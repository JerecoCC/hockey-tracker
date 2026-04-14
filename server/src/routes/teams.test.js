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
  start_season_id: null, latest_season_id: null,
  start_season_start_date: null, latest_season_end_date: null,
};

const ITER = {
  id: 'iter-1', team_id: 'team-1', season_id: null,
  name: 'Leafs', code: 'TOR', logo: null, note: null,
  recorded_at: new Date().toISOString(),
  season_start_date: null, season_end_date: null,
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

  // Route creates team row, inserts base iteration, then fetches full team (3 sql calls)
  it('returns 201 on success and upper-cases the code', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'team-1' }])  // INSERT teams RETURNING id
      .mockResolvedValueOnce([])                    // INSERT team_iterations (base)
      .mockResolvedValueOnce([{ ...TEAM, code: 'TOR' }]); // SELECT full team
    const res = await request(app).post('/api/admin/teams')
      .send({ name: 'Leafs', code: 'tor', league_id: 'league-1' });
    expect(res.status).toBe(201);
    expect(res.body.code).toBe('TOR');
  });

  it('returns 400 on foreign key violation (bad league_id)', async () => {
    const err = Object.assign(new Error('fk'), { code: '23503' });
    sql.mockRejectedValueOnce(err);
    const res = await request(app).post('/api/admin/teams')
      .send({ name: 'Leafs', code: 'TOR', league_id: 'bad-id' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/league does not exist/i);
  });

  it('returns 500 on generic DB error', async () => {
    sql.mockRejectedValueOnce(new Error('connection lost'));
    const res = await request(app).post('/api/admin/teams')
      .send({ name: 'Leafs', code: 'TOR', league_id: 'league-1' });
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/teams/:id
// Route SQL sequence (identity field like name):
//   1. SELECT id FROM teams (exists check)
//   2. SELECT id FROM team_iterations WHERE season_id IS NULL (base iter)
//   3. UPDATE team_iterations (update base iter name/code/logo)
//   4. UPDATE teams (non-identity fields + season tracking)
//   5. SELECT full team (return value)
// For non-identity-only patches steps 2 & 3 are skipped.
// ---------------------------------------------------------------------------
describe('PATCH /api/admin/teams/:id', () => {
  it('returns updated team when updating an identity field (name)', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'team-1' }])                        // exists
      .mockResolvedValueOnce([{ id: 'iter-1' }])                        // base iter found
      .mockResolvedValueOnce([])                                          // UPDATE team_iterations
      .mockResolvedValueOnce([])                                          // UPDATE teams
      .mockResolvedValueOnce([{ ...TEAM, name: 'Toronto Maple Leafs' }]); // SELECT full
    const res = await request(app).patch('/api/admin/teams/team-1')
      .send({ name: 'Toronto Maple Leafs' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Toronto Maple Leafs');
  });

  it('returns updated team when updating a non-identity field (city)', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'team-1' }])               // exists
      .mockResolvedValueOnce([])                                 // UPDATE teams
      .mockResolvedValueOnce([{ ...TEAM, city: 'Ottawa' }]);    // SELECT full
    const res = await request(app).patch('/api/admin/teams/team-1')
      .send({ city: 'Ottawa' });
    expect(res.status).toBe(200);
    expect(res.body.city).toBe('Ottawa');
  });

  it('sends start_season_id and latest_season_id to the DB', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'team-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...TEAM, start_season_id: 'season-1', latest_season_id: 'season-3' }]);
    const res = await request(app).patch('/api/admin/teams/team-1')
      .send({ start_season_id: 'season-1', latest_season_id: 'season-3' });
    expect(res.status).toBe(200);
    expect(res.body.start_season_id).toBe('season-1');
    expect(res.body.latest_season_id).toBe('season-3');
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

  it('returns 400 when code is empty string', async () => {
    const res = await request(app).patch('/api/admin/teams/team-1').send({ code: '' });
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

// ---------------------------------------------------------------------------
// GET /api/admin/teams/:id/iterations
// ---------------------------------------------------------------------------
describe('GET /api/admin/teams/:id/iterations', () => {
  it('returns an array of iterations', async () => {
    sql.mockResolvedValueOnce([ITER]);
    const res = await request(app).get('/api/admin/teams/team-1/iterations');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('iter-1');
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).get('/api/admin/teams/team-1/iterations');
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/teams/:id/iterations
// SQL sequence: 1) SELECT team exists  2) INSERT iteration  3) optionally UPDATE teams
//               4) SELECT full iteration
// ---------------------------------------------------------------------------
describe('POST /api/admin/teams/:id/iterations', () => {
  it('returns 400 when name is missing', async () => {
    const res = await request(app).post('/api/admin/teams/team-1/iterations').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name is required/i);
  });

  it('returns 404 when team does not exist', async () => {
    sql.mockResolvedValueOnce([]); // team exists check → empty
    const res = await request(app).post('/api/admin/teams/nope/iterations')
      .send({ name: 'Leafs' });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/team not found/i);
  });

  it('returns 201 without season tracking fields', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'team-1' }])  // team exists
      .mockResolvedValueOnce([{ id: 'iter-1' }])  // INSERT RETURNING id
      .mockResolvedValueOnce([ITER]);              // SELECT full iteration
    const res = await request(app).post('/api/admin/teams/team-1/iterations')
      .send({ name: 'Leafs', code: 'tor' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('iter-1');
    expect(res.body.name).toBe('Leafs');
  });

  it('returns 201 and updates team season tracking when provided', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'team-1' }])  // team exists
      .mockResolvedValueOnce([{ id: 'iter-1' }])  // INSERT RETURNING id
      .mockResolvedValueOnce([])                    // UPDATE teams (season tracking)
      .mockResolvedValueOnce([ITER]);              // SELECT full iteration
    const res = await request(app).post('/api/admin/teams/team-1/iterations')
      .send({ name: 'Leafs', start_season_id: 'season-1', latest_season_id: 'season-2' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('iter-1');
    // Verify the UPDATE teams call happened (4 total sql calls)
    expect(sql).toHaveBeenCalledTimes(4);
  });

  it('returns 500 on DB error', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'team-1' }])
      .mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).post('/api/admin/teams/team-1/iterations')
      .send({ name: 'Leafs' });
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/teams/:id/iterations/:iterationId
// SQL sequence: 1) UPDATE iteration RETURNING id  2) optionally UPDATE teams
//               3) SELECT full iteration
// ---------------------------------------------------------------------------
describe('PATCH /api/admin/teams/:id/iterations/:iterationId', () => {
  it('returns 400 when name is empty string', async () => {
    const res = await request(app)
      .patch('/api/admin/teams/team-1/iterations/iter-1').send({ name: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name cannot be empty/i);
  });

  it('returns 404 when iteration not found', async () => {
    sql.mockResolvedValueOnce([]); // UPDATE RETURNING → nothing matched
    const res = await request(app)
      .patch('/api/admin/teams/team-1/iterations/nope').send({ name: 'X' });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/iteration not found/i);
  });

  it('returns updated iteration without season tracking fields', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'iter-1' }])          // UPDATE RETURNING id
      .mockResolvedValueOnce([{ ...ITER, name: 'New Name' }]); // SELECT full
    const res = await request(app)
      .patch('/api/admin/teams/team-1/iterations/iter-1')
      .send({ name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
  });

  it('updates team season tracking when provided', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'iter-1' }])  // UPDATE RETURNING id
      .mockResolvedValueOnce([])                    // UPDATE teams (season tracking)
      .mockResolvedValueOnce([ITER]);              // SELECT full
    const res = await request(app)
      .patch('/api/admin/teams/team-1/iterations/iter-1')
      .send({ name: 'Leafs', start_season_id: 'season-1', latest_season_id: 'season-3' });
    expect(res.status).toBe(200);
    expect(sql).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/teams/:id/iterations/:iterationId
// ---------------------------------------------------------------------------
describe('DELETE /api/admin/teams/:id/iterations/:iterationId', () => {
  it('returns 200 on success', async () => {
    sql.mockResolvedValueOnce([{ id: 'iter-1' }]);
    const res = await request(app)
      .delete('/api/admin/teams/team-1/iterations/iter-1');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });

  it('returns 404 when iteration not found', async () => {
    sql.mockResolvedValueOnce([]);
    const res = await request(app)
      .delete('/api/admin/teams/team-1/iterations/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/iteration not found/i);
  });
});
