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
  is_current: false,
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

  it('filters by league_id when provided', async () => {
    sql.mockResolvedValueOnce([SEASON]);
    const res = await request(app).get('/api/admin/seasons?league_id=league-1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([SEASON]);
    expect(sql).toHaveBeenCalledTimes(1);
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
// POST /api/admin/seasons
// ---------------------------------------------------------------------------
describe('POST /api/admin/seasons', () => {
  it('returns 400 when league_id is missing', async () => {
    const res = await request(app).post('/api/admin/seasons').send({ name: 'NHL 2024–25' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/league_id is required/i);
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app).post('/api/admin/seasons').send({ league_id: 'league-1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name is required/i);
  });

  it('returns 400 when name is blank', async () => {
    const res = await request(app).post('/api/admin/seasons')
      .send({ league_id: 'league-1', name: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name is required/i);
  });

  it('returns 400 when league is not found', async () => {
    sql.mockResolvedValueOnce([]); // no league rows
    const res = await request(app).post('/api/admin/seasons')
      .send({ league_id: 'bad-id', name: 'Test Season' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/league not found/i);
  });

  it('creates a season with the provided name', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'league-1' }])              // league existence check
      .mockResolvedValueOnce([{ ...SEASON, name: 'NHL 2024–25' }]); // INSERT RETURNING
    const res = await request(app).post('/api/admin/seasons')
      .send({ league_id: 'league-1', name: 'NHL 2024–25', start_date: '2024-09-01', end_date: '2025-04-30' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('NHL 2024–25');
  });

  it('trims whitespace from the name', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'league-1' }])
      .mockResolvedValueOnce([{ ...SEASON, name: 'NHL 2024–25' }]);
    const res = await request(app).post('/api/admin/seasons')
      .send({ league_id: 'league-1', name: '  NHL 2024–25  ' });
    expect(res.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/seasons/:id
// ---------------------------------------------------------------------------
describe('PATCH /api/admin/seasons/:id', () => {
  it('returns updated season on success', async () => {
    sql
      .mockResolvedValueOnce([{ ...SEASON }])                                     // fetch existing
      .mockResolvedValueOnce([])                                                  // UPDATE seasons
      .mockResolvedValueOnce([{ ...SEASON, name: 'NHL 2024–25', end_date: '2025-04-15' }]); // SELECT JOIN re-fetch
    const res = await request(app).patch('/api/admin/seasons/season-1')
      .send({ name: 'NHL 2024–25', end_date: '2025-04-15' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('NHL 2024–25');
  });

  it('keeps the existing name when name is not provided', async () => {
    sql
      .mockResolvedValueOnce([{ ...SEASON }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...SEASON, end_date: '2025-04-15' }]);
    const res = await request(app).patch('/api/admin/seasons/season-1')
      .send({ end_date: '2025-04-15' });
    expect(res.status).toBe(200);
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

// ---------------------------------------------------------------------------
// PATCH /api/admin/seasons/:id/current
// ---------------------------------------------------------------------------
describe('PATCH /api/admin/seasons/:id/current', () => {
  it('sets is_current to true by updating leagues.current_season_id', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'season-1', league_id: 'league-1' }]) // existence check
      .mockResolvedValueOnce([])                                           // UPDATE leagues SET current_season_id = id
      .mockResolvedValueOnce([{ ...SEASON, is_current: true }]);           // SELECT JOIN to return season
    const res = await request(app)
      .patch('/api/admin/seasons/season-1/current')
      .send({ is_current: true });
    expect(res.status).toBe(200);
    expect(res.body.is_current).toBe(true);
    // 3 queries: check + update league + select back
    expect(sql).toHaveBeenCalledTimes(3);
  });

  it('sets is_current to false by clearing leagues.current_season_id', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'season-1', league_id: 'league-1' }]) // existence check
      .mockResolvedValueOnce([])                                           // UPDATE leagues SET current_season_id = NULL
      .mockResolvedValueOnce([{ ...SEASON, is_current: false }]);          // SELECT JOIN to return season
    const res = await request(app)
      .patch('/api/admin/seasons/season-1/current')
      .send({ is_current: false });
    expect(res.status).toBe(200);
    expect(res.body.is_current).toBe(false);
    // 3 queries: check + update league + select back
    expect(sql).toHaveBeenCalledTimes(3);
  });

  it('returns 400 when is_current is not a boolean', async () => {
    const res = await request(app)
      .patch('/api/admin/seasons/season-1/current')
      .send({ is_current: 'yes' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/boolean/i);
  });

  it('returns 400 when is_current is missing', async () => {
    const res = await request(app)
      .patch('/api/admin/seasons/season-1/current')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/boolean/i);
  });

  it('returns 404 when season not found', async () => {
    sql.mockResolvedValueOnce([]); // existence check returns nothing
    const res = await request(app)
      .patch('/api/admin/seasons/nope/current')
      .send({ is_current: true });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app)
      .patch('/api/admin/seasons/season-1/current')
      .send({ is_current: true });
    expect(res.status).toBe(500);
  });
});

const GROUP = {
  id: 'group-1', league_id: 'league-1', parent_id: null,
  name: 'Division A', sort_order: 0, created_at: new Date().toISOString(),
  teams: [], has_season_override: false,
};
const TEAM = { id: 'team-1', name: 'Sharks', code: 'SJS', logo: null };

// ---------------------------------------------------------------------------
// GET /api/admin/seasons/:seasonId/groups
// ---------------------------------------------------------------------------
describe('GET /api/admin/seasons/:seasonId/groups', () => {
  it('returns 404 when season not found', async () => {
    sql.mockResolvedValueOnce([]); // season check
    const res = await request(app).get('/api/admin/seasons/nope/groups');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/season not found/i);
  });

  it('returns groups with default teams (no overrides)', async () => {
    sql
      .mockResolvedValueOnce([SEASON])   // season check
      .mockResolvedValueOnce([GROUP]);   // groups query
    const res = await request(app).get('/api/admin/seasons/season-1/groups');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('group-1');
    expect(res.body[0].has_season_override).toBe(false);
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).get('/api/admin/seasons/season-1/groups');
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/admin/seasons/:seasonId/groups/:groupId/teams
// ---------------------------------------------------------------------------
describe('PUT /api/admin/seasons/:seasonId/groups/:groupId/teams', () => {
  it('returns 400 when team_ids is not an array', async () => {
    const res = await request(app)
      .put('/api/admin/seasons/season-1/groups/group-1/teams')
      .send({ team_ids: 'bad' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/must be an array/i);
  });

  it('returns 404 when season not found', async () => {
    sql
      .mockResolvedValueOnce([])         // season check
      .mockResolvedValueOnce([GROUP]);   // group check
    const res = await request(app)
      .put('/api/admin/seasons/nope/groups/group-1/teams')
      .send({ team_ids: [] });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/season not found/i);
  });

  it('returns 404 when group not found', async () => {
    sql
      .mockResolvedValueOnce([SEASON])   // season check
      .mockResolvedValueOnce([]);        // group check
    const res = await request(app)
      .put('/api/admin/seasons/season-1/groups/nope/teams')
      .send({ team_ids: [] });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/group not found/i);
  });

  it('returns 400 when season and group are in different leagues', async () => {
    sql
      .mockResolvedValueOnce([SEASON])                                  // season (league-1)
      .mockResolvedValueOnce([{ ...GROUP, league_id: 'league-2' }]);   // group (league-2)
    const res = await request(app)
      .put('/api/admin/seasons/season-1/groups/group-1/teams')
      .send({ team_ids: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/same league/i);
  });

  it('sets season teams and returns them', async () => {
    sql
      .mockResolvedValueOnce([SEASON])   // season check
      .mockResolvedValueOnce([GROUP])    // group check
      .mockResolvedValueOnce([])         // DELETE
      .mockResolvedValueOnce([])         // INSERT team-1
      .mockResolvedValueOnce([TEAM]);    // SELECT teams
    const res = await request(app)
      .put('/api/admin/seasons/season-1/groups/group-1/teams')
      .send({ team_ids: ['team-1'] });
    expect(res.status).toBe(200);
    expect(res.body.teams).toHaveLength(1);
    expect(res.body.season_id).toBe('season-1');
    expect(res.body.group_id).toBe('group-1');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/seasons/:seasonId/groups/:groupId/teams
// ---------------------------------------------------------------------------
describe('DELETE /api/admin/seasons/:seasonId/groups/:groupId/teams', () => {
  it('removes the season override and returns 200', async () => {
    sql.mockResolvedValueOnce([]);
    const res = await request(app)
      .delete('/api/admin/seasons/season-1/groups/group-1/teams');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/reverts to defaults/i);
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app)
      .delete('/api/admin/seasons/season-1/groups/group-1/teams');
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/admin/seasons/:seasonId/teams
// Replaces the flat season roster and updates each team's start/latest season.
// SQL sequence per team_id (N teams):
//   1) SELECT season
//   2) SELECT auto group (or INSERT if missing)
//   3) DELETE group_teams
//   4..3+N) INSERT group_teams (one per team)
//   5+N) DELETE season_teams
//   6+N..5+2N) INSERT season_teams + UPDATE teams tracking (two calls per team)
//   last) SELECT teams for response
// ---------------------------------------------------------------------------
describe('PUT /api/admin/seasons/:seasonId/teams', () => {
  it('returns 400 when team_ids is not an array', async () => {
    const res = await request(app)
      .put('/api/admin/seasons/season-1/teams')
      .send({ team_ids: 'bad' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/must be an array/i);
  });

  it('returns 404 when season not found', async () => {
    sql.mockResolvedValueOnce([]); // season SELECT → empty
    const res = await request(app)
      .put('/api/admin/seasons/nope/teams')
      .send({ team_ids: [] });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/season not found/i);
  });

  it('clears roster and returns empty teams when team_ids is []', async () => {
    sql
      .mockResolvedValueOnce([SEASON])            // SELECT season
      .mockResolvedValueOnce([{ id: 'ag-1' }])   // SELECT auto group (exists)
      .mockResolvedValueOnce([])                   // DELETE group_teams
      .mockResolvedValueOnce([])                   // DELETE season_teams
      .mockResolvedValueOnce([]);                  // SELECT teams → empty
    const res = await request(app)
      .put('/api/admin/seasons/season-1/teams')
      .send({ team_ids: [] });
    expect(res.status).toBe(200);
    expect(res.body.teams).toHaveLength(0);
    expect(res.body.season_id).toBe('season-1');
  });

  it('creates the auto group when none exists and sets the roster', async () => {
    sql
      .mockResolvedValueOnce([SEASON])              // SELECT season
      .mockResolvedValueOnce([])                     // SELECT auto group → none
      .mockResolvedValueOnce([{ id: 'ag-new' }])   // INSERT auto group RETURNING id
      .mockResolvedValueOnce([])                     // DELETE group_teams
      .mockResolvedValueOnce([])                     // INSERT group_team (team-1)
      .mockResolvedValueOnce([])                     // DELETE season_teams
      .mockResolvedValueOnce([])                     // INSERT season_team (team-1)
      .mockResolvedValueOnce([])                     // UPDATE teams tracking (team-1)
      .mockResolvedValueOnce([TEAM]);               // SELECT teams
    const res = await request(app)
      .put('/api/admin/seasons/season-1/teams')
      .send({ team_ids: ['team-1'] });
    expect(res.status).toBe(200);
    expect(res.body.teams).toHaveLength(1);
    expect(res.body.auto_group_id).toBe('ag-new');
  });

  it('uses existing auto group and updates start/latest season on first add', async () => {
    sql
      .mockResolvedValueOnce([SEASON])              // SELECT season
      .mockResolvedValueOnce([{ id: 'ag-1' }])    // SELECT auto group (exists)
      .mockResolvedValueOnce([])                    // DELETE group_teams
      .mockResolvedValueOnce([])                    // INSERT group_team (team-1)
      .mockResolvedValueOnce([])                    // DELETE season_teams
      .mockResolvedValueOnce([])                    // INSERT season_team (team-1)
      .mockResolvedValueOnce([])                    // UPDATE teams tracking (team-1)
      .mockResolvedValueOnce([TEAM]);              // SELECT teams
    const res = await request(app)
      .put('/api/admin/seasons/season-1/teams')
      .send({ team_ids: ['team-1'] });
    expect(res.status).toBe(200);
    expect(res.body.teams).toHaveLength(1);
    expect(res.body.season_id).toBe('season-1');
    expect(res.body.auto_group_id).toBe('ag-1');
    // One UPDATE teams call per team_id = 8 total sql calls
    expect(sql).toHaveBeenCalledTimes(8);
  });

  it('returns 400 on FK violation (invalid team_id)', async () => {
    const fkErr = Object.assign(new Error('fk'), { code: '23503' });
    sql
      .mockResolvedValueOnce([SEASON])
      .mockResolvedValueOnce([{ id: 'ag-1' }])
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(fkErr);             // INSERT group_team → FK error
    const res = await request(app)
      .put('/api/admin/seasons/season-1/teams')
      .send({ team_ids: ['bad-team'] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/one or more teams not found/i);
  });

  it('returns 500 on generic DB error', async () => {
    sql
      .mockResolvedValueOnce([SEASON])
      .mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app)
      .put('/api/admin/seasons/season-1/teams')
      .send({ team_ids: [] });
    expect(res.status).toBe(500);
  });
});
