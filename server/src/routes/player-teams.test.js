'use strict';

jest.mock('drizzle-orm', () => ({
  and: jest.fn((...args) => ({ type: 'and', args })),
  desc: jest.fn((column) => ({ type: 'desc', column })),
  eq: jest.fn((left, right) => ({ type: 'eq', left, right })),
  sql: jest.fn((strings, ...values) => ({ type: 'sql', strings, values })),
}));

jest.mock('../db', () => {
  const mockDbChain = {
    from: jest.fn(() => mockDbChain),
    innerJoin: jest.fn(() => mockDbChain),
    where: jest.fn(() => mockDbChain),
    orderBy: jest.fn(),
  };
  const playerTeams = {
    id: 'pt.id',
    playerId: 'pt.player_id',
    teamId: 'pt.team_id',
    seasonId: 'pt.season_id',
    jerseyNumber: 'pt.jersey_number',
    isProspect: 'pt.is_prospect',
    position: 'pt.position',
    acquisitionType: 'pt.acquisition_type',
    startDate: 'pt.start_date',
    endDate: 'pt.end_date',
    createdAt: 'pt.created_at',
  };
  const teams = {
    id: 't.id',
    primaryColor: 't.primary_color',
    textColor: 't.text_color',
  };
  return {
    sql: jest.fn(),
    db: {
      select: jest.fn(() => mockDbChain),
    },
    schema: { playerTeams, teams },
    __mockDbChain: mockDbChain,
  };
});

jest.mock('../middleware/auth', () => ({
  requireAdmin: (req, res, next) => {
    req.user = { id: 'admin-1', role: 'admin' };
    next();
  },
}));

const request = require('supertest');
const express = require('express');
const { sql, db, __mockDbChain } = require('../db');
const playerTeamsRouter = require('./player-teams');

const app = express();
app.use(express.json());
app.use('/api/admin/player-teams', playerTeamsRouter);

const STINT_ROW = {
  id: 'stint-1',
  player_id: 'player-1',
  team_id: 'team-1',
  season_id: 'season-1',
  jersey_number: 16,
  is_prospect: false,
  photo: 'https://example.com/player.png',
  position: 'C',
  acquisition_type: 'trade',
  start_date: '2024-10-01',
  end_date: null,
  created_at: '2024-10-01T00:00:00.000Z',
  team_name: 'Toronto Maple Leafs',
  team_code: 'TOR',
  team_logo: 'https://example.com/leafs.png',
  primary_color: '#003e7e',
  text_color: '#ffffff',
};

beforeEach(() => {
  jest.clearAllMocks();
  sql.mockReset();
  __mockDbChain.from.mockClear();
  __mockDbChain.innerJoin.mockClear();
  __mockDbChain.where.mockClear();
  __mockDbChain.orderBy.mockReset();
});

describe('POST /api/admin/player-teams/bulk', () => {
  it('returns 400 when players is empty', async () => {
    const res = await request(app)
      .post('/api/admin/player-teams/bulk')
      .send({ team_id: 'team-1', season_id: 'season-1', players: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/players must be a non-empty array/i);
  });

  it('creates roster rows and reports skipped duplicates', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'stint-1', player_id: 'player-1' }])
      .mockResolvedValueOnce([]);

    const res = await request(app)
      .post('/api/admin/player-teams/bulk')
      .send({
        team_id: 'team-1',
        season_id: 'season-1',
        players: [
          { player_id: 'player-1', jersey_number: 16 },
          { player_id: 'player-2', jersey_number: 34 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.created).toHaveLength(1);
    expect(res.body.skipped).toBe(1);
    expect(sql).toHaveBeenCalledTimes(2);
  });
});

describe('POST /api/admin/player-teams', () => {
  it('rejects invalid acquisition_type', async () => {
    const res = await request(app)
      .post('/api/admin/player-teams')
      .send({
        player_id: 'player-1',
        team_id: 'team-1',
        season_id: 'season-1',
        acquisition_type: 'call_up',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid acquisition_type/i);
  });

  it('creates a stint and stores the season photo when provided', async () => {
    sql
      .mockResolvedValueOnce([{
        id: 'stint-1',
        player_id: 'player-1',
        team_id: 'team-1',
        season_id: 'season-1',
        jersey_number: 16,
        position: 'C',
        acquisition_type: 'draft',
        start_date: '2024-10-01',
        end_date: null,
      }])
      .mockResolvedValueOnce([]);

    const res = await request(app)
      .post('/api/admin/player-teams')
      .send({
        player_id: 'player-1',
        team_id: 'team-1',
        season_id: 'season-1',
        jersey_number: 16,
        position: 'C',
        acquisition_type: 'draft',
        start_date: '2024-10-01',
        photo: 'https://example.com/player.png',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: 'stint-1',
      acquisition_type: 'draft',
      photo: 'https://example.com/player.png',
    });
    expect(sql).toHaveBeenCalledTimes(2);
  });

  it('returns 409 when an active stint already exists', async () => {
    const err = Object.assign(new Error('duplicate'), { code: '23505' });
    sql.mockRejectedValueOnce(err);

    const res = await request(app)
      .post('/api/admin/player-teams')
      .send({ player_id: 'player-1', team_id: 'team-1', season_id: 'season-1' });

    expect(res.status).toBe(409);
  });
});

describe('GET /api/admin/player-teams/history/:playerId', () => {
  it('returns stints with team data nested under team', async () => {
    sql.mockResolvedValueOnce([{ exists: true }]);
    __mockDbChain.orderBy.mockResolvedValueOnce([STINT_ROW]);

    const res = await request(app).get('/api/admin/player-teams/history/player-1');

    expect(res.status).toBe(200);
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(__mockDbChain.from).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual([
      {
        id: 'stint-1',
        player_id: 'player-1',
        team_id: 'team-1',
        season_id: 'season-1',
        jersey_number: 16,
        is_prospect: false,
        photo: 'https://example.com/player.png',
        position: 'C',
        acquisition_type: 'trade',
        start_date: '2024-10-01',
        end_date: null,
        created_at: '2024-10-01T00:00:00.000Z',
        team: {
          id: 'team-1',
          name: 'Toronto Maple Leafs',
          code: 'TOR',
          logo: 'https://example.com/leafs.png',
          primary_color: '#003e7e',
          text_color: '#ffffff',
        },
      },
    ]);
  });

  it('returns null acquisition_type when the column does not exist yet', async () => {
    sql.mockResolvedValueOnce([{ exists: false }]);
    __mockDbChain.orderBy.mockResolvedValueOnce([{ ...STINT_ROW, acquisition_type: null }]);

    const res = await request(app).get('/api/admin/player-teams/history/player-1');

    expect(res.status).toBe(200);
    expect(res.body[0].acquisition_type).toBeNull();
  });

  it('returns 500 when history lookup fails', async () => {
    sql.mockResolvedValueOnce([{ exists: true }]);
    __mockDbChain.orderBy.mockRejectedValueOnce(new Error('DB down'));

    const res = await request(app).get('/api/admin/player-teams/history/player-1');

    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/admin/player-teams', () => {
  it('updates prospect status without creating a new stint', async () => {
    sql.mockResolvedValueOnce([{
      id: 'stint-1',
      player_id: 'player-1',
      team_id: 'team-1',
      season_id: 'season-1',
      jersey_number: 16,
      is_prospect: true,
      position: 'C',
    }]);

    const res = await request(app)
      .patch('/api/admin/player-teams')
      .send({
        player_id: 'player-1',
        team_id: 'team-1',
        season_id: 'season-1',
        is_prospect: true,
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 'stint-1',
      is_prospect: true,
    });
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it('updates prospect status on a matching historical stint when no active row exists', async () => {
    sql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: 'stint-sjs',
        player_id: 'player-kyle-masters',
        team_id: 'team-sjs',
        season_id: 'season-1',
        jersey_number: 44,
        is_prospect: true,
        position: 'C',
      }]);

    const res = await request(app)
      .patch('/api/admin/player-teams')
      .send({
        player_id: 'player-kyle-masters',
        team_id: 'team-sjs',
        season_id: 'season-1',
        is_prospect: true,
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 'stint-sjs',
      is_prospect: true,
    });
    expect(sql).toHaveBeenCalledTimes(2);
  });
});

describe('PATCH /api/admin/player-teams/:id', () => {
  it('updates prospect status on a specific stint row', async () => {
    sql.mockResolvedValueOnce([{
      id: 'stint-1',
      player_id: 'player-1',
      team_id: 'team-1',
      season_id: 'season-1',
      jersey_number: 16,
      is_prospect: true,
      position: 'C',
      acquisition_type: 'draft',
      start_date: '2024-10-01',
      end_date: '2025-01-15',
    }]);

    const res = await request(app)
      .patch('/api/admin/player-teams/stint-1')
      .send({ is_prospect: true });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 'stint-1',
      is_prospect: true,
    });
    expect(sql).toHaveBeenCalledTimes(1);
  });
});

describe('DELETE /api/admin/player-teams/:id', () => {
  it('removes the player-team association', async () => {
    sql.mockResolvedValueOnce([{ id: 'stint-1' }]);

    const res = await request(app).delete('/api/admin/player-teams/stint-1');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Player removed from team');
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it('returns 404 when the stint is not found', async () => {
    sql.mockResolvedValueOnce([]);

    const res = await request(app).delete('/api/admin/player-teams/missing-stint');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/stint not found/i);
  });
});

describe('GET /api/admin/player-teams/history/:playerId/jerseys', () => {
  it('returns jersey history rows', async () => {
    sql.mockResolvedValueOnce([
      { id: 'j-1', player_teams_id: 'stint-1', jersey_number: 16, effective_from: '2024-10-01' },
    ]);

    const res = await request(app).get('/api/admin/player-teams/history/player-1/jerseys');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].jersey_number).toBe(16);
  });
});

describe('GET /api/admin/player-teams/history/:playerId/photos', () => {
  it('returns player photo history rows unchanged', async () => {
    const rows = [{
      id: 'photo-1',
      player_id: 'player-1',
      team_id: 'team-1',
      season_id: 'season-1',
      photo: 'https://example.com/player.png',
      created_at: '2024-10-01T00:00:00.000Z',
      season_name: '2024-25',
      team_name: 'Toronto Maple Leafs',
    }];
    sql.mockResolvedValueOnce(rows);

    const res = await request(app).get('/api/admin/player-teams/history/player-1/photos');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(rows);
  });
});

describe('POST /api/admin/player-teams/history/:playerId/photos', () => {
  it('requires team_id, season_id and photo', async () => {
    const res = await request(app)
      .post('/api/admin/player-teams/history/player-1/photos')
      .send({ team_id: 'team-1', season_id: 'season-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/photo is required/i);
  });

  it('upserts a player season photo', async () => {
    sql.mockResolvedValueOnce([{
      id: 'photo-1',
      player_id: 'player-1',
      team_id: 'team-1',
      season_id: 'season-1',
      photo: 'https://example.com/player.png',
      created_at: '2024-10-01T00:00:00.000Z',
    }]);

    const res = await request(app)
      .post('/api/admin/player-teams/history/player-1/photos')
      .send({
        team_id: 'team-1',
        season_id: 'season-1',
        photo: 'https://example.com/player.png',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('photo-1');
  });
});
