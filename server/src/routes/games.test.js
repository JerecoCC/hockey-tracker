'use strict';

jest.mock('../db', () => ({ sql: jest.fn() }));
jest.mock('../middleware/auth', () => ({
  requireAdmin: (req, res, next) => { req.user = { id: 'admin-1', role: 'admin' }; next(); },
}));

const request     = require('supertest');
const express     = require('express');
const { sql }     = require('../db');
const gamesRouter = require('./games');

const app = express();
app.use(express.json());
app.use('/api/admin/games', gamesRouter);

// ── Fixtures ────────────────────────────────────────────────────────────────

const GAME = {
  id: 'game-1', season_id: 'season-1',
  home_team_id: 'team-1', away_team_id: 'team-2',
  home_team_name: 'Sharks', home_team_code: 'SJS', home_team_logo: null,
  away_team_name: 'Kings',  away_team_code: 'LAK', away_team_logo: null,
  game_type: 'regular', status: 'scheduled',
  scheduled_at: '2024-10-15T19:00:00Z', venue: 'SAP Center',
  home_score: null, away_score: null,
  home_score_reg: null, away_score_reg: null,
  overtime_periods: null, shootout: false,
  game_number: null, game_number_in_series: null,
  playoff_series_id: null, notes: null, created_at: new Date().toISOString(),
};

const SERIES = {
  id: 'series-1', season_id: 'season-1', round: 1, series_letter: 'A',
  home_team_id: 'team-1', away_team_id: 'team-2',
  home_team_name: 'Sharks', home_team_code: 'SJS', home_team_logo: null,
  away_team_name: 'Kings',  away_team_code: 'LAK', away_team_logo: null,
  games_to_win: 4, home_wins: 0, away_wins: 0,
  status: 'upcoming', winner_team_id: null, created_at: new Date().toISOString(),
};

afterEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// GET /api/admin/games
// ---------------------------------------------------------------------------
describe('GET /api/admin/games', () => {
  it('returns an array of games', async () => {
    sql.mockResolvedValueOnce([GAME]);
    const res = await request(app).get('/api/admin/games');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('game-1');
  });

  it('accepts season_id, game_type and status query params', async () => {
    sql.mockResolvedValueOnce([GAME]);
    const res = await request(app)
      .get('/api/admin/games?season_id=season-1&game_type=regular&status=scheduled');
    expect(res.status).toBe(200);
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).get('/api/admin/games');
    expect(res.status).toBe(500);
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
      .mockResolvedValueOnce([{ id: 'game-1' }])            // existence check
      .mockResolvedValueOnce([])                             // UPDATE
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

  it('returns 400 on check constraint violation', async () => {
    const checkErr = Object.assign(new Error('check'), { code: '23514' });
    sql
      .mockResolvedValueOnce([{ id: 'game-1' }])
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
    sql.mockResolvedValueOnce([SERIES]);
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
