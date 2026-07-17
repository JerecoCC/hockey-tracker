'use strict';

jest.mock('../db', () => ({ sql: jest.fn() }));

const { sql } = require('../db');

const {
  getGoogleCalendarAuthorizationUrl,
  _private: {
    decryptRefreshToken,
    encryptRefreshToken,
    calendarGameSelect,
    eventForGame,
    eventIdForGame,
    googleRequest,
    upsertGameEvent,
  },
} = require('./googleCalendar');

const originalFetch = global.fetch;
const mockGoogleResponse = (status, body = null) => ({
  status,
  ok: status >= 200 && status < 300,
  text: jest.fn().mockResolvedValue(body == null ? '' : JSON.stringify(body)),
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GOOGLE_CLIENT_ID = 'client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
  process.env.GOOGLE_CALENDAR_CALLBACK_URL =
    'http://localhost:5000/api/user/calendar/google/callback';
  process.env.GOOGLE_CALENDAR_TOKEN_SECRET = 'test-calendar-token-secret-at-least-32-chars';
  process.env.CLIENT_URL = 'http://localhost:5173';
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('Google Calendar service helpers', () => {
  it('encrypts refresh tokens with authenticated encryption', () => {
    const encrypted = encryptRefreshToken('refresh-token-value');

    expect(encrypted).toMatch(/^v1:/);
    expect(encrypted).not.toContain('refresh-token-value');
    expect(decryptRefreshToken(encrypted)).toBe('refresh-token-value');
  });

  it('builds a least-privilege offline OAuth URL', () => {
    const url = new URL(
      getGoogleCalendarAuthorizationUrl({
        state: 'signed-state',
        loginHint: 'fan@example.com',
      }),
    );

    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('scope')).toBe(
      'https://www.googleapis.com/auth/calendar.app.created',
    );
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('state')).toBe('signed-state');
  });

  it('classifies a disabled Calendar API response for an actionable callback error', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockGoogleResponse(403, {
        error: {
          code: 403,
          status: 'PERMISSION_DENIED',
          message: 'Google Calendar API has not been used in this project or is disabled.',
          details: [
            {
              '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
              reason: 'SERVICE_DISABLED',
              domain: 'googleapis.com',
            },
          ],
        },
      }),
    );

    await expect(
      googleRequest('https://www.googleapis.com/calendar/v3/calendars', {
        accessToken: 'access-token',
      }),
    ).rejects.toMatchObject({
      status: 403,
      code: 'calendar_api_disabled',
    });
  });

  it('creates a stable valid event id and an all-day event with an exclusive end date', () => {
    const game = {
      id: 'game-1',
      calendar_date: '2026-12-31',
      away_code: 'AWY',
      home_code: 'HOM',
      league_code: 'NHL',
    };

    const event = eventForGame({ userId: 'user-1', game });

    expect(event.id).toBe(eventIdForGame('user-1', 'game-1'));
    expect(event.id).toMatch(/^ht[0-9a-f]{64}$/);
    expect(event.status).toBe('confirmed');
    expect(event.summary).toBe('AWY @ HOM · NHL');
    expect(event.start).toEqual({ date: '2026-12-31' });
    expect(event.end).toEqual({ date: '2027-01-01' });
    expect(event.extendedProperties.private).toMatchObject({
      hockeyTrackerManaged: 'true',
      hockeyTrackerGameId: 'game-1',
    });
  });

  it('selects favorite-team games on their original date and lets a watch date override it', () => {
    calendarGameSelect('user-1');

    const queryText = sql.mock.calls[0][0].join(' ').replace(/\s+/g, ' ');
    expect(queryText).toContain('FROM games g');
    expect(queryText).toContain('FROM user_favorite_teams uft');
    expect(queryText).toContain('COALESCE( uwg.scheduled_for');
    expect(queryText).toContain("g.scheduled_at AT TIME ZONE 'America/New_York'");
    expect(queryText).toContain('uwg.skipped_at IS NULL');
    expect(queryText).not.toContain('uwg.scheduled_for IS NOT NULL AND uwg.skipped_at IS NULL');
  });

  it('restores a cancelled deterministic event when the game is scheduled again', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        mockGoogleResponse(200, {
          id: eventIdForGame('user-1', 'game-1'),
          status: 'cancelled',
        }),
      )
      .mockResolvedValueOnce(mockGoogleResponse(200, { status: 'confirmed' }));

    await upsertGameEvent({
      accessToken: 'access-token',
      calendarId: 'calendar-1',
      userId: 'user-1',
      game: {
        id: 'game-1',
        calendar_date: '2026-12-31',
        away_code: 'AWY',
        home_code: 'HOM',
        league_code: 'NHL',
      },
    });

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/events/ht'),
      expect.objectContaining({ method: 'GET' }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/events/ht'),
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('"status":"confirmed"'),
      }),
    );
  });
});
