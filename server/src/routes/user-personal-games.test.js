'use strict';

jest.mock('../db', () => ({ sql: jest.fn() }));
jest.mock('../middleware/auth', () => ({
  requireAuth: (req, res, next) => {
    req.user = { id: 'user-1', role: 'user' };
    next();
  },
}));
jest.mock('../services/googleCalendar', () => ({
  syncScheduledGameToGoogleCalendar: jest.fn().mockResolvedValue({ status: 'synced' }),
}));
jest.mock('../lib/personalGames', () => {
  const actual = jest.requireActual('../lib/personalGames');
  return {
    ...actual,
    fetchPersonalGames: jest.fn(),
    findOwnedPersonalGame: jest.fn(),
  };
});

const request = require('supertest');
const express = require('express');
const { sql } = require('../db');
const { syncScheduledGameToGoogleCalendar } = require('../services/googleCalendar');
const { fetchPersonalGames, findOwnedPersonalGame } = require('../lib/personalGames');
const router = require('./user-personal-games');

const app = express();
app.use(express.json());
app.use('/api/user/personal-games', router);

const HOME = '11111111-1111-4111-8111-111111111111';
const AWAY = '22222222-2222-4222-8222-222222222222';
const GAME_ID = '33333333-3333-4333-8333-333333333333';
const SHAPED = { id: GAME_ID, is_personal: true };

beforeEach(() => {
  jest.clearAllMocks();
  fetchPersonalGames.mockResolvedValue([SHAPED]);
});

describe('POST /api/user/personal-games', () => {
  it('creates the game, syncs its calendar event and returns it shaped', async () => {
    sql.mockResolvedValueOnce([{ id: GAME_ID }]);

    const res = await request(app).post('/api/user/personal-games').send({
      home_team_id: HOME,
      away_team_id: AWAY,
      game_type: 'regular',
      scheduled_at: '2026-10-10',
      scheduled_time: '19:00',
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(SHAPED);
    expect(sql.mock.calls[0][0].join('?')).toContain('INSERT INTO user_personal_games');
    expect(sql.mock.calls[0].slice(1)).toEqual(
      expect.arrayContaining(['user-1', HOME, AWAY, '2026-10-10', '19:00']),
    );
    expect(syncScheduledGameToGoogleCalendar).toHaveBeenCalledWith({
      userId: 'user-1',
      gameId: GAME_ID,
    });
  });

  it('rejects a watch date on or before the game date', async () => {
    const res = await request(app).post('/api/user/personal-games').send({
      home_team_id: HOME,
      away_team_id: AWAY,
      scheduled_at: '2026-10-10',
      scheduled_for: '2026-10-10',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/after the game date/);
    expect(sql).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/user/personal-games/:id', () => {
  it("records a score on the user's own game", async () => {
    findOwnedPersonalGame.mockResolvedValueOnce({ id: GAME_ID });
    sql
      .mockResolvedValueOnce([
        {
          home_team_id: HOME,
          away_team_id: AWAY,
          game_type: 'regular',
          scheduled_at: '2026-10-10',
          scheduled_time: '19:00',
          scheduled_for: null,
          home_score: null,
          away_score: null,
          result_type: 'regulation',
        },
      ])
      .mockResolvedValueOnce([]);

    const res = await request(app)
      .patch(`/api/user/personal-games/${GAME_ID}`)
      .send({ home_score: 3, away_score: 2, result_type: 'shootout' });

    expect(res.status).toBe(200);
    const updateValues = sql.mock.calls[1].slice(1);
    expect(updateValues).toEqual(expect.arrayContaining([3, 2, 'shootout', '19:00']));
    expect(syncScheduledGameToGoogleCalendar).toHaveBeenCalled();
  });

  it("returns 404 for another user's game", async () => {
    findOwnedPersonalGame.mockResolvedValueOnce(null);
    const res = await request(app).patch(`/api/user/personal-games/${GAME_ID}`).send({});
    expect(res.status).toBe(404);
    expect(sql).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/user/personal-games/:id', () => {
  it('deletes the game and removes its calendar event', async () => {
    findOwnedPersonalGame.mockResolvedValueOnce({ id: GAME_ID });
    sql.mockResolvedValueOnce([]);

    const res = await request(app).delete(`/api/user/personal-games/${GAME_ID}`);

    expect(res.status).toBe(200);
    expect(sql.mock.calls[0][0].join('?')).toContain('DELETE FROM user_personal_games');
    expect(syncScheduledGameToGoogleCalendar).toHaveBeenCalledWith({
      userId: 'user-1',
      gameId: GAME_ID,
    });
  });
});

describe('recording a personal game score', () => {
  it('marks a new game watched when it is added with a score', async () => {
    sql.mockResolvedValueOnce([{ id: GAME_ID }]);

    await request(app).post('/api/user/personal-games').send({
      home_team_id: HOME,
      away_team_id: AWAY,
      scheduled_at: '2026-10-10',
      home_score: 3,
      away_score: 1,
      watched_on: '2026-10-11',
    });

    const insert = sql.mock.calls[0][0].join('?');
    expect(insert).toContain('watched_on');
    expect(insert).toMatch(/COALESCE\(\?::date, \?::date, CURRENT_DATE\)/);
    expect(sql.mock.calls[0].slice(1)).toEqual(expect.arrayContaining([3, 1, '2026-10-11']));
  });

  it('marks an edited game watched when its score is set, keeping an existing date', async () => {
    findOwnedPersonalGame.mockResolvedValueOnce({ id: GAME_ID });
    sql
      .mockResolvedValueOnce([
        {
          season_id: null,
          home_team_id: HOME,
          away_team_id: AWAY,
          game_type: 'regular',
          scheduled_at: '2026-10-10',
          scheduled_time: null,
          scheduled_for: null,
          home_score: null,
          away_score: null,
          result_type: 'regulation',
        },
      ])
      .mockResolvedValueOnce([]);

    const res = await request(app)
      .patch(`/api/user/personal-games/${GAME_ID}`)
      .send({ home_score: 2, away_score: 4, result_type: 'regulation', watched_on: '2026-10-12' });

    expect(res.status).toBe(200);
    const update = sql.mock.calls[1][0].join('?');
    expect(update).toMatch(/COALESCE\(\s*watched_on,\s*\?::date,\s*\?::date,\s*CURRENT_DATE\s*\)/);
    expect(sql.mock.calls[1].slice(1)).toEqual(expect.arrayContaining(['2026-10-12']));
  });
});

describe('POST /api/user/personal-games/bulk', () => {
  const GAME_2 = '44444444-4444-4444-8444-444444444444';
  const SEASON = '55555555-5555-4555-8555-555555555555';

  it('adds every game under the season in one insert and syncs each calendar event', async () => {
    sql.mockResolvedValueOnce([{ id: GAME_ID }, { id: GAME_2 }]);

    const res = await request(app)
      .post('/api/user/personal-games/bulk')
      .send({
        season_id: SEASON,
        games: [
          { away_team_id: AWAY, home_team_id: HOME, game_type: 'regular', scheduled_at: '2026-10-10', scheduled_time: '19:00' },
          { away_team_id: HOME, home_team_id: AWAY, game_type: 'playoff', scheduled_at: '2026-10-12' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ created: 2, ids: [GAME_ID, GAME_2] });
    expect(sql).toHaveBeenCalledTimes(1);
    const rows = JSON.parse(sql.mock.calls[0].find((value) => typeof value === 'string' && value.startsWith('[')));
    expect(rows).toEqual([
      { season_id: SEASON, home_team_id: HOME, away_team_id: AWAY, game_type: 'regular', scheduled_at: '2026-10-10', scheduled_time: '19:00' },
      { season_id: SEASON, home_team_id: AWAY, away_team_id: HOME, game_type: 'playoff', scheduled_at: '2026-10-12', scheduled_time: null },
    ]);
    expect(syncScheduledGameToGoogleCalendar).toHaveBeenCalledTimes(2);
  });

  it('saves nothing when any row is invalid, naming the row', async () => {
    const res = await request(app)
      .post('/api/user/personal-games/bulk')
      .send({
        games: [
          { away_team_id: AWAY, home_team_id: HOME, scheduled_at: '2026-10-10' },
          { away_team_id: AWAY, home_team_id: AWAY, scheduled_at: '2026-10-11' },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/^Game 2: .*must be different/);
    expect(sql).not.toHaveBeenCalled();
  });

  it('rejects an empty list', async () => {
    const res = await request(app).post('/api/user/personal-games/bulk').send({ games: [] });
    expect(res.status).toBe(400);
  });
});
