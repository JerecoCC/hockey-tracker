import axios, { AxiosError } from 'axios';
import type { GameRecord } from '@/hooks/useGames';
import type { GameRosterEntry } from '@/hooks/useGameRoster';
import type { GoalRecord, PostGoalData } from '@/hooks/useGameGoals';
import type { GoalieStatRecord } from '@/hooks/useGameGoalieStats';
import type { LineupPositionSlot } from '@/hooks/useGameLineup';
import type { ShootoutAttempt } from '@/hooks/useShootoutAttempts';
import {
  ManualPlayerMovementRequiredError,
  type GameAutofillManualMoveReport,
  type GameAutofillProgress,
} from './gameAutofillTypes';

const API = import.meta.env.VITE_API_URL || '/api';
const PWHL_BASE_URL = 'https://lscluster.hockeytech.com/feed/index.php';
const PWHL_APP_KEY = '446521baf8c38984';
const PWHL_CLIENT_CODE = 'pwhl';
const PWHL_LEAGUE_ID = '1';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

const apiError = (err: unknown, fallback: string): string =>
  (err as AxiosError<{ error: string }>).response?.data?.error
  ?? (err instanceof Error ? err.message : fallback);

type TeamSide = 'away' | 'home';

interface TeamPlayerRecord {
  id: string;
  league_player_number?: string | null;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
  team_id: string;
  position: string | null;
}

interface LeaguePlayer {
  id: string;
  league_player_number?: string | null;
  first_name: string;
  last_name: string;
  team_id: string | null;
  team_code: string | null;
  team_name?: string | null;
}

interface PwhlPlayer {
  playerId: number;
  sweaterNumber: number;
  firstName: string;
  lastName: string;
  name: string;
  position: string;
  group: 'skaters' | 'goalies';
  starting: boolean;
}

interface MatchedPlayer extends PwhlPlayer {
  localId: string;
  localLeaguePlayerNumber?: string | null;
}

interface PwhlGoal {
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

interface PwhlGoalieLogRow {
  info?: { id?: string | number | null };
  stats?: {
    timeOnIce?: string | null;
    shotsAgainst?: unknown;
    goalsAgainst?: unknown;
    saves?: unknown;
  };
  periodStart?: { id?: string | number | null } | null;
  timeStart?: string | null;
  periodEnd?: { id?: string | number | null } | null;
  timeEnd?: string | null;
}

interface GoalieStintPayload {
  goalie_id: string;
  team_id: string;
  entered_period: string;
  entered_time?: string | null;
  exited_period?: string | null;
  exited_time?: string | null;
  shots_against?: number;
  goals_against?: number | null;
  time_on_ice?: number | null;
}

interface ResolvedPwhlGoalieStint extends GoalieStintPayload {
  pwhlGoalieId: number;
}

interface ExistingGoalieStint extends GoalieStintPayload {
  id: string;
  stint_ord: number;
}

type ShootoutAttemptPayload = Pick<ShootoutAttempt, 'team_id' | 'shooter_id' | 'scored'>;

function leaguePlayerNumberLabel(value: string | number | null | undefined) {
  return value == null || value === '' ? null : `league player number ${value}`;
}

function pwhlPlayerIdentifier(player: PwhlPlayer) {
  return leaguePlayerNumberLabel(player.playerId) ?? `#${player.sweaterNumber} ${player.name}`;
}

function gameLabel(game: GameRecord) {
  const date = (game.scheduled_at ?? '').slice(0, 10);
  const matchup = `${game.away_team.code} @ ${game.home_team.code}`;
  return date ? `${date} ${matchup}` : matchup;
}

function localPlayerIdentifier(
  player: Pick<TeamPlayerRecord, 'league_player_number' | 'first_name' | 'last_name' | 'jersey_number'>,
) {
  const fallbackJersey = player.jersey_number == null ? '' : `#${player.jersey_number} `;
  return (
    leaguePlayerNumberLabel(player.league_player_number) ??
    `${fallbackJersey}${player.first_name} ${player.last_name}`
  );
}

interface FillSummary {
  gameId: string;
  goalsCreated: number;
  goalsUpdated: number;
  rosterPlayers: number;
  periodShots: Array<{ period: string; away_shots: number; home_shots: number }>;
  goalieStints: number;
  starsSet: number;
  startingGoaliesSet: number;
  shootoutAttempts: number;
}

export interface PwhlAutofillResult {
  summary: FillSummary;
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
  await new Promise<void>((resolve) => {
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      setTimeout(resolve, 0);
      return;
    }
    window.requestAnimationFrame(() => resolve());
  });
}

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

  const summary = await fetchPwhlJson<any>(pwhlFeedUrl('gameSummary', gameId));
  const warnings: string[] = [];

  await emitProgress({
    step: 'match',
    message: 'Matching PWHL date, teams, and existing game data...',
  });

  assertGameMatches(game, summary);
  const shootoutGame = isShootoutGame(summary);
  const playByPlay = shootoutGame
    ? await fetchPwhlJson<any[]>(pwhlFeedUrl('gameCenterPlayByPlay', gameId))
    : [];

  const [existingGoals, existingShootoutAttempts] = await Promise.all([
    apiGet<GoalRecord[]>(`/admin/games/${game.id}/goals`),
    shootoutGame
      ? apiGet<ShootoutAttempt[]>(`/admin/games/${game.id}/shootout-attempts`)
      : Promise.resolve([]),
  ]);
  const existingGoalKeys = new Set(existingGoals.map(goalAutofillKey));
  const existingGoalsByKey = new Map(existingGoals.map((goal) => [goalAutofillKey(goal), goal]));
  const existingShootoutAttemptKeys = new Set(
    shootoutAttemptAutofillKeys(existingShootoutAttempts),
  );

  let goalsCreated = 0;
  let goalsUpdated = 0;
  let goalsSkipped = 0;
  let shootoutAttemptsCreated = 0;
  let shootoutAttemptsSkipped = 0;

  const rosterDate = gameDateOnly(summary) ?? game.scheduled_at;
  const [initialAwayPlayers, initialHomePlayers] = await Promise.all([
    fetchTeamPlayers(game.away_team.id, game.season_id, rosterDate),
    fetchTeamPlayers(game.home_team.id, game.season_id, rosterDate),
  ]);
  let baseAwayPlayers = initialAwayPlayers;
  let baseHomePlayers = initialHomePlayers;
  const pwhlPlayers = {
    away: getPwhlPlayers(summary, 'away'),
    home: getPwhlPlayers(summary, 'home'),
  };

  await emitProgress({
    step: 'roster',
    message: 'Matching dressed PWHL players to the local roster...',
  });

  const leaguePlayers = await fetchLeaguePlayers(game);
  if (leaguePlayers.length > 0) {
    const conflicts = [
      ...findCrossTeamPlayerConflicts(
        leaguePlayers,
        game.away_team.id,
        pwhlPlayers.away,
        initialAwayPlayers,
      ).map((conflict) => ({
        ...conflict,
        targetCode: game.away_team.code,
        targetTeamId: game.away_team.id,
      })),
      ...findCrossTeamPlayerConflicts(
        leaguePlayers,
        game.home_team.id,
        pwhlPlayers.home,
        initialHomePlayers,
      ).map((conflict) => ({
        ...conflict,
        targetCode: game.home_team.code,
        targetTeamId: game.home_team.id,
      })),
    ];
    if (conflicts.length > 0) {
      await moveCrossTeamPlayerConflicts(
        game,
        conflicts,
        null,
        warnings,
      );
      [baseAwayPlayers, baseHomePlayers] = await Promise.all([
        fetchTeamPlayers(game.away_team.id, game.season_id, rosterDate),
        fetchTeamPlayers(game.home_team.id, game.season_id, rosterDate),
      ]);
    }
  }

  const awayPlayers = await ensurePwhlPlayersRostered(
    game,
    game.away_team.id,
    game.away_team.code,
    pwhlPlayers.away,
    baseAwayPlayers,
    rosterDate,
    warnings,
  );
  const homePlayers = await ensurePwhlPlayersRostered(
    game,
    game.home_team.id,
    game.home_team.code,
    pwhlPlayers.home,
    baseHomePlayers,
    rosterDate,
    warnings,
  );
  const matched = {
    away: matchPwhlPlayers(pwhlPlayers.away, awayPlayers, game.away_team.code),
    home: matchPwhlPlayers(pwhlPlayers.home, homePlayers, game.home_team.code),
  };
  if (matched.away.length === 0 || matched.home.length === 0) {
    throw new Error('PWHL game summary did not include roster data for both teams.');
  }

  await syncLeaguePlayerNumbers(matched);
  await syncGameRoster(game, matched);
  await emitProgress({
    step: 'roster',
    message: `Roster saved (${matched.away.length + matched.home.length} players).`,
    refresh: true,
  });

  const startingGoaliesSet = await syncStartingGoalies(game, matched, warnings);
  if (startingGoaliesSet > 0) {
    await emitProgress({
      step: 'lineups',
      message: 'Starting goalies saved.',
      refresh: true,
    });
  }

  const allMatchedByPwhlId = new Map<number, MatchedPlayer>();
  [...matched.away, ...matched.home].forEach((player) => {
    allMatchedByPwhlId.set(player.playerId, player);
  });

  const goals = getPwhlGoals(summary);
  const gameTimes = inferPwhlGameTimes(summary);
  await apiPatch(`/admin/games/${game.id}`, {
    league_game_number: gameId,
    scheduled_at: gameDateOnly(summary) ?? undefined,
    scheduled_time: scheduledTimeFromIso(summary?.details?.GameDateISO8601) ?? undefined,
    venue: summary?.details?.venue ?? undefined,
    status: 'in_progress',
    current_period: '1',
    shootout: shootoutGame,
    time_start: gameTimes.startIso,
  });

  await emitProgress({
    step: 'start',
    message: 'Game moved to in-progress. Filling periods...',
    refresh: true,
  });

  const goalsByPeriod = groupGoalsByPeriodNumber(goals);
  const playedPeriodNumbers = getPlayedPeriodNumbers(summary, goals, shootoutGame);
  let processedGoals = 0;
  for (const [periodIndex, periodNumber] of playedPeriodNumbers.entries()) {
    await apiPatch(`/admin/games/${game.id}`, gameProgressPatchForPeriod(periodNumber));
    await emitProgress({
      step: 'period',
      message: `Filling ${formatAutofillPeriod(periodNumber)} period...`,
      completed: periodIndex,
      total: playedPeriodNumbers.length,
      refresh: true,
    });

    for (const goal of goalsByPeriod.get(periodNumber) ?? []) {
      const teamId = goal.teamSide === 'away' ? game.away_team.id : game.home_team.id;
      const scorer = allMatchedByPwhlId.get(goal.scorerId);
      if (!scorer) throw new Error(`Could not match PWHL scorer ${goal.scorerId}.`);

      const goalPayload: PostGoalData = {
        team_id: teamId,
        period: goal.period,
        period_time: goal.periodTime,
        goal_type: goal.goalType,
        empty_net: goal.emptyNet,
        penalty_shot: goal.penaltyShot,
        scorer_id: scorer.localId,
        assist_1_id: resolveOptionalPlayerId(goal.assist1Id, allMatchedByPwhlId),
        assist_2_id: resolveOptionalPlayerId(goal.assist2Id, allMatchedByPwhlId),
      };
      const key = goalAutofillKey(goalPayload);
      if (existingGoalKeys.has(key)) {
        const existingGoal = existingGoalsByKey.get(key);
        if (existingGoal && shouldUpdateGoalFromAutofill(existingGoal, goalPayload)) {
          const updatedGoal = await apiPut<GoalRecord, PostGoalData>(
            `/admin/games/${game.id}/goals/${existingGoal.id}`,
            goalPayload,
          );
          existingGoalsByKey.set(key, updatedGoal);
          goalsUpdated += 1;
        } else {
          goalsSkipped += 1;
        }
        processedGoals += 1;
        continue;
      }

      const createdGoal = await apiPost<GoalRecord, PostGoalData>(
        `/admin/games/${game.id}/goals`,
        goalPayload,
      );
      existingGoalKeys.add(key);
      existingGoalKeys.add(goalAutofillKey(createdGoal));
      existingGoalsByKey.set(key, createdGoal);
      existingGoalsByKey.set(goalAutofillKey(createdGoal), createdGoal);
      goalsCreated += 1;
      processedGoals += 1;
      await emitProgress({
        step: 'goals',
        message: `Added goal ${processedGoals} of ${goals.length}.`,
        completed: processedGoals,
        total: goals.length,
        refresh: true,
      });
    }

    await emitProgress({
      step: 'period',
      message: `Finished ${formatAutofillPeriod(periodNumber)} period.`,
      completed: periodIndex + 1,
      total: playedPeriodNumbers.length,
      refresh: true,
    });
  }

  const shootoutAttempts = shootoutGame
    ? resolvePwhlShootoutAttempts(playByPlay, matched, summary, game)
    : [];
  if (shootoutGame && shootoutAttempts.length === 0) {
    throw new Error('PWHL play-by-play did not include shootout attempts.');
  }
  if (shootoutGame) {
    await apiPatch(`/admin/games/${game.id}`, {
      current_period: 'SO',
      shootout: true,
      shootout_first_team_id: shootoutAttempts[0]?.team_id,
    });
    const shootoutAttemptKeys = shootoutAttemptAutofillKeys(shootoutAttempts);
    for (const [index, attempt] of shootoutAttempts.entries()) {
      const key = shootoutAttemptKeys[index];
      if (existingShootoutAttemptKeys.has(key)) {
        shootoutAttemptsSkipped += 1;
        continue;
      }

      await apiPost<unknown, ShootoutAttemptPayload>(
        `/admin/games/${game.id}/shootout-attempts`,
        attempt,
      );
      existingShootoutAttemptKeys.add(key);
      shootoutAttemptsCreated += 1;
      await emitProgress({
        step: 'shootout',
        message: `Added shootout attempt ${index + 1} of ${shootoutAttempts.length}.`,
        completed: index + 1,
        total: shootoutAttempts.length,
        refresh: true,
      });
    }
  }

  const periodShots = getPeriodShots(summary);
  for (const [index, row] of periodShots.entries()) {
    await apiPatch(`/admin/games/${game.id}/shots`, row);
    await emitProgress({
      step: 'shots',
      message: `Saved shots for period ${row.period}.`,
      completed: index + 1,
      total: periodShots.length,
      refresh: true,
    });
  }

  const goalieStints = buildGoalieStintPayloads(game, summary, matched);
  if (goalieStints.length > 0) {
    await syncGoalieStints(game.id, goalieStints);
    await emitProgress({
      step: 'goalies',
      message: `Saved ${goalieStints.length} goalie stint${goalieStints.length === 1 ? '' : 's'}.`,
      refresh: true,
    });
  }

  const stars = resolveSummaryStars(summary, matched);
  await emitProgress({
    step: 'final',
    message: 'Finalizing game details and stars...',
  });
  await apiPatch(`/admin/games/${game.id}`, {
    scheduled_at: gameDateOnly(summary) ?? undefined,
    scheduled_time: scheduledTimeFromIso(summary?.details?.GameDateISO8601) ?? undefined,
    venue: summary?.details?.venue ?? undefined,
    status: 'final',
    current_period: getCurrentPeriod(summary),
    overtime_periods: getOvertimePeriods(summary),
    shootout: shootoutGame,
    shootout_first_team_id: shootoutGame ? shootoutAttempts[0]?.team_id : undefined,
    time_start: gameTimes.startIso,
    time_end: gameTimes.endIso,
    star_1_id: stars[0] ?? undefined,
    star_2_id: stars[1] ?? undefined,
    star_3_id: stars[2] ?? undefined,
  });
  await emitProgress({
    step: 'complete',
    message: 'PWHL auto-fill complete.',
    refresh: true,
  });

  if (stars.length < Math.min(3, toArray(summary?.mostValuablePlayers).length || 3)) {
    warnings.push('Less than three PWHL stars could be matched to local players.');
  }
  if (!gameTimes.startIso || !gameTimes.endIso) {
    warnings.push('PWHL start/end times were not both available.');
  }
  if (goalsSkipped > 0) {
    warnings.push(`${goalsSkipped} existing ${pluralize('goal', goalsSkipped)} were already present.`);
  }
  if (shootoutAttemptsSkipped > 0) {
    warnings.push(
      `${shootoutAttemptsSkipped} existing shootout ${pluralize('attempt', shootoutAttemptsSkipped)} were already present.`,
    );
  }

  return {
    summary: {
      gameId,
      goalsCreated,
      goalsUpdated,
      rosterPlayers: matched.away.length + matched.home.length,
      periodShots,
      goalieStints: goalieStints.length,
      starsSet: stars.length,
      startingGoaliesSet,
      shootoutAttempts: shootoutAttemptsCreated,
    },
    warnings,
  };
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

function pwhlFeedUrl(view: 'gameSummary' | 'gameCenterPlayByPlay', gameId: string) {
  const params = new URLSearchParams({
    feed: 'statviewfeed',
    view,
    game_id: gameId,
    key: PWHL_APP_KEY,
    client_code: PWHL_CLIENT_CODE,
    lang: 'en',
    league_id: PWHL_LEAGUE_ID,
    fmt: 'json',
  });
  if (view === 'gameSummary') params.set('site_id', '0');
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

async function fetchLeaguePlayers(game: GameRecord): Promise<LeaguePlayer[]> {
  if (!game.league_id) return [];
  const { data } = await axios.get<LeaguePlayer[] | { players: LeaguePlayer[] }>(
    `${API}/admin/players`,
    {
      headers: authHeaders(),
      params: {
        league_id: game.league_id,
        season_id: game.season_id,
        include_prospects: 'true',
      },
    },
  );
  return Array.isArray(data) ? data : (data.players ?? []);
}

function assertGameMatches(game: GameRecord, summary: any) {
  const pwhlDate = gameDateOnly(summary);
  const localDates = localDateCandidates(game.scheduled_at);
  if (pwhlDate && localDates.length > 0 && !localDates.includes(pwhlDate)) {
    throw new Error(
      `PWHL game is scheduled for ${pwhlDate}, but this page is scheduled for ${localDates.join(' or ')}.`,
    );
  }

  const awayCode = normalizeCode(summary?.visitingTeam?.info?.abbreviation);
  const homeCode = normalizeCode(summary?.homeTeam?.info?.abbreviation);
  if (awayCode !== normalizeCode(game.away_team.code) || homeCode !== normalizeCode(game.home_team.code)) {
    throw new Error(
      `PWHL game is ${awayCode || '?'} @ ${homeCode || '?'}, but this page is ${game.away_team.code} @ ${game.home_team.code}.`,
    );
  }
}

function getPwhlPlayers(summary: any, side: TeamSide): PwhlPlayer[] {
  const team = side === 'away' ? summary?.visitingTeam : summary?.homeTeam;
  return [
    ...toArray(team?.skaters).map((row) => pwhlPlayerFromRow(row, 'skaters')),
    ...toArray(team?.goalies).map((row) => pwhlPlayerFromRow(row, 'goalies')),
  ].filter((player): player is PwhlPlayer => !!player);
}

function pwhlPlayerFromRow(row: any, group: PwhlPlayer['group']): PwhlPlayer | null {
  const info = row?.info;
  const playerId = Number(info?.id);
  if (!Number.isFinite(playerId) || playerId <= 0) return null;
  const firstName = String(info?.firstName ?? '').trim();
  const lastName = String(info?.lastName ?? '').trim();
  const name = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (!name) return null;

  return {
    playerId,
    sweaterNumber: Number(info?.jerseyNumber),
    firstName,
    lastName,
    name,
    position: reportPositionToLocalPosition(info?.position),
    group,
    starting: isTruthy(row?.starting),
  };
}

interface PlayerConflict {
  externalPlayer: PwhlPlayer;
  existing: LeaguePlayer;
}

interface MovePlayerConflict extends PlayerConflict {
  targetCode: string;
  targetTeamId: string;
}

function findCrossTeamPlayerConflicts(
  leaguePlayers: LeaguePlayer[],
  teamId: string,
  externalPlayers: PwhlPlayer[],
  localPlayers: TeamPlayerRecord[],
): PlayerConflict[] {
  const missing = externalPlayers.filter((player) => !findLocalPlayerForExternal(player, localPlayers));
  if (missing.length === 0) return [];

  const byLeaguePlayerNumber = new Map<string, LeaguePlayer>();
  const byFullName = new Map<string, LeaguePlayer>();
  const byLastInitial = new Map<string, LeaguePlayer>();
  for (const player of leaguePlayers) {
    if (!player.team_id || player.team_id === teamId) continue;
    if (player.league_player_number) byLeaguePlayerNumber.set(player.league_player_number, player);
    const fullKey = normalizeNameKey(`${player.first_name} ${player.last_name}`);
    const liKey = lastNameInitialKey(player.first_name, player.last_name);
    if (!byFullName.has(fullKey)) byFullName.set(fullKey, player);
    if (!byLastInitial.has(liKey)) byLastInitial.set(liKey, player);
  }

  return missing.flatMap((externalPlayer) => {
    const leagueNumber = String(externalPlayer.playerId);
    const existing =
      byLeaguePlayerNumber.get(leagueNumber) ??
      byFullName.get(normalizeNameKey(externalPlayer.name)) ??
      byLastInitial.get(lastNameInitialKey(externalPlayer.firstName, externalPlayer.lastName));
    return existing ? [{ externalPlayer, existing }] : [];
  });
}

async function moveCrossTeamPlayerConflicts(
  game: GameRecord,
  conflicts: MovePlayerConflict[],
  moveDate: string | null | undefined,
  warnings: string[],
) {
  const normalizedMoveDate = moveDate?.slice(0, 10);
  if (!normalizedMoveDate) {
    throw new ManualPlayerMovementRequiredError(buildManualMoveReport(game, conflicts));
  }

  for (const conflict of conflicts) {
    await apiPost<
      unknown,
      {
        player_id: string;
        season_id: string;
        to_team_id: string;
        trade_date: string;
        jersey_number: number;
        position: string;
        acquisition_type: string | null;
      }
    >('/admin/player-teams/trade', {
      player_id: conflict.existing.id,
      season_id: game.season_id,
      to_team_id: conflict.targetTeamId,
      trade_date: normalizedMoveDate,
      jersey_number: conflict.externalPlayer.sweaterNumber,
      position: conflict.externalPlayer.position,
      acquisition_type: null,
    });
  }

  warnings.push(
    `Auto-recorded ${conflicts.length} PWHL ${pluralize('player movement', conflicts.length)} from game data: ${conflicts
      .map((conflict) => `${pwhlPlayerIdentifier(conflict.externalPlayer)} to ${conflict.targetCode}`)
      .join(', ')}.`,
  );
}

function buildManualMoveReport(
  game: GameRecord,
  conflicts: MovePlayerConflict[],
): GameAutofillManualMoveReport {
  return {
    leagueCode: 'PWHL',
    gameId: game.id,
    gameLabel: gameLabel(game),
    gameDate: (game.scheduled_at ?? '').slice(0, 10) || null,
    moves: conflicts.map((conflict) => ({
      playerName: conflict.externalPlayer.name,
      leaguePlayerNumber: String(conflict.externalPlayer.playerId),
      jerseyNumber: conflict.externalPlayer.sweaterNumber,
      position: conflict.externalPlayer.position,
      fromTeamCode: conflict.existing.team_code,
      fromTeamName: conflict.existing.team_name ?? null,
      toTeamCode: conflict.targetCode,
      toTeamName:
        conflict.targetTeamId === game.away_team.id
          ? game.away_team.name
          : conflict.targetTeamId === game.home_team.id
            ? game.home_team.name
            : null,
    })),
  };
}

async function ensurePwhlPlayersRostered(
  game: GameRecord,
  teamId: string,
  teamCode: string,
  externalPlayers: PwhlPlayer[],
  localPlayers: TeamPlayerRecord[],
  gameDate: string | null | undefined,
  warnings: string[],
): Promise<TeamPlayerRecord[]> {
  const jerseyConflicts = externalPlayers.flatMap((player) => {
    if (findLocalPlayerByLeagueNumber(player, localPlayers)) return [];
    const rows = localPlayers.filter((local) => local.jersey_number === player.sweaterNumber);
    if (rows.length === 0) return [];
    if (rows.some((local) => !local.league_player_number && playerNamesMatch(local, player))) return [];
    return rows.map((local) => ({ player, local }));
  });
  if (jerseyConflicts.length > 0) {
    const lines = jerseyConflicts
      .map(
        ({ player, local }) =>
          `${pwhlPlayerIdentifier(player)} conflicts with ${localPlayerIdentifier(local)}`,
      )
      .join('; ');
    throw new Error(`Auto-fill stopped because ${teamCode} has jersey conflicts: ${lines}.`);
  }

  const missing = externalPlayers.filter((player) => !findLocalPlayerForExternal(player, localPlayers));
  if (missing.length === 0) return localPlayers;

  const { created } = await apiPost<{ created: Array<{ id: string }> }, { players: Array<Record<string, unknown>> }>(
    '/admin/players/bulk',
    {
      players: missing.map((player) => ({
        first_name: player.firstName,
        last_name: player.lastName,
        league_player_number: String(player.playerId),
        position: player.position,
      })),
    },
  );

  await apiPost<unknown, { team_id: string; season_id: string; players: Array<{ player_id: string; jersey_number: number }> }>(
    '/admin/player-teams/bulk',
    {
      team_id: teamId,
      season_id: game.season_id,
      players: created.map((player, index) => ({
        player_id: player.id,
        jersey_number: missing[index].sweaterNumber,
      })),
    },
  );

  warnings.push(
    `Auto-created ${missing.length} missing ${teamCode} ${pluralize('player', missing.length)} from PWHL data: ${missing
      .map((player) => pwhlPlayerIdentifier(player))
      .join(', ')}.`,
  );

  return fetchTeamPlayers(teamId, game.season_id, gameDate);
}

function matchPwhlPlayers(
  externalPlayers: PwhlPlayer[],
  localPlayers: TeamPlayerRecord[],
  teamCode: string,
): MatchedPlayer[] {
  const missing: string[] = [];
  const matched = externalPlayers.flatMap((externalPlayer) => {
    const local = findLocalPlayerForExternal(externalPlayer, localPlayers);
    if (!local) {
      missing.push(pwhlPlayerIdentifier(externalPlayer));
      return [];
    }
    return [{
      ...externalPlayer,
      localId: local.id,
      localLeaguePlayerNumber: local.league_player_number ?? null,
    }];
  });

  if (missing.length > 0) {
    throw new Error(`Missing ${teamCode} PWHL player matches: ${missing.join(', ')}.`);
  }
  return matched;
}

function findLocalPlayerForExternal(player: PwhlPlayer, localPlayers: TeamPlayerRecord[]) {
  return (
    findLocalPlayerByLeagueNumber(player, localPlayers) ??
    localPlayers.find(
      (local) =>
        local.jersey_number === player.sweaterNumber &&
        !local.league_player_number &&
        playerNamesMatch(local, player),
    )
  );
}

function findLocalPlayerByLeagueNumber(player: PwhlPlayer, localPlayers: TeamPlayerRecord[]) {
  const leaguePlayerNumber = String(player.playerId);
  return localPlayers.find((local) => local.league_player_number === leaguePlayerNumber);
}

async function syncLeaguePlayerNumbers(matched: Record<TeamSide, MatchedPlayer[]>) {
  const players = [...matched.away, ...matched.home];
  const conflicts = players.filter(
    (player) =>
      !!player.localLeaguePlayerNumber &&
      player.localLeaguePlayerNumber !== String(player.playerId),
  );
  if (conflicts.length > 0) {
    throw new Error(
      `League player number mismatch: ${conflicts
        .map(
          (player) =>
            `${leaguePlayerNumberLabel(player.localLeaguePlayerNumber)} conflicts with ${leaguePlayerNumberLabel(
              player.playerId,
            )}`,
        )
        .join('; ')}.`,
    );
  }

  await Promise.all(
    players
      .filter((player) => !player.localLeaguePlayerNumber)
      .map((player) =>
        apiPatch(`/admin/players/${player.localId}`, {
          league_player_number: String(player.playerId),
        }),
      ),
  );
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

async function syncStartingGoalies(
  game: GameRecord,
  matched: Record<TeamSide, MatchedPlayer[]>,
  warnings: string[],
) {
  let saved = 0;
  for (const side of ['away', 'home'] as const) {
    const goalies = matched[side].filter((player) => player.group === 'goalies' && player.starting);
    if (goalies.length !== 1) {
      const teamCode = side === 'away' ? game.away_team.code : game.home_team.code;
      warnings.push(`Could not find one starting goalie for ${teamCode} in the PWHL summary.`);
      continue;
    }
    await apiPut<unknown, { team_id: string; slots: Array<{ position_slot: LineupPositionSlot; player_id: string }> }>(
      `/admin/games/${game.id}/lineup`,
      {
        team_id: side === 'away' ? game.away_team.id : game.home_team.id,
        slots: [{ position_slot: 'G', player_id: goalies[0].localId }],
      },
    );
    saved += 1;
  }
  return saved;
}

function getPwhlGoals(summary: any): PwhlGoal[] {
  const awayPwhlTeamId = Number(summary?.visitingTeam?.info?.id);
  return toArray(summary?.periods).flatMap((periodRow) =>
    toArray(periodRow?.goals).map((goal) => {
      const periodNumber = Number(goal?.period?.id ?? periodRow?.info?.id ?? 1);
      const teamId = Number(goal?.team?.id);
      const properties = goal?.properties ?? {};
      return {
        teamSide: teamId === awayPwhlTeamId ? 'away' : 'home',
        periodNumber,
        period: pwhlPeriodToLocal(periodNumber),
        periodTime: normalizeClockTime(goal?.time) ?? '0:00',
        goalType: pwhlGoalType(properties),
        emptyNet: isTruthy(properties?.isEmptyNet),
        penaltyShot: isTruthy(properties?.isPenaltyShot),
        scorerId: Number(goal?.scoredBy?.id),
        assist1Id: toOptionalNumber(toArray(goal?.assists)[0]?.id),
        assist2Id: toOptionalNumber(toArray(goal?.assists)[1]?.id),
      } satisfies PwhlGoal;
    }),
  );
}

function groupGoalsByPeriodNumber(goals: PwhlGoal[]) {
  const grouped = new Map<number, PwhlGoal[]>();
  goals.forEach((goal) => {
    const rows = grouped.get(goal.periodNumber) ?? [];
    rows.push(goal);
    grouped.set(goal.periodNumber, rows);
  });
  return grouped;
}

function getPlayedPeriodNumbers(summary: any, goals: PwhlGoal[], shootoutGame: boolean) {
  const periodNumbers = toArray(summary?.periods)
    .map((period) => Number(period?.info?.id))
    .filter((period) => Number.isFinite(period) && period > 0);
  const maxGoalPeriod = goals.reduce((max, goal) => Math.max(max, goal.periodNumber), 0);
  const maxPeriod = Math.max(...periodNumbers, maxGoalPeriod, shootoutGame ? 4 : 3);
  return Array.from(new Set(Array.from({ length: Math.max(3, maxPeriod) }, (_, index) => index + 1)));
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

function getPeriodShots(summary: any) {
  return toArray(summary?.periods).map((period) => ({
    period: pwhlPeriodToLocal(Number(period?.info?.id)),
    away_shots: Number(period?.stats?.visitingShots ?? 0),
    home_shots: Number(period?.stats?.homeShots ?? 0),
  }));
}

function buildGoalieStintPayloads(
  game: GameRecord,
  summary: any,
  matched: Record<TeamSide, MatchedPlayer[]>,
): GoalieStintPayload[] {
  const matchedByPwhlId = new Map(
    (['away', 'home'] as const).flatMap((side) =>
      matched[side].map((player) => [player.playerId, { ...player, side }] as const),
    ),
  );
  return [
    ...buildTeamGoalieStints(game, summary?.visitingTeam, 'away', matchedByPwhlId),
    ...buildTeamGoalieStints(game, summary?.homeTeam, 'home', matchedByPwhlId),
  ];
}

function buildTeamGoalieStints(
  game: GameRecord,
  team: any,
  side: TeamSide,
  matchedByPwhlId: Map<number, MatchedPlayer & { side: TeamSide }>,
) {
  const teamId = side === 'away' ? game.away_team.id : game.home_team.id;
  const goalies = toArray<PwhlGoalieLogRow>(team?.goalies);
  const logs = toArray<PwhlGoalieLogRow>(team?.goalieLog);
  const rawStints = logs.length > 0
    ? logs
    : goalies
        .filter((goalie) => goalieActuallyPlayed(goalie))
        .map((goalie) => ({
          info: goalie.info,
          stats: goalie.stats,
          periodStart: { id: '1' },
          timeStart: '0:00',
          periodEnd: null,
          timeEnd: null,
        }));

  const seenGoalieStints = new Map<number, number>();
  const stints = rawStints.flatMap<ResolvedPwhlGoalieStint>((stint) => {
    const pwhlGoalieId = Number(stint?.info?.id);
    const matchedGoalie = matchedByPwhlId.get(pwhlGoalieId);
    if (!matchedGoalie) return [];

    const enteredPeriod = normalizeGoalieStintPeriod(stint?.periodStart?.id);
    if (!enteredPeriod) return [];
    const stintIndex = seenGoalieStints.get(pwhlGoalieId) ?? 0;
    seenGoalieStints.set(pwhlGoalieId, stintIndex + 1);

    return [{
      pwhlGoalieId,
      goalie_id: matchedGoalie.localId,
      team_id: teamId,
      entered_period: enteredPeriod,
      entered_time: normalizeGoalieStintTime(stint?.timeStart, enteredPeriod, stintIndex),
      exited_period: normalizeGoalieStintPeriod(stint?.periodEnd?.id),
      exited_time: normalizeGoalieStintTime(stint?.timeEnd),
      shots_against: Number(stint?.stats?.shotsAgainst ?? 0),
      goals_against: Number(stint?.stats?.goalsAgainst ?? 0),
      time_on_ice: parseToiSeconds(stint?.stats?.timeOnIce),
    }];
  });

  return openFinalGoalieStint(
    collapseUnswitchedGoalieStints(stints, goalies),
  ).map(toGoalieStintPayload);
}

function collapseUnswitchedGoalieStints(
  stints: ResolvedPwhlGoalieStint[],
  goalies: PwhlGoalieLogRow[],
): ResolvedPwhlGoalieStint[] {
  if (stints.length === 0 || new Set(stints.map((stint) => stint.goalie_id)).size > 1) {
    return stints;
  }

  const firstStint = stints[0]!;
  const goalieTotals = goalies.find(
    (goalie) => Number(goalie?.info?.id) === firstStint.pwhlGoalieId,
  )?.stats;

  return [{
    ...firstStint,
    exited_period: null,
    exited_time: null,
    shots_against:
      toOptionalNumber(goalieTotals?.shotsAgainst) ?? sumPayloadNumbers(stints, 'shots_against'),
    goals_against:
      toOptionalNumber(goalieTotals?.goalsAgainst) ?? sumNullablePayloadNumbers(stints, 'goals_against'),
    time_on_ice:
      parseToiSeconds(goalieTotals?.timeOnIce) ?? sumNullablePayloadNumbers(stints, 'time_on_ice'),
  }];
}

function openFinalGoalieStint(stints: ResolvedPwhlGoalieStint[]): ResolvedPwhlGoalieStint[] {
  const finalIndex = stints.length - 1;
  return stints.map((stint, index) =>
    index === finalIndex ? { ...stint, exited_period: null, exited_time: null } : stint,
  );
}

function toGoalieStintPayload(stint: ResolvedPwhlGoalieStint): GoalieStintPayload {
  return {
    goalie_id: stint.goalie_id,
    team_id: stint.team_id,
    entered_period: stint.entered_period,
    entered_time: stint.entered_time,
    exited_period: stint.exited_period,
    exited_time: stint.exited_time,
    shots_against: stint.shots_against,
    goals_against: stint.goals_against,
    time_on_ice: stint.time_on_ice,
  };
}

function sumPayloadNumbers(
  stints: GoalieStintPayload[],
  key: 'shots_against' | 'goals_against' | 'time_on_ice',
) {
  return stints.reduce((sum, stint) => sum + Number(stint[key] ?? 0), 0);
}

function sumNullablePayloadNumbers(
  stints: GoalieStintPayload[],
  key: 'goals_against' | 'time_on_ice',
) {
  const values = stints
    .map((stint) => stint[key])
    .filter((value): value is number => value != null && Number.isFinite(Number(value)));
  return values.length > 0 ? values.reduce((sum, value) => sum + Number(value), 0) : null;
}

async function syncGoalieStints(gameId: string, desiredStints: GoalieStintPayload[]) {
  const existingStats = await apiGet<GoalieStatRecord[]>(`/admin/games/${gameId}/goalie-stints`);
  const existingByTeam = groupExistingGoalieStints(existingStats);
  const desiredByTeam = groupDesiredGoalieStints(desiredStints);
  const teamIds = new Set([...existingByTeam.keys(), ...desiredByTeam.keys()]);

  for (const teamId of teamIds) {
    const existing = existingByTeam.get(teamId) ?? [];
    const desired = desiredByTeam.get(teamId) ?? [];
    const sharedLength = Math.min(existing.length, desired.length);

    for (let index = 0; index < sharedLength; index += 1) {
      const existingStint = existing[index]!;
      const desiredStint = desired[index]!;
      if (goalieStintNeedsUpdate(existingStint, desiredStint)) {
        await apiPut<GoalieStatRecord[], GoalieStintPayload>(
          `/admin/games/${gameId}/goalie-stints/${existingStint.id}`,
          desiredStint,
        );
      }
    }

    for (const desiredStint of desired.slice(sharedLength)) {
      await apiPost<GoalieStatRecord[], GoalieStintPayload>(
        `/admin/games/${gameId}/goalie-stints`,
        desiredStint,
      );
    }

    for (const extraStint of existing.slice(desired.length).reverse()) {
      await apiDelete(`/admin/games/${gameId}/goalie-stints/${extraStint.id}`);
    }
  }
}

function resolveSummaryStars(summary: any, matched: Record<TeamSide, MatchedPlayer[]>) {
  const matchedByPwhlId = new Map(
    [...matched.away, ...matched.home].map((player) => [player.playerId, player.localId]),
  );
  return toArray(summary?.mostValuablePlayers)
    .map((star) => matchedByPwhlId.get(Number(star?.player?.info?.id)))
    .filter((id): id is string => !!id)
    .slice(0, 3);
}

function resolvePwhlShootoutAttempts(
  playByPlay: any,
  matched: Record<TeamSide, MatchedPlayer[]>,
  summary: any,
  game: GameRecord,
): ShootoutAttemptPayload[] {
  const matchedByPwhlId = new Map(
    [...matched.away, ...matched.home].map((player) => [player.playerId, player.localId]),
  );
  const teamIdByPwhlId = new Map<number, string>([
    [Number(summary?.visitingTeam?.info?.id), game.away_team.id],
    [Number(summary?.homeTeam?.info?.id), game.home_team.id],
  ]);

  return toArray(playByPlay)
    .filter((event) => event?.event === 'shootout')
    .map((event) => {
      const shooterId = matchedByPwhlId.get(Number(event?.details?.shooter?.id));
      const teamId = teamIdByPwhlId.get(Number(event?.details?.shooterTeam?.id));
      if (!teamId || !shooterId) return null;
      return {
        team_id: teamId,
        shooter_id: shooterId,
        scored: isTruthy(event?.details?.isGoal),
      };
    })
    .filter((attempt): attempt is ShootoutAttemptPayload => !!attempt);
}

function goalAutofillKey(goal: Pick<PostGoalData, 'team_id' | 'period' | 'period_time' | 'scorer_id'>) {
  return [
    goal.team_id,
    goal.period,
    goal.period_time ?? '',
    goal.scorer_id,
  ].join('|');
}

function shouldUpdateGoalFromAutofill(existing: GoalRecord, next: PostGoalData) {
  return (
    existing.goal_type !== (next.goal_type ?? 'even-strength') ||
    existing.empty_net !== !!next.empty_net ||
    existing.penalty_shot !== !!next.penalty_shot
  );
}

function shootoutAttemptAutofillKeys(
  attempts: Array<Pick<ShootoutAttemptPayload, 'team_id' | 'shooter_id' | 'scored'> & { attempt_order?: number }>,
) {
  const counts = new Map<string, number>();
  return [...attempts]
    .sort((a, b) => (a.attempt_order ?? 0) - (b.attempt_order ?? 0))
    .map((attempt) => {
      const baseKey = `${attempt.team_id}|${attempt.shooter_id}|${attempt.scored ? '1' : '0'}`;
      const count = (counts.get(baseKey) ?? 0) + 1;
      counts.set(baseKey, count);
      return `${baseKey}|${count}`;
    });
}

function resolveOptionalPlayerId(
  pwhlPlayerId: number | null | undefined,
  playersByPwhlId: Map<number, MatchedPlayer>,
) {
  if (!pwhlPlayerId) return null;
  const player = playersByPwhlId.get(pwhlPlayerId);
  if (!player) throw new Error(`Could not match PWHL player ${pwhlPlayerId}.`);
  return player.localId;
}

function pwhlGoalType(properties: any) {
  if (isTruthy(properties?.isPowerPlay)) return 'power-play';
  if (isTruthy(properties?.isShortHanded)) return 'shorthanded';
  return 'even-strength';
}

function isShootoutGame(summary: any) {
  return isTruthy(summary?.hasShootout) || /SO/i.test(String(summary?.details?.status ?? ''));
}

function getCurrentPeriod(summary: any) {
  if (isShootoutGame(summary)) return 'SO';
  return getOvertimePeriods(summary) > 0 ? 'OT' : '3';
}

function getOvertimePeriods(summary: any) {
  const maxPeriod = toArray(summary?.periods).reduce(
    (max, period) => Math.max(max, Number(period?.info?.id ?? 0)),
    0,
  );
  if (isShootoutGame(summary)) return Math.max(1, maxPeriod - 3);
  return Math.max(0, maxPeriod - 3);
}

function gameDateOnly(summary: any) {
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

function inferPwhlGameTimes(summary: any) {
  const date = gameDateOnly(summary);
  if (!date) return {};
  const startIso = reportClockIso(date, summary?.details?.startTime);
  const endIso = reportClockIso(date, summary?.details?.endTime, startIso);
  return { startIso, endIso };
}

function reportClockIso(date: string, value: string | null | undefined, startIso?: string) {
  const match = String(value ?? '').trim().match(/^(\d{1,2}):([0-5]\d)\s*([ap])m\s+([A-Z]{2,4})$/i);
  if (!match) return undefined;
  const rawHour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3].toUpperCase();
  const zone = match[4].toUpperCase();
  const offset = REPORT_TIMEZONE_OFFSETS[zone];
  if (!offset) return undefined;

  const hour = meridiem === 'A' ? rawHour % 12 : (rawHour % 12) + 12;
  let iso = new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00${offset}`).toISOString();
  if (startIso && Date.parse(iso) <= Date.parse(startIso)) {
    const next = new Date(iso);
    next.setUTCDate(next.getUTCDate() + 1);
    iso = next.toISOString();
  }
  return iso;
}

function pwhlPeriodToLocal(period: unknown) {
  const number = Number(period);
  if (number <= 3) return String(number);
  return 'OT';
}

function normalizeGoalieStintPeriod(period: string | number | null | undefined) {
  if (period == null || period === '') return null;
  const number = Number(period);
  if ([1, 2, 3].includes(number)) return String(number);
  if (number > 3) return 'OT';
  const normalized = String(period).replace(/^P/i, '').toUpperCase();
  if (['1', '2', '3'].includes(normalized)) return normalized;
  if (normalized === 'OT' || normalized.startsWith('OT')) return 'OT';
  if (normalized === 'SO') return 'SO';
  return null;
}

function normalizeGoalieStintTime(
  time: string | null | undefined,
  enteredPeriod?: string,
  goalieStintIndex = 0,
) {
  if (!time || /^unknown$/i.test(time)) return null;
  const normalized = String(time).replace(/^0(\d:)/, '$1');
  if (enteredPeriod === '1' && goalieStintIndex === 0 && ['00:00', '0:00'].includes(normalized)) {
    return null;
  }
  return normalized;
}

function normalizeClockTime(value: string | null | undefined) {
  const match = String(value ?? '').trim().match(/^(\d{1,2}):([0-5]\d)$/);
  return match ? `${Number(match[1])}:${match[2]}` : null;
}

function parseToiSeconds(value: string | null | undefined) {
  const match = String(value ?? '').trim().match(/^(\d{1,3}):([0-5]\d)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function goalieActuallyPlayed(goalie: any) {
  return (
    parseToiSeconds(goalie?.stats?.timeOnIce) != null ||
    Number(goalie?.stats?.shotsAgainst ?? 0) > 0 ||
    Number(goalie?.stats?.saves ?? 0) > 0 ||
    Number(goalie?.stats?.goalsAgainst ?? 0) > 0
  );
}

function groupExistingGoalieStints(stats: GoalieStatRecord[]) {
  const byTeam = new Map<string, ExistingGoalieStint[]>();
  for (const stat of stats) {
    for (const stint of stat.stints ?? []) {
      const rows = byTeam.get(stat.team_id) ?? [];
      rows.push({
        id: stint.id,
        stint_ord: stint.stint_ord,
        goalie_id: stat.goalie_id,
        team_id: stat.team_id,
        entered_period: stint.entered_period,
        entered_time: stint.entered_time,
        exited_period: stint.exited_period,
        exited_time: stint.exited_time,
        shots_against: stint.shots_against,
        goals_against: stint.goals_against_override,
        time_on_ice: stint.time_on_ice,
      });
      byTeam.set(stat.team_id, rows);
    }
  }
  for (const rows of byTeam.values()) {
    rows.sort((a, b) => a.stint_ord - b.stint_ord);
  }
  return byTeam;
}

function groupDesiredGoalieStints(stints: GoalieStintPayload[]) {
  const byTeam = new Map<string, GoalieStintPayload[]>();
  for (const stint of stints) {
    const rows = byTeam.get(stint.team_id) ?? [];
    rows.push(stint);
    byTeam.set(stint.team_id, rows);
  }
  return byTeam;
}

function goalieStintNeedsUpdate(existing: ExistingGoalieStint, desired: GoalieStintPayload) {
  return (
    existing.goalie_id !== desired.goalie_id ||
    existing.team_id !== desired.team_id ||
    existing.entered_period !== desired.entered_period ||
    nullish(existing.entered_time) !== nullish(desired.entered_time) ||
    nullish(existing.exited_period) !== nullish(desired.exited_period) ||
    nullish(existing.exited_time) !== nullish(desired.exited_time) ||
    Number(existing.shots_against ?? 0) !== Number(desired.shots_against ?? 0) ||
    nullishNumber(existing.goals_against) !== nullishNumber(desired.goals_against) ||
    nullishNumber(existing.time_on_ice) !== nullishNumber(desired.time_on_ice)
  );
}

function reportPositionToLocalPosition(position: string | null | undefined): string {
  const normalized = (position ?? '').toUpperCase().trim();
  if (['C', 'LW', 'RW', 'F', 'D', 'LD', 'RD', 'G'].includes(normalized)) return normalized;
  return normalized.endsWith('D') ? 'D' : 'F';
}

function formatAutofillPeriod(periodNumber: number) {
  if (periodNumber <= 3) return `${periodNumber}${periodOrdinalSuffix(periodNumber)}`;
  if (periodNumber === 4) return 'overtime';
  return `overtime ${periodNumber - 3}`;
}

function periodOrdinalSuffix(periodNumber: number) {
  if (periodNumber === 1) return 'st';
  if (periodNumber === 2) return 'nd';
  if (periodNumber === 3) return 'rd';
  return 'th';
}

function playerNamesMatch(local: TeamPlayerRecord, player: PwhlPlayer) {
  return (
    normalizeNameKey(`${local.first_name} ${local.last_name}`) === normalizeNameKey(player.name) ||
    lastNameInitialKey(local.first_name, local.last_name) ===
      lastNameInitialKey(player.firstName, player.lastName)
  );
}

function lastNameInitialKey(firstName: string, lastName: string) {
  return `${normalizeNameKey(lastName)}|${normalizeNameKey(firstName).slice(0, 1)}`;
}

function normalizeNameKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();
}

function normalizeCode(value: string | null | undefined) {
  return String(value ?? '').trim().toUpperCase();
}

function isTruthy(value: unknown) {
  return value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
}

function toOptionalNumber(value: unknown) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toArray<T = any>(value: T[] | T | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

function pluralize(word: string, count: number) {
  return count === 1 ? word : `${word}s`;
}

function nullish(value: string | null | undefined) {
  return value ?? null;
}

function nullishNumber(value: number | null | undefined) {
  return value == null ? null : Number(value);
}

export { apiError as pwhlAutofillApiError };
