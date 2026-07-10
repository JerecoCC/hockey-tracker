'use strict';

jest.mock('../db', () => ({ sql: jest.fn() }));
jest.mock('../middleware/auth', () => ({
  requireAdmin: (req, res, next) => { req.user = { id: 'admin-1', role: 'admin' }; next(); },
  requireAuth:  (req, res, next) => { req.user = { id: 'admin-1', role: 'admin' }; next(); },
}));
jest.mock('@vercel/blob', () => ({ put: jest.fn() }));

const request       = require('supertest');
const express       = require('express');
const { sql }       = require('../db');
const { put }       = require('@vercel/blob');
const leaguesRouter = require('./leagues');

const app = express();
app.use(express.json());
app.use('/api/admin/leagues', leaguesRouter);

const LEAGUE = {
  id: 'league-1', name: 'NHL', code: 'NHL', description: null,
  logo: null, icon: null, primary_color: '#334155', text_color: '#ffffff',
  best_of_playoff: 7, best_of_shootout: 3, scoring_system: '2-1-0',
  goalie_min_regular_minutes: 1500, playoff_format: null,
  season_phase: 'regular',
  created_at: new Date().toISOString(),
};

afterEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// POST /api/admin/leagues/upload
// ---------------------------------------------------------------------------
describe('POST /api/admin/leagues/upload', () => {
  it('accepts .ico files and stores them with an icon content type', async () => {
    put.mockResolvedValueOnce({ url: 'https://blob.example.com/leagues/icon.ico' });

    const res = await request(app)
      .post('/api/admin/leagues/upload')
      .attach('logo', Buffer.from('icon'), {
        filename: 'league.ico',
        contentType: 'application/octet-stream',
      });

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://blob.example.com/leagues/icon.ico');
    expect(put).toHaveBeenCalledWith(
      expect.stringMatching(/^leagues\/.+\.ico$/),
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'image/x-icon' }),
    );
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/leagues
// ---------------------------------------------------------------------------
describe('GET /api/admin/leagues', () => {
  it('returns an array of leagues', async () => {
    sql.mockResolvedValueOnce([LEAGUE]);
    const res = await request(app).get('/api/admin/leagues');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([LEAGUE]);
    const queryText = sql.mock.calls[0][0].join(' ');
    expect(queryText).toContain('AS season_phase');
    expect(queryText).toContain('LEFT JOIN seasons cs');
    expect(queryText).toContain('cs.playoffs_started');
    expect(queryText).toContain('l.goalie_min_regular_minutes');
  });

  it('returns 500 on DB error', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).get('/api/admin/leagues');
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/leagues/:id
// ---------------------------------------------------------------------------
describe('GET /api/admin/leagues/:id', () => {
  it('returns the league with teams and seasons', async () => {
    sql
      .mockResolvedValueOnce([LEAGUE])          // league row
      .mockResolvedValueOnce([])                // teams
      .mockResolvedValueOnce([]);               // seasons
    const res = await request(app).get('/api/admin/leagues/league-1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('league-1');
    expect(res.body.teams).toEqual([]);
    expect(res.body.seasons).toEqual([]);
  });

  it('selects raw team logo variants for edit forms', async () => {
    sql
      .mockResolvedValueOnce([LEAGUE])
      .mockResolvedValueOnce([
        {
          id: 'team-1',
          name: 'Toronto Maple Leafs',
          place_name: 'Toronto',
          team_name: 'Maple Leafs',
          code: 'TOR',
          logo: 'https://cdn.example.com/tor-dark.svg',
          logo_dark: 'https://cdn.example.com/tor-dark.svg',
          logo_light: null,
        },
      ])
      .mockResolvedValueOnce([]);

    const res = await request(app).get('/api/admin/leagues/league-1');

    expect(res.status).toBe(200);
    expect(res.body.teams[0]).toMatchObject({
      logo: 'https://cdn.example.com/tor-dark.svg',
      logo_dark: 'https://cdn.example.com/tor-dark.svg',
      logo_light: null,
    });

    const teamQuery = sql.mock.calls[1][0].join('');
    expect(teamQuery).toContain('team_logo_default(logo_dark, logo_light) AS logo');
    expect(teamQuery).toContain('logo_dark, logo_light, icon');
    expect(teamQuery).not.toContain('team_logo_dark(logo_dark, logo_light) AS logo_dark');
    expect(teamQuery).not.toContain('team_logo_light(logo_dark, logo_light) AS logo_light');
  });

  it('returns 404 when not found', async () => {
    sql.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/admin/leagues/nope');
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/leagues
// ---------------------------------------------------------------------------
describe('POST /api/admin/leagues', () => {
  it('returns 400 when name is missing', async () => {
    const res = await request(app).post('/api/admin/leagues').send({ code: 'NHL' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name is required/i);
  });

  it('returns 400 when code is missing', async () => {
    const res = await request(app).post('/api/admin/leagues').send({ name: 'NHL' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/code is required/i);
  });

  it('returns 201 on success', async () => {
    sql.mockResolvedValueOnce([LEAGUE]);
    const res = await request(app).post('/api/admin/leagues')
      .send({ name: 'NHL', code: 'nhl', goalie_min_regular_minutes: 240 });
    expect(res.status).toBe(201);
    expect(res.body.code).toBe('NHL');
    const queryValues = sql.mock.calls[0].slice(1);
    expect(queryValues).toContain(240);
  });

  it('rejects negative goalie minimum minutes', async () => {
    const res = await request(app).post('/api/admin/leagues')
      .send({ name: 'NHL', code: 'nhl', goalie_min_regular_minutes: -1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/goalie_min_regular_minutes/i);
  });

  it('returns 409 on duplicate code', async () => {
    const err = Object.assign(new Error('dup'), { code: '23505' });
    sql.mockRejectedValueOnce(err);
    const res = await request(app).post('/api/admin/leagues')
      .send({ name: 'NHL', code: 'NHL' });
    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/leagues/:id
// ---------------------------------------------------------------------------
describe('PATCH /api/admin/leagues/:id', () => {
  it('returns 400 when name is empty string', async () => {
    const res = await request(app).patch('/api/admin/leagues/league-1').send({ name: '  ' });
    expect(res.status).toBe(400);
  });

  it('returns updated league on success', async () => {
    sql.mockResolvedValueOnce([{ ...LEAGUE, name: 'New NHL', goalie_min_regular_minutes: 240 }]);
    const res = await request(app).patch('/api/admin/leagues/league-1')
      .send({ name: 'New NHL', goalie_min_regular_minutes: 240 });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New NHL');
    expect(res.body.goalie_min_regular_minutes).toBe(240);
    const queryValues = sql.mock.calls[0].slice(1);
    expect(queryValues).toContain(240);
  });

  it('rejects invalid goalie minimum minutes on update', async () => {
    const res = await request(app).patch('/api/admin/leagues/league-1')
      .send({ goalie_min_regular_minutes: 'abc' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when not found', async () => {
    sql.mockResolvedValueOnce([]);
    const res = await request(app).patch('/api/admin/leagues/nope').send({ name: 'X' });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Draft dates
// ---------------------------------------------------------------------------
describe('league draft dates', () => {
  const DRAFT_DATE = {
    id: 'draft-date-1',
    league_id: 'league-1',
    draft_year: 2026,
    start_round: 1,
    end_round: 2,
    draft_date: '2026-06-26',
    notes: null,
    created_at: new Date().toISOString(),
  };
  const DRAFT_EVENT_PAYLOAD = {
    draft_year: 2026,
    start_date: '2026-06-26',
    end_date: '2026-06-27',
    total_rounds: 7,
    days: [
      { draft_date: '2026-06-26', start_round: 1, end_round: 1 },
      { draft_date: '2026-06-27', start_round: 2, end_round: 7 },
    ],
  };

  it('lists draft date round ranges for a league', async () => {
    sql.mockResolvedValueOnce([DRAFT_DATE]);

    const res = await request(app).get('/api/admin/leagues/league-1/draft-dates');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([DRAFT_DATE]);
    expect(sql.mock.calls[0][0].join(' ')).toContain('FROM league_draft_dates');
  });

  it('creates a draft date when the round range does not overlap', async () => {
    sql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([DRAFT_DATE]);

    const res = await request(app)
      .post('/api/admin/leagues/league-1/draft-dates')
      .send({
        draft_year: 2026,
        start_round: 1,
        end_round: 2,
        draft_date: '2026-06-26',
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(DRAFT_DATE);
  });

  it('creates a draft event with one saved row per draft day', async () => {
    const dayOne = { ...DRAFT_DATE, start_round: 1, end_round: 1, draft_date: '2026-06-26' };
    const dayTwo = {
      ...DRAFT_DATE,
      id: 'draft-date-2',
      start_round: 2,
      end_round: 7,
      draft_date: '2026-06-27',
    };
    sql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([dayOne])
      .mockResolvedValueOnce([dayTwo]);

    const res = await request(app)
      .post('/api/admin/leagues/league-1/draft-dates/events')
      .send(DRAFT_EVENT_PAYLOAD);

    expect(res.status).toBe(201);
    expect(res.body).toEqual([dayOne, dayTwo]);
  });

  it('creates a one-day draft event', async () => {
    const oneDayPayload = {
      draft_year: 2026,
      start_date: '2026-06-26',
      end_date: '2026-06-26',
      total_rounds: 7,
      days: [{ draft_date: '2026-06-26', start_round: 1, end_round: 7 }],
    };
    sql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...DRAFT_DATE, end_round: 7 }]);

    const res = await request(app)
      .post('/api/admin/leagues/league-1/draft-dates/events')
      .send(oneDayPayload);

    expect(res.status).toBe(201);
    expect(res.body[0].end_round).toBe(7);
  });

  it('rejects draft events that reuse a previous day round range', async () => {
    const res = await request(app)
      .post('/api/admin/leagues/league-1/draft-dates/events')
      .send({
        ...DRAFT_EVENT_PAYLOAD,
        days: [
          { draft_date: '2026-06-26', start_round: 1, end_round: 3 },
          { draft_date: '2026-06-27', start_round: 3, end_round: 7 },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/continuous and non-overlapping/i);
    expect(sql).not.toHaveBeenCalled();
  });

  it('replaces all rows for an existing draft event', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'existing-draft-date' }])
      .mockResolvedValueOnce([{ id: 'deleted-draft-date' }])
      .mockResolvedValueOnce([{ ...DRAFT_DATE, end_round: 7 }]);

    const res = await request(app)
      .put('/api/admin/leagues/league-1/draft-dates/events/2026')
      .send({
        draft_year: 2026,
        start_date: '2026-06-26',
        end_date: '2026-06-26',
        total_rounds: 7,
        days: [{ draft_date: '2026-06-26', start_round: 1, end_round: 7 }],
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].end_round).toBe(7);
  });

  it('rejects overlapping draft date ranges', async () => {
    sql.mockResolvedValueOnce([{ id: 'existing' }]);

    const res = await request(app)
      .post('/api/admin/leagues/league-1/draft-dates')
      .send({
        draft_year: 2026,
        start_round: 2,
        end_round: 4,
        draft_date: '2026-06-27',
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/overlaps/i);
  });

  it('rejects invalid draft date payloads', async () => {
    const res = await request(app)
      .post('/api/admin/leagues/league-1/draft-dates')
      .send({
        draft_year: 2026,
        start_round: 4,
        end_round: 2,
        draft_date: '2026-06-26',
      });

    expect(res.status).toBe(400);
    expect(sql).not.toHaveBeenCalled();
  });

  it('updates a draft date after checking overlap against other rows', async () => {
    sql
      .mockResolvedValueOnce([DRAFT_DATE])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...DRAFT_DATE, end_round: 3 }]);

    const res = await request(app)
      .patch('/api/admin/leagues/league-1/draft-dates/draft-date-1')
      .send({ end_round: 3 });

    expect(res.status).toBe(200);
    expect(res.body.end_round).toBe(3);
  });

  it('deletes a draft date', async () => {
    sql.mockResolvedValueOnce([{ id: 'draft-date-1' }]);

    const res = await request(app).delete(
      '/api/admin/leagues/league-1/draft-dates/draft-date-1',
    );

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/removed/i);
  });

  it('deletes all rows for a draft event', async () => {
    sql.mockResolvedValueOnce([{ id: 'draft-date-1' }, { id: 'draft-date-2' }]);

    const res = await request(app).delete(
      '/api/admin/leagues/league-1/draft-dates/events/2026',
    );

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/leagues/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/admin/leagues/:id', () => {
  it('returns 200 on success', async () => {
    sql.mockResolvedValueOnce([{ id: 'league-1' }]);
    const res = await request(app).delete('/api/admin/leagues/league-1');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });

  it('returns 404 when not found', async () => {
    sql.mockResolvedValueOnce([]);
    const res = await request(app).delete('/api/admin/leagues/nope');
    expect(res.status).toBe(404);
  });
});
