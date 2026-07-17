import type { GameRecord } from '@/hooks/useGames';
import { canMarkGameWatched, getOvertimeSuffix, getScoreCardGame } from './gamePresentation';

const game = (overrides: Partial<GameRecord> = {}) =>
  ({
    status: 'scheduled',
    shootout: false,
    overtime_periods: 0,
    period_scores: [],
    series_home_wins: 4,
    series_away_wins: 4,
    ...overrides,
  }) as GameRecord;

describe('game presentation utilities', () => {
  it('prioritizes shootout over overtime status', () => {
    expect(getOvertimeSuffix(game({ shootout: true, overtime_periods: 1 }))).toBe('/SO');
    expect(getOvertimeSuffix(game({ period_scores: [{ period: 'OT' }] as never }))).toBe('/OT');
  });

  it('uses the series record captured at game time for score cards', () => {
    expect(
      getScoreCardGame(
        game({ series_home_wins_at_game: 2, series_away_wins_at_game: 1 }),
      ),
    ).toMatchObject({ series_home_wins: 2, series_away_wins: 1 });
  });

  it('only permits final games to be marked watched', () => {
    expect(canMarkGameWatched(game({ status: 'final' }))).toBe(true);
    expect(canMarkGameWatched(game({ status: 'scheduled' }))).toBe(false);
  });
});
