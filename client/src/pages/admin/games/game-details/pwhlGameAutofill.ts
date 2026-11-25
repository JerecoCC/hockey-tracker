import axios from 'axios';
import type { GameRecord, GameType } from '@/hooks/useGames';
import type { GameAutofillProgress } from './gameAutofillTypes';
import {
  validateAutofillGamePreflight,
  type AutofillOfficialGameMeta,
} from './gameAutofillPreflight';
import { API, authHeaders, getDetailedApiErrorMessage as apiError } from '@/lib/apiClient';

const PWHL_BASE_URL = 'https://lscluster.hockeytech.com/feed/index.php';
const PWHL_APP_KEY = '446521baf8c38984';
const PWHL_CLIENT_CODE = 'pwhl';
const PWHL_LEAGUE_ID = '1';

interface PwhlTeamRow {
  info?: {
    id?: string | number | null;
    name?: string | null;
    abbreviation?: string | null;
  } | null;
  /** Team totals; `goals` is the final score, a shootout win counting as one goal. */
  stats?: { goals?: string | number | null } | null;
}

interface PwhlAutofillSummaryMeta {
  details?: {
    gameNumber?: string | number | null;
    GameNumber?: string | number | null;
    game_number?: string | number | null;
    round?: string | number | null;
    Round?: string | number | null;
    playoffRound?: string | number | null;
    PlayoffRound?: string | number | null;
    gameType?: string | null;
    GameType?: string | null;
    type?: string | null;
    started?: string | number | null;
    final?: string | number | null;
    /** "Final", "Final OT1", "Final SO", or a live status. */
    status?: string | null;
    GameDateISO8601?: string | null;
    date?: string | null;
  } | null;
  visitingTeam?: PwhlTeamRow | null;
  homeTeam?: PwhlTeamRow | null;
  periods?: OneOrMany<{ info?: { id?: string | number | null } | null }>;
  hasShootout?: unknown;
}

type OneOrMany<T> = T | T[] | null;

export type PwhlGameState = 'final' | 'in_progress' | 'scheduled';

export interface PwhlAutofillResult {
  summary: {
    gameId: string;
    state: PwhlGameState;
    /** The final score saved on the game, or null when it isn't final yet. */
    finalScore: { away: number; home: number } | null;
    /** How a final game was decided. */
    decidedIn: 'regulation' | 'overtime' | 'shootout' | null;
  };
  /** A one-line description of what was saved, for the success toast. */
  message: string;
  warnings: string[];
}

interface PwhlAutofillOptions {
  onProgress?: (progress: GameAutofillProgress) => void | Promise<void>;
}

async function emitAutofillProgress(
  onProgress: PwhlAutofillOptions['onProgress'],
  progress: GameAutofillProgress,
) {
  if (!onProgress) return;
  await onProgress({ leagueLabel: 'PWHL', ...progress });
}

/**
 * Fills a game from PWHL HockeyTech data. The app only tracks a game's schedule and result, so
 * this saves its date and time, its status and, once it's final, its final score and whether it
 * went to overtime or a shootout. Rosters, goals, shots, goalies and stars aren't filled.
 */
export async function autofillGameFromPwhlGamecenter(
  game: GameRecord,
  input: string,
  options: PwhlAutofillOptions = {},
): Promise<PwhlAutofillResult> {
  const emitProgress = (progress: GameAutofillProgress) =>
    emitAutofillProgress(options.onProgress, progress);
  const gameId = buildPwhlGameId(input);
  if (!gameId) {
    throw new Error('Enter a PWHL game ID or PWHL game-center URL.');
  }

  await emitProgress({
    step: 'fetch',
    message: `Fetching PWHL HockeyTech data for game ${gameId}...`,
  });
  const summary = await fetchPwhlJson<PwhlAutofillSummaryMeta>(pwhlFeedUrl(gameId));

  await emitProgress({
    step: 'match',
    message: 'Matching PWHL date and teams...',
  });
  assertGameMatches(game, summary);
  await validatePwhlAutofillPreflight(game, summary);

  const state = pwhlGameState(summary);
  const schedule = {
    league_game_number: gameId,
    scheduled_at: gameDateOnly(summary) ?? undefined,
    scheduled_time: scheduledTimeFromIso(summary?.details?.GameDateISO8601) ?? undefined,
  };
  const matchup = `${game.away_team.code} @ ${game.home_team.code}`;
  const warnings: string[] = [];
  let finalScore: PwhlAutofillResult['summary']['finalScore'] = null;
  let decidedIn: PwhlAutofillResult['summary']['decidedIn'] = null;
  let message: string;

  await emitProgress({ step: 'final', message: 'Saving the game...' });
  if (state === 'final') {
    finalScore = pwhlFinalScore(summary);
    const shootout = isShootoutGame(summary);
    const overtimePeriods = getOvertimePeriods(summary);
    decidedIn = shootout ? 'shootout' : overtimePeriods > 0 ? 'overtime' : 'regulation';
    await apiPatch(`/admin/games/${game.id}`, {
      ...schedule,
      status: 'final',
      current_period: getCurrentPeriod(summary),
      overtime_periods: overtimePeriods,
      shootout,
      final_home_score: finalScore.home,
      final_away_score: finalScore.away,
    });
    const suffix = decidedIn === 'shootout' ? ' (SO)' : decidedIn === 'overtime' ? ' (OT)' : '';
    message = `Filled PWHL game ${gameId}: ${game.away_team.code} ${finalScore.away}, ${game.home_team.code} ${finalScore.home}${suffix}.`;
  } else if (state === 'in_progress') {
    await apiPatch(`/admin/games/${game.id}`, { ...schedule, status: 'in_progress' });
    message = `PWHL game ${gameId} (${matchup}) is in progress.`;
    warnings.push("It isn't final yet, so no final score was saved.");
  } else {
    await apiPatch(`/admin/games/${game.id}`, schedule);
    message = `PWHL game ${gameId} (${matchup}) hasn't started; its date and time were updated.`;
  }

  await emitProgress({ step: 'complete', message: 'PWHL auto-fill complete.', refresh: true });

  return { summary: { gameId, state, finalScore, decidedIn }, message, warnings };
}

function buildPwhlGameId(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const queryMatch = trimmed.match(/[?&]game_id=(\d+)/i);
  if (queryMatch) return queryMatch[1];

  try {
    const url = new URL(trimmed);
    const gameId = url.searchParams.get('game_id');
    if (gameId && /^\d+$/.test(gameId)) return gameId;
  } catch {
    // Plain game ids are handled below.
  }

  const numeric = trimmed.match(/^\d+$/);
  return numeric ? numeric[0] : null;
}

function pwhlFeedUrl(gameId: string) {
  const params = new URLSearchParams({
    feed: 'statviewfeed',
    view: 'gameSummary',
    game_id: gameId,
    key: PWHL_APP_KEY,
    client_code: PWHL_CLIENT_CODE,
    lang: 'en',
    league_id: PWHL_LEAGUE_ID,
    fmt: 'json',
    site_id: '0',
  });
  return `${PWHL_BASE_URL}?${params.toString()}`;
}

async function fetchPwhlJson<T>(url: string) {
  const { data } = await axios.get<T>(`${API}/admin/games/pwhl-api`, {
    headers: authHeaders(),
    params: { url },
  });
  return data;
}

async function apiGet<T>(path: string): Promise<T> {
  const { data } = await axios.get<T>(`${API}${path}`, { headers: authHeaders() });
  return data;
}

async function apiPatch(path: string, body: Record<string, unknown>) {
  const { data } = await axios.patch(`${API}${path}`, body, { headers: authHeaders() });
  return data;
}

async function validatePwhlAutofillPreflight(game: GameRecord, summary: PwhlAutofillSummaryMeta) {
  const seasonGames = await apiGet<GameRecord[]>(
    `/admin/games?season_id=${encodeURIComponent(game.season_id)}`,
  );
  validateAutofillGamePreflight(game, seasonGames, pwhlOfficialGameMeta(game, summary));
}

function assertGameMatches(game: GameRecord, summary: PwhlAutofillSummaryMeta) {
  const pwhlDate = gameDateOnly(summary);
  const localDates = localDateCandidates(game.scheduled_at);
  if (pwhlDate && localDates.length > 0 && !localDates.includes(pwhlDate)) {
    throw new Error(
      `PWHL game is scheduled for ${pwhlDate}, but this page is scheduled for ${localDates.join(' or ')}.`,
    );
  }

  const awayCode = normalizeCode(summary?.visitingTeam?.info?.abbreviation);
  const homeCode = normalizeCode(summary?.homeTeam?.info?.abbreviation);
  if (
    awayCode !== normalizeCode(game.away_team.code) ||
    homeCode !== normalizeCode(game.home_team.code)
  ) {
    throw new Error(
      `PWHL game is ${awayCode || '?'} @ ${homeCode || '?'}, but this page is ${game.away_team.code} @ ${game.home_team.code}.`,
    );
  }
}

function pwhlOfficialGameMeta(
  game: GameRecord,
  summary: PwhlAutofillSummaryMeta,
): AutofillOfficialGameMeta {
  const gameNumber = positiveIntegerFromText(
    summary?.details?.gameNumber ?? summary?.details?.GameNumber ?? summary?.details?.game_number,
  );

  return {
    leagueLabel: 'PWHL',
    gameType: pwhlGameType(summary),
    regularGameNumber: game.game_type === 'regular' ? gameNumber : null,
    playoffRound: positiveIntegerFromText(
      summary?.details?.round ??
        summary?.details?.Round ??
        summary?.details?.playoffRound ??
        summary?.details?.PlayoffRound,
    ),
    playoffGameNumberInSeries: game.game_type === 'playoff' ? gameNumber : null,
  };
}

function pwhlGameType(summary: PwhlAutofillSummaryMeta): GameType | null {
  const raw = String(
    summary?.details?.gameType ?? summary?.details?.GameType ?? summary?.details?.type ?? '',
  ).toLowerCase();

  if (/\b(preseason|pre-season|exhibition)\b/.test(raw)) return 'preseason';
  if (/\b(playoff|postseason|post-season)\b/.test(raw)) return 'playoff';
  if (/\b(regular|season)\b/.test(raw)) return 'regular';
  return null;
}

function pwhlGameState(summary: PwhlAutofillSummaryMeta): PwhlGameState {
  const details = summary?.details;
  if (isTruthy(details?.final) || /^final\b/i.test(String(details?.status ?? '').trim())) {
    return 'final';
  }
  return isTruthy(details?.started) ? 'in_progress' : 'scheduled';
}

function pwhlFinalScore(summary: PwhlAutofillSummaryMeta) {
  const away = nonNegativeInteger(summary?.visitingTeam?.stats?.goals);
  const home = nonNegativeInteger(summary?.homeTeam?.stats?.goals);
  if (away == null || home == null) {
    throw new Error('PWHL game summary did not include the final score.');
  }
  if (away === home) {
    throw new Error(`PWHL lists a tied final score (${away}-${home}), so it wasn't saved.`);
  }
  return { away, home };
}

function positiveIntegerFromText(value: string | number | null | undefined) {
  const number = nonNegativeInteger(value);
  return number != null && number > 0 ? number : null;
}

function nonNegativeInteger(value: string | number | null | undefined) {
  const text = String(value ?? '').trim();
  return /^\d+$/.test(text) ? Number(text) : null;
}

function isShootoutGame(summary: PwhlAutofillSummaryMeta) {
  return isTruthy(summary?.hasShootout) || /\bSO\b/i.test(String(summary?.details?.status ?? ''));
}

function getCurrentPeriod(summary: PwhlAutofillSummaryMeta) {
  if (isShootoutGame(summary)) return 'SO';
  return getOvertimePeriods(summary) > 0 ? 'OT' : '3';
}

/** Overtime periods played: periods beyond the third. A shootout follows at least one. */
function getOvertimePeriods(summary: PwhlAutofillSummaryMeta) {
  const maxPeriod = toArray(summary?.periods).reduce(
    (max, period) => Math.max(max, Number(period?.info?.id ?? 0) || 0),
    0,
  );
  if (isShootoutGame(summary)) return Math.max(1, maxPeriod - 3);
  return Math.max(0, maxPeriod - 3);
}

function gameDateOnly(summary: PwhlAutofillSummaryMeta) {
  const iso = summary?.details?.GameDateISO8601;
  if (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(iso)) return iso.slice(0, 10);
  const parsed = Date.parse(String(summary?.details?.date ?? ''));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : null;
}

function localDateCandidates(value: string | null | undefined) {
  if (!value) return [];
  const candidates = new Set<string>();
  const rawDate = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) candidates.add(rawDate);
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    candidates.add(parsed.toISOString().slice(0, 10));
    candidates.add(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(parsed),
    );
  }
  return [...candidates];
}

function scheduledTimeFromIso(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

function normalizeCode(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

function isTruthy(value: unknown) {
  return value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
}

function toArray<T = unknown>(value: T[] | T | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

export { apiError as pwhlAutofillApiError };
