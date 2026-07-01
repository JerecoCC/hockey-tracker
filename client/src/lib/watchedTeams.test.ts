import type { GameRecord } from '@/hooks/useGames';
import { getWatchedTeamSummaries, getWatchedYears } from './watchedTeams';

const teamHome = {
  id: 'team-home',
  name: 'Toronto Maple Leafs',
  code: 'TOR',
  logo: null,
  primary_color: '#003e7e',
  secondary_color: '#ffffff',
  text_color: '#ffffff',
};

const teamAway = {
  id: 'team-away',
  name: 'Boston Bruins',
  code: 'BOS',
  logo: null,
  primary_color: '#ffb81c',
  secondary_color: '#111111',
  text_color: '#111111',
};

const makeWatchedGame = (overrides: Partial<GameRecord> = {}): GameRecord => ({
  id: 'game-1',
  season_id: 'season-1',
  game_type: 'regular',
  status: 'final',
  scheduled_at: '2026-01-01',
  scheduled_time: null,
  time_start: null,
  time_end: null,
  venue: null,
  home_team: teamHome,
  away_team: teamAway,
  home_score: 3,
  away_score: 2,
  overtime_periods: null,
  shootout: false,
  shootout_first_team_id: null,
  playoff_series_id: null,
  game_number_in_series: null,
  game_number: null,
  playoff_round: null,
  series_home_team_id: null,
  series_away_team_id: null,
  series_home_wins: null,
  series_away_wins: null,
  series_home_wins_at_game: null,
  series_away_wins_at_game: null,
  series_games_to_win: null,
  notes: null,
  created_at: '2026-01-01T00:00:00Z',
  period_scores: [],
  period_shots: [],
  star_1_id: null,
  star_2_id: null,
  star_3_id: null,
  best_of_shootout: 3,
  watched_by_user: true,
  watched_on: '2026-01-05',
  skipped_by_user: false,
  scheduled_for: '2026-01-05',
  ...overrides,
});

describe('watchedTeams', () => {
  it('filters watched teams by scheduled game year instead of scheduled watch year', () => {
    const games = [
      makeWatchedGame({
        id: 'watched-after-year-end',
        scheduled_at: '2025-12-31',
        watched_on: '2026-01-05',
        scheduled_for: '2026-01-05',
      }),
      makeWatchedGame({
        id: 'played-in-2026',
        scheduled_at: '2026-01-02',
        watched_on: '2026-01-06',
        scheduled_for: '2026-01-06',
      }),
    ];

    expect(getWatchedYears(games)).toEqual(['2026', '2025']);

    const summaries = getWatchedTeamSummaries(games, '2025');
    expect(summaries).toHaveLength(2);
    expect(summaries.every((summary) => summary.count === 1)).toBe(true);
  });

  it('uses the user local timezone when deriving the scheduled game year', () => {
    const scheduledInstant = new Date('2025-12-31T23:30:00-05:00');
    const expectedYear = new Intl.DateTimeFormat('en-US', { year: 'numeric' }).format(
      scheduledInstant,
    );
    const oppositeWatchYear = expectedYear === '2025' ? '2026' : '2025';
    const scheduledWatchDate =
      oppositeWatchYear === '2025' ? '2025-12-20' : `${oppositeWatchYear}-01-05`;

    const games = [
      makeWatchedGame({
        scheduled_at: '2025-12-31',
        scheduled_time: '23:30',
        watched_on: scheduledWatchDate,
        scheduled_for: scheduledWatchDate,
      }),
    ];

    expect(getWatchedYears(games)).toEqual([expectedYear]);
    expect(getWatchedTeamSummaries(games, expectedYear)).toHaveLength(2);
    expect(getWatchedTeamSummaries(games, oppositeWatchYear)).toHaveLength(0);
  });
});
