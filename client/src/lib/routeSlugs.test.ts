import { buildGameDetailsPath } from './routeSlugs';

describe('buildGameDetailsPath', () => {
  it('uses the dated matchup route when date and team codes are available', () => {
    expect(
      buildGameDetailsPath({
        leagueCode: 'PWHL',
        seasonName: '2025-26',
        gameId: 'game-1',
        awayTeamCode: 'MIN',
        homeTeamCode: 'MTL',
        scheduledAt: '2025-11-21T00:00:00.000Z',
      }),
    ).toBe('/admin/leagues/pwhl/seasons/2025-26/games/11-21-2025/min-vs-mtl');
  });

  it('falls back to the direct game id route when the matchup slug cannot be built', () => {
    expect(
      buildGameDetailsPath({
        leagueCode: 'PWHL',
        seasonName: '2025-26',
        gameId: 'game-1',
        scheduledAt: '2025-11-21T00:00:00.000Z',
      }),
    ).toBe('/admin/leagues/pwhl/seasons/2025-26/games/game-1');
  });
});
