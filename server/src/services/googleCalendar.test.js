'use strict';

jest.mock('../db', () => ({ sql: jest.fn() }));

const { sql } = require('../db');

const {
  getGoogleCalendarAuthorizationUrl,
  normalizeGoogleCalendarTimeZone,
  syncAllScheduledGamesForUser,
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

  it('creates a stable valid event id and a timed three-hour event in Eastern Time', () => {
    const game = {
      id: 'game-1',
      calendar_date: '2026-12-31',
      scheduled_time: '19:30',
      away_code: 'AWY',
      home_code: 'HOM',
      league_code: 'NHL',
    };

    const event = eventForGame({ userId: 'user-1', game });

    expect(event.id).toBe(eventIdForGame('user-1', 'game-1'));
    expect(event.id).toMatch(/^ht[0-9a-f]{64}$/);
    expect(event.status).toBe('confirmed');
    expect(event.summary).toBe('AWY @ HOM · NHL');
    expect(event.start).toEqual({
      dateTime: '2026-12-31T19:30:00',
      timeZone: 'America/New_York',
    });
    expect(event.end).toEqual({
      dateTime: '2026-12-31T22:30:00',
      timeZone: 'America/New_York',
    });
    expect(event.extendedProperties.private).toMatchObject({
      hockeyTrackerManaged: 'true',
      hockeyTrackerGameId: 'game-1',
    });
  });

  it('rolls a late timed event end into the next date', () => {
    const event = eventForGame({
      userId: 'user-1',
      game: {
        id: 'game-1',
        calendar_date: '2026-12-31',
        scheduled_time: '23:30',
      },
    });

    expect(event.start.dateTime).toBe('2026-12-31T23:30:00');
    expect(event.end.dateTime).toBe('2027-01-01T02:30:00');
  });

  it('converts the original game instant to the user timezone', () => {
    const event = eventForGame({
      userId: 'user-1',
      timeZone: 'Asia/Manila',
      game: {
        id: 'game-1',
        game_date: '2026-12-31',
        calendar_date: '2026-12-31',
        scheduled_time: '19:30',
      },
    });

    expect(event.start).toEqual({
      dateTime: '2027-01-01T08:30:00',
      timeZone: 'Asia/Manila',
    });
    expect(event.end).toEqual({
      dateTime: '2027-01-01T11:30:00',
      timeZone: 'Asia/Manila',
    });
  });

  it('keeps a moved watch date on the chosen user-local day', () => {
    const event = eventForGame({
      userId: 'user-1',
      timeZone: 'Asia/Manila',
      game: {
        id: 'game-1',
        game_date: '2026-12-31',
        calendar_date: '2027-01-05',
        scheduled_for: '2027-01-05',
        scheduled_time: '19:30',
      },
    });

    expect(event.start).toEqual({
      dateTime: '2027-01-05T08:30:00',
      timeZone: 'Asia/Manila',
    });
  });

  it('rejects invalid IANA timezones', () => {
    expect(() => normalizeGoogleCalendarTimeZone('Mars/Olympus_Mons')).toThrow(
      'Invalid calendar time zone',
    );
  });

  it('keeps games without a known scheduled time as all-day events', () => {
    const event = eventForGame({
      userId: 'user-1',
      game: {
        id: 'game-1',
        calendar_date: '2026-12-31',
      },
    });

    expect(event.start).toEqual({ date: '2026-12-31' });
    expect(event.end).toEqual({ date: '2027-01-01' });
  });

  it('selects favorite-team games from the closest non-ended season', () => {
    calendarGameSelect('user-1');

    const queryText = sql.mock.calls[0][0].join(' ').replace(/\s+/g, ' ');
    expect(queryText).toContain('WITH closest_open_season AS');
    expect(queryText).toContain('WHERE candidate.is_ended = FALSE');
    expect(queryText).toContain('FROM games candidate_game');
    expect(queryText).toContain('JOIN user_favorite_teams candidate_favorite');
    expect(queryText).toContain('WHERE candidate_game.season_id = candidate.id');
    expect(queryText).toContain('candidate.start_date <= CURRENT_DATE');
    expect(queryText).toContain('CURRENT_DATE < candidate.start_date');
    expect(queryText).toContain('LIMIT 1');
    expect(queryText).toContain('FROM games g');
    expect(queryText).toContain('g.season_id = (SELECT id FROM closest_open_season)');
    expect(queryText).toContain('FROM user_favorite_teams uft');
    expect(queryText).toContain('COALESCE( uwg.scheduled_for');
    expect(queryText).toContain('END::text AS game_date');
    expect(queryText).toContain('uwg.scheduled_for::text AS scheduled_for');
    expect(queryText).toContain("g.scheduled_at AT TIME ZONE 'America/New_York'");
    expect(queryText).toContain("NULLIF(BTRIM(g.scheduled_time), '')");
    expect(queryText).toContain(
      "TO_CHAR(g.scheduled_at AT TIME ZONE 'America/New_York', 'HH24:MI')",
    );
    expect(queryText).toContain('uwg.skipped_at IS NULL');
    expect(queryText).not.toContain('uwg.scheduled_for IS NOT NULL OR EXISTS');
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

  it('reports completed upserts and removals during a full sync', async () => {
    const onProgress = jest.fn();
    sql
      .mockResolvedValueOnce([
        {
          id: 'game-1',
          calendar_date: '2026-12-31',
          scheduled_time: '19:30',
          away_code: 'AWY',
          home_code: 'HOM',
          league_code: 'NHL',
        },
      ])
      .mockResolvedValueOnce([]);
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        mockGoogleResponse(200, {
          items: [
            {
              extendedProperties: {
                private: { hockeyTrackerGameId: 'stale-game' },
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(mockGoogleResponse(200, { status: 'confirmed' }))
      .mockResolvedValueOnce(mockGoogleResponse(200, { status: 'confirmed' }))
      .mockResolvedValueOnce(mockGoogleResponse(204));

    await expect(
      syncAllScheduledGamesForUser('user-1', {
        connection: {
          calendar_id: 'calendar-1',
          refresh_token_encrypted: 'unused',
        },
        accessToken: 'access-token',
        onProgress,
      }),
    ).resolves.toEqual({ status: 'synced', synced: 1, removed: 1 });

    expect(onProgress).toHaveBeenCalledWith({
      step: 'sync',
      message: 'Synced AWY @ HOM',
      completed: 1,
      total: 2,
    });
    expect(onProgress).toHaveBeenCalledWith({
      step: 'remove',
      message: 'Removed stale game 1',
      completed: 2,
      total: 2,
    });
    expect(onProgress).toHaveBeenLastCalledWith({
      step: 'complete',
      message: 'Google Calendar is up to date.',
      completed: 2,
      total: 2,
    });
  });
});
