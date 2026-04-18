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
  nationality: 'CAN',
  height_cm: 183,
  weight_lbs: 185,
  position: 'C',
  shoots: 'L',
  is_active: true,
  created_at: new Date().toISOString(),
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

  it('filters by league_id when provided', async () => {
    sql.mockResolvedValueOnce([PLAYER]);
    const res = await request(app).get('/api/admin/players?league_id=league-1');
    expect(res.status).toBe(200);
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).get('/api/admin/players');
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/players/:id
// ---------------------------------------------------------------------------
describe('GET /api/admin/players/:id', () => {
  it('returns the player', async () => {
    sql.mockResolvedValueOnce([PLAYER]);
    const res = await request(app).get('/api/admin/players/player-1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('player-1');
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

  it('returns 400 when a row is missing shoots', async () => {
    const res = await request(app).post('/api/admin/players/bulk')
      .send({ players: [{ first_name: 'Wayne', last_name: 'Gretzky', position: 'C' }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/shoots/i);
  });

  it('includes row number in validation error message', async () => {
    const res = await request(app).post('/api/admin/players/bulk')
      .send({ players: [validRow, { first_name: 'Mario', last_name: 'Lemieux', position: 'C' }] });
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
