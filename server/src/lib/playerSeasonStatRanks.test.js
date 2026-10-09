'use strict';

jest.mock('../db', () => ({ sql: jest.fn() }));

const { sql } = require('../db');
const { fetchPlayerSeasonStatRanks } = require('./playerSeasonStatRanks');

const row = (overrides) => ({
  game_type: 'regular',
  stat: 'points',
  value: 10,
  league_rank: 50,
  league_count: 1,
  team_rank: 5,
  team_count: 1,
  league_code: 'NHL',
  league_primary_color: '#000000',
  league_text_color: '#ffffff',
  team_code: 'TOR',
  team_primary_color: '#00205b',
  team_text_color: '#ffffff',
  ...overrides,
});

afterEach(() => jest.clearAllMocks());

describe('fetchPlayerSeasonStatRanks', () => {
  it('prefers a top-10 league rank, in league colors', async () => {
    sql.mockResolvedValueOnce([row({ league_rank: 2, league_count: 3, team_rank: 1 })]);

    const ranks = await fetchPlayerSeasonStatRanks({
      playerId: 'p-1',
      seasonId: 's-1',
      isGoalie: false,
    });

    expect(ranks.regular.points).toEqual({
      scope: 'league',
      rank: 2,
      tied: true,
      label: 'NHL',
      primary_color: '#000000',
      text_color: '#ffffff',
    });
  });

  it('falls back to a top-10 team rank, in team colors', async () => {
    sql.mockResolvedValueOnce([row({ game_type: 'playoff', stat: 'goals', team_rank: 3 })]);

    const ranks = await fetchPlayerSeasonStatRanks({
      playerId: 'p-1',
      seasonId: 's-1',
      isGoalie: false,
    });

    expect(ranks.playoff.goals).toEqual({
      scope: 'team',
      rank: 3,
      tied: false,
      label: 'TOR',
      primary_color: '#00205b',
      text_color: '#ffffff',
    });
  });

  it('skips stats outside both top 10s and counting stats at zero', async () => {
    sql.mockResolvedValueOnce([
      row({ stat: 'assists', league_rank: 40, team_rank: 11 }),
      row({ stat: 'goals', value: 0, league_rank: 1, league_count: 400 }),
      row({ stat: 'gaa', value: 0, league_rank: 1 }),
    ]);

    const ranks = await fetchPlayerSeasonStatRanks({
      playerId: 'p-1',
      seasonId: 's-1',
      isGoalie: true,
    });

    expect(ranks.regular).toEqual({
      gaa: expect.objectContaining({ scope: 'league', rank: 1 }),
    });
  });
});
