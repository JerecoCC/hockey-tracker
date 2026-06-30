import type { GameRecord } from '@/hooks/useGames';

export type WatchedTeam = GameRecord['home_team'];

export interface TeamWatchSummary {
  team: WatchedTeam;
  count: number;
}

const getWatchedYear = (game: GameRecord) => game.watched_on?.match(/^([0-9]{4})/)?.[1] ?? null;

const addTeamWatch = (map: Map<string, TeamWatchSummary>, team: WatchedTeam) => {
  const existing = map.get(team.id);
  if (!existing) {
    map.set(team.id, { team, count: 1 });
    return;
  }

  existing.count += 1;
};

export const getWatchedYears = (games: GameRecord[], favoriteTeamIds: string[]) => {
  const favoriteSet = new Set(favoriteTeamIds);
  const years = new Set<string>();

  for (const game of games) {
    if (!game.watched_by_user) continue;
    if (!favoriteSet.has(game.home_team.id) && !favoriteSet.has(game.away_team.id)) continue;
    const year = getWatchedYear(game);
    if (year) years.add(year);
  }

  return [...years].sort((a, b) => b.localeCompare(a));
};

export const getWatchedTeamSummaries = (
  games: GameRecord[],
  favoriteTeamIds: string[],
  year = 'all',
) => {
  const favoriteSet = new Set(favoriteTeamIds);
  const map = new Map<string, TeamWatchSummary>();

  for (const game of games) {
    if (!game.watched_by_user) continue;
    const watchedYear = getWatchedYear(game);
    if (year !== 'all' && watchedYear !== year) continue;
    if (favoriteSet.has(game.home_team.id)) addTeamWatch(map, game.home_team);
    if (favoriteSet.has(game.away_team.id)) addTeamWatch(map, game.away_team);
  }

  return [...map.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return (a.team.team_name || a.team.name).localeCompare(b.team.team_name || b.team.name);
  });
};
