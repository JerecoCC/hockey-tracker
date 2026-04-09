'use strict';

jest.mock('../db', () => ({ sql: jest.fn() }));
jest.mock('../middleware/auth', () => ({
  requireAdmin: (req, res, next) => { req.user = { id: 'admin-1', role: 'admin' }; next(); },
  requireAuth:  (req, res, next) => { req.user = { id: 'admin-1', role: 'admin' }; next(); },
}));

const request       = require('supertest');
const express       = require('express');
const { sql }       = require('../db');
const seasonsRouter = require('./seasons');

const app = express();
app.use(express.json());
app.use('/api/admin/seasons', seasonsRouter);

const SEASON = {
  id: 'season-1', name: 'NHL 2024–25', league_id: 'league-1',
  start_date: '2024-09-01', end_date: '2025-04-30', created_at: new Date().toISOString(),
};

afterEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// GET /api/admin/seasons
// ---------------------------------------------------------------------------
describe('GET /api/admin/seasons', () => {
  it('returns an array of seasons', async () => {
    sql.mockResolvedValueOnce([SEASON]);
    const res = await request(app).get('/api/admin/seasons');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([SEASON]);
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).get('/api/admin/seasons');
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/seasons/:id
// ---------------------------------------------------------------------------
describe('GET /api/admin/seasons/:id', () => {
  it('returns the season', async () => {
    sql.mockResolvedValueOnce([SEASON]);
    const res = await request(app).get('/api/admin/seasons/season-1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('season-1');
  });

  it('returns 404 when not found', async () => {
    sql.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/admin/seasons/nope');
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/seasons  (also tests generateSeasonName logic)
// ---------------------------------------------------------------------------
describe('POST /api/admin/seasons', () => {
  it('returns 400 when league_id is missing', async () => {
    const res = await request(app).post('/api/admin/seasons').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/league_id is required/i);
  });

  it('returns 400 when league is not found', async () => {
    sql.mockResolvedValueOnce([]); // no league rows
    const res = await request(app).post('/api/admin/seasons')
      .send({ league_id: 'bad-id' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/league not found/i);
  });

  it('auto-generates a cross-year name (2024–25)', async () => {
    sql
      .mockResolvedValueOnce([{ code: 'NHL' }])  // league lookup
      .mockResolvedValueOnce([{ ...SEASON, name: 'NHL 2024–25' }]); // INSERT RETURNING
    const res = await request(app).post('/api/admin/seasons')
      .send({ league_id: 'league-1', start_date: '2024-09-01', end_date: '2025-04-30' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('NHL 2024–25');
  });

  it('auto-generates a single-year name (2025)', async () => {
    sql
      .mockResolvedValueOnce([{ code: 'AHL' }])
      .mockResolvedValueOnce([{ ...SEASON, id: 's-2', name: 'AHL 2025', league_id: 'l-2' }]);
    const res = await request(app).post('/api/admin/seasons')
      .send({ league_id: 'l-2', start_date: '2025-01-01', end_date: '2025-06-30' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('AHL 2025');
  });

  it('auto-generates a name with no dates', async () => {
    sql
      .mockResolvedValueOnce([{ code: 'OHL' }])
      .mockResolvedValueOnce([{ ...SEASON, id: 's-3', name: 'OHL', league_id: 'l-3' }]);
    const res = await request(app).post('/api/admin/seasons')
      .send({ league_id: 'l-3' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('OHL');
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/seasons/:id
// ---------------------------------------------------------------------------
describe('PATCH /api/admin/seasons/:id', () => {
  it('returns updated season on success', async () => {
    sql
      .mockResolvedValueOnce([{ ...SEASON, end_date: '2025-04-15' }]) // existing
      .mockResolvedValueOnce([{ code: 'NHL' }])                        // league lookup
      .mockResolvedValueOnce([{ ...SEASON, name: 'NHL 2024–25', end_date: '2025-04-15' }]);
    const res = await request(app).patch('/api/admin/seasons/season-1')
      .send({ end_date: '2025-04-15' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('NHL 2024–25');
  });

  it('returns 404 when season not found', async () => {
    sql.mockResolvedValueOnce([]); // no existing row
    const res = await request(app).patch('/api/admin/seasons/nope')
      .send({ end_date: '2025-04-15' });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/seasons/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/admin/seasons/:id', () => {
  it('returns 200 on success', async () => {
    sql.mockResolvedValueOnce([{ id: 'season-1' }]);
    const res = await request(app).delete('/api/admin/seasons/season-1');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });

  it('returns 404 when not found', async () => {
    sql.mockResolvedValueOnce([]);
    const res = await request(app).delete('/api/admin/seasons/nope');
    expect(res.status).toBe(404);
  });
});
