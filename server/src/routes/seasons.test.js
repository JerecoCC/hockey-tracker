'use strict';

jest.mock('../db', () => ({ sql: jest.fn() }));
jest.mock('../middleware/auth', () => ({
  requireAdmin: (req, res, next) => {
    req.user = { id: 'admin-1', role: 'admin' };
    next();
  },
  requireAuth: (req, res, next) => {
    req.user = { id: 'admin-1', role: 'admin' };
    next();
  },
}));

const request = require('supertest');
const express = require('express');
const { sql } = require('../db');
const seasonsRouter = require('./seasons');

const app = express();
app.use(express.json());
app.use('/api/admin/seasons', seasonsRouter);

const SEASON = {
  id: 'season-1',
  name: 'NHL 2024–25',
  league_id: 'league-1',
  is_current: false,
  is_ended: false,
  started_at: '2024-09-01T00:00:00.000Z',
  start_date: '2024-09-01',
  end_date: '2025-04-30',
  created_at: new Date().toISOString(),
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
    sql
      .mockResolvedValueOnce([SEASON])
      .mockResolvedValueOnce([{ has_incomplete_regular_team_games: false }]);
    const res = await request(app).get('/api/admin/seasons/season-1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('season-1');
    expect(res.body.has_incomplete_regular_team_games).toBe(false);
    const queryText = sql.mock.calls[0][0].join('');
    expect(queryText).toContain('has_scheduled_games');
    expect(queryText).toContain('has_unfinished_regular_games');
    const completionQueryText = sql.mock.calls[1][0].join('');
    expect(completionQueryText).toContain('participant_teams');
    expect(completionQueryText).toContain('games_per_season');
    expect(completionQueryText).toContain('has_incomplete_regular_team_games');
  });

  it('returns 404 when not found', async () => {
    sql.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/admin/seasons/nope');
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/seasons/:id/stats
// ---------------------------------------------------------------------------
describe('GET /api/admin/seasons/:id/stats', () => {
  it('returns paginated forward stats with total count', async () => {
    sql.mockResolvedValueOnce([
      {
        player_id: 'player-1',
        first_name: 'Wayne',
        last_name: 'Gretzky',
        points: 215,
        total: 42,
      },
    ]);

    const res = await request(app).get(
      '/api/admin/seasons/season-1/stats?group=forwards&page=2&page_size=10&sort_key=points&sort_dir=desc',
    );

    expect(res.status).toBe(200);
    expect(sql).toHaveBeenCalledTimes(1);
    expect(sql.mock.calls[0][0].join('')).toContain('best_player_photo');
    expect(res.body).toEqual({
      items: [
        {
          player_id: 'player-1',
          first_name: 'Wayne',
          last_name: 'Gretzky',
          points: 215,
        },
      ],
      total: 42,
      page: 2,
      page_size: 10,
    });
  });

  it('uses the shared player photo helper for summary skater and goalie stats', async () => {
    sql.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const res = await request(app).get('/api/admin/seasons/season-1/stats');

    expect(res.status).toBe(200);
    expect(sql).toHaveBeenCalledTimes(2);
    expect(sql.mock.calls[0][0].join('')).toContain('best_player_photo');
    expect(sql.mock.calls[1][0].join('')).toContain('best_player_photo');
  });

  it('filters regular-season goalie leaders by configured minimum minutes', async () => {
    sql.mockResolvedValueOnce([
      {
        player_id: 'goalie-1',
        first_name: 'Ann',
        last_name: 'Goalie',
        time_on_ice: 14400,
        total: 1,
      },
    ]);

    const res = await request(app).get(
      '/api/admin/seasons/season-1/stats?group=goalies&competition=regular&sort_key=time_on_ice&sort_dir=desc',
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      items: [
        {
          player_id: 'goalie-1',
          first_name: 'Ann',
          last_name: 'Goalie',
          time_on_ice: 14400,
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
    });
    const queryText = sql.mock.calls[0][0].join('');
    expect(queryText).toContain('goalie_min_regular_minutes');
    expect(queryText).toContain('league_goalie_min_regular_minutes');
    expect(queryText).not.toContain("UPPER(l.code) = 'PWHL'");
    expect(queryText).toContain('time_on_ice >= COALESCE');
    expect(queryText).toContain("= 'time_on_ice'");
    expect(queryText).not.toContain('WHERE gp >= 25');
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/seasons/:id/awards
// ---------------------------------------------------------------------------
describe('GET /api/admin/seasons/:id/awards', () => {
  it('uses the shared player photo helper for award recipients', async () => {
    sql
      .mockResolvedValueOnce([
        {
          award_id: 'award-1',
          league_id: 'league-1',
          name: 'Second All-Star Team',
          recipient_type: 'player',
          season_award_id: 'season-award-1',
        },
      ])
      .mockResolvedValueOnce([]);

    const res = await request(app).get('/api/admin/seasons/season-1/awards');

    expect(res.status).toBe(200);
    expect(sql).toHaveBeenCalledTimes(2);
    const recipientQueryText = sql.mock.calls[1][0].join('');
    expect(recipientQueryText).toContain('best_player_photo');
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/seasons/:id/awards/:seasonAwardId/recipients
// ---------------------------------------------------------------------------
describe('POST /api/admin/seasons/:id/awards/:seasonAwardId/recipients', () => {
  it('rejects player recipients that do not match award eligibility', async () => {
    sql
      .mockResolvedValueOnce([
        {
          id: 'season-award-1',
          recipient_type: 'player',
          player_eligibility: { position_groups: ['goalie'], rookies_only: false },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'player-1',
          position: 'C',
          rookie_season_id: 'season-1',
        },
      ]);

    const res = await request(app)
      .post('/api/admin/seasons/season-1/awards/season-award-1/recipients')
      .send({
        recipient_type: 'player',
        player_id: 'player-1',
        role: 'winner',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Player is not eligible for this award');
    expect(sql).toHaveBeenCalledTimes(2);
    expect(sql.mock.calls[1][0].join('')).toContain('FROM players p');
  });

  it('rejects team recipients that do not match award conference eligibility', async () => {
    sql
      .mockResolvedValueOnce([
        {
          id: 'season-award-1',
          recipient_type: 'team',
          player_eligibility: null,
          team_eligibility: { conference_names: ['Eastern Conference'] },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'team-1',
          conference_names: ['Western Conference'],
          conference_keys: [],
        },
      ]);

    const res = await request(app)
      .post('/api/admin/seasons/season-1/awards/season-award-1/recipients')
      .send({
        recipient_type: 'team',
        team_id: 'team-1',
        role: 'winner',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Team is not eligible for this award');
    expect(sql).toHaveBeenCalledTimes(2);
    expect(sql.mock.calls[1][0].join('')).toContain('conference_memberships');
  });
});

// ---------------------------------------------------------------------------
// PUT /api/admin/seasons/:id/awards/:seasonAwardId/nominees
// ---------------------------------------------------------------------------
describe('PUT /api/admin/seasons/:id/awards/:seasonAwardId/nominees', () => {
  it('replaces nominees in submitted order and stores rank positions', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'season-award-1', recipient_type: 'player' }])
      .mockResolvedValueOnce([{ id: 'player-2' }])
      .mockResolvedValueOnce([{ id: 'player-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const res = await request(app)
      .put('/api/admin/seasons/season-1/awards/season-award-1/nominees')
      .send({
        nominees: [
          { recipient_type: 'player', player_id: 'player-2' },
          { recipient_type: 'player', player_id: 'player-1', stat_value: '10' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 2 });
    expect(sql).toHaveBeenCalledTimes(6);
    expect(sql.mock.calls[1][0].join('')).toContain('FROM players p');
    expect(sql.mock.calls[2][0].join('')).toContain('FROM players p');
    expect(sql.mock.calls[3][0].join('')).toContain("sar.role = 'nominee'");
    expect(sql.mock.calls[4][0].join('')).toContain('INSERT INTO season_award_recipients');
    expect(sql.mock.calls[4].slice(1)).toEqual([
      'season-award-1',
      'player',
      'player-2',
      null,
      1,
      null,
      null,
      null,
    ]);
    expect(sql.mock.calls[5].slice(1)).toEqual([
      'season-award-1',
      'player',
      'player-1',
      null,
      2,
      null,
      '10',
      null,
    ]);
  });

  it('rejects duplicate nominee recipients before replacing rows', async () => {
    sql.mockResolvedValueOnce([{ id: 'season-award-1', recipient_type: 'player' }]);

    const res = await request(app)
      .put('/api/admin/seasons/season-1/awards/season-award-1/nominees')
      .send({
        nominees: [
          { recipient_type: 'player', player_id: 'player-1' },
          { recipient_type: 'player', player_id: 'player-1' },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('nominees must be unique');
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it('rejects team nominees that do not match award conference eligibility', async () => {
    sql
      .mockResolvedValueOnce([
        {
          id: 'season-award-1',
          recipient_type: 'team',
          player_eligibility: null,
          team_eligibility: { conference_names: ['Eastern Conference'] },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'team-1',
          conference_names: ['Western Conference'],
          conference_keys: [],
        },
      ]);

    const res = await request(app)
      .put('/api/admin/seasons/season-1/awards/season-award-1/nominees')
      .send({
        nominees: [{ recipient_type: 'team', team_id: 'team-1' }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Team is not eligible for this award');
    expect(sql).toHaveBeenCalledTimes(2);
    expect(sql.mock.calls[1][0].join('')).toContain('conference_memberships');
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/seasons/:id/standings
// ---------------------------------------------------------------------------
describe('GET /api/admin/seasons/:id/standings', () => {
  it('uses season participants and cached team stats to build standings', async () => {
    sql.mockResolvedValueOnce([
      {
        team_id: 'team-1',
        team_name: 'Sharks',
        points: 2,
        gp: 1,
      },
    ]);

    const res = await request(app).get('/api/admin/seasons/season-1/standings');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    const queryText = sql.mock.calls[0][0].join('');
    expect(queryText).toContain('participant_teams');
    expect(queryText).toContain('group_alignment_set_id');
    expect(queryText).toContain('group_alignment_set_teams');
    expect(queryText).toContain('group_alignment_teams');
    expect(queryText).toContain('season_alignment_group_teams');
    expect(queryText).toContain('game_team_stats');
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
    const res = await request(app)
      .post('/api/admin/seasons')
      .send({ league_id: 'league-1', name: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name is required/i);
  });

  it('returns 400 when league is not found', async () => {
    sql.mockResolvedValueOnce([]); // no league rows
    const res = await request(app)
      .post('/api/admin/seasons')
      .send({ league_id: 'bad-id', name: 'Test Season' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/league not found/i);
  });

  it('creates a season with the provided name', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'league-1' }]) // league existence check
      .mockResolvedValueOnce([{ ...SEASON, name: 'NHL 2024–25' }]); // INSERT RETURNING
    const res = await request(app).post('/api/admin/seasons').send({
      league_id: 'league-1',
      name: 'NHL 2024–25',
      start_date: '2024-09-01',
      end_date: '2025-04-30',
    });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('NHL 2024–25');
  });

  it('trims whitespace from the name', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'league-1' }])
      .mockResolvedValueOnce([{ ...SEASON, name: 'NHL 2024–25' }]);
    const res = await request(app)
      .post('/api/admin/seasons')
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
      .mockResolvedValueOnce([{ ...SEASON }]) // fetch existing
      .mockResolvedValueOnce([]) // UPDATE seasons
      .mockResolvedValueOnce([]) // UPDATE leagues (unset current)
      .mockResolvedValueOnce([{ ...SEASON, name: 'NHL 2024–25', end_date: '2025-04-15' }]); // SELECT JOIN re-fetch
    const res = await request(app)
      .patch('/api/admin/seasons/season-1')
      .send({ name: 'NHL 2024–25', end_date: '2025-04-15' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('NHL 2024–25');
  });

  it('keeps the existing name when name is not provided', async () => {
    sql
      .mockResolvedValueOnce([{ ...SEASON }])
      .mockResolvedValueOnce([]) // UPDATE seasons
      .mockResolvedValueOnce([]) // UPDATE leagues (unset current)
      .mockResolvedValueOnce([{ ...SEASON, end_date: '2025-04-15' }]);
    const res = await request(app)
      .patch('/api/admin/seasons/season-1')
      .send({ end_date: '2025-04-15' });
    expect(res.status).toBe(200);
  });

  it('does not clear is_current when end_date is not set', async () => {
    sql
      .mockResolvedValueOnce([{ ...SEASON, end_date: null }]) // fetch existing (no end_date)
      .mockResolvedValueOnce([]) // UPDATE seasons
      .mockResolvedValueOnce([{ ...SEASON, name: 'NHL Updated', end_date: null }]); // re-fetch
    const res = await request(app)
      .patch('/api/admin/seasons/season-1')
      .send({ name: 'NHL Updated' });
    expect(res.status).toBe(200);
    // Only 3 SQL calls — no UPDATE leagues step when end_date is absent
    expect(sql).toHaveBeenCalledTimes(3);
  });

  it('blocks changing team alignment after games have been scheduled', async () => {
    sql.mockResolvedValueOnce([
      {
        ...SEASON,
        is_current: true,
        end_date: null,
        group_alignment_set_id: 'alignment-1',
        has_scheduled_games: true,
      },
    ]);

    const res = await request(app)
      .patch('/api/admin/seasons/season-1')
      .send({ group_alignment_set_id: 'alignment-2' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/cannot be changed/i);
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it('returns 404 when season not found', async () => {
    sql.mockResolvedValueOnce([]); // no existing row
    const res = await request(app)
      .patch('/api/admin/seasons/nope')
      .send({ end_date: '2025-04-15' });
    expect(res.status).toBe(404);
  });

  it('auto-keeps is_ended true when already ended and no end_date in request', async () => {
    // cur.is_ended = true, no end_date in body → mergedEndDate = null, mergedIsEnded stays true
    // UPDATE leagues should still fire because mergedIsEnded is true
    sql
      .mockResolvedValueOnce([{ ...SEASON, end_date: null, is_ended: true }]) // fetch existing
      .mockResolvedValueOnce([]) // UPDATE seasons
      .mockResolvedValueOnce([]) // UPDATE leagues (unset current)
      .mockResolvedValueOnce([{ ...SEASON, name: 'NHL Renamed', end_date: null, is_ended: true }]);
    const res = await request(app)
      .patch('/api/admin/seasons/season-1')
      .send({ name: 'NHL Renamed' });
    expect(res.status).toBe(200);
    // 4 calls: fetch + UPDATE seasons + UPDATE leagues + SELECT re-fetch
    expect(sql).toHaveBeenCalledTimes(4);
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).patch('/api/admin/seasons/season-1').send({ name: 'Crash' });
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/seasons/:id/start
// ---------------------------------------------------------------------------
describe('PATCH /api/admin/seasons/:id/start', () => {
  it('moves the active upcoming season to in progress', async () => {
    sql
      .mockResolvedValueOnce([
        {
          id: 'season-1',
          is_current: true,
          started_at: null,
          playoffs_started: false,
          is_ended: false,
        },
      ])
      .mockResolvedValueOnce([{ id: 'season-1', started_at: '2024-10-01T00:00:00.000Z' }]);

    const res = await request(app).patch('/api/admin/seasons/season-1/start').send({});

    expect(res.status).toBe(200);
    expect(res.body.started_at).toBe('2024-10-01T00:00:00.000Z');
    expect(sql.mock.calls[1][0].join('')).toContain('COALESCE(started_at, NOW())');
  });

  it('does not allow a non-active season to be started', async () => {
    sql.mockResolvedValueOnce([
      {
        id: 'season-1',
        is_current: false,
        started_at: null,
        playoffs_started: false,
        is_ended: false,
      },
    ]);

    const res = await request(app).patch('/api/admin/seasons/season-1/start').send({});

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/active season/i);
    expect(sql).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/seasons/:id/playoffs
// ---------------------------------------------------------------------------
describe('PATCH /api/admin/seasons/:id/playoffs', () => {
  it('starts playoffs when regular-season completion checks pass', async () => {
    sql
      .mockResolvedValueOnce([
        {
          id: 'season-1',
          is_current: true,
          started_at: SEASON.started_at,
          is_ended: false,
          playoffs_started: false,
          has_unfinished_regular_games: false,
        },
      ])
      .mockResolvedValueOnce([{ has_incomplete_regular_team_games: false }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...SEASON, playoffs_started: true }]);

    const res = await request(app).patch('/api/admin/seasons/season-1/playoffs').send({});

    expect(res.status).toBe(200);
    expect(res.body.playoffs_started).toBe(true);
    expect(res.body.has_incomplete_regular_team_games).toBe(false);
    expect(sql).toHaveBeenCalledTimes(4);
    expect(sql.mock.calls[1][0].join('')).toContain('participant_teams');
    expect(sql.mock.calls[1][0].join('')).toContain('game_team_stats');
  });

  it('blocks playoffs while regular-season games are scheduled or in progress', async () => {
    sql.mockResolvedValueOnce([
      {
        id: 'season-1',
        is_current: true,
        started_at: SEASON.started_at,
        is_ended: false,
        playoffs_started: false,
        has_unfinished_regular_games: true,
      },
    ]);

    const res = await request(app).patch('/api/admin/seasons/season-1/playoffs').send({});

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/scheduled or in progress/i);
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it('blocks playoffs until every team has reached games_per_season', async () => {
    sql
      .mockResolvedValueOnce([
        {
          id: 'season-1',
          is_current: true,
          started_at: SEASON.started_at,
          is_ended: false,
          playoffs_started: false,
          has_unfinished_regular_games: false,
        },
      ])
      .mockResolvedValueOnce([{ has_incomplete_regular_team_games: true }]);

    const res = await request(app).patch('/api/admin/seasons/season-1/playoffs').send({});

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/games_per_season/i);
    expect(sql).toHaveBeenCalledTimes(2);
  });

  it('returns 404 when season not found', async () => {
    sql.mockResolvedValueOnce([]);

    const res = await request(app).patch('/api/admin/seasons/nope/playoffs').send({});

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
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

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).delete('/api/admin/seasons/season-1');
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/seasons/:id/current
// ---------------------------------------------------------------------------
describe('PATCH /api/admin/seasons/:id/current', () => {
  it('does not allow an ended season to become active', async () => {
    sql.mockResolvedValueOnce([
      { id: 'season-1', league_id: 'league-1', is_ended: true },
    ]);

    const res = await request(app)
      .patch('/api/admin/seasons/season-1/current')
      .send({ is_current: true });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/ended season/i);
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it('sets is_current to true by updating leagues.current_season_id', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'season-1', league_id: 'league-1' }]) // existence check
      .mockResolvedValueOnce([]) // UPDATE leagues SET current_season_id = id
      .mockResolvedValueOnce([{ ...SEASON, is_current: true }]); // SELECT JOIN to return season
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
      .mockResolvedValueOnce([]) // UPDATE leagues SET current_season_id = NULL
      .mockResolvedValueOnce([{ ...SEASON, is_current: false }]); // SELECT JOIN to return season
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
    const res = await request(app).patch('/api/admin/seasons/season-1/current').send({});
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
  id: 'group-1',
  league_id: 'league-1',
  parent_id: null,
  name: 'Division A',
  sort_order: 0,
  created_at: new Date().toISOString(),
  teams: [],
  has_season_override: false,
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
      .mockResolvedValueOnce([SEASON]) // season check
      .mockResolvedValueOnce([GROUP]); // groups query
    const res = await request(app).get('/api/admin/seasons/season-1/groups');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('group-1');
    expect(res.body[0].has_season_override).toBe(false);
  });

  it('returns no groups for a league-wide alignment set', async () => {
    sql
      .mockResolvedValueOnce([{ ...SEASON, group_alignment_set_id: 'alignment-1' }])
      .mockResolvedValueOnce([{ id: 'alignment-1', structure_type: 'league' }]);
    const res = await request(app).get('/api/admin/seasons/season-1/groups');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
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
    sql.mockResolvedValueOnce([]); // season check
    const res = await request(app)
      .put('/api/admin/seasons/nope/groups/group-1/teams')
      .send({ team_ids: [] });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/season not found/i);
  });

  it('returns 404 when group not found', async () => {
    sql
      .mockResolvedValueOnce([SEASON]) // season check
      .mockResolvedValueOnce([]); // group check
    const res = await request(app)
      .put('/api/admin/seasons/season-1/groups/nope/teams')
      .send({ team_ids: [] });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/group not found/i);
  });

  it('returns 400 when season and group are in different leagues', async () => {
    sql
      .mockResolvedValueOnce([SEASON]) // season (league-1)
      .mockResolvedValueOnce([{ ...GROUP, league_id: 'league-2' }]); // group (league-2)
    const res = await request(app)
      .put('/api/admin/seasons/season-1/groups/group-1/teams')
      .send({ team_ids: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/same league/i);
  });

  it('sets season teams and returns them', async () => {
    sql
      .mockResolvedValueOnce([SEASON]) // season check
      .mockResolvedValueOnce([GROUP]) // group check
      .mockResolvedValueOnce([]) // DELETE
      .mockResolvedValueOnce([]) // INSERT team-1
      .mockResolvedValueOnce([TEAM]); // SELECT teams
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
    sql.mockResolvedValueOnce([SEASON]).mockResolvedValueOnce([]);
    const res = await request(app).delete('/api/admin/seasons/season-1/groups/group-1/teams');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/reverts to defaults/i);
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).delete('/api/admin/seasons/season-1/groups/group-1/teams');
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
    const res = await request(app).put('/api/admin/seasons/nope/teams').send({ team_ids: [] });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/season not found/i);
  });

  it('clears roster and returns empty teams when team_ids is []', async () => {
    sql
      .mockResolvedValueOnce([SEASON]) // SELECT season
      .mockResolvedValueOnce([{ id: 'ag-1' }]) // SELECT auto group (exists)
      .mockResolvedValueOnce([]) // DELETE group_teams
      .mockResolvedValueOnce([]) // DELETE season_teams
      .mockResolvedValueOnce([]); // SELECT teams → empty
    const res = await request(app).put('/api/admin/seasons/season-1/teams').send({ team_ids: [] });
    expect(res.status).toBe(200);
    expect(res.body.teams).toHaveLength(0);
    expect(res.body.season_id).toBe('season-1');
  });

  it('creates the auto group when none exists and sets the roster', async () => {
    sql
      .mockResolvedValueOnce([SEASON]) // SELECT season
      .mockResolvedValueOnce([]) // SELECT auto group → none
      .mockResolvedValueOnce([{ id: 'ag-new' }]) // INSERT auto group RETURNING id
      .mockResolvedValueOnce([]) // DELETE group_teams
      .mockResolvedValueOnce([]) // INSERT group_team (team-1)
      .mockResolvedValueOnce([]) // DELETE season_teams
      .mockResolvedValueOnce([]) // INSERT season_team (team-1)
      .mockResolvedValueOnce([]) // UPDATE teams tracking (team-1)
      .mockResolvedValueOnce([TEAM]); // SELECT teams
    const res = await request(app)
      .put('/api/admin/seasons/season-1/teams')
      .send({ team_ids: ['team-1'] });
    expect(res.status).toBe(200);
    expect(res.body.teams).toHaveLength(1);
    expect(res.body.auto_group_id).toBe('ag-new');
  });

  it('uses existing auto group and updates start/latest season on first add', async () => {
    sql
      .mockResolvedValueOnce([SEASON]) // SELECT season
      .mockResolvedValueOnce([{ id: 'ag-1' }]) // SELECT auto group (exists)
      .mockResolvedValueOnce([]) // DELETE group_teams
      .mockResolvedValueOnce([]) // INSERT group_team (team-1)
      .mockResolvedValueOnce([]) // DELETE season_teams
      .mockResolvedValueOnce([]) // INSERT season_team (team-1)
      .mockResolvedValueOnce([]) // UPDATE teams tracking (team-1)
      .mockResolvedValueOnce([TEAM]); // SELECT teams
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
      .mockRejectedValueOnce(fkErr); // INSERT group_team → FK error
    const res = await request(app)
      .put('/api/admin/seasons/season-1/teams')
      .send({ team_ids: ['bad-team'] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/one or more teams not found/i);
  });

  it('returns 500 on generic DB error', async () => {
    sql.mockResolvedValueOnce([SEASON]).mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).put('/api/admin/seasons/season-1/teams').send({ team_ids: [] });
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/seasons/:seasonId/teams
// ---------------------------------------------------------------------------
const SEASON_TEAM = {
  id: 'team-1',
  name: 'Sharks',
  code: 'SJS',
  logo: null,
  primary_color: '#007A53',
  text_color: '#FFFFFF',
  secondary_color: null,
  home_arena: 'SAP Center',
  inherited: false,
};

describe('GET /api/admin/seasons/:seasonId/teams', () => {
  it('returns 404 when season is not found', async () => {
    sql.mockResolvedValueOnce([]); // season check
    const res = await request(app).get('/api/admin/seasons/nope/teams');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/season not found/i);
  });

  it("returns the season's own teams when the roster is set", async () => {
    sql
      .mockResolvedValueOnce([SEASON]) // season check (start_date)
      .mockResolvedValueOnce([SEASON_TEAM]); // current teams LATERAL query
    const res = await request(app).get('/api/admin/seasons/season-1/teams');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('team-1');
    expect(res.body[0].inherited).toBe(false);
    // 2 SQL calls: season check + current teams
    expect(sql).toHaveBeenCalledTimes(2);
  });

  it('returns teams from a grouped alignment set', async () => {
    sql
      .mockResolvedValueOnce([{ ...SEASON, group_alignment_set_id: 'alignment-1' }])
      .mockResolvedValueOnce([{ id: 'alignment-1', structure_type: 'groups' }])
      .mockResolvedValueOnce([SEASON_TEAM]);

    const res = await request(app).get('/api/admin/seasons/season-1/teams');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('team-1');
    const queryText = sql.mock.calls[2][0].join('');
    expect(queryText).toContain('group_alignment_teams');
    expect(queryText).toContain('season_alignment_group_teams');
    expect(sql).toHaveBeenCalledTimes(3);
  });

  it("falls back to the previous season's roster when the current season has none", async () => {
    const prevSeason = { id: 'season-0', prev_start_date: '2023-09-01' };
    const inheritedTeam = { ...SEASON_TEAM, inherited: true };
    sql
      .mockResolvedValueOnce([SEASON]) // season check
      .mockResolvedValueOnce([]) // current teams → empty
      .mockResolvedValueOnce([prevSeason]) // prev season lookup
      .mockResolvedValueOnce([inheritedTeam]); // inherited teams LATERAL query
    const res = await request(app).get('/api/admin/seasons/season-1/teams');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].inherited).toBe(true);
    // 4 SQL calls: season + empty current + prev season + inherited
    expect(sql).toHaveBeenCalledTimes(4);
  });

  it('returns an empty array when there are no teams and no previous season', async () => {
    sql
      .mockResolvedValueOnce([SEASON]) // season check
      .mockResolvedValueOnce([]) // current teams → empty
      .mockResolvedValueOnce([]); // prev season → none
    const res = await request(app).get('/api/admin/seasons/season-1/teams');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(sql).toHaveBeenCalledTimes(3);
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).get('/api/admin/seasons/season-1/teams');
    expect(res.status).toBe(500);
  });
});
