import { buildGameDetailsPath, buildUserGameDetailsPath } from './routeSlugs';

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

  it('uses the Eastern game date for NHL dated routes', () => {
    expect(
      buildGameDetailsPath({
        leagueCode: 'NHL',
        seasonName: '2025-26',
        gameId: 'game-1',
        awayTeamCode: 'NYR',
        homeTeamCode: 'BOS',
        scheduledAt: '2025-12-02T00:00:00.000Z',
      }),
    ).toBe('/admin/leagues/nhl/seasons/2025-26/games/12-01-2025/nyr-vs-bos');
  });
});

describe('buildUserGameDetailsPath', () => {
  it('always uses the Eastern game date for user dated routes', () => {
    expect(
      buildUserGameDetailsPath({
        gameId: 'game-1',
        awayTeamCode: 'TBL',
        homeTeamCode: 'MTL',
        scheduledAt: '2026-05-02T02:30:00.000Z',
      }),
    ).toBe('/games/05-01-2026/tbl-vs-mtl');
  });

  it('keeps the intended date for midnight placeholder rows with a scheduled time', () => {
    expect(
      buildUserGameDetailsPath({
        gameId: 'game-1',
        awayTeamCode: 'EDM',
        homeTeamCode: 'WPG',
        scheduledAt: '2025-12-29T00:00:00.000Z',
        scheduledTime: '21:30',
      }),
    ).toBe('/games/12-29-2025/edm-vs-wpg');
  });

  it('falls back to the direct game id route when the user matchup slug cannot be built', () => {
    expect(
      buildUserGameDetailsPath({
        gameId: 'game-1',
        scheduledAt: '2026-05-02T02:30:00.000Z',
      }),
    ).toBe('/games/game-1');
  });
});
