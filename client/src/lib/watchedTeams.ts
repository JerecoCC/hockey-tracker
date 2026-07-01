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

const DATE_ONLY_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const ISO_DATE_PREFIX_RE = /^([0-9]{4}-[0-9]{2}-[0-9]{2})/;
const ISO_MIDNIGHT_RE = /T00:00(?::00(?:\.0+)?)?(?:Z|[+-][0-9]{2}:[0-9]{2})$/;

const toDateKeyInZone = (date: Date, timeZone?: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return year && month && day ? `${year}-${month}-${day}` : null;
};

const getRawDateKey = (value: string | null) => value?.match(ISO_DATE_PREFIX_RE)?.[1] ?? null;

const getEtAbbrForDateKey = (dateKey: string): string =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  })
    .formatToParts(new Date(`${dateKey}T17:00:00Z`))
    .find((part) => part.type === 'timeZoneName')?.value ?? 'ET';

const getEtDateKey = (scheduledAt: string | null, scheduledTime: string | null) => {
  if (!scheduledAt) return null;
  if (DATE_ONLY_RE.test(scheduledAt)) return scheduledAt;
  const rawDateKey = getRawDateKey(scheduledAt);
  const isMidnightPlaceholder =
    !!scheduledTime &&
    scheduledTime !== '00:00' &&
    !!rawDateKey &&
    ISO_MIDNIGHT_RE.test(scheduledAt);
  if (isMidnightPlaceholder) return rawDateKey;
  const base = new Date(scheduledAt);
  if (Number.isNaN(base.getTime())) return rawDateKey;
  return toDateKeyInZone(base, 'America/New_York');
};

const getScheduledInstant = (scheduledAt: string | null, scheduledTime: string | null) => {
  if (!scheduledAt) return null;

  const direct = new Date(scheduledAt);
  const hasDirectInstant = !Number.isNaN(direct.getTime());

  if (!scheduledTime) {
    if (DATE_ONLY_RE.test(scheduledAt)) return new Date(`${scheduledAt}T17:00:00Z`);
    return hasDirectInstant ? direct : null;
  }

  const etDatePart =
    getEtDateKey(scheduledAt, scheduledTime) ?? toDateKeyInZone(new Date(), 'America/New_York');
  if (!etDatePart) return null;
  const offset = getEtAbbrForDateKey(etDatePart) === 'EDT' ? '-04:00' : '-05:00';
  return new Date(`${etDatePart}T${scheduledTime}:00${offset}`);
};

const getScheduledGameDateKey = (game: GameRecord) => {
  if (game.scheduled_at && DATE_ONLY_RE.test(game.scheduled_at) && !game.scheduled_time) {
    return game.scheduled_at;
  }
  const instant = getScheduledInstant(game.scheduled_at, game.scheduled_time);
  return instant ? toDateKeyInZone(instant) : getRawDateKey(game.scheduled_at);
};

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

export const getWatchedTeamSummaries = (games: GameRecord[], year = 'all') => {
  const map = new Map<string, TeamWatchSummary>();

  for (const game of games) {
    if (!game.watched_by_user) continue;
    const scheduledGameYear = getScheduledGameYear(game);
    if (year !== 'all' && scheduledGameYear !== year) continue;
    addTeamWatch(map, game.home_team, game);
    addTeamWatch(map, game.away_team, game);
  }

  return [...map.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return (a.team.team_name || a.team.name).localeCompare(b.team.team_name || b.team.name);
  });
};
