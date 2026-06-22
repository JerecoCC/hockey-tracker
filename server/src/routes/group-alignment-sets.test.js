'use strict';

jest.mock('../db', () => ({ sql: jest.fn() }));
jest.mock('../middleware/auth', () => ({
  requireAdmin: (req, _res, next) => {
    req.user = { id: 'admin-1', role: 'admin' };
    next();
  },
}));

const request = require('supertest');
const express = require('express');
const { sql } = require('../db');
const groupAlignmentSetsRouter = require('./group-alignment-sets');

const app = express();
app.use(express.json());
app.use('/api/admin/group-alignment-sets', groupAlignmentSetsRouter);

const ALIGNMENT_SET = {
  id: 'alignment-1',
  league_id: 'league-1',
  name: 'League-wide',
  structure_type: 'league',
  created_at: new Date().toISOString(),
};

afterEach(() => jest.clearAllMocks());

describe('GET /api/admin/group-alignment-sets', () => {
  it('returns 400 when league_id is missing', async () => {
    const res = await request(app).get('/api/admin/group-alignment-sets');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/league_id/i);
  });

  it('lists alignment sets for a league', async () => {
    sql.mockResolvedValueOnce([{ ...ALIGNMENT_SET, group_count: 0, team_count: 0 }]);
    const res = await request(app).get('/api/admin/group-alignment-sets?league_id=league-1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].structure_type).toBe('league');
  });
});

describe('POST /api/admin/group-alignment-sets', () => {
  it('creates a league-wide alignment with no groups', async () => {
    sql.mockResolvedValueOnce([ALIGNMENT_SET]).mockResolvedValueOnce([]);
    const res = await request(app)
      .post('/api/admin/group-alignment-sets')
      .send({
        league_id: 'league-1',
        name: 'League-wide',
        structure_type: 'league',
        source: 'league',
      });

    expect(res.status).toBe(201);
    expect(res.body.structure_type).toBe('league');
    expect(res.body.groups).toEqual([]);
    expect(res.body.teams).toEqual([]);
    expect(sql).toHaveBeenCalledTimes(2);
  });

  it('rejects a missing name', async () => {
    const res = await request(app)
      .post('/api/admin/group-alignment-sets')
      .send({ league_id: 'league-1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/i);
  });
});

describe('POST /api/admin/group-alignment-sets/:id/groups', () => {
  it('rejects invalid roles before touching the database', async () => {
    const res = await request(app)
      .post('/api/admin/group-alignment-sets/alignment-1/groups')
      .send({ name: 'East', role: 'pod' });
    expect(res.status).toBe(400);
    expect(sql).not.toHaveBeenCalled();
  });
});
