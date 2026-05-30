'use strict';

jest.mock('../db', () => ({ sql: jest.fn() }));
jest.mock('../middleware/auth', () => ({
  requireAdmin: (req, _res, next) => { req.user = { id: 'admin-1', role: 'admin' }; next(); },
}));

const request       = require('supertest');
const express       = require('express');
const { sql }       = require('../db');
const playersRouter = require('./players');

const app = express();
app.use(express.json());
app.use('/api/admin/players', playersRouter);

const PLAYER = {
  id: 'player-1',
  first_name: 'Wayne',
  last_name: 'Gretzky',
  photo: null,
  date_of_birth: '1961-01-26',
  birth_city: 'Brantford',
  birth_country: 'CAN',
  nationality: 'CAN',
  height_cm: 183,
  weight_lbs: 185,
  position: 'C',
  shoots: 'L',
  is_active: true,
  created_at: new Date().toISOString(),
};

const PLAYER_WITH_ROSTER = {
  ...PLAYER,
  jersey_number: 99,
  team_name: 'Oilers',
  primary_color: '#ff4500',
  text_color: '#ffffff',
};

afterEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// GET /api/admin/players
// ---------------------------------------------------------------------------
describe('GET /api/admin/players', () => {
  it('returns all players', async () => {
    sql.mockResolvedValueOnce([PLAYER]);
    const res = await request(app).get('/api/admin/players');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([PLAYER]);
  });

  it('filters by league_id and returns roster fields', async () => {
    sql.mockResolvedValueOnce([PLAYER_WITH_ROSTER]);
    const res = await request(app).get('/api/admin/players?league_id=league-1');
    expect(res.status).toBe(200);
    expect(sql).toHaveBeenCalledTimes(1);
    expect(res.body[0]).toMatchObject({
      jersey_number: 99,
      team_name: 'Oilers',
      primary_color: '#ff4500',
      text_color: '#ffffff',
    });
  });

  it('filters by team_id and returns roster fields', async () => {
    sql.mockResolvedValueOnce([PLAYER_WITH_ROSTER]);
    const res = await request(app).get('/api/admin/players?team_id=team-1');
    expect(res.status).toBe(200);
    expect(sql).toHaveBeenCalledTimes(1);
    expect(res.body[0]).toMatchObject({
      jersey_number: 99,
      team_name: 'Oilers',
      primary_color: '#ff4500',
      text_color: '#ffffff',
    });
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).get('/api/admin/players');
    expect(res.status).toBe(500);
  });

  it('returns 500 on DB error with league_id', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).get('/api/admin/players?league_id=league-1');
    expect(res.status).toBe(500);
  });

  it('returns 500 on DB error with team_id', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).get('/api/admin/players?team_id=team-1');
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/players/:id/latest-season-stats
// ---------------------------------------------------------------------------
describe('GET /api/admin/players/:id/latest-season-stats', () => {
  it('returns the latest played season stats split by regular season and playoffs', async () => {
    sql
      .mockResolvedValueOnce([{ season_id: 'season-2', season_name: '2023-24', player_position: 'C' }])
      .mockResolvedValueOnce([
        { game_type: 'regular', gp: 10, goals: 5, assists: 6, points: 11 },
        { game_type: 'playoff', gp: 2, goals: 1, assists: 0, points: 1 },
      ])
      .mockResolvedValueOnce([]);

    const res = await request(app).get('/api/admin/players/player-1/latest-season-stats');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      season_id: 'season-2',
      season_name: '2023-24',
      regular: {
        gp: 10,
        goals: 5,
        assists: 6,
        points: 11,
        wins: 0,
        shootout_wins: 0,
        goals_against: 0,
        shots_against: 0,
        save_pct: null,
      },
      playoffs: {
        gp: 2,
        goals: 1,
        assists: 0,
        points: 1,
        wins: 0,
        shootout_wins: 0,
        goals_against: 0,
        shots_against: 0,
        save_pct: null,
      },
    });
  });

  it('returns null when the player has never played a final game', async () => {
    sql.mockResolvedValueOnce([]);

    const res = await request(app).get('/api/admin/players/player-1/latest-season-stats');

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it('uses goalie stints, not roster presence, for goalie games played', async () => {
    sql
      .mockResolvedValueOnce([{ season_id: 'season-2', season_name: '2023-24', player_position: 'G' }])
      .mockResolvedValueOnce([
        { game_type: 'regular', gp: 12, goals: 0, assists: 1, points: 1 },
        { game_type: 'playoff', gp: 4, goals: 0, assists: 0, points: 0 },
      ])
      .mockResolvedValueOnce([
        {
          game_type: 'regular',
          gp: 7,
          shots_against: 210,
          goals_against: 18,
          wins: 5,
          shootout_wins: 1,
        },
      ]);

    const res = await request(app).get('/api/admin/players/player-1/latest-season-stats');

    expect(res.status).toBe(200);
    expect(res.body.regular).toMatchObject({
      gp: 7,
      goals: 0,
      assists: 0,
      points: 0,
      wins: 5,
      shootout_wins: 1,
      goals_against: 18,
      shots_against: 210,
      save_pct: 0.914,
    });
    expect(res.body.playoffs).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/players/:id/last-five-games
// ---------------------------------------------------------------------------
describe('GET /api/admin/players/:id/last-five-games', () => {
  it('returns recent game rows with team and opponent data', async () => {
    sql.mockResolvedValueOnce([
      {
        game_id: 'game-5',
        season_id: 'season-1',
        scheduled_at: '2026-01-15T00:00:00.000Z',
        game_type: 'regular',
        team_id: 'team-1',
        team_name: 'Oilers',
        team_code: 'EDM',
        team_logo: 'oilers.png',
        team_primary_color: '#ff4500',
        team_text_color: '#ffffff',
        opponent_team_id: 'team-2',
        opponent_name: 'Canucks',
        opponent_code: 'VAN',
        opponent_logo: 'canucks.png',
        opponent_primary_color: '#00205b',
        opponent_text_color: '#ffffff',
        is_home: true,
        goals: 1,
        assists: 2,
        points: 3,
        goalie_started: null,
        shots_against: null,
        goals_against: null,
        save_pct: null,
      },
    ]);

    const res = await request(app).get('/api/admin/players/player-1/last-five-games');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      game_id: 'game-5',
      season_id: 'season-1',
      team_name: 'Oilers',
      opponent_code: 'VAN',
      goals: 1,
      assists: 2,
      points: 3,
    });
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).get('/api/admin/players/player-1/last-five-games');
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/players/:id
// ---------------------------------------------------------------------------
describe('GET /api/admin/players/:id', () => {
  it('returns the player', async () => {
    sql.mockResolvedValueOnce([PLAYER]);
    const res = await request(app).get('/api/admin/players/player-1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('player-1');
  });

  it('returns 404 when not found', async () => {
    sql.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/admin/players/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).get('/api/admin/players/player-1');
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/players
// ---------------------------------------------------------------------------
describe('POST /api/admin/players', () => {
  it('creates a player and returns 201', async () => {
    sql.mockResolvedValueOnce([PLAYER]);
    const res = await request(app).post('/api/admin/players')
      .send({ first_name: 'Wayne', last_name: 'Gretzky', position: 'C', shoots: 'L' });
    expect(res.status).toBe(201);
    expect(res.body.first_name).toBe('Wayne');
  });

  it('returns 400 when first_name is missing', async () => {
    const res = await request(app).post('/api/admin/players')
      .send({ last_name: 'Gretzky' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/first_name/i);
  });

  it('returns 400 when last_name is missing', async () => {
    const res = await request(app).post('/api/admin/players')
      .send({ first_name: 'Wayne' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/last_name/i);
  });

  it('returns 400 when first_name is blank whitespace', async () => {
    const res = await request(app).post('/api/admin/players')
      .send({ first_name: '   ', last_name: 'Gretzky' });
    expect(res.status).toBe(400);
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).post('/api/admin/players')
      .send({ first_name: 'Wayne', last_name: 'Gretzky' });
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/players/bulk
// ---------------------------------------------------------------------------
describe('POST /api/admin/players/bulk', () => {
  const validRow = { first_name: 'Wayne', last_name: 'Gretzky', position: 'C', shoots: 'L' };
  const validRow2 = { first_name: 'Mario', last_name: 'Lemieux', position: 'C', shoots: 'R' };

  it('creates all players and returns 201 with created array', async () => {
    sql.mockResolvedValueOnce([PLAYER]).mockResolvedValueOnce([{ ...PLAYER, id: 'player-2' }]);
    const res = await request(app).post('/api/admin/players/bulk')
      .send({ players: [validRow, validRow2] });
    expect(res.status).toBe(201);
    expect(res.body.created).toHaveLength(2);
  });

  it('creates a single player successfully', async () => {
    sql.mockResolvedValueOnce([PLAYER]);
    const res = await request(app).post('/api/admin/players/bulk')
      .send({ players: [validRow] });
    expect(res.status).toBe(201);
    expect(res.body.created[0].first_name).toBe('Wayne');
  });

  it('returns 400 when players is not an array', async () => {
    const res = await request(app).post('/api/admin/players/bulk')
      .send({ players: 'bad' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/non-empty array/i);
  });

  it('returns 400 when players array is empty', async () => {
    const res = await request(app).post('/api/admin/players/bulk')
      .send({ players: [] });
    expect(res.status).toBe(400);
  });

  it('returns 400 when a row is missing first_name', async () => {
    const res = await request(app).post('/api/admin/players/bulk')
      .send({ players: [{ last_name: 'Gretzky', position: 'C', shoots: 'L' }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/first_name/i);
  });

  it('returns 400 when a row is missing last_name', async () => {
    const res = await request(app).post('/api/admin/players/bulk')
      .send({ players: [{ first_name: 'Wayne', position: 'C', shoots: 'L' }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/last_name/i);
  });

  it('returns 400 when a row is missing position', async () => {
    const res = await request(app).post('/api/admin/players/bulk')
      .send({ players: [{ first_name: 'Wayne', last_name: 'Gretzky', shoots: 'L' }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/position/i);
  });

  it('succeeds when shoots is omitted (optional field)', async () => {
    sql.mockResolvedValueOnce([PLAYER]);
    const res = await request(app).post('/api/admin/players/bulk')
      .send({ players: [{ first_name: 'Wayne', last_name: 'Gretzky', position: 'C' }] });
    expect(res.status).toBe(201);
  });

  it('includes row number in validation error message', async () => {
    const res = await request(app).post('/api/admin/players/bulk')
      .send({ players: [validRow, { first_name: 'Mario', last_name: 'Lemieux' }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/row 2/i);
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).post('/api/admin/players/bulk')
      .send({ players: [validRow] });
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/players/:id
// ---------------------------------------------------------------------------
describe('PATCH /api/admin/players/:id', () => {
  it('returns the updated player', async () => {
    sql.mockResolvedValueOnce([{ ...PLAYER, weight_lbs: 190 }]);
    const res = await request(app).patch('/api/admin/players/player-1')
      .send({ weight_lbs: 190 });
    expect(res.status).toBe(200);
    expect(res.body.weight_lbs).toBe(190);
  });

  it('returns 404 when not found', async () => {
    sql.mockResolvedValueOnce([]);
    const res = await request(app).patch('/api/admin/players/nope')
      .send({ weight_lbs: 190 });
    expect(res.status).toBe(404);
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).patch('/api/admin/players/player-1')
      .send({ weight_lbs: 190 });
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/players/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/admin/players/:id', () => {
  it('returns 200 with message on success', async () => {
    sql.mockResolvedValueOnce([{ id: 'player-1' }]);
    const res = await request(app).delete('/api/admin/players/player-1');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });

  it('returns 404 when not found', async () => {
    sql.mockResolvedValueOnce([]);
    const res = await request(app).delete('/api/admin/players/nope');
    expect(res.status).toBe(404);
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).delete('/api/admin/players/player-1');
    expect(res.status).toBe(500);
  });
});
