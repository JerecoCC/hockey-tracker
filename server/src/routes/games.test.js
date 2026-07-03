'use strict';

jest.mock('../db', () => ({
  sql: jest.fn(),
  db: { execute: jest.fn(), select: jest.fn() },
  schema: jest.requireActual('../schema'),
}));
jest.mock('../middleware/auth', () => ({
  requireAdmin: (req, res, next) => { req.user = { id: 'admin-1', role: 'admin' }; next(); },
}));
jest.mock('../lib/gameStatsSnapshots', () => ({
  rebuildGameStats: jest.fn(() => Promise.resolve()),
}));

const request     = require('supertest');
const express     = require('express');
const { sql, db } = require('../db');
const { rebuildGameStats } = require('../lib/gameStatsSnapshots');
const gamesRouter = require('./games');

const app = express();
app.use(express.json());
app.use('/api/admin/games', gamesRouter);

let selectRows = [];
let selectError = null;

const makeSelectChain = () => {
  const chain = {
    from: jest.fn(() => chain),
    innerJoin: jest.fn(() => chain),
    leftJoin: jest.fn(() => chain),
    where: jest.fn(() => chain),
    orderBy: jest.fn(() => (
      selectError ? Promise.reject(selectError) : Promise.resolve(selectRows)
    )),
  };
  return chain;
};

// ── Fixtures ────────────────────────────────────────────────────────────────

const LAST_FIVE_GAME = {
  game_id: 'game-0', scheduled_at: '2024-10-10T19:00:00Z',
  home_score: 3, away_score: 1,
  overtime_periods: null, shootout: false,
  result: 'W', opponent_code: 'LAK', opponent_logo: null, is_home: true,
};

const GAME = {
  id: 'game-1', season_id: 'season-1',
  home_team: {
    id: 'team-1', name: 'Sharks', code: 'SJS', logo: null,
    primary_color: '#006272', secondary_color: '#EA7200', text_color: '#ffffff',
  },
  away_team: {
    id: 'team-2', name: 'Kings', code: 'LAK', logo: null,
    primary_color: '#111111', secondary_color: '#A2AAAD', text_color: '#ffffff',
  },
  game_type: 'regular', status: 'scheduled',
  scheduled_at: '2024-10-15T19:00:00Z', venue: 'SAP Center',
  home_score: 0, away_score: 0, winner_team_id: null,
  overtime_periods: null, shootout: false, shootout_first_team_id: null,
  game_number: null, game_number_in_series: null,
  playoff_round: null,
  playoff_round_names: null,
  playoff_matchup_names: null,
  bracket_slot_key: null,
  playoff_series_id: null, notes: null, created_at: new Date().toISOString(),
  home_last_five: [LAST_FIVE_GAME],
  away_last_five: [],
};

const SERIES = {
  id: 'series-1', season_id: 'season-1', round: 1, series_letter: 'A',
  home_team_id: 'team-1', away_team_id: 'team-2',
  home_team_name: 'Sharks', home_team_code: 'SJS', home_team_logo: null,
  away_team_name: 'Kings',  away_team_code: 'LAK', away_team_logo: null,
  games_to_win: 4, home_wins: 0, away_wins: 0,
  status: 'upcoming', winner_team_id: null, created_at: new Date().toISOString(),
};

beforeEach(() => {
  sql.mockReset();
  db.execute.mockReset();
  db.select.mockReset();
  rebuildGameStats.mockClear();
  selectRows = [];
  selectError = null;
  db.select.mockImplementation(() => makeSelectChain());
});

// ---------------------------------------------------------------------------
// GET /api/admin/games
// ---------------------------------------------------------------------------
describe('GET /api/admin/games', () => {
  it('returns an array of games', async () => {
    selectRows = [GAME];
    const res = await request(app).get('/api/admin/games');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('game-1');
    expect(res.body[0]).toMatchObject({ home_score: 0, away_score: 0, winner_team_id: null });
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(db.execute).not.toHaveBeenCalled();
    expect(sql).not.toHaveBeenCalled();
  });

  it('accepts season_id, game_type and status query params', async () => {
    selectRows = [GAME];
    const res = await request(app)
      .get('/api/admin/games?season_id=season-1&game_type=regular&status=scheduled');
    expect(res.status).toBe(200);
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(db.execute).not.toHaveBeenCalled();
    expect(sql).not.toHaveBeenCalled();
  });

  it('filters games by week start on the backend', async () => {
    selectRows = [GAME];
    const res = await request(app)
      .get('/api/admin/games?season_id=season-1&week=2024-10-14');

    expect(res.status).toBe(200);
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(db.execute).not.toHaveBeenCalled();
    expect(sql).not.toHaveBeenCalled();
  });

  it('rejects invalid week query values', async () => {
    const res = await request(app).get('/api/admin/games?week=October-14');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/week must be/i);
    expect(sql).not.toHaveBeenCalled();
  });

  it('returns 500 on DB error', async () => {
    selectError = new Error('DB down');
    const res = await request(app).get('/api/admin/games');
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/games/route-lookup
// ---------------------------------------------------------------------------
describe('GET /api/admin/games/route-lookup', () => {
  it('resolves a slug game route to a single game id', async () => {
    db.execute.mockResolvedValueOnce([{ game_id: 'game-1' }]);

    const res = await request(app)
      .get('/api/admin/games/route-lookup?season_id=season-1&game_date=10-15-2024&game_slug=lak-vs-sjs');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ game_id: 'game-1' });
    expect(db.execute).toHaveBeenCalledTimes(1);
    expect(sql).not.toHaveBeenCalled();
  });

  it('resolves route lookup results returned in a Drizzle rows wrapper', async () => {
    db.execute.mockResolvedValueOnce({ rows: [{ game_id: 'game-1' }] });

    const res = await request(app)
      .get('/api/admin/games/route-lookup?season_id=season-1&game_date=10-15-2024&game_slug=lak-vs-sjs');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ game_id: 'game-1' });
  });

  it('requires all route lookup params', async () => {
    const res = await request(app).get('/api/admin/games/route-lookup?season_id=season-1');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
    expect(sql).not.toHaveBeenCalled();
  });

  it('returns 404 when a slug game route cannot be resolved', async () => {
    db.execute.mockResolvedValueOnce([]);

    const res = await request(app)
      .get('/api/admin/games/route-lookup?season_id=season-1&game_date=10-15-2024&game_slug=lak-vs-sjs');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/games/:id
// ---------------------------------------------------------------------------
describe('GET /api/admin/games/:id', () => {
  it('returns the game record', async () => {
    sql.mockResolvedValueOnce([GAME]);
    const res = await request(app).get('/api/admin/games/game-1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('game-1');
    expect(res.body).toMatchObject({ home_score: 0, away_score: 0, winner_team_id: null });
  });

  it('includes home and away secondary_color fields', async () => {
    sql.mockResolvedValueOnce([GAME]);
    const res = await request(app).get('/api/admin/games/game-1');
    expect(res.status).toBe(200);
    expect(res.body.home_team.secondary_color).toBe('#EA7200');
    expect(res.body.away_team.secondary_color).toBe('#A2AAAD');
  });

  it('includes home_last_five and away_last_five arrays', async () => {
    sql.mockResolvedValueOnce([GAME]);
    const res = await request(app).get('/api/admin/games/game-1');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.home_last_five)).toBe(true);
    expect(Array.isArray(res.body.away_last_five)).toBe(true);
    expect(res.body.home_last_five).toHaveLength(1);
    expect(res.body.away_last_five).toHaveLength(0);
  });

  it('home_last_five entries have expected shape (game_id, result, scores, is_home)', async () => {
    sql.mockResolvedValueOnce([GAME]);
    const res = await request(app).get('/api/admin/games/game-1');
    expect(res.status).toBe(200);
    const entry = res.body.home_last_five[0];
    expect(entry).toMatchObject({
      game_id: 'game-0',
      result: 'W',
      home_score: 3,
      away_score: 1,
      is_home: true,
      scheduled_at: '2024-10-10T19:00:00Z',
    });
  });

  it('queries all other season-series meetings, including future non-final games', async () => {
    sql.mockResolvedValueOnce([GAME]);

    const res = await request(app).get('/api/admin/games/game-1');

    expect(res.status).toBe(200);

    const queryText = sql.mock.calls[0][0].join(' ');
    const prevMeetingsStart = queryText.indexOf('-- All other meetings between home and away teams in the same season');
    const prevMeetingsEnd = queryText.indexOf(') prev ON true', prevMeetingsStart);
    const prevMeetingsSection = queryText.slice(prevMeetingsStart, prevMeetingsEnd);

    expect(prevMeetingsSection).toMatch(/'status',\s+lg\.status/);
    expect(prevMeetingsSection).toMatch(/'created_at',\s+lg\.created_at/);
    expect(prevMeetingsSection).not.toMatch(/g2\.status\s*=\s*'final'/);
    expect(prevMeetingsSection).not.toMatch(/g2\.scheduled_at\s*<\s*g\.scheduled_at/);
  });

  it('includes playoff matchup label fields for game details', async () => {
    sql.mockResolvedValueOnce([
      {
        ...GAME,
        game_type: 'playoff',
        playoff_round: 1,
        bracket_slot_key: 'r1m0',
        playoff_round_names: { 1: 'Semifinal' },
        playoff_matchup_names: { r1m0: 'Eastern Semifinal' },
      },
    ]);

    const res = await request(app).get('/api/admin/games/game-1');

    expect(res.status).toBe(200);
    expect(res.body.bracket_slot_key).toBe('r1m0');
    expect(res.body.playoff_matchup_names).toEqual({ r1m0: 'Eastern Semifinal' });

    const queryText = sql.mock.calls[0][0].join(' ');
    expect(queryText).toContain('ps2.bracket_slot_key AS bracket_slot_key');
    expect(queryText).toContain('brs.matchup_names AS playoff_matchup_names');
  });

  it('returns 404 when game not found', async () => {
    sql.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/admin/games/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).get('/api/admin/games/game-1');
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/games
// ---------------------------------------------------------------------------
describe('POST /api/admin/games', () => {
  it('returns 400 when required fields are missing', async () => {
    const res = await request(app).post('/api/admin/games')
      .send({ season_id: 'season-1', home_team_id: 'team-1' }); // missing away_team_id
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 400 when home and away teams are the same', async () => {
    const res = await request(app).post('/api/admin/games')
      .send({ season_id: 'season-1', home_team_id: 'team-1', away_team_id: 'team-1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/different/i);
  });

  it('creates a game and returns 201', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'game-1' }])  // INSERT RETURNING id
      .mockResolvedValueOnce([GAME]);              // SELECT re-fetch
    const res = await request(app).post('/api/admin/games').send({
      season_id: 'season-1', home_team_id: 'team-1', away_team_id: 'team-2',
      venue: 'SAP Center', game_type: 'regular', status: 'scheduled',
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('game-1');
    expect(res.body.status).toBe('scheduled');
  });

  it('returns 409 for a duplicate matchup on the same date', async () => {
    sql.mockResolvedValueOnce([{ id: 'existing-game' }]); // duplicate check hit
    const res = await request(app).post('/api/admin/games').send({
      season_id: 'season-1', home_team_id: 'team-1', away_team_id: 'team-2',
      scheduled_at: '2026-04-17',
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('skips the duplicate check when the date is null', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'game-1' }])  // INSERT RETURNING id (no dup query first)
      .mockResolvedValueOnce([GAME]);              // SELECT re-fetch
    const res = await request(app).post('/api/admin/games').send({
      season_id: 'season-1', home_team_id: 'team-1', away_team_id: 'team-2',
    });
    expect(res.status).toBe(201);
  });

  it('returns 400 on FK violation', async () => {
    const fkErr = Object.assign(new Error('fk'), { code: '23503' });
    sql.mockRejectedValueOnce(fkErr);
    const res = await request(app).post('/api/admin/games').send({
      season_id: 'bad', home_team_id: 'team-1', away_team_id: 'team-2',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid season_id or team_id/i);
  });

  it('does not accept in_progress as a status (check constraint)', async () => {
    const checkErr = Object.assign(new Error('check'), { code: '23514' });
    sql.mockRejectedValueOnce(checkErr);
    const res = await request(app).post('/api/admin/games').send({
      season_id: 'season-1', home_team_id: 'team-1', away_team_id: 'team-2',
      status: 'in_progress',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid game_type or status/i);
  });

  it('returns 500 on generic DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).post('/api/admin/games').send({
      season_id: 'season-1', home_team_id: 'team-1', away_team_id: 'team-2',
    });
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/games/:id
// ---------------------------------------------------------------------------
describe('PATCH /api/admin/games/:id', () => {
  it('updates a game and returns the updated record', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'game-1', playoff_series_id: null }]) // existence check
      .mockResolvedValueOnce([])                             // UPDATE
      .mockResolvedValueOnce([{ playoff_series_id: null, home_team_id: 'team-1', away_team_id: 'team-2' }]) // final-status follow-up
      .mockResolvedValueOnce([{ ...GAME, status: 'final', home_score: 3, away_score: 2 }]); // re-fetch
    const res = await request(app).patch('/api/admin/games/game-1')
      .send({ status: 'final', home_score: 3, away_score: 2 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('final');
    expect(res.body.home_score).toBe(3);
  });

  it('returns 404 when game not found', async () => {
    sql.mockResolvedValueOnce([]); // existence check → empty
    const res = await request(app).patch('/api/admin/games/nope')
      .send({ status: 'final' });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('updates playoff round and game number in series when provided', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'game-1', playoff_series_id: 'series-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          ...GAME,
          game_type: 'playoff',
          playoff_series_id: 'series-1',
          game_number_in_series: 3,
          playoff_round: 2,
          playoff_round_names: { 2: 'Semifinal' },
        },
      ]);

    const res = await request(app).patch('/api/admin/games/game-1').send({
      playoff_round: 2,
      game_number_in_series: 3,
    });

    expect(res.status).toBe(200);
    expect(res.body.playoff_round).toBe(2);
    expect(res.body.game_number_in_series).toBe(3);

    const queries = sql.mock.calls.map((call) => call[0].join(' '));
    expect(queries.some((query) => query.includes('game_number_in_series'))).toBe(true);
    expect(
      queries.some(
        (query) => query.includes('UPDATE playoff_series') && query.includes('SET round ='),
      ),
    ).toBe(true);
  });

  it('returns 400 on check constraint violation', async () => {
    const checkErr = Object.assign(new Error('check'), { code: '23514' });
    sql
      .mockResolvedValueOnce([{ id: 'game-1', playoff_series_id: null }])
      .mockRejectedValueOnce(checkErr);
    const res = await request(app).patch('/api/admin/games/game-1')
      .send({ status: 'in_progress' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid game_type or status/i);
  });

  it('returns 500 on generic DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).patch('/api/admin/games/game-1')
      .send({ venue: 'New Arena' });
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/games/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/admin/games/:id', () => {
  it('deletes a game and returns 204', async () => {
    sql.mockResolvedValueOnce([{ id: 'game-1' }]);
    const res = await request(app).delete('/api/admin/games/game-1');
    expect(res.status).toBe(204);
  });

  it('returns 404 when game not found', async () => {
    sql.mockResolvedValueOnce([]);
    const res = await request(app).delete('/api/admin/games/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).delete('/api/admin/games/game-1');
    expect(res.status).toBe(500);
  });
});



// ---------------------------------------------------------------------------
// GET /api/admin/games/playoff-series
// ---------------------------------------------------------------------------
describe('GET /api/admin/games/playoff-series', () => {
  it('resolves team names using the season date-aware team iteration range', async () => {
    sql.mockResolvedValueOnce([SERIES]);

    const res = await request(app).get('/api/admin/games/playoff-series?season_id=season-1');

    expect(res.status).toBe(200);
    expect(res.body[0].home_team_name).toBe('Sharks');

    const queryText = sql.mock.calls[0][0].join(' ');
    expect(queryText).toContain('JOIN seasons s ON s.id = ps.season_id');
    expect(queryText).toContain('ti.start_season_id');
    expect(queryText).toContain('ti.latest_season_id');
    expect(queryText).toContain('ss.start_date <= s.start_date');
    expect(queryText).toContain('ls.start_date >= s.start_date');
    expect(queryText).toContain('brs.matchup_names AS playoff_matchup_names');
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/games/playoff-series
// ---------------------------------------------------------------------------
describe('POST /api/admin/games/playoff-series', () => {
  it('returns 400 when required fields are missing', async () => {
    const res = await request(app).post('/api/admin/games/playoff-series')
      .send({ season_id: 'season-1', home_team_id: 'team-1' }); // missing away_team_id + round
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 400 when home and away teams are the same', async () => {
    const res = await request(app).post('/api/admin/games/playoff-series')
      .send({ season_id: 'season-1', home_team_id: 'team-1', away_team_id: 'team-1', round: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/different/i);
  });

  it('creates a playoff series and returns 201', async () => {
    sql
      .mockResolvedValue([])
      .mockResolvedValueOnce([{ best_of: 7 }])
      .mockResolvedValueOnce([SERIES]);
    const res = await request(app).post('/api/admin/games/playoff-series').send({
      season_id: 'season-1', home_team_id: 'team-1', away_team_id: 'team-2', round: 1,
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('series-1');
    expect(res.body.round).toBe(1);
  });

  it('returns 400 on FK violation', async () => {
    const fkErr = Object.assign(new Error('fk'), { code: '23503' });
    sql.mockRejectedValueOnce(fkErr);
    const res = await request(app).post('/api/admin/games/playoff-series').send({
      season_id: 'bad', home_team_id: 'team-1', away_team_id: 'team-2', round: 1,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid season_id or team_id/i);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/games/playoff-series/:seriesId
// ---------------------------------------------------------------------------
describe('PATCH /api/admin/games/playoff-series/:seriesId', () => {
  it('updates a series and returns the updated record', async () => {
    sql.mockResolvedValueOnce([{ ...SERIES, home_wins: 2 }]);
    const res = await request(app).patch('/api/admin/games/playoff-series/series-1')
      .send({ home_wins: 2 });
    expect(res.status).toBe(200);
    expect(res.body.home_wins).toBe(2);
  });

  it('returns 404 when series not found', async () => {
    sql.mockResolvedValueOnce([]); // UPDATE RETURNING → empty
    const res = await request(app).patch('/api/admin/games/playoff-series/nope')
      .send({ home_wins: 1 });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).patch('/api/admin/games/playoff-series/series-1')
      .send({ home_wins: 1 });
    expect(res.status).toBe(500);
  });
});


// ── Sub-resource fixtures ────────────────────────────────────────────────────

const GOAL = {
  id: 'goal-1', game_id: 'game-1', team_id: 'team-1',
  period: '1', goal_type: 'even-strength', empty_net: false, penalty_shot: false,
  period_time: '10:23', scorer_id: 'player-1',
  assist_1_id: 'player-2', assist_2_id: null, created_at: new Date().toISOString(),
  team_name: 'Sharks', team_code: 'SJS', team_logo: null,
  team_primary_color: '#006272', team_text_color: '#ffffff',
  scorer_first_name: 'Joe', scorer_last_name: 'Smith',
  scorer_photo: null, scorer_jersey_number: 39,
  assist_1_first_name: 'Wayne', assist_1_last_name: 'Gretzky',
  assist_1_photo: null, assist_1_jersey_number: 99,
  assist_2_first_name: null, assist_2_last_name: null,
  assist_2_photo: null, assist_2_jersey_number: null,
  scorer_prior_goals: 2, assist_1_prior_assists: 5, assist_2_prior_assists: 0,
};

const GOALIE_STAT = {
  id: 'gs-1', game_id: 'game-1', team_id: 'team-1', goalie_id: 'player-10',
  shots_against: 30, saves: 28, created_at: new Date().toISOString(),
  goalie_first_name: 'Martin', goalie_last_name: 'Jones',
  goalie_photo: null, goalie_jersey_number: 31,
  team_name: 'Sharks', team_code: 'SJS', team_logo: null,
  team_primary_color: '#006272', team_text_color: '#ffffff',
};

const mockSqlFragments = (count) => {
  for (let i = 0; i < count; i += 1) {
    sql.mockReturnValueOnce('');
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/games/:id/goals
// ---------------------------------------------------------------------------
describe('GET /api/admin/games/:id/goals', () => {
  it('returns an array of goals with prior stats', async () => {
    sql.mockResolvedValueOnce([GOAL]);
    const res = await request(app).get('/api/admin/games/game-1/goals');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('goal-1');
    expect(res.body[0].scorer_prior_goals).toBe(2);
    expect(res.body[0].assist_1_prior_assists).toBe(5);
  });

  it('returns an empty array when no goals exist', async () => {
    sql.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/admin/games/game-1/goals');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).get('/api/admin/games/game-1/goals');
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/games/:id/goals
// ---------------------------------------------------------------------------
describe('POST /api/admin/games/:id/goals', () => {
  it('returns 400 when required fields are missing', async () => {
    const res = await request(app).post('/api/admin/games/game-1/goals')
      .send({ team_id: 'team-1', period: '1' }); // missing scorer_id
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 400 when the scorer matches the first assist', async () => {
    const res = await request(app).post('/api/admin/games/game-1/goals')
      .send({
        team_id: 'team-1',
        period: '1',
        scorer_id: 'player-1',
        assist_1_id: 'player-1',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/scorer_id and assist_1_id must be different/i);
    expect(sql).not.toHaveBeenCalled();
  });

  it('returns 400 when a second assist is provided without a first assist', async () => {
    const res = await request(app).post('/api/admin/games/game-1/goals')
      .send({
        team_id: 'team-1',
        period: '1',
        scorer_id: 'player-1',
        assist_2_id: 'player-3',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/assist_1_id is required/i);
    expect(sql).not.toHaveBeenCalled();
  });

  it('returns 404 when game does not exist', async () => {
    sql.mockResolvedValueOnce([]); // game lookup → empty
    const res = await request(app).post('/api/admin/games/nope/goals')
      .send({ team_id: 'team-1', period: '1', scorer_id: 'player-1' });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 400 when team is not a participant', async () => {
    sql.mockResolvedValueOnce([{ home_team_id: 'team-1', away_team_id: 'team-2' }]);
    const res = await request(app).post('/api/admin/games/game-1/goals')
      .send({ team_id: 'team-99', period: '1', scorer_id: 'player-1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/participant/i);
  });

  it('creates a goal and returns 201 with full record', async () => {
    sql
      .mockResolvedValueOnce([{ home_team_id: 'team-1', away_team_id: 'team-2' }]) // game lookup
      .mockResolvedValueOnce([{ id: 'goal-1' }])   // INSERT RETURNING id
      .mockResolvedValueOnce([GOAL]);               // SELECT full record
    const res = await request(app).post('/api/admin/games/game-1/goals').send({
      team_id: 'team-1', period: '1', scorer_id: 'player-1',
      goal_type: 'power-play', empty_net: false, penalty_shot: false, period_time: '10:23',
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('goal-1');
    expect(res.body.goal_type).toBe('even-strength'); // from fixture
  });

  it('returns 400 on FK violation', async () => {
    sql.mockResolvedValueOnce([{ home_team_id: 'team-1', away_team_id: 'team-2' }]);
    sql.mockRejectedValueOnce(Object.assign(new Error('fk'), { code: '23503' }));
    const res = await request(app).post('/api/admin/games/game-1/goals')
      .send({ team_id: 'team-1', period: '1', scorer_id: 'bad-player' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it('returns 500 on generic DB error', async () => {
    sql.mockResolvedValueOnce([{ home_team_id: 'team-1', away_team_id: 'team-2' }]);
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).post('/api/admin/games/game-1/goals')
      .send({ team_id: 'team-1', period: '1', scorer_id: 'player-1' });
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/admin/games/:id/goals/:goalId
// ---------------------------------------------------------------------------
describe('PUT /api/admin/games/:id/goals/:goalId', () => {
  it('returns 400 when required fields are missing', async () => {
    const res = await request(app).put('/api/admin/games/game-1/goals/goal-1')
      .send({ team_id: 'team-1', period: '1' }); // missing scorer_id
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 400 when the scorer matches the second assist', async () => {
    const res = await request(app).put('/api/admin/games/game-1/goals/goal-1')
      .send({
        team_id: 'team-1',
        period: '1',
        scorer_id: 'player-1',
        assist_1_id: 'player-2',
        assist_2_id: 'player-1',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/scorer_id and assist_2_id must be different/i);
    expect(sql).not.toHaveBeenCalled();
  });

  it('returns 400 when both assists match', async () => {
    const res = await request(app).put('/api/admin/games/game-1/goals/goal-1')
      .send({
        team_id: 'team-1',
        period: '1',
        scorer_id: 'player-1',
        assist_1_id: 'player-2',
        assist_2_id: 'player-2',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/assist_1_id and assist_2_id must be different/i);
    expect(sql).not.toHaveBeenCalled();
  });

  it('updates a goal, returns the full goal record, and refreshes cached stats', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'goal-1' }])
      .mockResolvedValueOnce([GOAL]);
    const res = await request(app).put('/api/admin/games/game-1/goals/goal-1').send({
      team_id: 'team-1', period: '1', scorer_id: 'player-1',
      goal_type: 'shorthanded', empty_net: false, penalty_shot: true, period_time: '05:00',
    });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('goal-1');
    expect(res.body.scorer_prior_goals).toBe(2);
    expect(rebuildGameStats).toHaveBeenCalledWith(sql, 'game-1');
  });

  it('returns 404 when goal not found', async () => {
    sql.mockResolvedValueOnce([]); // UPDATE RETURNING → empty
    const res = await request(app).put('/api/admin/games/game-1/goals/nope')
      .send({ team_id: 'team-1', period: '1', scorer_id: 'player-1' });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).put('/api/admin/games/game-1/goals/goal-1')
      .send({ team_id: 'team-1', period: '1', scorer_id: 'player-1' });
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/games/:id/goals/:goalId
// ---------------------------------------------------------------------------
describe('DELETE /api/admin/games/:id/goals/:goalId', () => {
  it('deletes a goal and returns 204', async () => {
    sql.mockResolvedValueOnce([{ id: 'goal-1' }]);
    const res = await request(app).delete('/api/admin/games/game-1/goals/goal-1');
    expect(res.status).toBe(204);
  });

  it('returns 404 when goal not found', async () => {
    sql.mockResolvedValueOnce([]);
    const res = await request(app).delete('/api/admin/games/game-1/goals/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).delete('/api/admin/games/game-1/goals/goal-1');
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/games/:id/shots
// ---------------------------------------------------------------------------
describe('PATCH /api/admin/games/:id/shots', () => {
  it('returns 400 when required fields are missing', async () => {
    const res = await request(app).patch('/api/admin/games/game-1/shots')
      .send({ period: '1', home_shots: 10 }); // missing away_shots
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('upserts shots and returns period_shots', async () => {
    const periodShots = [{ period: '1', home_shots: 10, away_shots: 8 }];
    sql.mockResolvedValueOnce([{ period_shots: periodShots }]);
    const res = await request(app).patch('/api/admin/games/game-1/shots')
      .send({ period: '1', home_shots: 10, away_shots: 8 });
    expect(res.status).toBe(200);
    expect(res.body.period_shots).toHaveLength(1);
    expect(res.body.period_shots[0].period).toBe('1');
  });

  it('returns 404 when game not found', async () => {
    sql.mockResolvedValueOnce([]); // UPDATE RETURNING → empty
    const res = await request(app).patch('/api/admin/games/nope/shots')
      .send({ period: '1', home_shots: 5, away_shots: 5 });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).patch('/api/admin/games/game-1/shots')
      .send({ period: '1', home_shots: 5, away_shots: 5 });
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/games/:id/roster
// ---------------------------------------------------------------------------
describe('POST /api/admin/games/:id/roster', () => {
  it('moves prospects to the roster before adding them to the game lineup', async () => {
    sql
      .mockResolvedValueOnce([]) // UPDATE player_teams is_prospect
      .mockResolvedValueOnce([]) // INSERT game_rosters
      .mockResolvedValueOnce([
        {
          id: 'roster-1',
          game_id: 'game-1',
          team_id: 'team-1',
          player_id: 'player-1',
          first_name: 'Jane',
          last_name: 'Doe',
          date_of_birth: null,
          start_date: null,
          acquisition_type: null,
          photo: null,
          position: 'C',
          jersey_number: 27,
        },
      ]);

    const res = await request(app).post('/api/admin/games/game-1/roster').send({
      team_id: 'team-1',
      player_ids: ['player-1'],
    });

    expect(res.status).toBe(201);
    expect(res.body[0].player_id).toBe('player-1');

    const queries = sql.mock.calls.map((call) => call[0].join(' '));
    expect(queries[0]).toMatch(/UPDATE player_teams pt/);
    expect(queries[0]).toMatch(/SET is_prospect = FALSE/);
    expect(queries[0]).toMatch(/pt\.season_id = g\.season_id/);
    expect(queries[1]).toMatch(/INSERT INTO game_rosters/);
    expect(queries[2]).toMatch(/player_team_stints/);
    expect(queries[2]).toMatch(/COALESCE\(pts\.start_date, pt\.start_date\) AS start_date/);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/admin/games/:id/lineup
// ---------------------------------------------------------------------------
describe('GET /api/admin/games/:id/lineup', () => {
  it('joins starting goalie metadata by the game season', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'game-1' }])
      .mockResolvedValueOnce([]);

    const res = await request(app).get('/api/admin/games/game-1/lineup');

    expect(res.status).toBe(200);
    const queries = sql.mock.calls.map((call) => call[0].join(' '));
    expect(queries[1]).toMatch(/home_starting_goalie_id/);
    expect(queries[1]).toMatch(/away_starting_goalie_id/);
    expect(queries[1]).toMatch(/pt\.season_id = slot\.season_id/);
    expect(queries[1]).toMatch(/p\.date_of_birth/);
    expect(queries[1]).toMatch(/player_team_stints/);
    expect(queries[1]).toMatch(/COALESCE\(pts\.start_date, pt\.start_date\) AS start_date/);
    expect(queries[1]).toMatch(/acquisition_type/);
    expect(queries.join(' ')).not.toMatch(/game_starting_lineup/);
  });

  it('returns only current game starting goalie rows', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'game-1' }])
      .mockResolvedValueOnce([{ id: 'game-1-home-G', team_id: 'home-1', inherited: false }]);

    const res = await request(app).get('/api/admin/games/game-1/lineup');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'game-1-home-G', team_id: 'home-1', inherited: false }]);
    const queries = sql.mock.calls.map((call) => call[0].join(' '));
    expect(queries[1]).toMatch(/goalie_slots AS/);
    expect(queries[1]).not.toMatch(/source_lineup AS/);
    expect(queries[1]).not.toMatch(/CROSS JOIN LATERAL \(VALUES/);
  });
});

describe('PUT /api/admin/games/:id/lineup', () => {
  it('returns 400 when a non-goalie starting slot is provided', async () => {
    const res = await request(app).put('/api/admin/games/game-1/lineup').send({
      team_id: 'team-1',
      slots: [{ position_slot: 'F1', player_id: 'player-1' }],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/only the g starting goalie slot is supported/i);
    expect(sql).not.toHaveBeenCalled();
  });

  it('joins returned starting goalie metadata by the game season', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'game-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const res = await request(app).put('/api/admin/games/game-1/lineup').send({
      team_id: 'team-1',
      slots: [{ position_slot: 'G', player_id: 'goalie-1' }],
    });

    expect(res.status).toBe(200);
    const queries = sql.mock.calls.map((call) => call[0].join(' '));
    expect(queries[2]).toMatch(/pt\.season_id = slot\.season_id/);
    expect(queries[2]).toMatch(/p\.date_of_birth/);
    expect(queries[2]).toMatch(/player_team_stints/);
    expect(queries[2]).toMatch(/COALESCE\(pts\.start_date, pt\.start_date\) AS start_date/);
    expect(queries[2]).toMatch(/acquisition_type/);
    expect(queries.join(' ')).not.toMatch(/game_starting_lineup/);
    expect(rebuildGameStats).toHaveBeenCalledWith(sql, 'game-1');
  });

  it('syncs a final game starting goalie stint when the lineup goalie changes', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'game-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'lineup-G', position_slot: 'G', player_id: 'goalie-2' }]);

    const res = await request(app).put('/api/admin/games/game-1/lineup').send({
      team_id: 'team-1',
      slots: [{ position_slot: 'G', player_id: 'goalie-2' }],
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'lineup-G', position_slot: 'G', player_id: 'goalie-2' }]);
    const queries = sql.mock.calls.map((call) => call[0].join(' '));
    expect(queries[1]).toMatch(/UPDATE game_goalie_stints st/);
    expect(queries[1]).toMatch(/g\.status = 'final'/);
    expect(queries[1]).toMatch(/st\.stint_ord = 1/);
    expect(queries[1]).toMatch(/st\.entered_period = '1'/);
    expect(rebuildGameStats).toHaveBeenCalledWith(sql, 'game-1');
  });

  it('does not write legacy starting lineup rows', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'game-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'lineup-G', inherited: false }]);

    const res = await request(app).put('/api/admin/games/game-1/lineup').send({
      team_id: 'team-1',
      slots: [{ position_slot: 'G', player_id: 'goalie-1' }],
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'lineup-G', inherited: false }]);
    const queries = sql.mock.calls.map((call) => call[0].join(' '));
    expect(queries[0]).toMatch(/UPDATE games/);
    expect(queries.join(' ')).not.toMatch(/game_starting_lineup/);
    expect(rebuildGameStats).toHaveBeenCalledWith(sql, 'game-1');
  });
});

describe('DELETE /api/admin/games/:id/lineup/:teamId', () => {
  it('clears a lineup and refreshes cached stats', async () => {
    sql.mockResolvedValueOnce([{ game_exists: true, changed: true }]);

    const res = await request(app).delete('/api/admin/games/game-1/lineup/team-1');

    expect(res.status).toBe(204);
    expect(rebuildGameStats).toHaveBeenCalledWith(sql, 'game-1');
  });

  it('returns 404 when lineup not found', async () => {
    sql.mockResolvedValueOnce([{ game_exists: true, changed: false }]);

    const res = await request(app).delete('/api/admin/games/game-1/lineup/team-1');

    expect(res.status).toBe(404);
    expect(rebuildGameStats).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/games/:id/goalie-stints
// ---------------------------------------------------------------------------
describe('GET /api/admin/games/:id/goalie-stints', () => {
  it('returns an array of goalie stats', async () => {
    mockSqlFragments(1); // goalieStintsCTE(id)
    sql.mockResolvedValueOnce([GOALIE_STAT]);
    const res = await request(app).get('/api/admin/games/game-1/goalie-stints');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('gs-1');
    expect(res.body[0].shots_against).toBe(30);
    expect(res.body[0].saves).toBe(28);

    const queries = sql.mock.calls.map((call) => call[0].join(' '));
    expect(queries[0]).toMatch(/own_goal/);
    expect(queries[0]).toMatch(/goal_type = 'own'/);
    expect(queries[0]).toMatch(/resolved_save_ga/);
    expect(queries[1]).toMatch(/total_save_ga/);
  });

  it('excludes shootout rows from automatic shots against totals', async () => {
    mockSqlFragments(1); // goalieStintsCTE(id)
    sql.mockResolvedValueOnce([]);
    await request(app).get('/api/admin/games/game-1/goalie-stints');

    const queries = sql.mock.calls.map((call) => call[0].join(' '));
    expect(queries[0]).toContain(
      "FILTER (WHERE (shot->>'period') ~ '^(1|2|3|OT|OT[1-9][0-9]*)$')",
    );
  });

  it('returns an empty array when no goalie stats exist', async () => {
    mockSqlFragments(1); // goalieStintsCTE(id)
    sql.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/admin/games/game-1/goalie-stints');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 500 on DB error', async () => {
    mockSqlFragments(1); // goalieStintsCTE(id)
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).get('/api/admin/games/game-1/goalie-stints');
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/games/:id/goalie-stints/:stintId
// ---------------------------------------------------------------------------
describe('DELETE /api/admin/games/:id/goalie-stints/:stintId', () => {
  it('deletes a goalie stint, returns refreshed goalie stats, and rebuilds stat snapshots', async () => {
    sql
      .mockResolvedValueOnce([{ team_id: 'team-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mockSqlFragments(1); // goalieStintsCTE(id)
    sql.mockResolvedValueOnce([GOALIE_STAT]);

    const res = await request(app).delete('/api/admin/games/game-1/goalie-stints/stint-1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([expect.objectContaining({ id: 'gs-1', shots_against: 30 })]);
    expect(rebuildGameStats).toHaveBeenCalledWith(sql, 'game-1');
  });

  it('returns 404 without rebuilding stats when the goalie stint is missing', async () => {
    sql.mockResolvedValueOnce([]);

    const res = await request(app).delete('/api/admin/games/game-1/goalie-stints/missing-stint');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/stint not found/i);
    expect(rebuildGameStats).not.toHaveBeenCalled();
  });
});
