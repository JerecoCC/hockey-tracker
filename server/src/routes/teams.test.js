'use strict';

jest.mock('../db', () => ({ sql: jest.fn() }));
jest.mock('../middleware/auth', () => ({
  requireAdmin: (req, res, next) => { req.user = { id: 'admin-1', role: 'admin' }; next(); },
  requireAuth:  (req, res, next) => { req.user = { id: 'admin-1', role: 'admin' }; next(); },
}));
jest.mock('@vercel/blob', () => ({ put: jest.fn() }));

const request     = require('supertest');
const express     = require('express');
const { sql }     = require('../db');
const teamsRouter = require('./teams');

const app = express();
app.use(express.json());
app.use('/api/admin/teams', teamsRouter);

const TEAM = {
  id: 'team-1', name: 'Leafs', code: 'TOR', description: null,
  location: 'Toronto', logo: null, league_id: 'league-1', created_at: new Date().toISOString(),
};

afterEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// GET /api/admin/teams
// ---------------------------------------------------------------------------
describe('GET /api/admin/teams', () => {
  it('returns an array of teams', async () => {
    sql.mockResolvedValueOnce([TEAM]);
    const res = await request(app).get('/api/admin/teams');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([TEAM]);
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).get('/api/admin/teams');
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/teams/:id
// ---------------------------------------------------------------------------
describe('GET /api/admin/teams/:id', () => {
  it('returns the team', async () => {
    sql.mockResolvedValueOnce([TEAM]);
    const res = await request(app).get('/api/admin/teams/team-1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('team-1');
  });

  it('returns 404 when not found', async () => {
    sql.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/admin/teams/nope');
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/teams
// ---------------------------------------------------------------------------
describe('POST /api/admin/teams', () => {
  it('returns 400 when name is missing', async () => {
    const res = await request(app).post('/api/admin/teams')
      .send({ code: 'TOR', league_id: 'l-1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name is required/i);
  });

  it('returns 400 when code is missing', async () => {
    const res = await request(app).post('/api/admin/teams')
      .send({ name: 'Leafs', league_id: 'l-1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/code is required/i);
  });

  it('returns 400 when league_id is missing', async () => {
    const res = await request(app).post('/api/admin/teams')
      .send({ name: 'Leafs', code: 'TOR' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/league_id is required/i);
  });

  it('returns 201 on success', async () => {
    sql.mockResolvedValueOnce([TEAM]);
    const res = await request(app).post('/api/admin/teams')
      .send({ name: 'Leafs', code: 'tor', league_id: 'league-1' });
    expect(res.status).toBe(201);
    expect(res.body.code).toBe('TOR');
  });

  it('returns 409 with code-specific message on duplicate code', async () => {
    const err = Object.assign(new Error('dup'), { code: '23505', detail: '(code)' });
    sql.mockRejectedValueOnce(err);
    const res = await request(app).post('/api/admin/teams')
      .send({ name: 'Leafs', code: 'TOR', league_id: 'league-1' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/code already exists/i);
  });

  it('returns 400 on foreign key violation (bad league_id)', async () => {
    const err = Object.assign(new Error('fk'), { code: '23503' });
    sql.mockRejectedValueOnce(err);
    const res = await request(app).post('/api/admin/teams')
      .send({ name: 'Leafs', code: 'TOR', league_id: 'bad-id' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/league does not exist/i);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/teams/:id
// ---------------------------------------------------------------------------
describe('PATCH /api/admin/teams/:id', () => {
  it('returns updated team on success', async () => {
    sql.mockResolvedValueOnce([{ ...TEAM, name: 'Toronto Maple Leafs' }]);
    const res = await request(app).patch('/api/admin/teams/team-1')
      .send({ name: 'Toronto Maple Leafs' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Toronto Maple Leafs');
  });

  it('returns 404 when not found', async () => {
    sql.mockResolvedValueOnce([]);
    const res = await request(app).patch('/api/admin/teams/nope').send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when name is empty string', async () => {
    const res = await request(app).patch('/api/admin/teams/team-1').send({ name: '' });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/teams/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/admin/teams/:id', () => {
  it('returns 200 on success', async () => {
    sql.mockResolvedValueOnce([{ id: 'team-1' }]);
    const res = await request(app).delete('/api/admin/teams/team-1');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });

  it('returns 404 when not found', async () => {
    sql.mockResolvedValueOnce([]);
    const res = await request(app).delete('/api/admin/teams/nope');
    expect(res.status).toBe(404);
  });
});
