'use strict';

jest.mock('../db', () => ({ sql: jest.fn() }));
jest.mock('../middleware/auth', () => ({
  requireAdmin: (req, res, next) => { req.user = { id: 'admin-1', role: 'admin' }; next(); },
  requireAuth:  (req, res, next) => { req.user = { id: 'admin-1', role: 'admin' }; next(); },
}));
jest.mock('@vercel/blob', () => ({ put: jest.fn() }));

const request       = require('supertest');
const express       = require('express');
const { sql }       = require('../db');
const leaguesRouter = require('./leagues');

const app = express();
app.use(express.json());
app.use('/api/admin/leagues', leaguesRouter);

const LEAGUE = {
  id: 'league-1', name: 'NHL', code: 'NHL', description: null,
  logo: null, primary_color: '#334155', text_color: '#ffffff', created_at: new Date().toISOString(),
};

afterEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// GET /api/admin/leagues
// ---------------------------------------------------------------------------
describe('GET /api/admin/leagues', () => {
  it('returns an array of leagues', async () => {
    sql.mockResolvedValueOnce([LEAGUE]);
    const res = await request(app).get('/api/admin/leagues');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([LEAGUE]);
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).get('/api/admin/leagues');
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/leagues/:id
// ---------------------------------------------------------------------------
describe('GET /api/admin/leagues/:id', () => {
  it('returns the league with teams and seasons', async () => {
    sql
      .mockResolvedValueOnce([LEAGUE])          // league row
      .mockResolvedValueOnce([])                // teams
      .mockResolvedValueOnce([]);               // seasons
    const res = await request(app).get('/api/admin/leagues/league-1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('league-1');
    expect(res.body.teams).toEqual([]);
    expect(res.body.seasons).toEqual([]);
  });

  it('returns 404 when not found', async () => {
    sql.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/admin/leagues/nope');
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/leagues
// ---------------------------------------------------------------------------
describe('POST /api/admin/leagues', () => {
  it('returns 400 when name is missing', async () => {
    const res = await request(app).post('/api/admin/leagues').send({ code: 'NHL' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name is required/i);
  });

  it('returns 400 when code is missing', async () => {
    const res = await request(app).post('/api/admin/leagues').send({ name: 'NHL' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/code is required/i);
  });

  it('returns 201 on success', async () => {
    sql.mockResolvedValueOnce([LEAGUE]);
    const res = await request(app).post('/api/admin/leagues')
      .send({ name: 'NHL', code: 'nhl' });
    expect(res.status).toBe(201);
    expect(res.body.code).toBe('NHL');
  });

  it('returns 409 on duplicate code', async () => {
    const err = Object.assign(new Error('dup'), { code: '23505' });
    sql.mockRejectedValueOnce(err);
    const res = await request(app).post('/api/admin/leagues')
      .send({ name: 'NHL', code: 'NHL' });
    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/leagues/:id
// ---------------------------------------------------------------------------
describe('PATCH /api/admin/leagues/:id', () => {
  it('returns 400 when name is empty string', async () => {
    const res = await request(app).patch('/api/admin/leagues/league-1').send({ name: '  ' });
    expect(res.status).toBe(400);
  });

  it('returns updated league on success', async () => {
    sql.mockResolvedValueOnce([{ ...LEAGUE, name: 'New NHL' }]);
    const res = await request(app).patch('/api/admin/leagues/league-1')
      .send({ name: 'New NHL' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New NHL');
  });

  it('returns 404 when not found', async () => {
    sql.mockResolvedValueOnce([]);
    const res = await request(app).patch('/api/admin/leagues/nope').send({ name: 'X' });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/leagues/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/admin/leagues/:id', () => {
  it('returns 200 on success', async () => {
    sql.mockResolvedValueOnce([{ id: 'league-1' }]);
    const res = await request(app).delete('/api/admin/leagues/league-1');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });

  it('returns 404 when not found', async () => {
    sql.mockResolvedValueOnce([]);
    const res = await request(app).delete('/api/admin/leagues/nope');
    expect(res.status).toBe(404);
  });
});
