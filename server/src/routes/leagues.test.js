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
  best_of_playoff: 7, best_of_shootout: 3,
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
      .send({ name: 'NHL', code: 'nhl' });
    expect(res.status).toBe(201);
    expect(res.body.code).toBe('NHL');
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
    sql.mockResolvedValueOnce([{ ...LEAGUE, name: 'New NHL' }]);
    const res = await request(app).patch('/api/admin/leagues/league-1')
      .send({ name: 'New NHL' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New NHL');
  });

  it('returns 404 when not found', async () => {
    sql.mockResolvedValueOnce([]);
    const res = await request(app).patch('/api/admin/leagues/nope').send({ name: 'X' });
    expect(res.status).toBe(404);
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
