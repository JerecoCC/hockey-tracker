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
