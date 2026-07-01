import type { GameRecord } from '@/hooks/useGames';

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

const getWatchedYear = (game: GameRecord) => game.watched_on?.match(/^([0-9]{4})/)?.[1] ?? null;

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
    const year = getWatchedYear(game);
    if (year) years.add(year);
  }

  return [...years].sort((a, b) => b.localeCompare(a));
};

export const getWatchedTeamSummaries = (games: GameRecord[], year = 'all') => {
  const map = new Map<string, TeamWatchSummary>();

  for (const game of games) {
    if (!game.watched_by_user) continue;
    const watchedYear = getWatchedYear(game);
    if (year !== 'all' && watchedYear !== year) continue;
    addTeamWatch(map, game.home_team, game);
    addTeamWatch(map, game.away_team, game);
  }

  return [...map.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return (a.team.team_name || a.team.name).localeCompare(b.team.team_name || b.team.name);
  });
};
