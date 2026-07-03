import axios, { AxiosError } from 'axios';
import type { GameRecord } from '@/hooks/useGames';
import type { GameRosterEntry } from '@/hooks/useGameRoster';
import type { GoalRecord, PostGoalData } from '@/hooks/useGameGoals';
import type { GoalieStatRecord, UpsertGoalieStatData } from '@/hooks/useGameGoalieStats';
import type { LineupPositionSlot } from '@/hooks/useGameLineup';
import type { ShootoutAttempt } from '@/hooks/useShootoutAttempts';
import {
  buildGoalieStints,
  buildGoalieStintsFromToiHtml,
  buildNhlGamecenterGameId,
  getGoaliesFromLanding,
  type GoalieStint,
  type GoaliesByTeam,
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
  league_player_number?: string | null;
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
  localLeaguePlayerNumber?: string | null;
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

interface ExistingGoalieStint extends GoalieStintPayload {
  id: string;
  stint_ord: number;
}

interface NhlReportClock {
  clock: string;
  meridiem?: 'AM' | 'PM';
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
  startingGoaliesSet: number;
  shootoutAttempts: number;
  usedRosterReport: boolean;
}

export interface NhlAutofillResult {
  summary: FillSummary;
  warnings: string[];
}

export interface NhlAutofillProgress {
  step: string;
  message: string;
  completed?: number;
  total?: number;
  refresh?: boolean;
}

interface NhlAutofillOptions {
  onProgress?: (progress: NhlAutofillProgress) => void | Promise<void>;
}

type ShootoutAttemptPayload = Pick<ShootoutAttempt, 'team_id' | 'shooter_id' | 'scored'>;

async function emitAutofillProgress(
  onProgress: NhlAutofillOptions['onProgress'],
  progress: NhlAutofillProgress,
) {
  if (!onProgress) return;
  await onProgress(progress);
  await new Promise<void>((resolve) => {
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      setTimeout(resolve, 0);
      return;
    }
    window.requestAnimationFrame(() => resolve());
  });
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

export async function autofillGameFromNhlGamecenter(
  game: GameRecord,
  input: string,
  options: NhlAutofillOptions = {},
): Promise<NhlAutofillResult> {
  const emitProgress = (progress: NhlAutofillProgress) =>
    emitAutofillProgress(options.onProgress, progress);
  const context: NhlGameIdContext = {
    seasonName: game.season_name,
    scheduledAt: game.scheduled_at,
    gameType: game.game_type,
  };
  const gamecenterId = buildNhlGamecenterGameId(input, context);
  if (!gamecenterId) {
    throw new Error('Enter an NHL game number, full GameCenter id, or GameCenter URL.');
  }

  await emitProgress({
    step: 'fetch',
    message: `Fetching NHL GameCenter data for game ${gamecenterId}...`,
  });

  const base = `https://api-web.nhle.com/v1/gamecenter/${gamecenterId}`;
  const rosterReportUrl = buildRosterReportUrl(gamecenterId);
  const gameSummaryReportUrl = buildGameSummaryReportUrl(gamecenterId);
  const shootoutReportUrl = buildShootoutReportUrl(gamecenterId);
  const goalieToiReportUrls = buildGoalieToiReportUrls(gamecenterId);
  const boxscore = await fetchNhlJson(`${base}/boxscore`);
  const warnings: string[] = [];

  await emitProgress({
    step: 'match',
    message: 'Matching NHL date, teams, and existing game data...',
  });

  assertGameMatches(game, boxscore);

  const [playByPlay, rosterReport, gameSummaryReport, shootoutReport, goalieToiReports] = await Promise.all([
    fetchNhlJson(`${base}/play-by-play`),
    fetchOptionalRosterReport(rosterReportUrl),
    fetchOptionalGameSummaryReport(gameSummaryReportUrl),
    fetchOptionalShootoutReport(shootoutReportUrl),
    fetchOptionalTextReports(goalieToiReportUrls),
  ]);
  const shootoutGame = isShootoutGame(boxscore);

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

  const rosterDate = boxscore.gameDate ?? game.scheduled_at;
  const [initialAwayPlayers, initialHomePlayers] = await Promise.all([
    fetchTeamPlayers(game.away_team.id, game.season_id, rosterDate),
    fetchTeamPlayers(game.home_team.id, game.season_id, rosterDate),
  ]);
  const nhlPlayers = {
    away: getNhlPlayers(boxscore, 'away'),
    home: getNhlPlayers(boxscore, 'home'),
  };

  await emitProgress({
    step: 'roster',
    message: 'Matching dressed players to the local roster...',
  });

  // Before auto-creating, make sure a "missing" player isn't simply on the wrong
  // team in the database (e.g. a trade not yet recorded). Creating a duplicate
  // would be wrong, so stop and tell the user to move that player first.
  if (rosterReport) {
    const leaguePlayers = await fetchLeaguePlayers(game);
    if (leaguePlayers.length > 0) {
      const conflicts = [
        ...findCrossTeamPlayerConflicts(
          leaguePlayers,
          game.away_team.id,
          rosterReport.players.away,
          initialAwayPlayers,
          nhlPlayers.away,
        ).map((conflict) => ({ ...conflict, targetCode: game.away_team.code })),
        ...findCrossTeamPlayerConflicts(
          leaguePlayers,
          game.home_team.id,
          rosterReport.players.home,
          initialHomePlayers,
          nhlPlayers.home,
        ).map((conflict) => ({ ...conflict, targetCode: game.home_team.code })),
      ];
      if (conflicts.length > 0) {
        const lines = conflicts
          .map(
            (conflict) =>
              `• #${conflict.reportPlayer.sweaterNumber} ${conflict.reportPlayer.name} → ${conflict.targetCode} (currently on ${conflict.existing.team_code ?? 'another team'})`,
          )
          .join('\n');
        throw new Error(
          `Auto-fill stopped — ${conflicts.length} ${pluralize('player', conflicts.length)} in the roster ` +
            `report already ${conflicts.length === 1 ? 'exists' : 'exist'} on another team. ` +
            `Move ${conflicts.length === 1 ? 'this player' : 'these players'} to the correct team ` +
            `first, then re-run auto-fill:\n${lines}`,
        );
      }
    }
  }

  // Auto-create any dressed roster-report players missing from the local season
  // roster so matching below doesn't fail on recent call-ups/trades.
  const awayPlayers = rosterReport
    ? await ensureReportPlayersRostered(game, game.away_team.id, game.away_team.code, rosterReport.players.away, nhlPlayers.away, initialAwayPlayers, rosterDate, warnings)
    : initialAwayPlayers;
  const homePlayers = rosterReport
    ? await ensureReportPlayersRostered(game, game.home_team.id, game.home_team.code, rosterReport.players.home, nhlPlayers.home, initialHomePlayers, rosterDate, warnings)
    : initialHomePlayers;
  const matched = {
    away: matchNhlPlayers(nhlPlayers.away, awayPlayers, game.away_team.code, rosterReport?.players.away),
    home: matchNhlPlayers(nhlPlayers.home, homePlayers, game.home_team.code, rosterReport?.players.home),
  };
  if (matched.away.length === 0 || matched.home.length === 0) {
    throw new Error('NHL boxscore did not include dressed player stats for both teams.');
  }

  const rosterMatched = rosterReport
    ? {
        away: matchReportPlayers(rosterReport.players.away, awayPlayers, game.away_team.code, nhlPlayers.away),
        home: matchReportPlayers(rosterReport.players.home, homePlayers, game.home_team.code, nhlPlayers.home),
      }
    : matched;

  await syncLeaguePlayerNumbers(matched);
  await syncGameRoster(game, rosterMatched);
  await emitProgress({
    step: 'roster',
    message: `Roster saved (${rosterMatched.away.length + rosterMatched.home.length} players).`,
    refresh: true,
  });
  const startingGoaliesSet = rosterReport
    ? await syncStartingGoalies(game, rosterMatched, warnings)
    : 0;
  if (startingGoaliesSet > 0) {
    await emitProgress({
      step: 'lineups',
      message: 'Starting goalies saved.',
      refresh: true,
    });
  }

  const allMatchedByNhlId = new Map<number, MatchedPlayer>();
  [...matched.away, ...matched.home].forEach((player) => {
    allMatchedByNhlId.set(player.playerId, player);
  });

  const goals = getNhlGoals(playByPlay, boxscore);
  const reportTimes = rosterReport
    ? inferReportTimes(rosterReport, boxscore.gameDate ?? game.scheduled_at, boxscore.startTimeUTC)
    : {};
  const gameStartIso = reportTimes.startIso ?? validIsoOrUndefined(boxscore.startTimeUTC);

  await apiPatch(`/admin/games/${game.id}`, {
    league_game_number: extractLeagueGameNumber(gamecenterId),
    scheduled_at: boxscore.gameDate ?? undefined,
    scheduled_time: boxscore.startTimeUTC ? easternScheduledTime(boxscore.startTimeUTC) : undefined,
    venue: rosterReport?.venue ?? readText(boxscore.venue) ?? undefined,
    status: 'in_progress',
    current_period: '1',
    shootout: shootoutGame,
    time_start: gameStartIso,
  });

  await emitProgress({
    step: 'start',
    message: 'Game moved to in-progress. Filling periods...',
    refresh: true,
  });

  const goalsByPeriod = groupGoalsByPeriodNumber(goals);
  const playedPeriodNumbers = getPlayedPeriodNumbers(boxscore, goals, shootoutGame);
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
      const scorer = allMatchedByNhlId.get(goal.scorerId);
      if (!scorer) throw new Error(`Could not match NHL scorer ${goal.scorerId}.`);

      const goalPayload: PostGoalData = {
        team_id: teamId,
        period: goal.period,
        period_time: goal.periodTime,
        goal_type: goal.goalType,
        empty_net: goal.emptyNet,
        penalty_shot: goal.penaltyShot,
        scorer_id: scorer.localId,
        assist_1_id: resolveOptionalPlayerId(goal.assist1Id, allMatchedByNhlId),
        assist_2_id: resolveOptionalPlayerId(goal.assist2Id, allMatchedByNhlId),
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
        await emitProgress({
          step: 'goals',
          message: `Checked goal ${processedGoals} of ${goals.length}.`,
          completed: processedGoals,
          total: goals.length,
          refresh: true,
        });
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

  const playByPlayShootoutAttempts = shootoutGame
    ? resolvePlayByPlayShootoutAttempts(playByPlay, boxscore, matched, game)
    : [];
  const reportShootoutAttempts = shootoutGame && playByPlayShootoutAttempts.length === 0
    ? resolveShootoutAttempts(shootoutReport?.attempts ?? [], matched, game)
    : [];
  const shootoutAttempts = playByPlayShootoutAttempts.length > 0
    ? playByPlayShootoutAttempts
    : reportShootoutAttempts;
  if (shootoutGame && shootoutAttempts.length === 0) {
    throw new Error('NHL shootout report could not be parsed into shootout attempts.');
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

  const periodShots = getPeriodShots(playByPlay, boxscore);
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

  const goalieStats = getGoalieStats(game, boxscore, matched);
  const goalieStints = buildGoalieStintPayloads(
    game,
    boxscore,
    playByPlay,
    goalieToiReports,
    matched,
    goalieStats,
  );
  const desiredGoalieStints = goalieStints.length > 0
    ? goalieStints
    : goalieStats.map(goalieStatToStintPayload);
  if (desiredGoalieStints.length > 0) {
    await syncGoalieStints(game.id, desiredGoalieStints);
    await emitProgress({
      step: 'goalies',
      message: `Saved ${desiredGoalieStints.length} goalie stint${desiredGoalieStints.length === 1 ? '' : 's'}.`,
      refresh: true,
    });
  }

  const reportStars = gameSummaryReport
    ? resolveSummaryStars(gameSummaryReport.stars, matched, game)
    : [];
  const inferredStars = inferStars(boxscore, goals, matched);
  const stars = [...new Set([...reportStars, ...inferredStars])].slice(0, 3);
  await emitProgress({
    step: 'final',
    message: 'Finalizing game details and three stars...',
  });
  await apiPatch(`/admin/games/${game.id}`, {
    scheduled_at: boxscore.gameDate ?? undefined,
    scheduled_time: boxscore.startTimeUTC ? easternScheduledTime(boxscore.startTimeUTC) : undefined,
    venue: rosterReport?.venue ?? readText(boxscore.venue) ?? undefined,
    status: 'final',
    current_period: getCurrentPeriod(boxscore, goals),
    overtime_periods: getOvertimePeriods(boxscore, goals),
    shootout: shootoutGame,
    shootout_first_team_id: shootoutGame ? shootoutAttempts[0]?.team_id : undefined,
    time_start: gameStartIso,
    time_end: reportTimes.endIso ?? undefined,
    star_1_id: stars[0] ?? undefined,
    star_2_id: stars[1] ?? undefined,
    star_3_id: stars[2] ?? undefined,
  });
  await emitProgress({
    step: 'complete',
    message: 'NHL auto-fill complete.',
    refresh: true,
  });

  if (stars.length < 3) warnings.push('Less than three stars could be inferred from matched players.');
  if (gameSummaryReport && reportStars.length < Math.min(3, gameSummaryReport.stars.length)) {
    warnings.push('NHL game summary stars were found, but not all could be matched to local players.');
  }
  if (!rosterReport) {
    warnings.push('NHL roster report was unavailable, so roster data came from the GameCenter boxscore.');
  } else if (!reportTimes.startIso || !reportTimes.endIso) {
    warnings.push('NHL roster report was found, but actual start/end times could not both be parsed.');
  }
  if (shootoutGame && !shootoutReport) {
    warnings.push('NHL shootout report was unavailable or empty.');
  }
  if (shootoutGame && playByPlayShootoutAttempts.length === 0 && reportShootoutAttempts.length > 0) {
    warnings.push('NHL shootout attempts came from the HTML shootout report because GameCenter play-by-play had no attempts.');
  }
  if (goalsSkipped > 0) {
    warnings.push(`${goalsSkipped} existing ${pluralize('goal', goalsSkipped)} matched NHL data and were skipped.`);
  }
  if (goalsUpdated > 0) {
    warnings.push(`${goalsUpdated} existing ${pluralize('goal', goalsUpdated)} matched NHL data and were updated.`);
  }
  if (shootoutAttemptsSkipped > 0) {
    warnings.push(
      `${shootoutAttemptsSkipped} existing shootout ${pluralize('attempt', shootoutAttemptsSkipped)} matched NHL data and were skipped.`,
    );
  }

  return {
    warnings,
    summary: {
      gameId: gamecenterId,
      goalsCreated,
      rosterPlayers: rosterMatched.away.length + rosterMatched.home.length,
      periodShots,
      goalieStats: goalieStats.length,
      starsSet: stars.length,
      startingGoaliesSet,
      shootoutAttempts: shootoutAttemptsCreated,
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

async function fetchOptionalTextReports(urls: string[]) {
  const reports = await Promise.all(
    urls.map(async (url) => {
      try {
        const { data } = await axios.get<string>(`${API}/admin/games/nhl-api`, {
          headers: authHeaders(),
          params: { url },
          responseType: 'text',
        });
        return typeof data === 'string' && data.trim() ? data : null;
      } catch {
        return null;
      }
    }),
  );
  return reports.filter((report): report is string => !!report);
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

function buildGoalieToiReportUrls(gamecenterId: string) {
  const seasonStart = gamecenterId.slice(0, 4);
  const seasonEnd = String(Number(seasonStart) + 1);
  const gameTypeAndNumber = gamecenterId.slice(4);
  return ['TV', 'TH'].map(
    (prefix) =>
      `https://www.nhl.com/scores/htmlreports/${seasonStart}${seasonEnd}/${prefix}${gameTypeAndNumber}.HTM`,
  );
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

function pluralize(word: string, count: number) {
  return count === 1 ? word : `${word}s`;
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

const LOCAL_POSITIONS = ['C', 'LW', 'RW', 'F', 'D', 'LD', 'RD', 'G'];

/** Map an NHL roster-report position (C/L/R/D/G) to a local player position. */
function reportPositionToLocalPosition(position: string | null | undefined): string {
  const normalized = (position ?? '').toUpperCase().trim();
  if (normalized === 'L') return 'LW';
  if (normalized === 'R') return 'RW';
  return LOCAL_POSITIONS.includes(normalized) ? normalized : 'F';
}

/** Title-case an ALL-CAPS report name, preserving hyphen/apostrophe/period breaks. */
function toTitleCaseName(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|[\s'’.-])([a-z])/g, (_match, separator, char) => `${separator}${char.toUpperCase()}`);
}

function splitReportName(fullName: string): { firstName: string; lastName: string } {
  const titled = toTitleCaseName(normalizeReportPlayerName(fullName));
  const parts = titled.split(' ').filter(Boolean);
  if (parts.length <= 1) {
    const only = parts[0] ?? titled;
    return { firstName: only, lastName: only };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

interface LeaguePlayer {
  id: string;
  league_player_number?: string | null;
  first_name: string;
  last_name: string;
  team_id: string | null;
  team_code: string | null;
}

/** All players rostered in this game's league for the season, with their team. */
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

/** Last-name + first-initial key — catches "Nick Paul" vs "Nicholas Paul". */
function lastNameInitialKey(firstName: string, lastName: string) {
  return `${normalizeNameKey(lastName)}|${normalizeNameKey(firstName).slice(0, 1)}`;
}

interface PlayerConflict {
  reportPlayer: ReportRosterPlayer;
  existing: LeaguePlayer;
}

/**
 * Find roster-report players who are missing from the target team's roster but
 * already exist on a different team in the league — these must be moved, not
 * re-created as duplicates.
 */
function findCrossTeamPlayerConflicts(
  leaguePlayers: LeaguePlayer[],
  teamId: string,
  reportPlayers: ReportRosterPlayer[],
  localPlayers: TeamPlayerRecord[],
  nhlPlayers: NhlPlayer[] = [],
): PlayerConflict[] {
  const rosteredJerseys = new Set(
    localPlayers.map((player) => player.jersey_number).filter((jersey): jersey is number => jersey != null),
  );
  const rosteredLeaguePlayerNumbers = new Set(
    localPlayers
      .map((player) => player.league_player_number)
      .filter((value): value is string => !!value),
  );
  const leaguePlayerNumberBySweater = new Map(
    nhlPlayers.map((player) => [player.sweaterNumber, String(player.playerId)]),
  );
  const missing = reportPlayers.filter(
    (player) =>
      Number.isFinite(player.sweaterNumber) &&
      !rosteredJerseys.has(player.sweaterNumber) &&
      !rosteredLeaguePlayerNumbers.has(leaguePlayerNumberBySweater.get(player.sweaterNumber) ?? ''),
  );
  if (missing.length === 0) return [];

  const byFullName = new Map<string, LeaguePlayer>();
  const byLastInitial = new Map<string, LeaguePlayer>();
  const byLeaguePlayerNumber = new Map<string, LeaguePlayer>();
  for (const player of leaguePlayers) {
    if (!player.team_id || player.team_id === teamId) continue;
    if (player.league_player_number) byLeaguePlayerNumber.set(player.league_player_number, player);
    const fullKey = normalizeNameKey(`${player.first_name} ${player.last_name}`);
    const liKey = lastNameInitialKey(player.first_name, player.last_name);
    if (!byFullName.has(fullKey)) byFullName.set(fullKey, player);
    if (!byLastInitial.has(liKey)) byLastInitial.set(liKey, player);
  }
  const conflicts: PlayerConflict[] = [];
  for (const reportPlayer of missing) {
    const { firstName, lastName } = splitReportName(reportPlayer.name);
    const leaguePlayerNumber = leaguePlayerNumberBySweater.get(reportPlayer.sweaterNumber);
    const existing =
      (leaguePlayerNumber ? byLeaguePlayerNumber.get(leaguePlayerNumber) : undefined) ??
      byFullName.get(normalizeNameKey(`${firstName} ${lastName}`)) ??
      byLastInitial.get(lastNameInitialKey(firstName, lastName));
    if (existing) conflicts.push({ reportPlayer, existing });
  }
  return conflicts;
}

/**
 * Ensure every dressed player in the roster report exists on the local season
 * roster. Any player missing by jersey is created from the report's full name
 * and position, then added to the team's season roster — so autofill can match
 * recent call-ups/trades without a manual roster edit first. Returns the (possibly
 * augmented) local player list.
 */
async function ensureReportPlayersRostered(
  game: GameRecord,
  teamId: string,
  teamCode: string,
  reportPlayers: ReportRosterPlayer[],
  nhlPlayers: NhlPlayer[],
  localPlayers: TeamPlayerRecord[],
  gameDate: string | null | undefined,
  warnings: string[],
): Promise<TeamPlayerRecord[]> {
  const rosteredJerseys = new Set(
    localPlayers.map((player) => player.jersey_number).filter((jersey): jersey is number => jersey != null),
  );
  const rosteredLeaguePlayerNumbers = new Set(
    localPlayers
      .map((player) => player.league_player_number)
      .filter((value): value is string => !!value),
  );
  const nhlPlayerBySweater = new Map(nhlPlayers.map((player) => [player.sweaterNumber, player]));
  const missing = reportPlayers.filter(
    (player) => {
      if (!Number.isFinite(player.sweaterNumber) || rosteredJerseys.has(player.sweaterNumber)) {
        return false;
      }
      const leaguePlayerNumber = nhlPlayerBySweater.get(player.sweaterNumber)?.playerId;
      return !rosteredLeaguePlayerNumbers.has(leaguePlayerNumber ? String(leaguePlayerNumber) : '');
    },
  );
  if (missing.length === 0) return localPlayers;

  const { created } = await apiPost<{ created: Array<{ id: string }> }, { players: Array<Record<string, unknown>> }>(
    '/admin/players/bulk',
    {
      players: missing.map((player) => {
        const { firstName, lastName } = splitReportName(player.name);
        const nhlPlayer = nhlPlayerBySweater.get(player.sweaterNumber);
        return {
          first_name: firstName,
          last_name: lastName,
          league_player_number: nhlPlayer ? String(nhlPlayer.playerId) : null,
          position: reportPositionToLocalPosition(player.position),
        };
      }),
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
    `Auto-created ${missing.length} missing ${teamCode} ${pluralize('player', missing.length)} from the roster report: ${missing
      .map((player) => `#${player.sweaterNumber} ${player.name}`)
      .join(', ')}.`,
  );

  return fetchTeamPlayers(teamId, game.season_id, gameDate);
}

function assertGameMatches(game: GameRecord, boxscore: any) {
  const nhlDate = typeof boxscore?.gameDate === 'string' ? boxscore.gameDate.slice(0, 10) : null;
  const localDates = nhlLocalDateCandidates(game.scheduled_at);
  if (nhlDate && localDates.length > 0 && !localDates.includes(nhlDate)) {
    throw new Error(
      `NHL game is scheduled for ${nhlDate}, but this page is scheduled for ${localDates.join(' or ')}.`,
    );
  }

  const awayCode = readText(boxscore?.awayTeam?.abbrev) ?? boxscore?.awayTeam?.abbrev;
  const homeCode = readText(boxscore?.homeTeam?.abbrev) ?? boxscore?.homeTeam?.abbrev;
  if (awayCode !== game.away_team.code || homeCode !== game.home_team.code) {
    throw new Error(
      `NHL game is ${awayCode} @ ${homeCode}, but this page is ${game.away_team.code} @ ${game.home_team.code}.`,
    );
  }
}

function nhlLocalDate(value: string | null | undefined) {
  if (!value) return null;
  const rawDate = value.slice(0, 10);
  if (!value.includes('T')) return rawDate;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return rawDate;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return year && month && day ? `${year}-${month}-${day}` : rawDate;
}

function nhlLocalDateCandidates(value: string | null | undefined) {
  if (!value) return [];
  const rawDate = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
  return Array.from(
    new Set([nhlLocalDate(value), rawDate].filter((date): date is string => !!date)),
  );
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
          // NHL boxscores now expose a single `name` ({default}); fall back to the
          // older firstName/lastName fields for compatibility.
          name:
            readText(player.name) ||
            [readText(player.firstName), readText(player.lastName)].filter(Boolean).join(' '),
          group,
        }))
      : [],
  );
}

function matchNhlPlayers(
  nhlPlayers: NhlPlayer[],
  localPlayers: TeamPlayerRecord[],
  teamCode: string,
  reportPlayers: ReportRosterPlayer[] = [],
): MatchedPlayer[] {
  const localByLeagueNumber = localPlayersByLeaguePlayerNumber(localPlayers);
  const localByJersey = new Map<number, TeamPlayerRecord[]>();
  localPlayers.forEach((player) => {
    if (player.jersey_number == null) return;
    const rows = localByJersey.get(player.jersey_number) ?? [];
    rows.push(player);
    localByJersey.set(player.jersey_number, rows);
  });
  // The boxscore only carries an abbreviated name (e.g. "N. Paul"); prefer the
  // full name from the roster report so the "missing player" message is actionable.
  const reportNameByJersey = new Map(
    reportPlayers.map((player) => [player.sweaterNumber, player.name]),
  );

  const missing: string[] = [];
  const matched = nhlPlayers.flatMap((nhlPlayer) => {
    const leaguePlayerNumber = String(nhlPlayer.playerId);
    const rows = localByJersey.get(nhlPlayer.sweaterNumber) ?? [];
    const local = localByLeagueNumber.get(leaguePlayerNumber) ?? rows[0];
    if (!local) {
      const fullName = reportNameByJersey.get(nhlPlayer.sweaterNumber) || nhlPlayer.name;
      missing.push(`#${nhlPlayer.sweaterNumber} ${fullName || `NHL ${nhlPlayer.playerId}`}`);
      return [];
    }
    return [{ ...nhlPlayer, localId: local.id, localLeaguePlayerNumber: local.league_player_number ?? null }];
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
  nhlPlayers: NhlPlayer[] = [],
): MatchedRosterPlayer[] {
  const localByLeagueNumber = localPlayersByLeaguePlayerNumber(localPlayers);
  const leaguePlayerNumberBySweater = new Map(
    nhlPlayers.map((player) => [player.sweaterNumber, String(player.playerId)]),
  );
  const localByJersey = localPlayersByJersey(localPlayers);
  const missing: string[] = [];
  const matched = reportPlayers.flatMap((reportPlayer) => {
    const leaguePlayerNumber = leaguePlayerNumberBySweater.get(reportPlayer.sweaterNumber);
    const local =
      (leaguePlayerNumber ? localByLeagueNumber.get(leaguePlayerNumber) : undefined) ??
      (localByJersey.get(reportPlayer.sweaterNumber) ?? [])[0];
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
        .map((player) => `${player.name} is ${player.localLeaguePlayerNumber}, NHL reports ${player.playerId}`)
        .join('; ')}.`,
    );
  }

  const updates = players.filter(
    (player) => !player.localLeaguePlayerNumber,
  );
  await Promise.all(
    updates.map((player) =>
      apiPatch(`/admin/players/${player.localId}`, {
        league_player_number: String(player.playerId),
      }),
    ),
  );
}

function localPlayersByLeaguePlayerNumber(localPlayers: TeamPlayerRecord[]) {
  const localByLeagueNumber = new Map<string, TeamPlayerRecord>();
  localPlayers.forEach((player) => {
    if (!player.league_player_number) return;
    localByLeagueNumber.set(player.league_player_number, player);
  });
  return localByLeagueNumber;
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
  // Official NHL reports put the "# / Pos / Name" column headers in <td class="heading">
  // cells (not <th>), and nest each roster table inside layout tables. Match a table by
  // a header row built from its *own* direct cells so wrapper tables don't qualify.
  return [...doc.querySelectorAll('table')]
    .filter((table) =>
      [...table.querySelectorAll('tr')]
        .filter((row) => row.closest('table') === table)
        .some((row) => {
          const cells = [...row.children]
            .filter((cell) => cell.tagName === 'TD' || cell.tagName === 'TH')
            .map((cell) => normalizeReportText(cell.textContent));
          return cells.includes('#') && cells.includes('Pos') && cells.includes('Name');
        }),
    )
    .slice(0, 2);
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
  const indexedNameCell = readIndexedCell(cells, headers, /shooter|player|name/);
  const sweaterNumber =
    readExplicitSweaterNumber(indexedNameCell ? [indexedNameCell] : []) ??
    readShootoutSweaterNumber(cells, headers) ??
    readExplicitSweaterNumber(cells);
  const nameCell =
    indexedNameCell ??
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
    const shooterPrefixMatch = cell.match(/(?:^|\s)#?\s*(\d{1,2})\s+[A-Z]\./);
    if (shooterPrefixMatch) return Number(shooterPrefixMatch[1]);
    const hashMatch = cell.match(/#\s*(\d{1,2})\b/);
    if (hashMatch) return Number(hashMatch[1]);
  }
  return undefined;
}

function shootoutResultScored(value: string) {
  const text = normalizeReportText(value).toLowerCase();
  if (text === 'g') return true;
  if (['m', 'p', 's'].includes(text)) return false;
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
  text = text.replace(/^\d{1,2}\s+/, ' ');
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

// A single hockey position token, used to recognise an official "3 Stars" row
// shape: [rank, team, position, "## NAME"] (or "## "/"NAME" as separate cells).
const STAR_POSITION_TOKEN = /^(?:C|L|R|D|G|F|LW|RW|LD|RD)$/i;

function directReportCells(row: Element): string[] {
  return [...row.children]
    .filter((child) => child.tagName === 'TD' || child.tagName === 'TH')
    .map((cell) => normalizeReportText(cell.textContent))
    .filter(Boolean);
}

/**
 * Parse a single "3 Stars" row from its *direct* cells. The official NHL game
 * summary lays OFFICIALS and 3 STARS out as side-by-side nested tables, so the
 * star rows must be read by their own direct children — flattening a parent row
 * recursively pulls in the officials (e.g. "#20 Mitch Dunning") and corrupts the
 * result. The strict shape (rank + team code + position + named player) keeps
 * scoring/penalty summary rows from matching.
 */
function parseStrictStarRow(cells: string[]): NhlSummaryStar | null {
  if (cells.length < 4) return null;
  if (!/^[123](?:st|nd|rd)?\.?$/i.test(cells[0].trim())) return null;
  const rank = Number(cells[0].replace(/[^\d]/g, ''));
  if (rank < 1 || rank > 3) return null;

  const teamCode = isLikelyTeamCode(cells[1]) ? cells[1] : undefined;
  const positionIndex = cells.findIndex((cell) => STAR_POSITION_TOKEN.test(cell.trim()));
  if (!teamCode || positionIndex < 2) return null;

  const rest = cells.slice(positionIndex + 1).join(' ').trim();
  const sweaterMatch = rest.match(/\b(\d{1,2})\b/);
  const sweaterNumber = sweaterMatch ? Number(sweaterMatch[1]) : undefined;
  const name = normalizeReportPlayerName(rest.replace(/\b\d{1,2}\b/, ' '));
  return isLikelyPlayerName(name) ? { rank, sweaterNumber, teamCode, name } : null;
}

function parseStrictStarRows(doc: Document): NhlSummaryStar[] {
  const stars: NhlSummaryStar[] = [];
  for (const row of doc.querySelectorAll('tr')) {
    const star = parseStrictStarRow(directReportCells(row));
    if (star && !stars.some((existing) => existing.rank === star.rank)) stars.push(star);
    if (stars.length >= 3) break;
  }
  return stars.sort((a, b) => a.rank - b.rank);
}

function parseSummaryStars(doc: Document): NhlSummaryStar[] {
  const strictStars = parseStrictStarRows(doc);
  if (strictStars.length > 0) return strictStars;

  const threeStarsByStars = parseThreeStarsBySection(doc);
  if (threeStarsByStars.length > 0) return threeStarsByStars;

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

function parseThreeStarsBySection(doc: Document): NhlSummaryStar[] {
  const tableStars = [...doc.querySelectorAll('table')]
    .map(parseThreeStarsByTable)
    .find((stars) => stars.length > 0);
  if (tableStars) return tableStars;

  const lines = [...doc.querySelectorAll('td, th')]
    .map((cell) => normalizeReportText(cell.textContent))
    .filter(Boolean);
  const markerIndex = lines.findIndex((line) => isThreeStarsByMarker(line));
  return markerIndex >= 0 ? parseThreeStarsByLines(lines.slice(markerIndex + 1, markerIndex + 30)) : [];
}

function parseThreeStarsByTable(table: Element): NhlSummaryStar[] {
  const rows = [...table.querySelectorAll('tr')].map((row) =>
    [...row.querySelectorAll('td, th')]
      .map((cell) => normalizeReportText(cell.textContent))
      .filter(Boolean),
  );
  const markerIndex = rows.findIndex((cells) => cells.some(isThreeStarsByMarker));
  if (markerIndex < 0) return [];

  const stars: NhlSummaryStar[] = [];
  for (const cells of rows.slice(markerIndex + 1)) {
    if (cells.some(isReportSectionMarker) && stars.length > 0) break;
    const star = parseThreeStarsByCells(cells);
    if (star && !stars.some((existing) => existing.rank === star.rank)) stars.push(star);
    if (stars.length >= 3) break;
  }
  return stars.sort((a, b) => a.rank - b.rank);
}

function parseThreeStarsByLines(lines: string[]): NhlSummaryStar[] {
  const stars: NhlSummaryStar[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const rank = readStarRank([lines[index]]);
    if (!rank || stars.some((existing) => existing.rank === rank)) continue;
    const windowCells = lines.slice(index, index + 5);
    if (windowCells.some(isReportSectionMarker) && stars.length > 0) break;
    const star = parseThreeStarsByCells(windowCells) ?? parseThreeStarsByCells([lines[index]]);
    if (star && !stars.some((existing) => existing.rank === star.rank)) stars.push(star);
    if (stars.length >= 3) break;
  }
  return stars.sort((a, b) => a.rank - b.rank);
}

function parseThreeStarsByCells(cells: string[]): NhlSummaryStar | null {
  if (cells.length === 0) return null;
  const joined = cells.join(' ');
  if (
    isThreeStarsByMarker(joined) ||
    /^star\s+team\s+pos\s+(?:no\.?|#)\s+player$/i.test(joined) ||
    /^(?:star|team|pos|player|no\.?|#)$/i.test(joined)
  ) {
    return null;
  }

  const rankIndex = cells.findIndex((cell) => readStarRank([cell]) != null);
  const rank = rankIndex >= 0 ? readStarRank([cells[rankIndex]]) : readStarRank([joined]);
  if (!rank) return null;

  const teamCode = cells.find((cell, index) => index !== rankIndex && isLikelyTeamCode(cell));
  const sweaterNumber = readSweaterNumberExcludingCells(cells, new Set([rankIndex]));
  const name =
    cells.map((cell, index) =>
      index === rankIndex ? '' : cleanSummaryStarName(cell, rank, teamCode, sweaterNumber),
    ).find((cell) => isLikelyPlayerName(cell)) ??
    cleanSummaryStarName(joined, rank, teamCode, sweaterNumber);

  return isLikelyPlayerName(name)
    ? {
        rank,
        sweaterNumber,
        teamCode,
        name: normalizeReportPlayerName(name),
      }
    : null;
}

function isThreeStarsByMarker(value: string) {
  return /(?:three|3)\s+stars\s+by/i.test(normalizeReportText(value));
}

function isReportSectionMarker(value: string) {
  const text = normalizeReportText(value);
  return (
    !isThreeStarsByMarker(text) &&
    /^(?:game\s+summary|scoring\s+summary|penalty\s+summary|shots\s+by\s+period|power\s+play|officials|scratches|goaltender\s+summary)\b/i.test(text)
  );
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

function readSweaterNumberExcludingCells(cells: string[], excludedIndexes: Set<number>) {
  for (const [index, cell] of cells.entries()) {
    if (excludedIndexes.has(index)) continue;
    const normalized = cell.replace('#', '').trim();
    if (/^\d{1,2}$/.test(normalized)) return Number(normalized);
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
  return /^[A-Z]{2,4}$/.test(value) && !['STAR', 'TEAM', 'NO', 'POS', 'NAME', 'PLAYER', 'LW', 'RW', 'LD', 'RD'].includes(value);
}

function isLikelyPlayerName(value: string | undefined) {
  return !!value && /[A-Za-z]/.test(value) && !isLikelyTeamCode(value) && !/^\d+$/.test(value);
}

function parseReportGameInfo(doc: Document): Pick<NhlRosterReport, 'venue' | 'start' | 'end'> {
  const gameInfoCells = [...doc.querySelectorAll('#GameInfo td, #GameInfo th')];
  const sourceCells =
    gameInfoCells.length > 0
      ? gameInfoCells
      : [...doc.querySelectorAll('td, th, div, span')].slice(0, 80);
  const lines = sourceCells
    .map((cell) => normalizeReportText(cell.textContent))
    .filter(Boolean);
  const joined = normalizeReportText(lines.join(' '));

  return {
    venue: parseReportVenue(lines, joined),
    start: parseReportClock(joined, 'Start'),
    end: parseReportClock(joined, 'End'),
  };
}

function parseReportVenue(lines: string[], joined: string) {
  const attendanceLine = lines.find((line) => /\bAttendance\b/i.test(line));
  const venuePattern =
    /\bAttendance\s+[\d,]+\s+at\s+(.+?)(?=\s+\b(?:Start|Game|Referee|Linesman|Officials)\b|$)/i;
  const lineMatch = attendanceLine?.match(venuePattern);
  if (lineMatch?.[1]) return lineMatch[1].trim();

  const joinedMatch = joined.match(venuePattern);
  return joinedMatch?.[1]?.trim();
}

function parseReportClock(text: string, label: 'Start' | 'End'): NhlReportClock | undefined {
  const match = text.match(
    new RegExp(`\\b${label}\\s+(\\d{1,2}:\\d{2})(?:\\s*([AP]M))?\\s+([A-Z]{2,4})\\b`, 'i'),
  );
  if (!match) return undefined;
  const meridiem = match[2]?.toUpperCase();
  return {
    clock: match[1],
    meridiem: meridiem === 'AM' || meridiem === 'PM' ? meridiem : undefined,
    zone: match[3].toUpperCase(),
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

async function syncStartingGoalies(
  game: GameRecord,
  matched: Record<TeamSide, MatchedRosterPlayer[]>,
  warnings: string[],
) {
  let saved = 0;
  for (const side of ['away', 'home'] as const) {
    const slots = buildStartingGoalieSlot(matched[side]);
    if (!slots) {
      const teamCode = side === 'away' ? game.away_team.code : game.home_team.code;
      warnings.push(`Could not find a bold starting goalie for ${teamCode} in the NHL roster report.`);
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

function buildStartingGoalieSlot(players: MatchedRosterPlayer[]) {
  const starters = players.filter((player) => player.starter);
  const goalies = starters.filter((player) => player.position === 'G');
  if (goalies.length !== 1) return null;

  return [{ position_slot: 'G' as const, player_id: goalies[0].localId }];
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
        emptyNet: isEmptyNetGoal(play, teamSide),
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

function buildGoalieStintPayloads(
  game: GameRecord,
  boxscore: any,
  playByPlay: any,
  goalieToiReports: string[],
  matched: Record<TeamSide, MatchedPlayer[]>,
  goalieStats: UpsertGoalieStatData[],
): GoalieStintPayload[] {
  const goaliesByTeam = getGoaliesFromLanding(boxscore);
  const parsedStints = buildParsedGoalieStints(goalieToiReports, playByPlay, goaliesByTeam);
  const rawStints = parsedStints.length > 0 ? parsedStints : buildDefaultGoalieStints(goaliesByTeam);
  const matchedByNhlId = new Map(
    (['away', 'home'] as const).flatMap((side) =>
      matched[side].map((player) => [player.playerId, { ...player, side }] as const),
    ),
  );
  const statsByGoalieId = new Map(goalieStats.map((stat) => [stat.goalie_id, stat]));
  const stintCountByGoalieId = new Map<number, number>();
  rawStints.forEach((stint) => {
    stintCountByGoalieId.set(stint.goalieId, (stintCountByGoalieId.get(stint.goalieId) ?? 0) + 1);
  });

  const seenGoalieStints = new Map<number, number>();
  return rawStints
    .map((stint) => {
      const matchedGoalie = matchedByNhlId.get(stint.goalieId);
      if (!matchedGoalie) return null;

      const enteredPeriod = normalizeGoalieStintPeriod(stint.enteredPeriod);
      if (!enteredPeriod) return null;

      const stintIndex = seenGoalieStints.get(stint.goalieId) ?? 0;
      seenGoalieStints.set(stint.goalieId, stintIndex + 1);
      const goalieStat = statsByGoalieId.get(matchedGoalie.localId);
      const useGoalieTotals = (stintCountByGoalieId.get(stint.goalieId) ?? 0) <= 1 || stintIndex === 0;
      const stintCount = stintCountByGoalieId.get(stint.goalieId) ?? 0;
      const timeOnIce = stintCount <= 1 ? parseNhlToiSeconds(stint.toi) : null;

      return {
        goalie_id: matchedGoalie.localId,
        team_id: matchedGoalie.side === 'away' ? game.away_team.id : game.home_team.id,
        entered_period: enteredPeriod,
        entered_time: normalizeGoalieStintTime(stint.enteredTime, enteredPeriod, stintIndex),
        exited_period: normalizeGoalieStintPeriod(stint.exitedPeriod),
        exited_time: normalizeGoalieStintTime(stint.exitedTime),
        shots_against: useGoalieTotals ? goalieStat?.shots_against ?? 0 : 0,
        goals_against: useGoalieTotals ? goalieStat?.goals_against ?? null : null,
        ...(timeOnIce == null ? {} : { time_on_ice: timeOnIce }),
      } satisfies GoalieStintPayload;
    })
    .filter((stint): stint is GoalieStintPayload => !!stint);
}

function buildParsedGoalieStints(
  goalieToiReports: string[],
  playByPlay: any,
  goaliesByTeam: GoaliesByTeam,
) {
  const toiStints = buildGoalieStintsFromToiHtml(goalieToiReports, goaliesByTeam)
    .filter((stint) => !stint.timingUnavailable);
  return toiStints.length > 0
    ? toiStints
    : buildGoalieStints(playByPlay, goaliesByTeam).filter((stint) => !stint.timingUnavailable);
}

function buildDefaultGoalieStints(goaliesByTeam: GoaliesByTeam): GoalieStint[] {
  return (['away', 'home'] as const).flatMap((side) =>
    goaliesByTeam[side]
      .filter(goalieActuallyPlayed)
      .map((goalie) => ({
        teamSide: side,
        teamAbbrev: goalie.teamAbbrev ?? side.toUpperCase(),
        goalieId: goalie.playerId,
        goalieName: goalie.name,
        enteredPeriod: 'P1',
        enteredTime: '00:00',
        exitedPeriod: null,
        exitedTime: null,
        toi: goalie.toi,
      })),
  );
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

function goalieStatToStintPayload(stat: UpsertGoalieStatData): GoalieStintPayload {
  return {
    goalie_id: stat.goalie_id,
    team_id: stat.team_id,
    entered_period: stat.entered_period || '1',
    entered_time: stat.sub_time || null,
    shots_against: stat.shots_against,
    goals_against: stat.goals_against ?? null,
  };
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
    ('time_on_ice' in desired &&
      nullishNumber(existing.time_on_ice) !== nullishNumber(desired.time_on_ice))
  );
}

function parseNhlToiSeconds(value: string | null | undefined) {
  const match = String(value ?? '').trim().match(/^(\d{1,3}):([0-5]\d)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function normalizeGoalieStintPeriod(period: string | null | undefined) {
  if (!period) return null;
  const normalized = period.replace(/^P/i, '').toUpperCase();
  if (['1', '2', '3'].includes(normalized)) return normalized;
  if (normalized === 'OT' || Number(normalized) > 3) return 'OT';
  if (normalized === 'SO') return 'SO';
  return null;
}

function normalizeGoalieStintTime(
  time: string | null | undefined,
  enteredPeriod?: string,
  goalieStintIndex = 0,
) {
  if (!time || /^unknown$/i.test(time)) return null;
  const normalized = time.replace(/^0(\d:)/, '$1');
  if (enteredPeriod === '1' && goalieStintIndex === 0 && ['00:00', '0:00'].includes(time)) return null;
  return normalized;
}

function nullish(value: string | null | undefined) {
  return value ?? null;
}

function nullishNumber(value: number | null | undefined) {
  return value == null ? null : Number(value);
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

function resolvePlayByPlayShootoutAttempts(
  playByPlay: any,
  boxscore: any,
  matched: Record<TeamSide, MatchedPlayer[]>,
  game: GameRecord,
): ShootoutAttemptPayload[] {
  const matchedByNhlId = new Map(
    [...matched.away, ...matched.home].map((player) => [player.playerId, player.localId]),
  );
  const teamIdByNhlId = new Map([
    [Number(boxscore.awayTeam?.id), game.away_team.id],
    [Number(boxscore.homeTeam?.id), game.home_team.id],
  ]);

  return getPlays(playByPlay)
    .filter((play) => isShootoutPlay(play) && isShootoutAttemptPlay(play))
    .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0))
    .map((play) => {
      const shooterNhlId = shootoutShooterId(play);
      const teamId = teamIdByNhlId.get(Number(play.details?.eventOwnerTeamId));
      const shooterId = shooterNhlId ? matchedByNhlId.get(shooterNhlId) : undefined;
      if (!teamId || !shooterId) return null;
      return {
        team_id: teamId,
        shooter_id: shooterId,
        scored: play.typeDescKey === 'goal',
      };
    })
    .filter((attempt): attempt is ShootoutAttemptPayload => !!attempt);
}

function isShootoutAttemptPlay(play: any) {
  return ['goal', 'shot-on-goal', 'missed-shot'].includes(String(play?.typeDescKey ?? ''));
}

function shootoutShooterId(play: any) {
  return toOptionalNumber(play.details?.scoringPlayerId ?? play.details?.shootingPlayerId);
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
  const maxGoalPeriod = goals.reduce((max, goal) => Math.max(max, goal.periodNumber), 0);
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

function validIsoOrUndefined(value: string | null | undefined) {
  if (!value) return undefined;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

function extractLeagueGameNumber(gamecenterId: string) {
  return gamecenterId.match(/(\d{4})$/)?.[1] ?? gamecenterId;
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

  const hours = time.meridiem
    ? [time.meridiem === 'AM' ? rawHour % 12 : (rawHour % 12) + 12]
    : rawHour === 12
      ? [0, 12]
      : [rawHour, rawHour + 12];
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
  const awayGoalieOn = situationCode[0] !== '0';
  const homeGoalieOn = situationCode[3] !== '0';
  const awaySkaters = Number(situationCode[1]) - (awayGoalieOn ? 0 : 1);
  const homeSkaters = Number(situationCode[2]) - (homeGoalieOn ? 0 : 1);
  if (!Number.isFinite(awaySkaters) || !Number.isFinite(homeSkaters)) return 'even-strength';

  const scoringSkaters = side === 'away' ? awaySkaters : homeSkaters;
  const defendingSkaters = side === 'away' ? homeSkaters : awaySkaters;
  if (scoringSkaters > defendingSkaters) return 'power-play';
  if (scoringSkaters < defendingSkaters) return 'shorthanded';
  return 'even-strength';
}

function isEmptyNetGoal(play: any, scoringSide: TeamSide) {
  if (play.details?.emptyNet) return true;
  if (play.details?.goalieInNetId) return false;

  const situationCode = String(play.situationCode ?? '');
  if (situationCode.length < 4) return false;
  const awayGoalieOn = situationCode[0] !== '0';
  const homeGoalieOn = situationCode[3] !== '0';
  return scoringSide === 'away' ? !homeGoalieOn : !awayGoalieOn;
}

function nhlPeriodToLocal(period: unknown) {
  const number = Number(period);
  if (number <= 3) return String(number);
  // The app/DB model only recognises a single 'OT' period (enforced by the
  // goals_period_check constraint: '1','2','3','OT','SO'). Multiple overtime
  // periods (2OT, 3OT, …) all collapse to 'OT'; how deep the game went is
  // tracked separately by the game's overtime_periods count.
  return 'OT';
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
