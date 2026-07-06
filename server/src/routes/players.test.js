'use strict';

jest.mock('../db', () => ({ sql: jest.fn() }));
jest.mock('../middleware/auth', () => ({
  requireAdmin: (req, _res, next) => { req.user = { id: 'admin-1', role: 'admin' }; next(); },
}));

const request       = require('supertest');
const express       = require('express');
const { sql }       = require('../db');
const playersRouter = require('./players');

const app = express();
app.use(express.json());
app.use('/api/admin/players', playersRouter);

const PLAYER = {
  id: 'player-1',
  first_name: 'Wayne',
  last_name: 'Gretzky',
  photo: null,
  date_of_birth: '1961-01-26',
  birth_city: 'Brantford',
  birth_country: 'CAN',
  height_cm: 183,
  weight_lbs: 185,
  position: 'C',
  shoots: 'L',
  status: 'active',
  is_active: true,
  created_at: new Date().toISOString(),
};

const PLAYER_WITH_ROSTER = {
  ...PLAYER,
  jersey_number: 99,
  team_name: 'Oilers',
  primary_color: '#ff4500',
  text_color: '#ffffff',
  acquisition_type: 'draft',
  start_date: '2024-10-01',
  has_games: true,
};

const expectLatestStintStartBeforeOpenTieBreaker = (queryText) => {
  const latestStartIndex = queryText.indexOf('COALESCE(pt.start_date');
  const openTieBreakerIndex = queryText.indexOf('CASE WHEN pt.end_date IS NULL THEN 0 ELSE 1 END');
  expect(latestStartIndex).toBeGreaterThanOrEqual(0);
  expect(openTieBreakerIndex).toBeGreaterThan(latestStartIndex);
};

afterEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// GET /api/admin/players
// ---------------------------------------------------------------------------
describe('GET /api/admin/players', () => {
  it('returns all players', async () => {
    sql.mockResolvedValueOnce([PLAYER]);
    const res = await request(app).get('/api/admin/players');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([PLAYER]);
  });

  it('filters by league_id and returns roster fields', async () => {
    sql.mockResolvedValueOnce([PLAYER_WITH_ROSTER]);
    const res = await request(app).get('/api/admin/players?league_id=league-1');
    expect(res.status).toBe(200);
    expect(sql).toHaveBeenCalledTimes(1);
    expect(res.body[0]).toMatchObject({
      jersey_number: 99,
      team_name: 'Oilers',
      primary_color: '#ff4500',
      text_color: '#ffffff',
      acquisition_type: 'draft',
      start_date: '2024-10-01',
      has_games: true,
    });
    const queryText = sql.mock.calls[0][0].join(' ');
    expect(queryText).toContain('pt.acquisition_type');
    expect(queryText).toContain('pt.start_date');
    expect(queryText).toContain('AS has_games');
    expect(queryText).toContain('FROM game_rosters gr');
    expect(queryText).toContain('JOIN seasons rs');
    expectLatestStintStartBeforeOpenTieBreaker(queryText);
  });

  it('returns unassigned players for a league', async () => {
    sql.mockResolvedValueOnce([PLAYER]);
    const res = await request(app).get('/api/admin/players?league_id=league-1&unassigned=true');
    expect(res.status).toBe(200);
    expect(sql).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual([PLAYER]);
    const queryText = sql.mock.calls[0][0].join(' ');
    expect(queryText).toContain('best_player_photo');
    expect(queryText).toContain('latest_ti.logo AS team_logo');
    expect(queryText).toContain('latest_jnh.jersey_number');
  });

  it('requires league_id when requesting unassigned players', async () => {
    const res = await request(app).get('/api/admin/players?unassigned=true');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/league_id/i);
    expect(sql).not.toHaveBeenCalled();
  });

  it('returns paginated league players with total count', async () => {
    sql
      .mockResolvedValueOnce([PLAYER_WITH_ROSTER])
      .mockResolvedValueOnce([{ total: 42 }]);

    const res = await request(app)
      .get('/api/admin/players?league_id=league-1&season_id=season-1&page=2&page_size=20&search=wayne');

    expect(res.status).toBe(200);
    expect(sql).toHaveBeenCalledTimes(2);
    expect(res.body).toEqual({
      players: [PLAYER_WITH_ROSTER],
      total: 42,
      page: 2,
      page_size: 20,
    });
    const queryText = sql.mock.calls[0][0].join(' ');
    expect(queryText).toContain('pt.acquisition_type');
    expect(queryText).toContain('pt.start_date');
    expect(queryText).toContain('AS has_games');
    expect(queryText).toContain('AS season_points');
    expect(queryText).toContain("sg.goal_type != 'own'");
    expect(queryText).toContain('FROM game_rosters gr');
    expect(queryText).toContain('rg.season_id');
    expectLatestStintStartBeforeOpenTieBreaker(queryText);
  });

  it('normalizes Maksim and Maxim player name aliases in paginated search', async () => {
    sql
      .mockResolvedValueOnce([PLAYER_WITH_ROSTER])
      .mockResolvedValueOnce([{ total: 1 }]);

    const res = await request(app)
      .get('/api/admin/players?league_id=league-1&season_id=season-1&page=1&page_size=20&search=maksim');

    expect(res.status).toBe(200);
    expect(sql).toHaveBeenCalledTimes(2);
    const rowCall = sql.mock.calls[0];
    const rowQueryText = rowCall[0].join(' ');
    expect(rowQueryText).toContain("REPLACE(first_name || ' ' || last_name, 'ks', 'x')");
    expect(rowCall).toContain('%maxim%');
  });

  it('orders season league player rows by latest stint before open-ended fallback', async () => {
    sql.mockResolvedValueOnce([PLAYER_WITH_ROSTER]);

    const res = await request(app)
      .get('/api/admin/players?league_id=league-1&season_id=season-1&include_prospects=true');

    expect(res.status).toBe(200);
    expect(sql).toHaveBeenCalledTimes(1);
    expectLatestStintStartBeforeOpenTieBreaker(sql.mock.calls[0][0].join(' '));
  });

  it('applies rookie and active filters to paginated league player rows and counts', async () => {
    sql
      .mockResolvedValueOnce([PLAYER_WITH_ROSTER])
      .mockResolvedValueOnce([{ total: 1 }]);

    const res = await request(app)
      .get('/api/admin/players?league_id=league-1&season_id=season-1&page=1&page_size=20&rookies_only=true');

    expect(res.status).toBe(200);
    expect(sql).toHaveBeenCalledTimes(2);

    const rowQueryText = sql.mock.calls[0][0].join(' ');
    const countQueryText = sql.mock.calls[1][0].join(' ');

    expect(rowQueryText).toContain('is_active = TRUE');
    expect(rowQueryText).toContain('rookie_season_id =');
    expect(countQueryText).toContain('is_active = TRUE');
    expect(countQueryText).toContain('rookie_season_id =');
  });

  it('includes inactive and retired players in paginated league player rows and counts', async () => {
    sql
      .mockResolvedValueOnce([PLAYER_WITH_ROSTER])
      .mockResolvedValueOnce([{ total: 1 }]);

    const res = await request(app)
      .get('/api/admin/players?league_id=league-1&season_id=season-1&page=1&page_size=20&include_inactive=true');

    expect(res.status).toBe(200);
    expect(sql).toHaveBeenCalledTimes(2);

    expect(sql.mock.calls[0]).toContain(true);
    expect(sql.mock.calls[1]).toContain(true);
  });

  it('filters paginated league player rows and counts to inactive or retired players only', async () => {
    sql
      .mockResolvedValueOnce([{ ...PLAYER_WITH_ROSTER, status: 'retired', is_active: false }])
      .mockResolvedValueOnce([{ total: 1 }]);

    const res = await request(app)
      .get('/api/admin/players?league_id=league-1&season_id=season-1&page=1&page_size=20&inactive_only=true');

    expect(res.status).toBe(200);
    expect(sql).toHaveBeenCalledTimes(2);

    const rowQueryText = sql.mock.calls[0][0].join(' ');
    const countQueryText = sql.mock.calls[1][0].join(' ');
    expect(rowQueryText).toContain('is_active = FALSE');
    expect(countQueryText).toContain('is_active = FALSE');
  });

  it('filters by team_id and returns roster fields', async () => {
    sql.mockResolvedValueOnce([PLAYER_WITH_ROSTER]);
    const res = await request(app).get('/api/admin/players?team_id=team-1');
    expect(res.status).toBe(200);
    expect(sql).toHaveBeenCalledTimes(1);
    expect(res.body[0]).toMatchObject({
      jersey_number: 99,
      team_name: 'Oilers',
      primary_color: '#ff4500',
      text_color: '#ffffff',
    });
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).get('/api/admin/players');
    expect(res.status).toBe(500);
  });

  it('returns 500 on DB error with league_id', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).get('/api/admin/players?league_id=league-1');
    expect(res.status).toBe(500);
  });

  it('returns 500 on DB error with team_id', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).get('/api/admin/players?team_id=team-1');
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/players/route-lookup
// ---------------------------------------------------------------------------
describe('GET /api/admin/players/route-lookup', () => {
  it('resolves a pretty player URL to database ids', async () => {
    const lookup = {
      player_id: 'player-1',
      team_id: 'team-1',
      league_id: 'league-1',
      league_code: 'NHL',
      team_code: 'SJS',
      player_slug: 'kyle-masters',
    };
    sql.mockResolvedValueOnce([lookup]);

    const res = await request(app).get(
      '/api/admin/players/route-lookup?league_code=nhl&team_code=sjs&player_slug=kyle-masters',
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual(lookup);
    const queryText = sql.mock.calls[0][0].join(' ');
    expect(queryText).toContain('jersey_number::text');
    expect(queryText).toContain('league_player_slug');
  });

  it('resolves a team-scoped jersey-name player URL to database ids', async () => {
    const lookup = {
      player_id: 'player-1',
      team_id: 'team-1',
      league_id: 'league-1',
      league_code: 'NHL',
      team_code: 'VAN',
      player_slug: '40-elias-pettersson',
    };
    sql.mockResolvedValueOnce([lookup]);

    const res = await request(app).get(
      '/api/admin/players/route-lookup?league_code=nhl&team_code=van&player_slug=40-elias-pettersson',
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual(lookup);
  });

  it('resolves a league-scoped player URL by league player number', async () => {
    const lookup = {
      player_id: 'player-1',
      team_id: null,
      league_id: 'league-1',
      league_code: 'NHL',
      team_code: null,
      player_slug: '8478402',
    };
    sql.mockResolvedValueOnce([lookup]);

    const res = await request(app).get(
      '/api/admin/players/route-lookup?league_code=nhl&player_slug=8478402',
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual(lookup);
  });

  it('still resolves a league-scoped player URL by name slug', async () => {
    const lookup = {
      player_id: 'player-1',
      team_id: null,
      league_id: 'league-1',
      league_code: 'NHL',
      team_code: null,
      player_slug: '8478402',
    };
    sql.mockResolvedValueOnce([lookup]);

    const res = await request(app).get(
      '/api/admin/players/route-lookup?league_code=nhl&player_slug=john-smith',
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual(lookup);
  });

  it('returns 404 when the pretty player URL cannot be resolved', async () => {
    sql.mockResolvedValueOnce([]);

    const res = await request(app).get(
      '/api/admin/players/route-lookup?league_code=nhl&team_code=sjs&player_slug=missing-player',
    );

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Player route not found' });
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/players/:id/awards
// ---------------------------------------------------------------------------
describe('GET /api/admin/players/:id/awards', () => {
  it('returns direct player awards and team awards won by the player season team', async () => {
    const playerAward = {
      id: 'recipient-1',
      award_id: 'award-1',
      season_award_id: 'season-award-1',
      award_name: 'Forward of the Year',
      season_id: 'season-1',
      season_name: '2025-26',
      awarded_at: '2026-05-01',
      recipient_type: 'player',
      player_photo: 'gretzky-2026.png',
      team_id: 'team-1',
      team_name: 'Oilers',
      team_place_name: 'Edmonton',
      team_team_name: 'Oilers',
      team_code: 'EDM',
      team_logo: 'oilers.png',
      team_primary_color: '#ff4500',
      team_secondary_color: '#041e42',
      team_text_color: '#ffffff',
    };
    const teamAward = {
      id: 'recipient-2',
      award_id: 'award-2',
      season_award_id: 'season-award-2',
      award_name: 'Walter Cup Winner',
      season_id: 'season-1',
      season_name: '2025-26',
      awarded_at: '2026-05-20',
      recipient_type: 'team',
      player_photo: null,
      team_id: 'team-1',
      team_name: 'Oilers',
      team_place_name: 'Edmonton',
      team_team_name: 'Oilers',
      team_code: 'EDM',
      team_logo: 'oilers.png',
      team_primary_color: '#ff4500',
      team_secondary_color: '#041e42',
      team_text_color: '#ffffff',
    };
    sql.mockResolvedValueOnce([playerAward, teamAward]);

    const res = await request(app).get('/api/admin/players/player-1/awards');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([playerAward, teamAward]);
    expect(sql).toHaveBeenCalledTimes(1);
    const queryText = sql.mock.calls[0][0].join(' ');
    expect(queryText).toContain('WITH winning_awards');
    expect(queryText).toContain("sar.role = 'winner'");
    expect(queryText).toContain("sar.recipient_type = 'player'");
    expect(queryText).toContain("sar.recipient_type = 'team'");
    expect(queryText).toContain("'player' AS recipient_type");
    expect(queryText).toContain("'team' AS recipient_type");
    expect(queryText).toContain('player_photo');
    expect(queryText).toContain('ti.place_name AS team_place_name');
    expect(queryText).toContain('ti.team_name AS team_team_name');
    expect(queryText).toContain('sar.player_id');
    expect(queryText).toContain('latest_pt.team_id = sar.team_id');
    expect(queryText).toContain('season_awards');
    expect(queryText).toContain('league_awards');
    expect(queryText).toContain('la.competition_scope');
    expect(queryText).toContain('la.stat_key');
    expect(queryText).toContain('t.secondary_color AS team_secondary_color');
    const finalOrderBy = queryText.slice(queryText.lastIndexOf('ORDER BY'));
    expect(finalOrderBy).toContain('season_start_date DESC NULLS LAST');
    expect(finalOrderBy).toContain('sort_order ASC');
    expect(finalOrderBy.indexOf('season_start_date DESC NULLS LAST')).toBeLessThan(
      finalOrderBy.indexOf('sort_order ASC'),
    );
    expect(finalOrderBy.indexOf('sort_order ASC')).toBeLessThan(
      finalOrderBy.indexOf('award_name ASC'),
    );
    expect(finalOrderBy.indexOf('award_name ASC')).toBeLessThan(
      finalOrderBy.indexOf('source_order ASC'),
    );
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).get('/api/admin/players/player-1/awards');
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/players/:id/stats
// ---------------------------------------------------------------------------
describe('GET /api/admin/players/:id/stats', () => {
  it('returns career stats using a valid stat_rows CTE', async () => {
    const statRow = {
      season_id: 'season-1',
      season_name: '2025-26',
      jersey_number: 97,
      gp: 12,
      goals: 8,
      assists: 10,
      points: 18,
      team_id: 'team-1',
      team_name: 'Oilers',
      team_logo: 'oilers.png',
      primary_color: '#ff4500',
      text_color: '#ffffff',
    };
    sql.mockResolvedValueOnce([statRow]);

    const res = await request(app).get('/api/admin/players/player-1/stats');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([statRow]);
    expect(sql).toHaveBeenCalledTimes(1);
    const queryText = sql.mock.calls[0][0].join(' ');
    expect(queryText).toMatch(/WITH\s+stat_rows AS/);
    expect(queryText).toContain('FROM game_player_stats gps');
    expect(queryText).toContain('WHERE gps.player_id =');
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));

    const res = await request(app).get('/api/admin/players/player-1/stats');

    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/players/:id/latest-season-stats
// ---------------------------------------------------------------------------
describe('GET /api/admin/players/:id/latest-season-stats', () => {
  it('returns the latest played season stats split by regular season and playoffs', async () => {
    sql
      .mockResolvedValueOnce([{ season_id: 'season-2', season_name: '2023-24', player_position: 'C' }])
      .mockResolvedValueOnce([
        { game_type: 'regular', gp: 10, goals: 5, assists: 6, points: 11 },
        { game_type: 'playoff', gp: 2, goals: 1, assists: 0, points: 1 },
      ])
      .mockResolvedValueOnce([]);

    const res = await request(app).get('/api/admin/players/player-1/latest-season-stats');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      season_id: 'season-2',
      season_name: '2023-24',
      regular: {
        gp: 10,
        goals: 5,
        assists: 6,
        points: 11,
        wins: 0,
        shootout_wins: 0,
        goals_against: 0,
        shots_against: 0,
        save_pct: null,
        time_on_ice: 0,
      },
      playoffs: {
        gp: 2,
        goals: 1,
        assists: 0,
        points: 1,
        wins: 0,
        shootout_wins: 0,
        goals_against: 0,
        shots_against: 0,
        save_pct: null,
        time_on_ice: 0,
      },
    });
  });

  it('returns null when the player has never played a final game', async () => {
    sql.mockResolvedValueOnce([]);

    const res = await request(app).get('/api/admin/players/player-1/latest-season-stats');

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it('returns requested season stats when season_id is provided', async () => {
    sql
      .mockResolvedValueOnce([{ season_id: 'season-1', season_name: '2022-23', player_position: 'C' }])
      .mockResolvedValueOnce([{ game_type: 'regular', gp: 4, goals: 2, assists: 3, points: 5 }])
      .mockResolvedValueOnce([]);

    const res = await request(app).get(
      '/api/admin/players/player-1/latest-season-stats?season_id=season-1',
    );

    expect(res.status).toBe(200);
    expect(res.body.season_id).toBe('season-1');
    expect(res.body.season_name).toBe('2022-23');
    expect(res.body.regular).toMatchObject({ gp: 4, goals: 2, assists: 3, points: 5 });
    expect(res.body.playoffs).toBeNull();
    expect(sql.mock.calls[0][0].join(' ')).toContain('WHERE s.id =');
  });

  it('uses goalie stints, not roster presence, for goalie games played', async () => {
    sql
      .mockResolvedValueOnce([{ season_id: 'season-2', season_name: '2023-24', player_position: 'G' }])
      .mockResolvedValueOnce([
        { game_type: 'regular', gp: 12, goals: 0, assists: 1, points: 1 },
        { game_type: 'playoff', gp: 4, goals: 0, assists: 0, points: 0 },
      ])
      .mockResolvedValueOnce([
        {
          game_type: 'regular',
          gp: 7,
          shots_against: 210,
          goals_against: 18,
          wins: 5,
          shootout_wins: 1,
        },
      ]);

    const res = await request(app).get('/api/admin/players/player-1/latest-season-stats');

    expect(res.status).toBe(200);
    expect(res.body.regular).toMatchObject({
      gp: 7,
      goals: 0,
      assists: 0,
      points: 0,
      wins: 5,
      shootout_wins: 1,
      goals_against: 18,
      shots_against: 210,
      save_pct: 0.914,
    });
    expect(res.body.playoffs).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/players/:id/last-five-games
// ---------------------------------------------------------------------------
describe('GET /api/admin/players/:id/last-five-games', () => {
  it('returns recent game rows with team and opponent data', async () => {
    sql.mockResolvedValueOnce([
      {
        game_id: 'game-5',
        season_id: 'season-1',
        scheduled_at: '2026-01-15T00:00:00.000Z',
        game_type: 'regular',
        team_id: 'team-1',
        team_name: 'Oilers',
        team_code: 'EDM',
        team_logo: 'oilers.png',
        team_primary_color: '#ff4500',
        team_text_color: '#ffffff',
        opponent_team_id: 'team-2',
        opponent_name: 'Canucks',
        opponent_code: 'VAN',
        opponent_logo: 'canucks.png',
        opponent_primary_color: '#00205b',
        opponent_text_color: '#ffffff',
        is_home: true,
        goals: 1,
        assists: 2,
        points: 3,
        goalie_started: null,
        shots_against: null,
        goals_against: null,
        save_pct: null,
      },
    ]);

    const res = await request(app).get('/api/admin/players/player-1/last-five-games');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      game_id: 'game-5',
      season_id: 'season-1',
      team_name: 'Oilers',
      opponent_code: 'VAN',
      goals: 1,
      assists: 2,
      points: 3,
    });
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).get('/api/admin/players/player-1/last-five-games');
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/players/:id/game-logs
// ---------------------------------------------------------------------------
describe('GET /api/admin/players/:id/game-logs', () => {
  it('returns paginated game logs with total count', async () => {
    sql.mockResolvedValueOnce([
      {
        total_count: 24,
        game_id: 'game-24',
        season_id: 'season-1',
        season_name: '2025-26',
        scheduled_at: '2026-02-01T00:00:00.000Z',
        game_type: 'regular',
        team_id: 'team-1',
        team_name: 'Oilers',
        team_code: 'EDM',
        team_logo: 'oilers.png',
        team_primary_color: '#ff4500',
        team_text_color: '#ffffff',
        opponent_team_id: 'team-2',
        opponent_name: 'Canucks',
        opponent_code: 'VAN',
        opponent_logo: 'canucks.png',
        opponent_primary_color: '#00205b',
        opponent_text_color: '#ffffff',
        is_home: false,
        goals: 0,
        assists: 1,
        points: 1,
        goalie_started: null,
        shots_against: null,
        goals_against: null,
        save_pct: null,
      },
    ]);

    const res = await request(app)
      .get('/api/admin/players/player-1/game-logs?season_id=season-1&game_type=regular&limit=20&offset=20');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(24);
    expect(res.body.games).toHaveLength(1);
    expect(res.body.games[0]).toMatchObject({
      game_id: 'game-24',
      season_name: '2025-26',
      opponent_code: 'VAN',
      assists: 1,
    });
    expect(res.body.games[0].total_count).toBeUndefined();
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).get('/api/admin/players/player-1/game-logs');
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/players/:id
// ---------------------------------------------------------------------------
describe('GET /api/admin/players/:id', () => {
  it('returns the player with latest team logo fields', async () => {
    sql.mockResolvedValueOnce([{
      ...PLAYER,
      player_team_id: 'player-team-1',
      team_id: 'team-1',
      jersey_number: 99,
      is_prospect: false,
      team_name: 'Oilers',
      team_code: 'EDM',
      team_logo: 'oilers.svg',
      team_logo_dark: 'oilers-dark.svg',
      team_logo_light: 'oilers-light.svg',
      primary_color: '#ff4500',
      text_color: '#ffffff',
    }]);
    const res = await request(app).get('/api/admin/players/player-1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('player-1');
    expect(res.body).toMatchObject({
      team_id: 'team-1',
      team_code: 'EDM',
      team_logo: 'oilers.svg',
      team_logo_dark: 'oilers-dark.svg',
      team_logo_light: 'oilers-light.svg',
    });
    const queryText = sql.mock.calls[0][0].join(' ');
    expect(queryText).toContain('latest_ti.logo AS team_logo');
    expect(queryText).toContain('latest_ti.logo_dark AS team_logo_dark');
    expect(queryText).toContain('latest_ti.logo_light AS team_logo_light');
    expect(queryText).toContain('WHERE pt.player_id = p.id');
  });

  it('returns 404 when not found', async () => {
    sql.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/admin/players/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).get('/api/admin/players/player-1');
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/players
// ---------------------------------------------------------------------------
describe('POST /api/admin/players', () => {
  it('creates a player and returns 201', async () => {
    sql.mockResolvedValueOnce([PLAYER]);
    const res = await request(app).post('/api/admin/players')
      .send({ first_name: 'Wayne', last_name: 'Gretzky', position: 'C', shoots: 'L' });
    expect(res.status).toBe(201);
    expect(res.body.first_name).toBe('Wayne');
  });

  it('creates an inactive player when status is provided', async () => {
    sql.mockResolvedValueOnce([{ ...PLAYER, status: 'inactive', is_active: false }]);
    const res = await request(app).post('/api/admin/players')
      .send({
        first_name: 'Wayne',
        last_name: 'Gretzky',
        position: 'C',
        shoots: 'L',
        status: 'inactive',
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('inactive');
    expect(sql.mock.calls[0][0].join(' ')).toContain('status, is_active');
  });

  it('returns 400 when status is invalid', async () => {
    const res = await request(app).post('/api/admin/players')
      .send({ first_name: 'Wayne', last_name: 'Gretzky', status: 'hurt' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/status/i);
    expect(sql).not.toHaveBeenCalled();
  });

  it('returns 400 when first_name is missing', async () => {
    const res = await request(app).post('/api/admin/players')
      .send({ last_name: 'Gretzky' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/first_name/i);
  });

  it('returns 400 when last_name is missing', async () => {
    const res = await request(app).post('/api/admin/players')
      .send({ first_name: 'Wayne' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/last_name/i);
  });

  it('returns 400 when first_name is blank whitespace', async () => {
    const res = await request(app).post('/api/admin/players')
      .send({ first_name: '   ', last_name: 'Gretzky' });
    expect(res.status).toBe(400);
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).post('/api/admin/players')
      .send({ first_name: 'Wayne', last_name: 'Gretzky' });
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/players/bulk
// ---------------------------------------------------------------------------
describe('POST /api/admin/players/bulk', () => {
  const validRow = { first_name: 'Wayne', last_name: 'Gretzky', position: 'C', shoots: 'L' };
  const validRow2 = { first_name: 'Mario', last_name: 'Lemieux', position: 'C', shoots: 'R' };

  it('creates all players and returns 201 with created array', async () => {
    sql.mockResolvedValueOnce([PLAYER]).mockResolvedValueOnce([{ ...PLAYER, id: 'player-2' }]);
    const res = await request(app).post('/api/admin/players/bulk')
      .send({ players: [validRow, validRow2] });
    expect(res.status).toBe(201);
    expect(res.body.created).toHaveLength(2);
  });

  it('creates a single player successfully', async () => {
    sql.mockResolvedValueOnce([PLAYER]);
    const res = await request(app).post('/api/admin/players/bulk')
      .send({ players: [validRow] });
    expect(res.status).toBe(201);
    expect(res.body.created[0].first_name).toBe('Wayne');
  });

  it('returns 400 when players is not an array', async () => {
    const res = await request(app).post('/api/admin/players/bulk')
      .send({ players: 'bad' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/non-empty array/i);
  });

  it('returns 400 when players array is empty', async () => {
    const res = await request(app).post('/api/admin/players/bulk')
      .send({ players: [] });
    expect(res.status).toBe(400);
  });

  it('returns 400 when a row is missing first_name', async () => {
    const res = await request(app).post('/api/admin/players/bulk')
      .send({ players: [{ last_name: 'Gretzky', position: 'C', shoots: 'L' }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/first_name/i);
  });

  it('returns 400 when a row is missing last_name', async () => {
    const res = await request(app).post('/api/admin/players/bulk')
      .send({ players: [{ first_name: 'Wayne', position: 'C', shoots: 'L' }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/last_name/i);
  });

  it('returns 400 when a row is missing position', async () => {
    const res = await request(app).post('/api/admin/players/bulk')
      .send({ players: [{ first_name: 'Wayne', last_name: 'Gretzky', shoots: 'L' }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/position/i);
  });

  it('succeeds when shoots is omitted (optional field)', async () => {
    sql.mockResolvedValueOnce([PLAYER]);
    const res = await request(app).post('/api/admin/players/bulk')
      .send({ players: [{ first_name: 'Wayne', last_name: 'Gretzky', position: 'C' }] });
    expect(res.status).toBe(201);
  });

  it('includes row number in validation error message', async () => {
    const res = await request(app).post('/api/admin/players/bulk')
      .send({ players: [validRow, { first_name: 'Mario', last_name: 'Lemieux' }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/row 2/i);
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).post('/api/admin/players/bulk')
      .send({ players: [validRow] });
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/players/:id/retire
// ---------------------------------------------------------------------------
describe('PATCH /api/admin/players/:id/retire', () => {
  it('marks the player inactive and closes current stint records', async () => {
    const retiredPlayer = {
      ...PLAYER,
      status: 'retired',
      is_active: false,
      retirement_date: '2025-06-30',
      retired_stint_id: 'career-stint-1',
      retired_team_id: 'team-1',
      retired_player_team_id: 'player-team-1',
      retired_season_id: 'season-1',
    };
    sql.mockResolvedValueOnce([retiredPlayer]);

    const res = await request(app).patch('/api/admin/players/player-1/retire')
      .send({ retirement_date: '2025-06-30' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 'player-1',
      status: 'retired',
      is_active: false,
      retirement_date: '2025-06-30',
      retired_stint_id: 'career-stint-1',
      retired_player_team_id: 'player-team-1',
    });
    expect(sql).toHaveBeenCalledTimes(1);

    const queryText = sql.mock.calls[0][0].join(' ');
    expect(queryText).toContain('UPDATE players');
    expect(queryText).toContain("SET status = 'retired', is_active = FALSE");
    expect(queryText).toContain('player_team_stints');
    expect(queryText).toContain('player_teams');
    expect(queryText).toContain('SET end_date =');
  });

  it('requires a valid retirement_date', async () => {
    const res = await request(app).patch('/api/admin/players/player-1/retire')
      .send({ retirement_date: '2025-02-30' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/retirement_date/i);
    expect(sql).not.toHaveBeenCalled();
  });

  it('returns 404 when the player is not found', async () => {
    sql.mockResolvedValueOnce([]);

    const res = await request(app).patch('/api/admin/players/nope/retire')
      .send({ retirement_date: '2025-06-30' });

    expect(res.status).toBe(404);
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));

    const res = await request(app).patch('/api/admin/players/player-1/retire')
      .send({ retirement_date: '2025-06-30' });

    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/players/:id/unretire
// ---------------------------------------------------------------------------
describe('PATCH /api/admin/players/:id/unretire', () => {
  it('marks the player active and reopens latest closed stint records', async () => {
    const unretiredPlayer = {
      ...PLAYER,
      status: 'active',
      is_active: true,
      unretired_stint_id: 'career-stint-1',
      unretired_team_id: 'team-1',
      unretired_player_team_id: 'player-team-1',
      unretired_season_id: 'season-1',
    };
    sql.mockResolvedValueOnce([unretiredPlayer]);

    const res = await request(app).patch('/api/admin/players/player-1/unretire')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 'player-1',
      status: 'active',
      is_active: true,
      unretired_stint_id: 'career-stint-1',
      unretired_player_team_id: 'player-team-1',
    });
    expect(sql).toHaveBeenCalledTimes(1);

    const queryText = sql.mock.calls[0][0].join(' ');
    expect(queryText).toContain('UPDATE players');
    expect(queryText).toContain("SET status = 'active', is_active = TRUE");
    expect(queryText).toContain('player_team_stints');
    expect(queryText).toContain('player_teams');
    expect(queryText).toContain('SET end_date = NULL');
  });

  it('returns 404 when the player is not found', async () => {
    sql.mockResolvedValueOnce([]);

    const res = await request(app).patch('/api/admin/players/nope/unretire')
      .send({});

    expect(res.status).toBe(404);
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));

    const res = await request(app).patch('/api/admin/players/player-1/unretire')
      .send({});

    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/players/:id
// ---------------------------------------------------------------------------
describe('PATCH /api/admin/players/:id', () => {
  it('returns the updated player', async () => {
    sql.mockResolvedValueOnce([{ ...PLAYER, weight_lbs: 190 }]);
    const res = await request(app).patch('/api/admin/players/player-1')
      .send({ weight_lbs: 190 });
    expect(res.status).toBe(200);
    expect(res.body.weight_lbs).toBe(190);
  });

  it('updates player status and derived active flag', async () => {
    sql.mockResolvedValueOnce([{ ...PLAYER, status: 'inactive', is_active: false }]);
    const res = await request(app).patch('/api/admin/players/player-1')
      .send({ status: 'inactive' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'inactive', is_active: false });
    const queryText = sql.mock.calls[0][0].join(' ');
    expect(queryText).toContain('status        = CASE');
    expect(queryText).toContain('is_active     = CASE');
  });

  it('returns 400 when updating to an invalid status', async () => {
    const res = await request(app).patch('/api/admin/players/player-1')
      .send({ status: 'injured' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/status/i);
    expect(sql).not.toHaveBeenCalled();
  });

  it('returns 404 when not found', async () => {
    sql.mockResolvedValueOnce([]);
    const res = await request(app).patch('/api/admin/players/nope')
      .send({ weight_lbs: 190 });
    expect(res.status).toBe(404);
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).patch('/api/admin/players/player-1')
      .send({ weight_lbs: 190 });
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/players/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/admin/players/:id', () => {
  it('returns 200 with message on success', async () => {
    sql.mockResolvedValueOnce([{ id: 'player-1' }]);
    const res = await request(app).delete('/api/admin/players/player-1');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });

  it('returns 404 when not found', async () => {
    sql.mockResolvedValueOnce([]);
    const res = await request(app).delete('/api/admin/players/nope');
    expect(res.status).toBe(404);
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).delete('/api/admin/players/player-1');
    expect(res.status).toBe(500);
  });
});

