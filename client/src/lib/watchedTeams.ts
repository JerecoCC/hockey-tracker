import type { GameRecord } from '@/hooks/useGames';
import { getScheduledGameDateKey } from './gameSchedule';

export type WatchedTeam = GameRecord['home_team'];

export interface TeamWatchSummary {
  team: WatchedTeam;
  count: number;
  record: {
    wins: number;
    losses: number;
    otSoLosses: number;
  };
}

export const getScheduledGameYear = (game: GameRecord) =>
  getScheduledGameDateKey(game)?.match(/^([0-9]{4})/)?.[1] ?? null;

const isOvertimeOrShootout = (game: GameRecord) =>
  game.shootout ||
  (game.overtime_periods ?? 0) > 0 ||
  game.period_scores.some(
    (periodScore) => periodScore.period === 'OT' || periodScore.period === 'SO',
  );

const getWinnerTeamId = (game: GameRecord) => {
  if (game.status !== 'final') return null;
  if (game.winner_team_id) return game.winner_team_id;
  if (game.home_score > game.away_score) return game.home_team.id;
  if (game.away_score > game.home_score) return game.away_team.id;
  return null;
};

const createTeamWatchSummary = (team: WatchedTeam): TeamWatchSummary => ({
  team,
  count: 0,
  record: {
    wins: 0,
    losses: 0,
    otSoLosses: 0,
  },
});

const addTeamWatch = (map: Map<string, TeamWatchSummary>, team: WatchedTeam, game: GameRecord) => {
  const existing = map.get(team.id);
  const summary = existing ?? createTeamWatchSummary(team);
  if (!existing) map.set(team.id, summary);

  summary.count += 1;

  const winnerTeamId = getWinnerTeamId(game);
  if (!winnerTeamId) return;
  if (winnerTeamId === team.id) {
    summary.record.wins += 1;
    return;
  }
  if (winnerTeamId !== game.home_team.id && winnerTeamId !== game.away_team.id) return;
  if (isOvertimeOrShootout(game)) summary.record.otSoLosses += 1;
  else summary.record.losses += 1;
};

export const getWatchedYears = (games: GameRecord[]) => {
  const years = new Set<string>();

  for (const game of games) {
    if (!game.watched_by_user) continue;
    const year = getScheduledGameYear(game);
    if (year) years.add(year);
  }

  return [...years].sort((a, b) => b.localeCompare(a));
};

/** Narrows watched games by year, league and season; 'all' (or nothing) keeps every one. */
export interface WatchedGameFilters {
  year?: string;
  leagueId?: string;
  seasonId?: string;
}

const matchesFilter = (value: string | null | undefined, filter = 'all') =>
  filter === 'all' || value === filter;

export interface WatchedLeagueOption {
  id: string;
  code: string;
  name: string;
  logo: string | null;
}

export interface WatchedSeasonOption {
  id: string;
  name: string;
  leagueId: string;
  leagueCode: string;
}

/** The leagues of the watched games, by code. */
export const getWatchedLeagues = (games: GameRecord[]): WatchedLeagueOption[] => {
  const leagues = new Map<string, WatchedLeagueOption>();
  for (const game of games) {
    if (!game.watched_by_user || !game.league_id || leagues.has(game.league_id)) continue;
    leagues.set(game.league_id, {
      id: game.league_id,
      code: game.league_code ?? game.league_name ?? '',
      name: game.league_name ?? game.league_code ?? '',
      logo: game.league_logo ?? null,
    });
  }
  return [...leagues.values()].sort((a, b) => a.code.localeCompare(b.code));
};

/** The seasons of the watched games (in one league, unless 'all'), latest first. */
export const getWatchedSeasons = (
  games: GameRecord[],
  leagueId = 'all',
): WatchedSeasonOption[] => {
  const seasons = new Map<string, WatchedSeasonOption>();
  for (const game of games) {
    if (!game.watched_by_user || !game.season_id || seasons.has(game.season_id)) continue;
    if (!matchesFilter(game.league_id, leagueId)) continue;
    seasons.set(game.season_id, {
      id: game.season_id,
      name: game.season_name ?? '',
      leagueId: game.league_id ?? '',
      leagueCode: game.league_code ?? '',
    });
  }
  return [...seasons.values()].sort(
    (a, b) => b.name.localeCompare(a.name) || a.leagueCode.localeCompare(b.leagueCode),
  );
};

export const getWatchedTeamSummaries = (
  games: GameRecord[],
  filters: string | WatchedGameFilters = 'all',
) => {
  const { year = 'all', leagueId = 'all', seasonId = 'all' } =
    typeof filters === 'string' ? { year: filters } : filters;
  const map = new Map<string, TeamWatchSummary>();

  for (const game of games) {
    if (!game.watched_by_user) continue;
    const scheduledGameYear = getScheduledGameYear(game);
    if (year !== 'all' && scheduledGameYear !== year) continue;
    if (!matchesFilter(game.league_id, leagueId)) continue;
    if (!matchesFilter(game.season_id, seasonId)) continue;
    addTeamWatch(map, game.home_team, game);
    addTeamWatch(map, game.away_team, game);
  }

  return [...map.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return (a.team.team_name || a.team.name).localeCompare(b.team.team_name || b.team.name);
  });
};

export type TeamWatchSortKey = 'team' | 'seen' | 'wins';

export const getWatchedTeamName = (team: WatchedTeam) => team.team_name || team.name;

const compareTeamNames = (a: TeamWatchSummary, b: TeamWatchSummary) =>
  getWatchedTeamName(a.team).localeCompare(getWatchedTeamName(b.team));

/**
 * Sorts by team name, games seen or wins. Ties on seen or wins go to the team
 * name, A to Z, whichever way the sort runs.
 */
export const sortTeamWatchSummaries = (
  summaries: TeamWatchSummary[],
  key: TeamWatchSortKey,
  dir: 'asc' | 'desc',
) => {
  const sign = dir === 'asc' ? 1 : -1;
  return [...summaries].sort((a, b) => {
    if (key === 'team') return sign * compareTeamNames(a, b);
    const diff = key === 'seen' ? a.count - b.count : a.record.wins - b.record.wins;
    return sign * diff || compareTeamNames(a, b);
  });
};

/** Keeps teams whose name, place or code contains the query (ignoring case). */
export const searchTeamWatchSummaries = (summaries: TeamWatchSummary[], query: string) => {
  const needle = query.trim().toLowerCase();
  if (!needle) return summaries;
  return summaries.filter(({ team }) =>
    [team.place_name, getWatchedTeamName(team), team.code].some((value) =>
      value?.toLowerCase().includes(needle),
    ),
  );
};
