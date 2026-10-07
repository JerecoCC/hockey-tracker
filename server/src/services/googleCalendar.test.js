'use strict';

jest.mock('../db', () => ({ sql: jest.fn() }));

const { sql } = require('../db');

const {
  getGoogleCalendarAuthorizationUrl,
  getGoogleCalendarStatus,
  normalizeGoogleCalendarTimeZone,
  syncAllScheduledGamesForUser,
  syncScheduledGameToGoogleCalendar,
  _private: {
    decryptRefreshToken,
    encryptRefreshToken,
    calendarGameSelect,
    eventForGame,
    eventIdForGame,
    googleRequest,
    gameIsAfterToday,
    gameIsInSyncWindow,
    refreshAccessToken,
    upsertGameEvent,
  },
} = require('./googleCalendar');

const originalFetch = global.fetch;
const PAST_WATCHED_GAME = {
  id: 'watched-game',
  game_date: '2025-12-30',
  calendar_date: '2025-12-30',
  scheduled_time: '19:30',
  away_code: 'OLD',
  home_code: 'WAT',
  league_code: 'NHL',
};
const mockGoogleResponse = (status, body = null, headers = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: {
    get: jest.fn((name) => headers[String(name).toLowerCase()] ?? null),
  },
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

  it('retries Calendar rate limits returned as 403 responses', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        mockGoogleResponse(
          403,
          {
            error: {
              code: 403,
              message: 'Rate Limit Exceeded',
            },
          },
          { 'retry-after': '0' },
        ),
      )
      .mockResolvedValueOnce(mockGoogleResponse(200, { items: [] }));

    await expect(
      googleRequest('https://www.googleapis.com/calendar/v3/calendars/calendar-1/events', {
        accessToken: 'access-token',
      }),
    ).resolves.toEqual({ items: [] });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('turns a rejected refresh token into a reconnect-required error', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockGoogleResponse(400, {
        error: 'invalid_grant',
        error_description: 'Bad Request',
      }),
    );

    await expect(
      refreshAccessToken(encryptRefreshToken('expired-refresh-token')),
    ).rejects.toMatchObject({
      status: 401,
      code: 'reauthorization_required',
      message:
        'Google Calendar authorization has expired. Reconnect Google Calendar to continue syncing.',
    });
  });

  it('reports when a saved connection requires Google reauthorization', async () => {
    sql.mockResolvedValueOnce([
      {
        calendar_id: 'calendar-1',
        calendar_name: 'Hockey Tracker',
        time_zone: 'Asia/Manila',
        last_sync_error:
          'Google Calendar authorization has expired. Reconnect Google Calendar to continue syncing.',
      },
    ]);

    await expect(getGoogleCalendarStatus('user-1')).resolves.toMatchObject({
      connected: true,
      reauthorization_required: true,
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

  it('syncs a custom watch date as an all-day event without the original game time', () => {
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

    expect(event.start).toEqual({ date: '2027-01-05' });
    expect(event.end).toEqual({ date: '2027-01-06' });
    expect(event.start).not.toHaveProperty('dateTime');
    expect(event.start).not.toHaveProperty('timeZone');
    expect(event.description).toContain('Original game date: January 1, 2027.');
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

  it('only treats event dates after today in the user timezone as syncable', () => {
    const now = new Date('2027-01-01T01:00:00Z');

    expect(
      gameIsAfterToday(
        {
          game_date: '2026-12-31',
          calendar_date: '2026-12-31',
          scheduled_time: '19:30',
        },
        'Asia/Manila',
        now,
      ),
    ).toBe(false);
    expect(
      gameIsAfterToday(
        {
          game_date: '2026-12-31',
          calendar_date: '2027-01-02',
          scheduled_for: '2027-01-02',
          scheduled_time: '19:30',
        },
        'Asia/Manila',
        now,
      ),
    ).toBe(true);
  });

  it('selects favorite-team games from the closest open season and all custom schedules', () => {
    calendarGameSelect('user-1');

    const queryText = sql.mock.calls[0][0].join(' ').replace(/\s+/g, ' ');
    expect(queryText).toContain('WITH closest_open_season AS');
    expect(queryText).toContain('WHERE candidate.is_ended = FALSE');
    expect(queryText).toContain('FROM games candidate_game');
    expect(queryText).toContain('JOIN user_favorite_teams candidate_favorite');
    expect(queryText).toContain('WHERE candidate_game.season_id = candidate.id');
    expect(queryText).toContain('candidate.start_date <= CURRENT_DATE');
    expect(queryText).toContain('CURRENT_DATE < candidate.start_date');
    expect(queryText).toContain('FROM games g');
    expect(queryText).toContain(
      'uwg.scheduled_for IS NOT NULL OR ( g.season_id IN (SELECT id FROM closest_open_season)',
    );
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
  });

  it('restores a cancelled deterministic event when the game is scheduled again', async () => {
    global.fetch = jest
      .fn()
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
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('"status":"confirmed"'),
      }),
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
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
        {
          id: 'game-today',
          game_date: '2026-01-01',
          calendar_date: '2026-01-01',
          scheduled_for: '2026-01-01',
          scheduled_time: '19:30',
          away_code: 'TDY',
          home_code: 'NOW',
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
              id: eventIdForGame('user-1', 'game-1'),
              extendedProperties: {
                private: { hockeyTrackerGameId: 'stale-game' },
              },
            },
          ],
        }),
      )
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
        now: new Date('2026-01-01T17:00:00Z'),
        writeIntervalMs: 0,
      }),
    ).resolves.toEqual({ status: 'synced', synced: 1, removed: 1 });

    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/events/ht'),
      expect.objectContaining({ method: 'PUT' }),
    );

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

  it('keeps events for past games that still match the calendar during a full sync', async () => {
    sql
      .mockResolvedValueOnce([PAST_WATCHED_GAME])
      .mockResolvedValueOnce([]);
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        mockGoogleResponse(200, {
          items: [
            {
              id: eventIdForGame('user-1', 'watched-game'),
              extendedProperties: { private: { hockeyTrackerGameId: 'watched-game' } },
            },
            {
              id: eventIdForGame('user-1', 'skipped-game'),
              extendedProperties: { private: { hockeyTrackerGameId: 'skipped-game' } },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(mockGoogleResponse(204));

    await expect(
      syncAllScheduledGamesForUser('user-1', {
        connection: { calendar_id: 'calendar-1', refresh_token_encrypted: 'unused' },
        accessToken: 'access-token',
        now: new Date('2026-01-01T17:00:00Z'),
        writeIntervalMs: 0,
      }),
    ).resolves.toEqual({ status: 'synced', synced: 0, removed: 1 });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining(`/events/${eventIdForGame('user-1', 'skipped-game')}`),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  describe('single game sync', () => {
    const connection = () => ({
      calendar_id: 'calendar-1',
      time_zone: 'America/New_York',
      refresh_token_encrypted: encryptRefreshToken('refresh-token'),
    });

    it('leaves the event for a past game that still matches the calendar', async () => {
      sql
        .mockResolvedValueOnce([connection()])
        .mockResolvedValueOnce([PAST_WATCHED_GAME])
        .mockResolvedValueOnce([]);
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(mockGoogleResponse(200, { access_token: 'access-token' }));

      await expect(
        syncScheduledGameToGoogleCalendar({
          userId: 'user-1',
          gameId: 'watched-game',
          now: new Date('2026-01-01T17:00:00Z'),
        }),
      ).resolves.toEqual({ status: 'synced' });
      // Only the token refresh — no DELETE for the watched game.
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('deletes the event when the game no longer matches the calendar', async () => {
      sql
        .mockResolvedValueOnce([connection()])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(mockGoogleResponse(200, { access_token: 'access-token' }))
        .mockResolvedValueOnce(mockGoogleResponse(204));

      await syncScheduledGameToGoogleCalendar({
        userId: 'user-1',
        gameId: 'skipped-game',
        now: new Date('2026-01-01T17:00:00Z'),
      });
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining(`/events/${eventIdForGame('user-1', 'skipped-game')}`),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });
});

describe('calendarGameSelect seasons', () => {
  it('takes the closest open season in each league, not one across all leagues', async () => {
    sql.mockResolvedValueOnce([]);
    await calendarGameSelect('user-1');

    const query = sql.mock.calls[0][0].join('?');
    expect(query).toContain('SELECT DISTINCT ON (candidate.league_id) candidate.id');
    expect(query).toContain('g.season_id IN (SELECT id FROM closest_open_season)');
    const seasonCte = query.slice(query.indexOf('WITH closest_open_season'), query.indexOf('SELECT\n    g.id'));
    expect(seasonCte).toContain('ORDER BY');
    expect(seasonCte).not.toContain('LIMIT 1');
  });
});

describe('gameIsInSyncWindow', () => {
  const now = new Date('2026-10-07T16:00:00Z');
  const seasonGame = (gameDate, seasonEnd) => ({
    id: 'game-1',
    has_season: true,
    season_end_date: seasonEnd,
    game_date: gameDate,
    calendar_date: gameDate,
    scheduled_time: null,
  });

  it('syncs past games of a season that has not ended yet', () => {
    expect(gameIsInSyncWindow(seasonGame('2026-09-19', '2027-06-30'), 'America/New_York', now)).toBe(true);
  });

  it('syncs through the season end date, then stops', () => {
    expect(gameIsInSyncWindow(seasonGame('2026-04-01', '2026-10-07'), 'America/New_York', now)).toBe(true);
    expect(gameIsInSyncWindow(seasonGame('2026-04-01', '2026-10-06'), 'America/New_York', now)).toBe(false);
  });

  it('keeps syncing a season without an end date', () => {
    expect(gameIsInSyncWindow(seasonGame('2026-01-01', null), 'America/New_York', now)).toBe(true);
  });

  it('only syncs games without a season from today on', () => {
    const game = { ...seasonGame('2026-10-01', null), has_season: false };
    expect(gameIsInSyncWindow(game, 'America/New_York', now)).toBe(false);
    expect(gameIsInSyncWindow({ ...game, calendar_date: '2026-10-09', game_date: '2026-10-09' }, 'America/New_York', now)).toBe(true);
  });
});
