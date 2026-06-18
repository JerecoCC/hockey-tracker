import axios, { AxiosError } from 'axios';
import type { GameRecord } from '@/hooks/useGames';
import type { GameRosterEntry } from '@/hooks/useGameRoster';
import type { GoalRecord, PostGoalData } from '@/hooks/useGameGoals';
import type { GoalieStatRecord, UpsertGoalieStatData } from '@/hooks/useGameGoalieStats';
import type { LineupPositionSlot } from '@/hooks/useGameLineup';
import {
  buildNhlGamecenterGameId,
  type NhlGameIdContext,
} from './nhlGoalieSwitchChecker';

const API = import.meta.env.VITE_API_URL || '/api';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

const apiError = (err: unknown, fallback: string): string =>
  (err as AxiosError<{ error: string }>).response?.data?.error
  ?? (err instanceof Error ? err.message : fallback);

type TeamSide = 'away' | 'home';

interface TeamPlayerRecord {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
  team_id: string;
  position: string | null;
}

interface NhlPlayer {
  playerId: number;
  sweaterNumber: number;
  name: string;
  group: 'forwards' | 'defense' | 'goalies';
}

interface MatchedPlayer extends NhlPlayer {
  localId: string;
}

interface ReportRosterPlayer {
  sweaterNumber: number;
  position: string;
  name: string;
  starter: boolean;
}

interface MatchedRosterPlayer {
  localId: string;
  sweaterNumber: number;
  name: string;
  position?: string;
  starter?: boolean;
}

interface NhlRosterReport {
  venue?: string;
  start?: NhlReportClock;
  end?: NhlReportClock;
  players: Record<TeamSide, ReportRosterPlayer[]>;
}

interface NhlGameSummaryReport {
  stars: NhlSummaryStar[];
}

interface NhlShootoutReport {
  attempts: NhlShootoutAttempt[];
}

interface NhlSummaryStar {
  rank: number;
  sweaterNumber?: number;
  teamCode?: string;
  name: string;
}

interface NhlShootoutAttempt {
  teamCode?: string;
  sweaterNumber?: number;
  name: string;
  scored: boolean;
}

interface NhlReportClock {
  clock: string;
  zone: string;
}

interface NhlGoal {
  teamSide: TeamSide;
  periodNumber: number;
  period: string;
  periodTime: string;
  goalType: string;
  emptyNet: boolean;
  penaltyShot: boolean;
  scorerId: number;
  assist1Id?: number | null;
  assist2Id?: number | null;
}

interface FillSummary {
  gameId: string;
  goalsCreated: number;
  rosterPlayers: number;
  periodShots: Array<{ period: string; away_shots: number; home_shots: number }>;
  goalieStats: number;
  starsSet: number;
  lineupsSet: number;
  shootoutAttempts: number;
  usedRosterReport: boolean;
}

export interface NhlAutofillResult {
  summary: FillSummary;
  warnings: string[];
}

export async function autofillGameFromNhlGamecenter(
  game: GameRecord,
  input: string,
): Promise<NhlAutofillResult> {
  const context: NhlGameIdContext = {
    seasonName: game.season_name,
    scheduledAt: game.scheduled_at,
    gameType: game.game_type,
  };
  const gamecenterId = buildNhlGamecenterGameId(input, context);
  if (!gamecenterId) {
    throw new Error('Enter an NHL game number, full GameCenter id, or GameCenter URL.');
  }

  const base = `https://api-web.nhle.com/v1/gamecenter/${gamecenterId}`;
  const rosterReportUrl = buildRosterReportUrl(gamecenterId);
  const gameSummaryReportUrl = buildGameSummaryReportUrl(gamecenterId);
  const shootoutReportUrl = buildShootoutReportUrl(gamecenterId);
  const [boxscore, playByPlay, rosterReport, gameSummaryReport, shootoutReport] = await Promise.all([
    fetchNhlJson(`${base}/boxscore`),
    fetchNhlJson(`${base}/play-by-play`),
    fetchOptionalRosterReport(rosterReportUrl),
    fetchOptionalGameSummaryReport(gameSummaryReportUrl),
    fetchOptionalShootoutReport(shootoutReportUrl),
  ]);
  const warnings: string[] = [];

  assertTeamsMatch(game, boxscore);
  const shootoutGame = isShootoutGame(boxscore);

  const [existingGoals, existingShootoutAttempts] = await Promise.all([
    apiGet<GoalRecord[]>(`/admin/games/${game.id}/goals`),
    shootoutGame ? apiGet<unknown[]>(`/admin/games/${game.id}/shootout-attempts`) : Promise.resolve([]),
  ]);
  if (existingGoals.length > 0) {
    throw new Error('This game already has goals. Remove them before using NHL autofill.');
  }
  if (existingShootoutAttempts.length > 0) {
    throw new Error('This game already has shootout attempts. Remove them before using NHL autofill.');
  }

  const [awayPlayers, homePlayers] = await Promise.all([
    fetchTeamPlayers(game.away_team.id, game.season_id, boxscore.gameDate ?? game.scheduled_at),
    fetchTeamPlayers(game.home_team.id, game.season_id, boxscore.gameDate ?? game.scheduled_at),
  ]);

  const nhlPlayers = {
    away: getNhlPlayers(boxscore, 'away'),
    home: getNhlPlayers(boxscore, 'home'),
  };
  const matched = {
    away: matchNhlPlayers(nhlPlayers.away, awayPlayers, game.away_team.code),
    home: matchNhlPlayers(nhlPlayers.home, homePlayers, game.home_team.code),
  };
  if (matched.away.length === 0 || matched.home.length === 0) {
    throw new Error('NHL boxscore did not include dressed player stats for both teams.');
  }

  const rosterMatched = rosterReport
    ? {
        away: matchReportPlayers(rosterReport.players.away, awayPlayers, game.away_team.code),
        home: matchReportPlayers(rosterReport.players.home, homePlayers, game.home_team.code),
      }
    : matched;

  await syncGameRoster(game, rosterMatched);
  const lineupsSet = rosterReport
    ? await syncStartingLineups(game, rosterMatched, warnings)
    : 0;

  const allMatchedByNhlId = new Map<number, MatchedPlayer>();
  [...matched.away, ...matched.home].forEach((player) => {
    allMatchedByNhlId.set(player.playerId, player);
  });

  const goals = getNhlGoals(playByPlay, boxscore);
  const reportTimes = rosterReport
    ? inferReportTimes(rosterReport, boxscore.gameDate ?? game.scheduled_at, boxscore.startTimeUTC)
    : {};

  await apiPatch(`/admin/games/${game.id}`, {
    scheduled_at: boxscore.gameDate ?? undefined,
    scheduled_time: boxscore.startTimeUTC ? easternScheduledTime(boxscore.startTimeUTC) : undefined,
    venue: rosterReport?.venue ?? readText(boxscore.venue) ?? undefined,
    status: 'in_progress',
    current_period: '1',
    shootout: shootoutGame,
    time_start: reportTimes.startIso ?? undefined,
  });

  const goalsByPeriod = groupGoalsByPeriodNumber(goals);
  for (const periodNumber of getPlayedPeriodNumbers(boxscore, goals, shootoutGame)) {
    await apiPatch(`/admin/games/${game.id}`, gameProgressPatchForPeriod(periodNumber));

    for (const goal of goalsByPeriod.get(periodNumber) ?? []) {
      const teamId = goal.teamSide === 'away' ? game.away_team.id : game.home_team.id;
      const scorer = allMatchedByNhlId.get(goal.scorerId);
      if (!scorer) throw new Error(`Could not match NHL scorer ${goal.scorerId}.`);

      await apiPost<GoalRecord, PostGoalData>(`/admin/games/${game.id}/goals`, {
        team_id: teamId,
        period: goal.period,
        period_time: goal.periodTime,
        goal_type: goal.goalType,
        empty_net: goal.emptyNet,
        penalty_shot: goal.penaltyShot,
        scorer_id: scorer.localId,
        assist_1_id: resolveOptionalPlayerId(goal.assist1Id, allMatchedByNhlId),
        assist_2_id: resolveOptionalPlayerId(goal.assist2Id, allMatchedByNhlId),
      });
    }
  }

  const shootoutAttempts = shootoutGame
    ? resolveShootoutAttempts(shootoutReport?.attempts ?? [], matched, game)
    : [];
  if (shootoutGame && shootoutAttempts.length === 0) {
    throw new Error('NHL shootout report could not be parsed into shootout attempts.');
  }
  if (shootoutGame) {
    await apiPatch(`/admin/games/${game.id}`, {
      current_period: 'SO',
      shootout: true,
      shootout_first_team_id: shootoutAttempts[0]?.team_id,
    });
    for (const attempt of shootoutAttempts) {
      await apiPost<unknown, { team_id: string; shooter_id: string; scored: boolean }>(
        `/admin/games/${game.id}/shootout-attempts`,
        attempt,
      );
    }
  }

  const periodShots = getPeriodShots(playByPlay, boxscore);
  for (const row of periodShots) {
    await apiPatch(`/admin/games/${game.id}/shots`, row);
  }

  const goalieStats = getGoalieStats(game, boxscore, matched);
  for (const stat of goalieStats) {
    await apiPut<GoalieStatRecord, UpsertGoalieStatData>(
      `/admin/games/${game.id}/goalie-stats`,
      stat,
    );
  }

  const reportStars = gameSummaryReport
    ? resolveSummaryStars(gameSummaryReport.stars, matched, game)
    : [];
  const inferredStars = inferStars(boxscore, goals, matched);
  const stars = [...new Set([...reportStars, ...inferredStars])].slice(0, 3);
  await apiPatch(`/admin/games/${game.id}`, {
    scheduled_at: boxscore.gameDate ?? undefined,
    scheduled_time: boxscore.startTimeUTC ? easternScheduledTime(boxscore.startTimeUTC) : undefined,
    venue: rosterReport?.venue ?? readText(boxscore.venue) ?? undefined,
    status: 'final',
    current_period: getCurrentPeriod(boxscore, goals),
    overtime_periods: getOvertimePeriods(boxscore, goals),
    shootout: shootoutGame,
    shootout_first_team_id: shootoutGame ? shootoutAttempts[0]?.team_id : undefined,
    time_start: reportTimes.startIso ?? undefined,
    time_end: reportTimes.endIso ?? undefined,
    star_1_id: stars[0] ?? undefined,
    star_2_id: stars[1] ?? undefined,
    star_3_id: stars[2] ?? undefined,
  });

  if (stars.length < 3) warnings.push('Less than three stars could be inferred from matched players.');
  if (gameSummaryReport && reportStars.length < Math.min(3, gameSummaryReport.stars.length)) {
    warnings.push('NHL game summary stars were found, but not all could be matched to local players.');
  }
  if (!rosterReport) {
    warnings.push('NHL roster report was unavailable, so roster data came from the GameCenter boxscore.');
  } else if (!reportTimes.startIso || !reportTimes.endIso) {
    warnings.push('NHL roster report was found, but actual start/end times could not be parsed.');
  }
  if (shootoutGame && !shootoutReport) {
    warnings.push('NHL shootout report was unavailable or empty.');
  }

  return {
    warnings,
    summary: {
      gameId: gamecenterId,
      goalsCreated: goals.length,
      rosterPlayers: rosterMatched.away.length + rosterMatched.home.length,
      periodShots,
      goalieStats: goalieStats.length,
      starsSet: stars.length,
      lineupsSet,
      shootoutAttempts: shootoutAttempts.length,
      usedRosterReport: !!rosterReport,
    },
  };
}

async function fetchNhlJson(url: string) {
  const { data } = await axios.get(`${API}/admin/games/nhl-api`, {
    headers: authHeaders(),
    params: { url },
  });
  return data;
}

async function fetchOptionalRosterReport(url: string): Promise<NhlRosterReport | null> {
  try {
    const { data } = await axios.get<string>(`${API}/admin/games/nhl-api`, {
      headers: authHeaders(),
      params: { url },
      responseType: 'text',
    });
    return parseNhlRosterReport(String(data ?? ''));
  } catch {
    return null;
  }
}

async function fetchOptionalGameSummaryReport(url: string): Promise<NhlGameSummaryReport | null> {
  try {
    const { data } = await axios.get<string>(`${API}/admin/games/nhl-api`, {
      headers: authHeaders(),
      params: { url },
      responseType: 'text',
    });
    return parseNhlGameSummaryReport(String(data ?? ''));
  } catch {
    return null;
  }
}

async function fetchOptionalShootoutReport(url: string): Promise<NhlShootoutReport | null> {
  try {
    const { data } = await axios.get<string>(`${API}/admin/games/nhl-api`, {
      headers: authHeaders(),
      params: { url },
      responseType: 'text',
    });
    return parseNhlShootoutReport(String(data ?? ''));
  } catch {
    return null;
  }
}

function buildRosterReportUrl(gamecenterId: string) {
  const seasonStart = gamecenterId.slice(0, 4);
  const seasonEnd = String(Number(seasonStart) + 1);
  return `https://www.nhl.com/scores/htmlreports/${seasonStart}${seasonEnd}/RO${gamecenterId.slice(4)}.HTM`;
}

function buildGameSummaryReportUrl(gamecenterId: string) {
  const seasonStart = gamecenterId.slice(0, 4);
  const seasonEnd = String(Number(seasonStart) + 1);
  return `https://www.nhl.com/scores/htmlreports/${seasonStart}${seasonEnd}/GS${gamecenterId.slice(4)}.HTM`;
}

function buildShootoutReportUrl(gamecenterId: string) {
  const seasonStart = gamecenterId.slice(0, 4);
  const seasonEnd = String(Number(seasonStart) + 1);
  return `https://www.nhl.com/scores/htmlreports/${seasonStart}${seasonEnd}/SO${gamecenterId.slice(4)}.HTM`;
}

async function apiGet<T>(path: string): Promise<T> {
  const { data } = await axios.get<T>(`${API}${path}`, { headers: authHeaders() });
  return data;
}

async function apiPost<TResponse, TBody>(path: string, body: TBody): Promise<TResponse> {
  const { data } = await axios.post<TResponse>(`${API}${path}`, body, { headers: authHeaders() });
  return data;
}

async function apiPut<TResponse, TBody>(path: string, body: TBody): Promise<TResponse> {
  const { data } = await axios.put<TResponse>(`${API}${path}`, body, { headers: authHeaders() });
  return data;
}

async function apiPatch(path: string, body: Record<string, unknown>) {
  const { data } = await axios.patch(`${API}${path}`, body, { headers: authHeaders() });
  return data;
}

async function apiDelete(path: string) {
  await axios.delete(`${API}${path}`, { headers: authHeaders() });
}

async function fetchTeamPlayers(
  teamId: string,
  seasonId: string,
  gameDate: string | null | undefined,
): Promise<TeamPlayerRecord[]> {
  const { data } = await axios.get<TeamPlayerRecord[]>(`${API}/admin/players`, {
    headers: authHeaders(),
    params: {
      team_id: teamId,
      season_id: seasonId,
      game_date: gameDate?.slice(0, 10),
      include_prospects: 'true',
    },
  });
  return data;
}

function assertTeamsMatch(game: GameRecord, boxscore: any) {
  const awayCode = readText(boxscore?.awayTeam?.abbrev) ?? boxscore?.awayTeam?.abbrev;
  const homeCode = readText(boxscore?.homeTeam?.abbrev) ?? boxscore?.homeTeam?.abbrev;
  if (awayCode !== game.away_team.code || homeCode !== game.home_team.code) {
    throw new Error(
      `NHL game is ${awayCode} @ ${homeCode}, but this page is ${game.away_team.code} @ ${game.home_team.code}.`,
    );
  }
}

function isShootoutGame(boxscore: any) {
  return (
    String(boxscore?.gameOutcome?.lastPeriodType ?? '').toUpperCase() === 'SO' ||
    String(boxscore?.periodDescriptor?.periodType ?? '').toUpperCase() === 'SO'
  );
}

function getNhlPlayers(boxscore: any, side: TeamSide): NhlPlayer[] {
  const stats = boxscore?.playerByGameStats?.[`${side}Team`] ?? {};
  return (['forwards', 'defense', 'goalies'] as const).flatMap((group) =>
    Array.isArray(stats[group])
      ? stats[group].map((player: any) => ({
          playerId: Number(player.playerId),
          sweaterNumber: Number(player.sweaterNumber),
          name: [readText(player.firstName), readText(player.lastName)].filter(Boolean).join(' '),
          group,
        }))
      : [],
  );
}

function matchNhlPlayers(
  nhlPlayers: NhlPlayer[],
  localPlayers: TeamPlayerRecord[],
  teamCode: string,
): MatchedPlayer[] {
  const localByJersey = new Map<number, TeamPlayerRecord[]>();
  localPlayers.forEach((player) => {
    if (player.jersey_number == null) return;
    const rows = localByJersey.get(player.jersey_number) ?? [];
    rows.push(player);
    localByJersey.set(player.jersey_number, rows);
  });

  const missing: string[] = [];
  const matched = nhlPlayers.flatMap((nhlPlayer) => {
    const rows = localByJersey.get(nhlPlayer.sweaterNumber) ?? [];
    const local = rows[0];
    if (!local) {
      missing.push(`#${nhlPlayer.sweaterNumber} ${nhlPlayer.name || `NHL ${nhlPlayer.playerId}`}`);
      return [];
    }
    return [{ ...nhlPlayer, localId: local.id }];
  });

  if (missing.length > 0) {
    throw new Error(`Missing ${teamCode} player matches: ${missing.join(', ')}.`);
  }
  return matched;
}

function matchReportPlayers(
  reportPlayers: ReportRosterPlayer[],
  localPlayers: TeamPlayerRecord[],
  teamCode: string,
): MatchedRosterPlayer[] {
  const localByJersey = localPlayersByJersey(localPlayers);
  const missing: string[] = [];
  const matched = reportPlayers.flatMap((reportPlayer) => {
    const local = (localByJersey.get(reportPlayer.sweaterNumber) ?? [])[0];
    if (!local) {
      missing.push(`#${reportPlayer.sweaterNumber} ${reportPlayer.name}`);
      return [];
    }
    return [{ ...reportPlayer, localId: local.id }];
  });

  if (missing.length > 0) {
    throw new Error(`Missing ${teamCode} roster report player matches: ${missing.join(', ')}.`);
  }
  return matched;
}

function localPlayersByJersey(localPlayers: TeamPlayerRecord[]) {
  const localByJersey = new Map<number, TeamPlayerRecord[]>();
  localPlayers.forEach((player) => {
    if (player.jersey_number == null) return;
    const rows = localByJersey.get(player.jersey_number) ?? [];
    rows.push(player);
    localByJersey.set(player.jersey_number, rows);
  });
  return localByJersey;
}

function parseNhlRosterReport(html: string): NhlRosterReport | null {
  if (!html.trim()) return null;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const rosterTables = findRosterTables(doc);
  if (rosterTables.length < 2) return null;

  return {
    ...parseReportGameInfo(doc),
    players: {
      away: parseRosterTable(rosterTables[0]),
      home: parseRosterTable(rosterTables[1]),
    },
  };
}

function parseNhlGameSummaryReport(html: string): NhlGameSummaryReport | null {
  if (!html.trim()) return null;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const stars = parseSummaryStars(doc);
  return stars.length > 0 ? { stars: stars.slice(0, 3) } : null;
}

function parseNhlShootoutReport(html: string): NhlShootoutReport | null {
  if (!html.trim()) return null;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const attempts = parseShootoutAttempts(doc);
  return attempts.length > 0 ? { attempts } : null;
}

function findRosterTables(doc: Document) {
  return [...doc.querySelectorAll('table')].filter((table) => {
    const headers = [...table.querySelectorAll('th')].map((cell) => normalizeReportText(cell.textContent));
    return headers.includes('#') && headers.includes('Pos') && headers.includes('Name');
  }).slice(0, 2);
}

function parseRosterTable(table: Element): ReportRosterPlayer[] {
  return [...table.querySelectorAll('tr')].flatMap((row) => {
    const cells = [...row.querySelectorAll('td')];
    if (cells.length < 3) return [];
    const sweaterNumber = Number(normalizeReportText(cells[0].textContent));
    if (!Number.isFinite(sweaterNumber)) return [];
    return [{
      sweaterNumber,
      position: normalizeReportText(cells[1].textContent),
      name: normalizeReportPlayerName(cells[2].textContent),
      starter: cells.some((cell) => cell.classList.contains('bold')),
    }];
  });
}

function parseShootoutAttempts(doc: Document): NhlShootoutAttempt[] {
  const tables = [...doc.querySelectorAll('table')];
  const candidateTables = tables.filter((table) => {
    const text = normalizeReportText(table.textContent);
    return /shootout|attempt|result|shooter|scored|saved|missed|goal/i.test(text);
  });
  const tablesToParse = candidateTables.length > 0 ? candidateTables : tables;
  const attempts = tablesToParse.flatMap(parseShootoutAttemptRows);
  return attempts.length > 0 ? attempts : parseShootoutAttemptLines(doc);
}

function parseShootoutAttemptRows(table: Element): NhlShootoutAttempt[] {
  const rows = [...table.querySelectorAll('tr')].map((row) =>
    [...row.querySelectorAll('td, th')].map((cell) => normalizeReportText(cell.textContent)).filter(Boolean),
  );
  const headerIndex = rows.findIndex((cells) =>
    cells.some((cell) => /shooter|player|result|attempt|team|club|#/i.test(cell)),
  );
  const headers = headerIndex >= 0 ? rows[headerIndex].map((cell) => cell.toLowerCase()) : [];
  const dataRows = rows.slice(headerIndex >= 0 ? headerIndex + 1 : 0);
  const attempts = dataRows
    .map((cells) => parseShootoutAttemptCells(cells, headers))
    .filter((attempt): attempt is NhlShootoutAttempt => !!attempt);
  return dedupeShootoutAttempts(attempts);
}

function parseShootoutAttemptLines(doc: Document): NhlShootoutAttempt[] {
  const lines = [...doc.querySelectorAll('td, th')]
    .map((cell) => normalizeReportText(cell.textContent))
    .filter(Boolean);
  return dedupeShootoutAttempts(
    lines
      .map((line) => parseShootoutAttemptCells([line], []))
      .filter((attempt): attempt is NhlShootoutAttempt => !!attempt),
  );
}

function parseShootoutAttemptCells(cells: string[], headers: string[]): NhlShootoutAttempt | null {
  const joined = cells.join(' ');
  if (!joined || /shootout|attempt|shooter|player|team|club|result/i.test(joined) && cells.length <= 2) {
    return null;
  }
  const resultText = readIndexedCell(cells, headers, /result|outcome|score/) ?? joined;
  const scored = shootoutResultScored(resultText);
  if (scored == null) return null;

  const tokens = joined.split(/\s+/);
  const teamCode =
    readIndexedCell(cells, headers, /team|club/) ??
    tokens.find((token) => isLikelyTeamCode(token));
  const sweaterNumber =
    readShootoutSweaterNumber(cells, headers) ??
    readExplicitSweaterNumber(cells);
  const nameCell =
    readIndexedCell(cells, headers, /shooter|player|name/) ??
    cells.map((cell) => cleanShootoutName(cell, teamCode, sweaterNumber))
      .find((cell) => isLikelyPlayerName(cell)) ??
    cleanShootoutName(joined, teamCode, sweaterNumber);

  return isLikelyPlayerName(nameCell)
    ? {
        teamCode,
        sweaterNumber,
        name: normalizeReportPlayerName(nameCell),
        scored,
      }
    : null;
}

function readIndexedCell(cells: string[], headers: string[], pattern: RegExp) {
  const index = headers.findIndex((header) => pattern.test(header));
  return index >= 0 ? cells[index] : undefined;
}

function readShootoutSweaterNumber(cells: string[], headers: string[]) {
  const indexed = readIndexedCell(cells, headers, /^#|no\.?|number/);
  if (indexed && /^\d{1,2}$/.test(indexed.replace('#', '').trim())) {
    return Number(indexed.replace('#', '').trim());
  }
  return undefined;
}

function readExplicitSweaterNumber(cells: string[]) {
  for (const cell of cells) {
    const match = cell.match(/#\s*(\d{1,2})\b/);
    if (match) return Number(match[1]);
  }
  return undefined;
}

function shootoutResultScored(value: string) {
  const text = normalizeReportText(value).toLowerCase();
  if (/\b(no goal|miss|missed|save|saved|stop|stopped|fail|failed)\b/.test(text)) return false;
  if (/\b(goal|scored|score|made|good)\b/.test(text)) return true;
  return null;
}

function cleanShootoutName(value: string, teamCode?: string, sweaterNumber?: number) {
  let text = normalizeReportText(value)
    .replace(/\b(no goal|missed?|saved?|stopped?|failed?|scored?|goal|made|good|result|attempt|shootout)\b/gi, ' ')
    .replace(/\b(?:team|club|shooter|player|name|no\.?|#)\b/gi, ' ');
  if (teamCode) text = text.replace(new RegExp(`\\b${teamCode}\\b`, 'g'), ' ');
  if (sweaterNumber != null) text = text.replace(new RegExp(`\\b#?${sweaterNumber}\\b`, 'g'), ' ');
  return normalizeReportPlayerName(text);
}

function dedupeShootoutAttempts(attempts: NhlShootoutAttempt[]) {
  const seen = new Set<string>();
  return attempts.filter((attempt) => {
    const key = `${attempt.teamCode ?? ''}|${attempt.sweaterNumber ?? ''}|${normalizeNameKey(attempt.name)}|${attempt.scored}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseSummaryStars(doc: Document): NhlSummaryStar[] {
  const starTable = [...doc.querySelectorAll('table')].find((table) =>
    /(?:three|3)\s+stars/i.test(normalizeReportText(table.textContent)),
  );
  const tableStars = starTable ? parseSummaryStarRows(starTable) : [];
  if (tableStars.length > 0) return tableStars;

  const lines = [...doc.querySelectorAll('td, th')]
    .map((cell) => normalizeReportText(cell.textContent))
    .filter(Boolean);
  const markerIndex = lines.findIndex((line) => /(?:three|3)\s+stars/i.test(line));
  return markerIndex >= 0 ? parseSummaryStarLines(lines.slice(markerIndex + 1, markerIndex + 20)) : [];
}

function parseSummaryStarRows(table: Element): NhlSummaryStar[] {
  const stars: NhlSummaryStar[] = [];
  for (const row of table.querySelectorAll('tr')) {
    const cells = [...row.querySelectorAll('td, th')]
      .map((cell) => normalizeReportText(cell.textContent))
      .filter(Boolean);
    const star = parseSummaryStarCells(cells);
    if (star && !stars.some((existing) => existing.rank === star.rank)) stars.push(star);
  }
  return stars.sort((a, b) => a.rank - b.rank);
}

function parseSummaryStarLines(lines: string[]): NhlSummaryStar[] {
  const stars: NhlSummaryStar[] = [];
  for (const line of lines) {
    const star = parseSummaryStarCells([line]);
    if (star && !stars.some((existing) => existing.rank === star.rank)) stars.push(star);
    if (stars.length >= 3) break;
  }
  return stars.sort((a, b) => a.rank - b.rank);
}

function parseSummaryStarCells(cells: string[]): NhlSummaryStar | null {
  const joined = cells.join(' ');
  if (
    !joined ||
    /^(?:three|3)\s+stars/i.test(joined) ||
    /^(?:star|player|team|no\.?|#)$/i.test(joined)
  ) {
    return null;
  }

  const rank = readStarRank(cells) ?? readStarRank([joined]);
  if (!rank) return null;

  const tokens = joined.split(/\s+/);
  const teamCode = cells.find((cell) => isLikelyTeamCode(cell)) ?? tokens.find((token) => isLikelyTeamCode(token));
  const sweaterNumber = readSweaterNumber(cells, rank) ?? readSweaterNumber(tokens, rank);
  const name =
    cells.map((cell) => cleanSummaryStarName(cell, rank, teamCode, sweaterNumber))
      .find((cell) => isLikelyPlayerName(cell))
    ?? cleanSummaryStarName(joined, rank, teamCode, sweaterNumber);

  return isLikelyPlayerName(name)
    ? {
        rank,
        sweaterNumber,
        teamCode,
        name: normalizeReportPlayerName(name),
      }
    : null;
}

function readStarRank(cells: string[]) {
  for (const cell of cells) {
    const match = cell.match(/(?:^|\b)([123])(?:st|nd|rd)?(?:\s+star|\.)?(?:\b|$)/i);
    if (match) return Number(match[1]);
  }
  return null;
}

function readSweaterNumber(cells: string[], rank: number) {
  for (const cell of cells) {
    const normalized = cell.replace('#', '').trim();
    if (!/^\d{1,2}$/.test(normalized)) continue;
    const value = Number(normalized);
    if (value !== rank) return value;
  }
  return undefined;
}

function cleanSummaryStarName(
  value: string,
  rank: number,
  teamCode?: string,
  sweaterNumber?: number,
) {
  let text = normalizeReportText(value)
    .replace(new RegExp(`\\b${rank}(?:st|nd|rd)?(?:\\s+star|\\.)?\\b`, 'i'), ' ')
    .replace(/\b(?:star|player|team|no\.?|#)\b/gi, ' ');
  if (teamCode) text = text.replace(new RegExp(`\\b${teamCode}\\b`, 'g'), ' ');
  if (sweaterNumber != null) text = text.replace(new RegExp(`\\b#?${sweaterNumber}\\b`, 'g'), ' ');
  return normalizeReportPlayerName(text);
}

function isLikelyTeamCode(value: string) {
  return /^[A-Z]{2,4}$/.test(value) && !['STAR', 'TEAM', 'NO', 'POS', 'NAME'].includes(value);
}

function isLikelyPlayerName(value: string | undefined) {
  return !!value && /[A-Za-z]/.test(value) && !isLikelyTeamCode(value) && !/^\d+$/.test(value);
}

function parseReportGameInfo(doc: Document): Pick<NhlRosterReport, 'venue' | 'start' | 'end'> {
  const lines = [...doc.querySelectorAll('#GameInfo td')]
    .map((cell) => normalizeReportText(cell.textContent))
    .filter(Boolean);
  const attendanceLine = lines.find((line) => /\bAttendance\b/i.test(line));
  const timeLine = lines.find((line) => /\bStart\b/i.test(line) && /\bEnd\b/i.test(line));
  const attendanceMatch = attendanceLine?.match(/\bAttendance\s+[\d,]+\s+at\s+(.+)$/i);
  const timeMatch = timeLine?.match(
    /\bStart\s+(\d{1,2}:\d{2})\s+([A-Z]{2,4})\s*;\s*End\s+(\d{1,2}:\d{2})\s+([A-Z]{2,4})/i,
  );

  return {
    venue: attendanceMatch?.[1]?.trim(),
    start: timeMatch ? { clock: timeMatch[1], zone: timeMatch[2].toUpperCase() } : undefined,
    end: timeMatch ? { clock: timeMatch[3], zone: timeMatch[4].toUpperCase() } : undefined,
  };
}

function normalizeReportText(value: string | null | undefined) {
  return String(value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeReportPlayerName(value: string | null | undefined) {
  return normalizeReportText(value).replace(/\s+\([AC]\)$/i, '');
}

function resolveOptionalPlayerId(
  nhlPlayerId: number | null | undefined,
  playersByNhlId: Map<number, MatchedPlayer>,
) {
  if (!nhlPlayerId) return null;
  const player = playersByNhlId.get(nhlPlayerId);
  if (!player) throw new Error(`Could not match NHL player ${nhlPlayerId}.`);
  return player.localId;
}

async function syncGameRoster(
  game: GameRecord,
  matched: Record<TeamSide, Array<{ localId: string }>>,
) {
  const desired = {
    away: new Set(matched.away.map((player) => player.localId)),
    home: new Set(matched.home.map((player) => player.localId)),
  };

  await apiPost<GameRosterEntry[], { team_id: string; player_ids: string[] }>(
    `/admin/games/${game.id}/roster`,
    { team_id: game.away_team.id, player_ids: [...desired.away] },
  );
  await apiPost<GameRosterEntry[], { team_id: string; player_ids: string[] }>(
    `/admin/games/${game.id}/roster`,
    { team_id: game.home_team.id, player_ids: [...desired.home] },
  );

  const latestRoster = await apiGet<GameRosterEntry[]>(`/admin/games/${game.id}/roster`);
  for (const entry of latestRoster) {
    if (entry.inherited) continue;
    const side =
      entry.team_id === game.away_team.id
        ? 'away'
        : entry.team_id === game.home_team.id
          ? 'home'
          : null;
    if (!side) continue;
    if (!desired[side].has(entry.player_id)) {
      await apiDelete(`/admin/games/${game.id}/roster/${entry.id}`);
    }
  }
}

async function syncStartingLineups(
  game: GameRecord,
  matched: Record<TeamSide, MatchedRosterPlayer[]>,
  warnings: string[],
) {
  let saved = 0;
  for (const side of ['away', 'home'] as const) {
    const slots = buildStartingLineupSlots(matched[side]);
    if (!slots) {
      const teamCode = side === 'away' ? game.away_team.code : game.home_team.code;
      warnings.push(`Could not find a complete bold starting lineup for ${teamCode} in the NHL roster report.`);
      continue;
    }
    await apiPut<unknown, { team_id: string; slots: Array<{ position_slot: LineupPositionSlot; player_id: string }> }>(
      `/admin/games/${game.id}/lineup`,
      {
        team_id: side === 'away' ? game.away_team.id : game.home_team.id,
        slots,
      },
    );
    saved += 1;
  }
  return saved;
}

function buildStartingLineupSlots(players: MatchedRosterPlayer[]) {
  const starters = players.filter((player) => player.starter);
  const forwards = starters.filter((player) => !['D', 'G'].includes(player.position ?? '')).slice(0, 3);
  const defense = starters.filter((player) => player.position === 'D').slice(0, 2);
  const goalie = starters.find((player) => player.position === 'G');
  if (forwards.length !== 3 || defense.length !== 2 || !goalie) return null;

  return [
    { position_slot: 'F1' as const, player_id: forwards[0].localId },
    { position_slot: 'F2' as const, player_id: forwards[1].localId },
    { position_slot: 'F3' as const, player_id: forwards[2].localId },
    { position_slot: 'D1' as const, player_id: defense[0].localId },
    { position_slot: 'D2' as const, player_id: defense[1].localId },
    { position_slot: 'G' as const, player_id: goalie.localId },
  ];
}

function getNhlGoals(playByPlay: any, boxscore: any): NhlGoal[] {
  return getPlays(playByPlay)
    .filter((play) => play.typeDescKey === 'goal' && !isShootoutPlay(play))
    .map((play) => {
      const ownerTeamId = Number(play.details?.eventOwnerTeamId);
      const periodNumber = Number(play.periodDescriptor?.number ?? 1);
      const teamSide = ownerTeamId === Number(boxscore.awayTeam?.id) ? 'away' : 'home';
      return {
        teamSide,
        periodNumber,
        period: nhlPeriodToLocal(periodNumber),
        periodTime: play.timeInPeriod,
        goalType: goalTypeFromSituation(play.situationCode, teamSide),
        emptyNet: !!play.details?.emptyNet,
        penaltyShot: !!play.details?.penaltyShot,
        scorerId: Number(play.details?.scoringPlayerId),
        assist1Id: toOptionalNumber(play.details?.assist1PlayerId),
        assist2Id: toOptionalNumber(play.details?.assist2PlayerId),
      };
    });
}

function groupGoalsByPeriodNumber(goals: NhlGoal[]) {
  const grouped = new Map<number, NhlGoal[]>();
  goals.forEach((goal) => {
    const rows = grouped.get(goal.periodNumber) ?? [];
    rows.push(goal);
    grouped.set(goal.periodNumber, rows);
  });
  return grouped;
}

function getPlayedPeriodNumbers(boxscore: any, goals: NhlGoal[], shootoutGame: boolean) {
  const maxGoalPeriod = goals.reduce((max, goal) => Math.max(max, goal.periodNumber), 0);
  const finalPeriod = Number(boxscore?.periodDescriptor?.number ?? (maxGoalPeriod || 3));
  if (shootoutGame) return [1, 2, 3, 4];
  const safeFinalPeriod = Math.max(1, Math.min(finalPeriod, 20));
  return Array.from({ length: safeFinalPeriod }, (_, index) => index + 1);
}

function gameProgressPatchForPeriod(periodNumber: number) {
  if (periodNumber <= 3) {
    return {
      current_period: String(periodNumber),
      overtime_periods: periodNumber === 1 ? 0 : undefined,
    };
  }
  return {
    current_period: 'OT',
    overtime_periods: periodNumber - 3,
  };
}

function getPeriodShots(playByPlay: any, boxscore: any) {
  const shots = new Map<string, { period: string; away_shots: number; home_shots: number }>();
  getPlays(playByPlay)
    .filter((play) => !isShootoutPlay(play) && (play.typeDescKey === 'goal' || play.typeDescKey === 'shot-on-goal'))
    .forEach((play) => {
      const period = nhlPeriodToLocal(play.periodDescriptor?.number);
      const row = shots.get(period) ?? { period, away_shots: 0, home_shots: 0 };
      const ownerTeamId = Number(play.details?.eventOwnerTeamId);
      if (ownerTeamId === Number(boxscore.awayTeam?.id)) row.away_shots += 1;
      if (ownerTeamId === Number(boxscore.homeTeam?.id)) row.home_shots += 1;
      shots.set(period, row);
    });
  return [...shots.values()];
}

function getGoalieStats(
  game: GameRecord,
  boxscore: any,
  matched: Record<TeamSide, MatchedPlayer[]>,
): UpsertGoalieStatData[] {
  return (['away', 'home'] as const).flatMap((side) => {
    const teamStats = boxscore?.playerByGameStats?.[`${side}Team`]?.goalies ?? [];
    const matchedByNhlId = new Map(matched[side].map((player) => [player.playerId, player]));
    return teamStats
      .filter((goalie: any) => goalieActuallyPlayed(goalie))
      .map((goalie: any) => ({
        goalie_id: matchedByNhlId.get(Number(goalie.playerId))!.localId,
        team_id: side === 'away' ? game.away_team.id : game.home_team.id,
        shots_against: Number(goalie.shotsAgainst ?? 0),
        goals_against: Number(goalie.goalsAgainst ?? 0),
      }));
  });
}

function inferStars(
  boxscore: any,
  goals: NhlGoal[],
  matched: Record<TeamSide, MatchedPlayer[]>,
): string[] {
  const winnerSide: TeamSide =
    Number(boxscore.awayTeam?.score ?? 0) > Number(boxscore.homeTeam?.score ?? 0) ? 'away' : 'home';
  const matchedByNhlId = new Map([...matched.away, ...matched.home].map((p) => [p.playerId, p]));
  const points = new Map<number, { playerId: number; points: number; goals: number; side: TeamSide }>();

  goals.forEach((goal) => {
    const scorer = points.get(goal.scorerId) ?? {
      playerId: goal.scorerId,
      points: 0,
      goals: 0,
      side: goal.teamSide,
    };
    scorer.points += 1;
    scorer.goals += 1;
    points.set(goal.scorerId, scorer);
    [goal.assist1Id, goal.assist2Id].forEach((assistId) => {
      if (!assistId) return;
      const assist = points.get(assistId) ?? {
        playerId: assistId,
        points: 0,
        goals: 0,
        side: goal.teamSide,
      };
      assist.points += 1;
      points.set(assistId, assist);
    });
  });

  const goalieStar = getWinningGoalie(boxscore, matched[winnerSide]);
  const skaterStars = [...points.values()]
    .sort(
      (a, b) =>
        Number(b.side === winnerSide) - Number(a.side === winnerSide) ||
        b.points - a.points ||
        b.goals - a.goals,
    )
    .map((row) => matchedByNhlId.get(row.playerId)?.localId)
    .filter((id): id is string => !!id);

  return [...new Set([goalieStar, ...skaterStars].filter((id): id is string => !!id))].slice(0, 3);
}

function resolveSummaryStars(
  stars: NhlSummaryStar[],
  matched: Record<TeamSide, MatchedPlayer[]>,
  game: GameRecord,
) {
  const candidates = [
    ...matched.away.map((player) => ({ ...player, teamCode: game.away_team.code })),
    ...matched.home.map((player) => ({ ...player, teamCode: game.home_team.code })),
  ];
  return stars
    .sort((a, b) => a.rank - b.rank)
    .map((star) => {
      const exactJerseyMatch =
        star.sweaterNumber != null
          ? candidates.find(
              (player) =>
                player.sweaterNumber === star.sweaterNumber &&
                (!star.teamCode || player.teamCode === star.teamCode),
            )
          : undefined;
      if (exactJerseyMatch) return exactJerseyMatch.localId;

      const normalizedStarName = normalizeNameKey(star.name);
      return candidates.find(
        (player) =>
          normalizeNameKey(player.name) === normalizedStarName &&
          (!star.teamCode || player.teamCode === star.teamCode),
      )?.localId;
    })
    .filter((id): id is string => !!id);
}

function resolveShootoutAttempts(
  attempts: NhlShootoutAttempt[],
  matched: Record<TeamSide, MatchedPlayer[]>,
  game: GameRecord,
) {
  const candidates = [
    ...matched.away.map((player) => ({
      ...player,
      teamCode: game.away_team.code,
      teamId: game.away_team.id,
    })),
    ...matched.home.map((player) => ({
      ...player,
      teamCode: game.home_team.code,
      teamId: game.home_team.id,
    })),
  ];

  return attempts.map((attempt) => {
    const jerseyMatch =
      attempt.sweaterNumber != null
        ? candidates.find(
            (player) =>
              player.sweaterNumber === attempt.sweaterNumber &&
              (!attempt.teamCode || player.teamCode === attempt.teamCode),
          )
        : undefined;
    const normalizedAttemptName = normalizeNameKey(attempt.name);
    const nameMatch = candidates.find(
      (player) =>
        normalizeNameKey(player.name) === normalizedAttemptName &&
        (!attempt.teamCode || player.teamCode === attempt.teamCode),
    );
    const player = jerseyMatch ?? nameMatch;
    if (!player) {
      throw new Error(`Could not match NHL shootout shooter ${attempt.name}.`);
    }
    return {
      team_id: player.teamId,
      shooter_id: player.localId,
      scored: attempt.scored,
    };
  });
}

function normalizeNameKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();
}

function getWinningGoalie(boxscore: any, matchedGoalies: MatchedPlayer[]) {
  const matchedByNhlId = new Map(matchedGoalies.map((goalie) => [goalie.playerId, goalie.localId]));
  const winningGoalies =
    Number(boxscore.awayTeam?.score ?? 0) > Number(boxscore.homeTeam?.score ?? 0)
      ? boxscore?.playerByGameStats?.awayTeam?.goalies
      : boxscore?.playerByGameStats?.homeTeam?.goalies;
  const goalie = Array.isArray(winningGoalies)
    ? winningGoalies.find((row: any) => goalieActuallyPlayed(row))
    : null;
  return goalie ? matchedByNhlId.get(Number(goalie.playerId)) : undefined;
}

function getCurrentPeriod(boxscore: any, goals: NhlGoal[]) {
  if (isShootoutGame(boxscore)) return 'SO';
  if (getOvertimePeriods(boxscore, goals) > 0) return 'OT';
  return '3';
}

function getOvertimePeriods(boxscore: any, goals: NhlGoal[]) {
  if (isShootoutGame(boxscore)) return 1;
  const maxGoalPeriod = goals.reduce((max, goal) => Math.max(max, localPeriodNumber(goal.period)), 0);
  const finalPeriod = Number(boxscore?.periodDescriptor?.number ?? maxGoalPeriod);
  return Math.max(0, finalPeriod - 3);
}

function easternScheduledTime(startTimeUTC: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(startTimeUTC));
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

const REPORT_TIMEZONE_OFFSETS: Record<string, string> = {
  ADT: '-03:00',
  AST: '-04:00',
  EDT: '-04:00',
  EST: '-05:00',
  CDT: '-05:00',
  CST: '-06:00',
  MDT: '-06:00',
  MST: '-07:00',
  PDT: '-07:00',
  PST: '-08:00',
};

function inferReportTimes(
  report: NhlRosterReport,
  gameDate: string | null | undefined,
  scheduledStartUTC: string | null | undefined,
) {
  const date = gameDate?.slice(0, 10);
  if (!date || !report.start || !report.end) return {};

  const startCandidates = reportClockCandidates(date, report.start);
  const scheduledMs = scheduledStartUTC ? Date.parse(scheduledStartUTC) : Number.NaN;
  const startIso = Number.isFinite(scheduledMs)
    ? closestIso(startCandidates, scheduledMs)
    : startCandidates.find((iso) => localHourFromIso(iso) >= 18) ?? startCandidates[0];
  if (!startIso) return {};

  const endIso = firstPlausibleEndIso(reportClockCandidates(date, report.end), Date.parse(startIso));
  return { startIso, endIso };
}

function reportClockCandidates(gameDate: string, time: NhlReportClock) {
  const offset = REPORT_TIMEZONE_OFFSETS[time.zone];
  const [rawHour, minute] = time.clock.split(':').map(Number);
  if (!offset || !Number.isFinite(rawHour) || !Number.isFinite(minute)) return [];

  const hours = rawHour === 12 ? [0, 12] : [rawHour, rawHour + 12];
  return [0, 1].flatMap((dayOffset) => {
    const candidateDate = shiftDate(gameDate, dayOffset);
    return hours.map((hour) => {
      const hh = String(hour).padStart(2, '0');
      const mm = String(minute).padStart(2, '0');
      return new Date(`${candidateDate}T${hh}:${mm}:00${offset}`).toISOString();
    });
  });
}

function closestIso(candidates: string[], targetMs: number) {
  return candidates
    .map((iso) => ({ iso, distance: Math.abs(Date.parse(iso) - targetMs) }))
    .sort((a, b) => a.distance - b.distance)[0]?.iso;
}

function firstPlausibleEndIso(candidates: string[], startMs: number) {
  const maxGameMs = 8 * 60 * 60 * 1000;
  return candidates
    .map((iso) => ({ iso, elapsed: Date.parse(iso) - startMs }))
    .filter(({ elapsed }) => elapsed > 0 && elapsed <= maxGameMs)
    .sort((a, b) => a.elapsed - b.elapsed)[0]?.iso;
}

function shiftDate(date: string, dayOffset: number) {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + dayOffset);
  return shifted.toISOString().slice(0, 10);
}

function localHourFromIso(iso: string) {
  return Number(iso.slice(11, 13));
}

function goalTypeFromSituation(situationCode: string | undefined, side: TeamSide) {
  if (!situationCode || situationCode.length < 4) return 'even-strength';
  const awaySkaters = Number(situationCode[1]);
  const homeSkaters = Number(situationCode[2]);
  if (!Number.isFinite(awaySkaters) || !Number.isFinite(homeSkaters)) return 'even-strength';

  const scoringSkaters = side === 'away' ? awaySkaters : homeSkaters;
  const defendingSkaters = side === 'away' ? homeSkaters : awaySkaters;
  if (scoringSkaters > defendingSkaters) return 'power-play';
  if (scoringSkaters < defendingSkaters) return 'short-handed';
  return 'even-strength';
}

function nhlPeriodToLocal(period: unknown) {
  const number = Number(period);
  if (number <= 3) return String(number);
  if (number === 4) return 'OT';
  return `OT${number - 3}`;
}

function localPeriodNumber(period: string) {
  if (period === 'OT') return 4;
  const otMatch = period.match(/^OT(\d+)$/);
  if (otMatch) return 3 + Number(otMatch[1]);
  return Number(period) || 0;
}

function getPlays(playByPlay: any): any[] {
  return Array.isArray(playByPlay?.plays) ? playByPlay.plays : [];
}

function isShootoutPlay(play: any) {
  return (
    String(play?.periodDescriptor?.periodType ?? '').toUpperCase() === 'SO' ||
    String(play?.periodDescriptor?.periodType ?? '').toLowerCase() === 'shootout'
  );
}

function goalieActuallyPlayed(goalie: any) {
  const toi = String(goalie?.toi ?? '').trim();
  return (
    (!!toi && toi !== '00:00' && toi !== '0:00') ||
    Number(goalie?.shotsAgainst ?? 0) > 0 ||
    Number(goalie?.saves ?? 0) > 0 ||
    Number(goalie?.goalsAgainst ?? 0) > 0
  );
}

function readText(value: any): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value?.default === 'string') return value.default;
  return undefined;
}

function toOptionalNumber(value: any): number | null {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export { apiError as nhlAutofillApiError };
