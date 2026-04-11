'use strict';

jest.mock('../db', () => ({ sql: jest.fn() }));
jest.mock('../middleware/auth', () => ({
  requireAdmin: (req, _res, next) => { req.user = { id: 'admin-1', role: 'admin' }; next(); },
}));

const request      = require('supertest');
const express      = require('express');
const { sql }      = require('../db');
const groupsRouter = require('./groups');

const app = express();
app.use(express.json());
app.use('/api/admin/groups', groupsRouter);

const GROUP = {
  id: 'group-1', league_id: 'league-1', parent_id: null,
  name: 'Division A', sort_order: 0, created_at: new Date().toISOString(),
};
const TEAM = { id: 'team-1', name: 'Sharks', code: 'SJS', logo: null };

afterEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// GET /api/admin/groups?league_id=xxx
// ---------------------------------------------------------------------------
describe('GET /api/admin/groups', () => {
  it('returns 400 when league_id is missing', async () => {
    const res = await request(app).get('/api/admin/groups');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/league_id/i);
  });

  it('returns flat list of groups with teams', async () => {
    sql.mockResolvedValueOnce([{ ...GROUP, teams: [] }]);
    const res = await request(app).get('/api/admin/groups?league_id=league-1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('group-1');
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).get('/api/admin/groups?league_id=league-1');
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/groups
// ---------------------------------------------------------------------------
describe('POST /api/admin/groups', () => {
  it('returns 400 when league_id is missing', async () => {
    const res = await request(app).post('/api/admin/groups').send({ name: 'East' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/league_id/i);
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app).post('/api/admin/groups').send({ league_id: 'league-1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/i);
  });

  it('returns 201 on success (no parent)', async () => {
    sql.mockResolvedValueOnce([GROUP]);
    const res = await request(app).post('/api/admin/groups')
      .send({ league_id: 'league-1', name: 'Division A' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Division A');
  });

  it('returns 201 with valid parent_id', async () => {
    sql.mockResolvedValueOnce([GROUP]);          // parent check
    sql.mockResolvedValueOnce([{ ...GROUP, id: 'group-2', parent_id: 'group-1', name: 'Sub A' }]);
    const res = await request(app).post('/api/admin/groups')
      .send({ league_id: 'league-1', name: 'Sub A', parent_id: 'group-1' });
    expect(res.status).toBe(201);
    expect(res.body.parent_id).toBe('group-1');
  });

  it('returns 400 when parent_id not found in same league', async () => {
    sql.mockResolvedValueOnce([]); // parent check returns nothing
    const res = await request(app).post('/api/admin/groups')
      .send({ league_id: 'league-1', name: 'Sub', parent_id: 'bad-parent' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/parent group not found/i);
  });

  it('returns 400 when league FK fails', async () => {
    const err = Object.assign(new Error('fk'), { code: '23503' });
    sql.mockRejectedValueOnce(err);
    const res = await request(app).post('/api/admin/groups')
      .send({ league_id: 'bad-league', name: 'East' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/league not found/i);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/groups/:id
// ---------------------------------------------------------------------------
describe('PATCH /api/admin/groups/:id', () => {
  it('returns 400 when name is empty string', async () => {
    const res = await request(app).patch('/api/admin/groups/group-1').send({ name: '  ' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when group not found', async () => {
    sql.mockResolvedValueOnce([]); // existing check
    const res = await request(app).patch('/api/admin/groups/nope').send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when group set as its own parent', async () => {
    sql.mockResolvedValueOnce([GROUP]); // existing check
    const res = await request(app).patch('/api/admin/groups/group-1')
      .send({ parent_id: 'group-1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/own parent/i);
  });

  it('returns updated group', async () => {
    sql.mockResolvedValueOnce([GROUP])                       // existing check
       .mockResolvedValueOnce([{ ...GROUP, name: 'East' }]); // update
    const res = await request(app).patch('/api/admin/groups/group-1').send({ name: 'East' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('East');
  });
});


// ---------------------------------------------------------------------------
// DELETE /api/admin/groups/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/admin/groups/:id', () => {
  it('returns 200 on success', async () => {
    sql.mockResolvedValueOnce([{ id: 'group-1' }]);
    const res = await request(app).delete('/api/admin/groups/group-1');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });

  it('returns 404 when not found', async () => {
    sql.mockResolvedValueOnce([]);
    const res = await request(app).delete('/api/admin/groups/nope');
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/admin/groups/:id/teams
// ---------------------------------------------------------------------------
describe('PUT /api/admin/groups/:id/teams', () => {
  it('returns 400 when team_ids is not an array', async () => {
    const res = await request(app).put('/api/admin/groups/group-1/teams')
      .send({ team_ids: 'not-an-array' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/must be an array/i);
  });

  it('returns 404 when group not found', async () => {
    sql.mockResolvedValueOnce([]); // group check
    const res = await request(app).put('/api/admin/groups/nope/teams')
      .send({ team_ids: [] });
    expect(res.status).toBe(404);
  });

  it('clears and returns empty teams list', async () => {
    sql
      .mockResolvedValueOnce([GROUP])   // group check
      .mockResolvedValueOnce([])        // DELETE
      .mockResolvedValueOnce([]);       // SELECT teams
    const res = await request(app).put('/api/admin/groups/group-1/teams')
      .send({ team_ids: [] });
    expect(res.status).toBe(200);
    expect(res.body.teams).toEqual([]);
  });

  it('returns teams after inserting one team', async () => {
    sql
      .mockResolvedValueOnce([GROUP])    // group check
      .mockResolvedValueOnce([])         // DELETE
      .mockResolvedValueOnce([])         // INSERT team-1
      .mockResolvedValueOnce([TEAM]);    // SELECT teams
    const res = await request(app).put('/api/admin/groups/group-1/teams')
      .send({ team_ids: ['team-1'] });
    expect(res.status).toBe(200);
    expect(res.body.teams).toHaveLength(1);
    expect(res.body.teams[0].id).toBe('team-1');
  });

  it('returns 400 when a team FK fails', async () => {
    sql
      .mockResolvedValueOnce([GROUP])    // group check
      .mockResolvedValueOnce([])         // DELETE
      .mockRejectedValueOnce(Object.assign(new Error('fk'), { code: '23503' }));
    const res = await request(app).put('/api/admin/groups/group-1/teams')
      .send({ team_ids: ['bad-team'] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/teams not found/i);
  });
});
