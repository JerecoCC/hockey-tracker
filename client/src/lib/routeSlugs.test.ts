import {
  buildSeasonDayGamesPath,
  buildPlayerDetailsPath,
  buildGameDetailsPath,
  buildLeaguePlayerDetailsPath,
  buildUserGameDetailsPath,
  buildUserLeaguePlayerDetailsPath,
  buildUserPlayerDetailsPath,
  buildUserTeamDetailsPath,
  buildUserWatchedTeamPath,
  gameDateRouteSlugToDateKey,
  leaguePlayerRouteSlug,
  playerTeamRouteSlug,
  userWatchedTeamRouteSlug,
} from './routeSlugs';

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
        scheduledTime: '19:00',
      }),
    ).toBe('/admin/leagues/pwhl/seasons/2025-26/games/11-21-2025/min-vs-mtl');
  });

  it('always uses the Eastern game date for admin dated routes', () => {
    expect(
      buildGameDetailsPath({
        leagueCode: 'PWHL',
        seasonName: '2025-26',
        gameId: 'game-1',
        awayTeamCode: 'MIN',
        homeTeamCode: 'MTL',
        scheduledAt: '2026-05-02T02:30:00.000Z',
      }),
    ).toBe('/admin/leagues/pwhl/seasons/2025-26/games/05-01-2026/min-vs-mtl');
  });

  it('keeps timezone-less midnight placeholder admin routes on their stored date', () => {
    expect(
      buildGameDetailsPath({
        leagueCode: 'NHL',
        seasonName: '2025-26',
        gameId: 'game-1',
        awayTeamCode: 'MTL',
        homeTeamCode: 'CHI',
        scheduledAt: '2025-10-11T00:00:00.000',
        scheduledTime: '19:00',
      }),
    ).toBe('/admin/leagues/nhl/seasons/2025-26/games/10-11-2025/mtl-vs-chi');
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

describe('season day game routes', () => {
  it('builds a dated season day games route', () => {
    expect(
      buildSeasonDayGamesPath({
        leagueCode: 'NHL',
        seasonName: '2025-26',
        dateKey: '2026-03-19',
      }),
    ).toBe('/admin/leagues/nhl/seasons/2025-26/games/03-19-2026');
  });

  it('parses dated route slugs back to date keys', () => {
    expect(gameDateRouteSlugToDateKey('03-19-2026')).toBe('2026-03-19');
    expect(gameDateRouteSlugToDateKey('2026-03-19')).toBe('2026-03-19');
    expect(gameDateRouteSlugToDateKey('02-31-2026')).toBeNull();
    expect(gameDateRouteSlugToDateKey('2026-02-31')).toBeNull();
  });
});

describe('buildUserTeamDetailsPath', () => {
  it('builds the user team details route with an optional season slug', () => {
    expect(
      buildUserTeamDetailsPath({
        leagueCode: 'NHL',
        teamCode: 'TOR',
        seasonName: '2025-26',
      }),
    ).toBe('/leagues/nhl/teams/tor?season=2025-26');
  });
});

describe('buildUserPlayerDetailsPath', () => {
  it('builds the user team-scoped player details route with the jersey number when available', () => {
    expect(
      buildUserPlayerDetailsPath({
        leagueCode: 'NHL',
        teamCode: 'TOR',
        firstName: 'Auston',
        lastName: 'Matthews',
        jerseyNumber: 34,
      }),
    ).toBe('/leagues/nhl/teams/tor/players/34-auston-matthews');
  });

  it('keeps a name slug for user team-scoped player details without a jersey number', () => {
    expect(
      buildUserPlayerDetailsPath({
        leagueCode: 'NHL',
        teamCode: 'TOR',
        firstName: 'Auston',
        lastName: 'Matthews',
      }),
    ).toBe('/leagues/nhl/teams/tor/players/auston-matthews');
  });
});

describe('buildUserLeaguePlayerDetailsPath', () => {
  it('builds the user league-scoped player details route with the league player number when available', () => {
    expect(
      buildUserLeaguePlayerDetailsPath({
        leagueCode: 'NHL',
        leaguePlayerNumber: '8475786',
        firstName: 'Sarah',
        lastName: 'Nurse',
      }),
    ).toBe('/leagues/nhl/players/8475786');
  });

  it('keeps a name slug for user league-scoped player details without a league player number', () => {
    expect(
      buildUserLeaguePlayerDetailsPath({
        leagueCode: 'NHL',
        firstName: 'Sarah',
        lastName: 'Nurse',
      }),
    ).toBe('/leagues/nhl/players/sarah-nurse');
  });
});

describe('buildPlayerDetailsPath', () => {
  it('builds the admin team-scoped player details route with the jersey number when available', () => {
    expect(
      buildPlayerDetailsPath({
        leagueCode: 'NHL',
        teamCode: 'VAN',
        firstName: 'Elias',
        lastName: 'Pettersson',
        jerseyNumber: 40,
      }),
    ).toBe('/admin/leagues/nhl/teams/van/players/40-elias-pettersson');
  });
});

describe('buildLeaguePlayerDetailsPath', () => {
  it('builds the admin league-scoped player details route with the league player number when available', () => {
    expect(
      buildLeaguePlayerDetailsPath({
        leagueCode: 'NHL',
        leaguePlayerNumber: '8480012',
        firstName: 'Elias',
        lastName: 'Pettersson',
      }),
    ).toBe('/admin/leagues/nhl/players/8480012');
  });
});

describe('player route slugs', () => {
  it('supports team and league player slug variants', () => {
    expect(
      playerTeamRouteSlug({
        firstName: 'Elias',
        lastName: 'Pettersson',
        jerseyNumber: 40,
      }),
    ).toBe('40-elias-pettersson');
    expect(
      leaguePlayerRouteSlug({
        leaguePlayerNumber: '8480012',
        firstName: 'Elias',
        lastName: 'Pettersson',
      }),
    ).toBe('8480012');
  });
});

describe('userWatchedTeamRouteSlug', () => {
  it('builds watched-team slugs from the team code and team name', () => {
    expect(
      userWatchedTeamRouteSlug({
        teamCode: 'BOS',
        teamName: 'Bruins',
      }),
    ).toBe('bos-bruins');
  });

  it('strips the place name from full team names when building watched-team slugs', () => {
    expect(
      buildUserWatchedTeamPath({
        teamCode: 'CBJ',
        teamName: 'Columbus Blue Jackets',
        teamPlaceName: 'Columbus',
      }),
    ).toBe('/dashboard/games-watched/cbj-blue-jackets');
  });
});
