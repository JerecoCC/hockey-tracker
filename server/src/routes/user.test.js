'use strict';

jest.mock('../db', () => ({ sql: jest.fn() }));
jest.mock('../middleware/auth', () => ({
  requireAuth: (req, _res, next) => {
    req.user = { id: 'user-1', role: 'user' };
    next();
  },
}));

const request = require('supertest');
const express = require('express');
const { sql } = require('../db');
const userRouter = require('./user');

const app = express();
app.use(express.json());
app.use('/api/user', userRouter);

afterEach(() => jest.clearAllMocks());

const GAME = {
  id: 'game-1',
  season_id: 'season-1',
  game_type: 'regular',
  status: 'scheduled',
  scheduled_at: '2024-10-10T19:00:00Z',
  scheduled_time: '19:00',
  venue: null,
  overtime_periods: null,
  shootout: false,
  playoff_series_id: null,
  game_number_in_series: null,
  game_number: 1,
  notes: null,
  current_period: null,
  created_at: '2024-01-01T00:00:00Z',
  star_1_id: null,
  star_2_id: null,
  star_3_id: null,
  playoff_round: null,
  playoff_round_names: null,
  period_scores: [],
  period_shots: [],
  home_team: { id: 'team-1', name: 'Home', code: 'HOM', logo: null, primary_color: '#111', secondary_color: '#222', text_color: '#fff' },
  away_team: { id: 'team-2', name: 'Away', code: 'AWY', logo: null, primary_color: '#333', secondary_color: '#444', text_color: '#fff' },
  season_name: '2024-25',
  league_id: 'league-1',
  league_name: 'NHL',
  league_primary_color: '#0a4fa3',
  league_text_color: '#ffffff',
  watched_by_user: false,
  watched_on: null,
  scheduled_for: '2024-10-12',
};

describe('GET /api/user/favorites', () => {
  it('returns the authenticated user favorite team ids', async () => {
    sql.mockResolvedValueOnce([{ team_id: 'team-1' }, { team_id: 'team-2' }]);

    const res = await request(app).get('/api/user/favorites');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(['team-1', 'team-2']);
  });
});

describe('GET /api/user/games', () => {
  it('returns games and scopes the query to the authenticated user favorites', async () => {
    sql.mockResolvedValueOnce([GAME]);

    const res = await request(app).get('/api/user/games');
    const queryText = sql.mock.calls[0][0].join(' ');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('game-1');
    expect(res.body[0].watched_by_user).toBe(false);
    expect(res.body[0].scheduled_for).toBe('2024-10-12');
    expect(sql.mock.calls[0].slice(1)).toContain('user-1');
    expect(queryText).toContain("g.status <> 'cancelled'");
    expect(queryText).toContain('uwg.skipped_at IS NULL');
  });

  it('keeps league and status filters working on top of favorite-team scoping', async () => {
    sql.mockResolvedValueOnce([GAME]);

    const res = await request(app)
      .get('/api/user/games?league_id=league-1&status=scheduled');

    expect(res.status).toBe(200);
    expect(res.body[0].id).toBe('game-1');
  });
});

describe('POST /api/user/watched-games/:gameId', () => {
  it('marks a game as watched for the authenticated user', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'game-1' }])
      .mockResolvedValueOnce([{ watched_on: '2024-10-15', scheduled_for: null }]);

    const res = await request(app).post('/api/user/watched-games/game-1');

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      user_id: 'user-1',
      game_id: 'game-1',
      watched_on: '2024-10-15',
      scheduled_for: null,
    });
  });

  it('keeps a scheduled watch date when a delayed game is marked watched', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'game-1' }])
      .mockResolvedValueOnce([{ watched_on: '2024-10-12', scheduled_for: '2024-10-12' }]);

    const res = await request(app).post('/api/user/watched-games/game-1');

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      user_id: 'user-1',
      game_id: 'game-1',
      watched_on: '2024-10-12',
      scheduled_for: '2024-10-12',
    });
  });

  it('returns 404 when the game does not exist', async () => {
    sql.mockResolvedValueOnce([]);

    const res = await request(app).post('/api/user/watched-games/nope');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/game not found/i);
  });
});

describe('PUT /api/user/watched-games/:gameId/schedule', () => {
  it('stores a scheduled watch date for the authenticated user', async () => {
    sql.mockResolvedValueOnce([{ id: 'game-1' }]).mockResolvedValueOnce([]);

    const res = await request(app)
      .put('/api/user/watched-games/game-1/schedule')
      .send({ scheduled_for: '2024-10-14' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user_id: 'user-1',
      game_id: 'game-1',
      scheduled_for: '2024-10-14',
    });
  });
});

describe('DELETE /api/user/watched-games/:gameId', () => {
  it('deletes the watched record when no scheduled watch date exists', async () => {
    sql.mockResolvedValueOnce([{ scheduled_for: null }]).mockResolvedValueOnce([]);

    const res = await request(app).delete('/api/user/watched-games/game-1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user_id: 'user-1',
      game_id: 'game-1',
      watched_on: null,
      scheduled_for: null,
      deleted: true,
    });
  });

  it('preserves the scheduled watch date when clearing watched state', async () => {
    sql.mockResolvedValueOnce([{ scheduled_for: '2024-10-14' }]).mockResolvedValueOnce([]);

    const res = await request(app).delete('/api/user/watched-games/game-1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user_id: 'user-1',
      game_id: 'game-1',
      watched_on: null,
      scheduled_for: '2024-10-14',
    });
  });
});

describe('POST /api/user/watched-games/:gameId/skip', () => {
  it('marks a game as skipped for the authenticated user', async () => {
    sql.mockResolvedValueOnce([{ id: 'game-1' }]).mockResolvedValueOnce([]);

    const res = await request(app).post('/api/user/watched-games/game-1/skip');

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      user_id: 'user-1',
      game_id: 'game-1',
      skipped: true,
    });
  });
});