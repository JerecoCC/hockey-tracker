'use strict';

jest.mock('../middleware/auth', () => ({
  requireAuth: (req, _res, next) => {
    req.user = { id: 'user-1', email: 'fan@example.com', role: 'user' };
    next();
  },
  signGoogleCalendarState: jest.fn(() => 'signed-state'),
  verifyGoogleCalendarState: jest.fn(() => ({
    userId: 'user-1',
    nonce: 'nonce-1',
  })),
}));

jest.mock('../services/googleCalendar', () => {
  class GoogleCalendarError extends Error {
    constructor(message, { status = 500, code = 'google_calendar_error' } = {}) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
  return {
    GoogleCalendarError,
    connectGoogleCalendar: jest.fn().mockResolvedValue({ connected: true }),
    disconnectGoogleCalendar: jest.fn().mockResolvedValue({ disconnected: true }),
    getGoogleCalendarAuthorizationUrl: jest.fn(() => 'https://accounts.google.com/connect'),
    getGoogleCalendarStatus: jest.fn().mockResolvedValue({
      configured: true,
      connected: false,
      calendar_name: null,
      connected_at: null,
      last_synced_at: null,
      last_sync_error: null,
    }),
    syncAllScheduledGamesForUser: jest
      .fn()
      .mockResolvedValue({ status: 'synced', synced: 2, removed: 1 }),
  };
});

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const { signGoogleCalendarState, verifyGoogleCalendarState } = require('../middleware/auth');
const {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  getGoogleCalendarAuthorizationUrl,
  getGoogleCalendarStatus,
  syncAllScheduledGamesForUser,
} = require('../services/googleCalendar');
const googleCalendarRouter = require('./google-calendar');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/user/calendar/google', googleCalendarRouter);

afterEach(() => jest.clearAllMocks());

describe('Google Calendar routes', () => {
  it('returns the current connection status', async () => {
    const res = await request(app).get('/api/user/calendar/google');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ configured: true, connected: false });
    expect(getGoogleCalendarStatus).toHaveBeenCalledWith('user-1');
  });

  it('starts a cookie-bound OAuth flow', async () => {
    const res = await request(app).post('/api/user/calendar/google/connect');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      authorization_url: 'https://accounts.google.com/connect',
    });
    expect(signGoogleCalendarState).toHaveBeenCalledWith({
      userId: 'user-1',
      nonce: expect.any(String),
    });
    expect(getGoogleCalendarAuthorizationUrl).toHaveBeenCalledWith({
      state: 'signed-state',
      loginHint: 'fan@example.com',
    });
    expect(res.headers['set-cookie'][0]).toContain('google_calendar_oauth_state=');
    expect(res.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(res.headers['set-cookie'][0]).toContain('SameSite=Lax');
  });

  it('connects after validating the callback state and cookie', async () => {
    const res = await request(app)
      .get('/api/user/calendar/google/callback?code=oauth-code&state=signed-state')
      .set('Cookie', 'google_calendar_oauth_state=nonce-1');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('http://localhost:5173/games?google_calendar=connected');
    expect(verifyGoogleCalendarState).toHaveBeenCalledWith('signed-state');
    expect(connectGoogleCalendar).toHaveBeenCalledWith({
      userId: 'user-1',
      code: 'oauth-code',
    });
  });

  it('rejects a callback whose state does not match the browser cookie', async () => {
    const res = await request(app)
      .get('/api/user/calendar/google/callback?code=oauth-code&state=signed-state')
      .set('Cookie', 'google_calendar_oauth_state=wrong-nonce');

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('google_calendar=error');
    expect(res.headers.location).toContain('reason=state_mismatch');
    expect(connectGoogleCalendar).not.toHaveBeenCalled();
  });

  it('runs a full reconciliation on demand', async () => {
    const res = await request(app).post('/api/user/calendar/google/sync');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'synced', synced: 2, removed: 1 });
    expect(syncAllScheduledGamesForUser).toHaveBeenCalledWith('user-1');
  });

  it('streams real reconciliation progress when requested', async () => {
    syncAllScheduledGamesForUser.mockImplementationOnce(async (_userId, { onProgress }) => {
      onProgress({
        step: 'sync',
        message: 'Synced AWY @ HOM',
        completed: 1,
        total: 2,
      });
      return { status: 'synced', synced: 2, removed: 0 };
    });

    const res = await request(app)
      .post('/api/user/calendar/google/sync')
      .set('Accept', 'application/x-ndjson');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/x-ndjson');
    expect(res.text.trim().split('\n').map(JSON.parse)).toEqual([
      {
        type: 'progress',
        progress: {
          step: 'sync',
          message: 'Synced AWY @ HOM',
          completed: 1,
          total: 2,
        },
      },
      {
        type: 'result',
        result: { status: 'synced', synced: 2, removed: 0 },
      },
    ]);
    expect(syncAllScheduledGamesForUser).toHaveBeenCalledWith('user-1', {
      onProgress: expect.any(Function),
    });
  });

  it('disconnects and removes the app calendar', async () => {
    const res = await request(app).delete('/api/user/calendar/google');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ disconnected: true });
    expect(disconnectGoogleCalendar).toHaveBeenCalledWith('user-1');
  });
});
