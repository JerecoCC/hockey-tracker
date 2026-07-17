const crypto = require('crypto');
const { sql } = require('../db');

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';
const DEFAULT_CALENDAR_NAME = 'Hockey Tracker';

class GoogleCalendarError extends Error {
  constructor(message, { status = 500, code = 'google_calendar_error', details = null } = {}) {
    super(message);
    this.name = 'GoogleCalendarError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const getCallbackUrl = () =>
  (
    process.env.GOOGLE_CALENDAR_CALLBACK_URL ||
    'http://localhost:5000/api/user/calendar/google/callback'
  ).trim();

const getEncryptionSecret = () => (process.env.GOOGLE_CALENDAR_TOKEN_SECRET || '').trim();

const isGoogleCalendarConfigured = () =>
  Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
    process.env.GOOGLE_CLIENT_SECRET?.trim() &&
      getCallbackUrl() &&
      getEncryptionSecret().length >= 32,
  );

const requireGoogleCalendarConfig = () => {
  if (!isGoogleCalendarConfigured()) {
    throw new GoogleCalendarError('Google Calendar sync is not configured', {
      status: 503,
      code: 'not_configured',
    });
  }
};

const tokenEncryptionKey = () =>
  crypto.createHash('sha256').update(getEncryptionSecret(), 'utf8').digest();

const encryptRefreshToken = (token) => {
  requireGoogleCalendarConfig();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', tokenEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
};

const decryptRefreshToken = (encrypted) => {
  requireGoogleCalendarConfig();
  const [version, ivValue, tagValue, ciphertextValue] = String(encrypted || '').split(':');
  if (version !== 'v1' || !ivValue || !tagValue || !ciphertextValue) {
    throw new GoogleCalendarError('Stored Google Calendar credentials are invalid', {
      code: 'invalid_credentials',
    });
  }
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      tokenEncryptionKey(),
      Buffer.from(ivValue, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new GoogleCalendarError('Stored Google Calendar credentials could not be decrypted', {
      code: 'invalid_credentials',
    });
  }
};

const readJsonResponse = async (response) => {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const getGoogleApiErrorCode = (data) => {
  const reasons = Array.isArray(data?.error?.details)
    ? data.error.details
        .map((detail) => detail?.reason)
        .filter((reason) => typeof reason === 'string')
    : [];

  if (reasons.includes('SERVICE_DISABLED')) return 'calendar_api_disabled';
  if (reasons.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT')) {
    return 'insufficient_calendar_scope';
  }
  return data?.error?.status || 'calendar_api_error';
};

const googleRequest = async (url, { accessToken, method = 'GET', body } = {}) => {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await readJsonResponse(response);
  if (!response.ok) {
    throw new GoogleCalendarError(
      data?.error?.message || data?.message || 'Google Calendar request failed',
      {
        status: response.status,
        code: getGoogleApiErrorCode(data),
        details: data,
      },
    );
  }
  return data;
};

const postTokenRequest = async (params) => {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const data = await readJsonResponse(response);
  if (!response.ok) {
    throw new GoogleCalendarError(data?.error_description || 'Google OAuth token exchange failed', {
      status: 502,
      code: data?.error || 'oauth_token_error',
      details: data,
    });
  }
  return data;
};

const getGoogleCalendarAuthorizationUrl = ({ state, loginHint } = {}) => {
  requireGoogleCalendarConfig();
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID.trim(),
    redirect_uri: getCallbackUrl(),
    response_type: 'code',
    scope: GOOGLE_CALENDAR_SCOPE,
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
  });
  if (loginHint) params.set('login_hint', loginHint);
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
};

const exchangeAuthorizationCode = (code) =>
  postTokenRequest({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID.trim(),
    client_secret: process.env.GOOGLE_CLIENT_SECRET.trim(),
    redirect_uri: getCallbackUrl(),
    grant_type: 'authorization_code',
  });

const refreshAccessToken = async (encryptedRefreshToken) => {
  requireGoogleCalendarConfig();
  const data = await postTokenRequest({
    client_id: process.env.GOOGLE_CLIENT_ID.trim(),
    client_secret: process.env.GOOGLE_CLIENT_SECRET.trim(),
    refresh_token: decryptRefreshToken(encryptedRefreshToken),
    grant_type: 'refresh_token',
  });
  if (!data.access_token) {
    throw new GoogleCalendarError('Google did not return an access token', {
      status: 502,
      code: 'missing_access_token',
    });
  }
  return data.access_token;
};

const addOneDay = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().slice(0, 10);
};

const eventIdForGame = (userId, gameId) =>
  `ht${crypto.createHash('sha256').update(`${userId}:${gameId}`, 'utf8').digest('hex')}`;

const eventForGame = ({ userId, game }) => {
  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').trim().replace(/\/$/, '');
  const matchup = `${game.away_code || 'Away'} @ ${game.home_code || 'Home'}`;
  return {
    id: eventIdForGame(userId, game.id),
    status: 'confirmed',
    summary: game.league_code ? `${matchup} · ${game.league_code}` : matchup,
    description: `Game synced from Hockey Tracker.\n\n${clientUrl}/games/${game.id}`,
    start: { date: game.calendar_date },
    end: { date: addOneDay(game.calendar_date) },
    transparency: 'transparent',
    source: {
      title: 'Hockey Tracker',
      url: `${clientUrl}/games/${game.id}`,
    },
    extendedProperties: {
      private: {
        hockeyTrackerManaged: 'true',
        hockeyTrackerGameId: game.id,
      },
    },
  };
};

const calendarUrl = (calendarId, suffix = '') =>
  `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}${suffix}`;

const createAppCalendar = async (accessToken) =>
  googleRequest(`${GOOGLE_CALENDAR_API}/calendars`, {
    accessToken,
    method: 'POST',
    body: {
      summary: DEFAULT_CALENDAR_NAME,
      description: 'Watch dates synced from Hockey Tracker.',
    },
  });

const calendarIsAccessible = async (accessToken, calendarId) => {
  try {
    await googleRequest(calendarUrl(calendarId), { accessToken });
    return true;
  } catch (err) {
    if (err instanceof GoogleCalendarError && [404, 410].includes(err.status)) {
      return false;
    }
    throw err;
  }
};

const upsertGameEvent = async ({ accessToken, calendarId, userId, game }) => {
  const event = eventForGame({ userId, game });
  const eventUrl = calendarUrl(calendarId, `/events/${encodeURIComponent(event.id)}`);
  try {
    // Google keeps deleted organizer events as cancelled tombstones. GET still
    // returns those events, and a full update with status=confirmed restores
    // them when a previously skipped game is scheduled again.
    await googleRequest(eventUrl, { accessToken });
    await googleRequest(eventUrl, { accessToken, method: 'PUT', body: event });
  } catch (err) {
    if (!(err instanceof GoogleCalendarError) || ![404, 410].includes(err.status)) throw err;
    try {
      await googleRequest(calendarUrl(calendarId, '/events'), {
        accessToken,
        method: 'POST',
        body: event,
      });
    } catch (insertErr) {
      if (!(insertErr instanceof GoogleCalendarError) || insertErr.status !== 409) throw insertErr;
      await googleRequest(eventUrl, { accessToken, method: 'PUT', body: event });
    }
  }
  return event.id;
};

const deleteGameEvent = async ({ accessToken, calendarId, userId, gameId }) => {
  try {
    await googleRequest(
      calendarUrl(calendarId, `/events/${encodeURIComponent(eventIdForGame(userId, gameId))}`),
      { accessToken, method: 'DELETE' },
    );
  } catch (err) {
    if (err instanceof GoogleCalendarError && [404, 410].includes(err.status)) return;
    throw err;
  }
};

const listManagedEvents = async ({ accessToken, calendarId }) => {
  const events = [];
  let pageToken = null;
  do {
    const params = new URLSearchParams({
      privateExtendedProperty: 'hockeyTrackerManaged=true',
      showDeleted: 'false',
      maxResults: '2500',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const data = await googleRequest(`${calendarUrl(calendarId, '/events')}?${params.toString()}`, {
      accessToken,
    });
    events.push(...(data?.items || []));
    pageToken = data?.nextPageToken || null;
  } while (pageToken);
  return events;
};

const getConnection = async (userId) => {
  const [connection] = await sql`
    SELECT
      calendar_id,
      calendar_name,
      refresh_token_encrypted,
      connected_at,
      updated_at,
      last_synced_at,
      last_sync_error
    FROM user_google_calendar_connections
    WHERE user_id = ${userId}
  `;
  return connection || null;
};

const getGoogleCalendarStatus = async (userId) => {
  const connection = await getConnection(userId);
  return {
    configured: isGoogleCalendarConfigured(),
    connected: Boolean(connection),
    calendar_name: connection?.calendar_name || null,
    connected_at: connection?.connected_at || null,
    last_synced_at: connection?.last_synced_at || null,
    last_sync_error: connection?.last_sync_error || null,
  };
};

const markSyncSuccess = (userId) => sql`
  UPDATE user_google_calendar_connections
  SET last_synced_at = NOW(), last_sync_error = NULL, updated_at = NOW()
  WHERE user_id = ${userId}
`;

const markSyncError = async (userId, err) => {
  const message = String(err?.message || 'Google Calendar sync failed').slice(0, 500);
  await sql`
    UPDATE user_google_calendar_connections
    SET last_sync_error = ${message}, updated_at = NOW()
    WHERE user_id = ${userId}
  `;
};

const calendarGameSelect = (userId, gameId = null) => sql`
  SELECT
    g.id,
    COALESCE(
      uwg.scheduled_for,
      CASE
        WHEN (g.scheduled_at AT TIME ZONE 'UTC')::time = TIME '00:00:00'
          THEN (g.scheduled_at AT TIME ZONE 'UTC')::date
        ELSE (g.scheduled_at AT TIME ZONE 'America/New_York')::date
      END
    )::text AS calendar_date,
    l.code AS league_code,
    COALESCE((
      SELECT ti.code
      FROM team_iterations ti
      WHERE ti.team_id = g.away_team_id
      ORDER BY (ti.season_id = g.season_id) DESC NULLS LAST, ti.recorded_at DESC
      LIMIT 1
    ), 'Away') AS away_code,
    COALESCE((
      SELECT ti.code
      FROM team_iterations ti
      WHERE ti.team_id = g.home_team_id
      ORDER BY (ti.season_id = g.season_id) DESC NULLS LAST, ti.recorded_at DESC
      LIMIT 1
    ), 'Home') AS home_code
  FROM games g
  LEFT JOIN user_watched_games uwg
    ON uwg.user_id = ${userId}
   AND uwg.game_id = g.id
  LEFT JOIN seasons s ON s.id = g.season_id
  LEFT JOIN leagues l ON l.id = s.league_id
  WHERE (${gameId}::uuid IS NULL OR g.id = ${gameId}::uuid)
    AND uwg.skipped_at IS NULL
    AND COALESCE(
      uwg.scheduled_for,
      CASE
        WHEN (g.scheduled_at AT TIME ZONE 'UTC')::time = TIME '00:00:00'
          THEN (g.scheduled_at AT TIME ZONE 'UTC')::date
        ELSE (g.scheduled_at AT TIME ZONE 'America/New_York')::date
      END
    ) IS NOT NULL
    AND (
      uwg.scheduled_for IS NOT NULL
      OR EXISTS (
        SELECT 1
        FROM user_favorite_teams uft
        WHERE uft.user_id = ${userId}
          AND (uft.team_id = g.home_team_id OR uft.team_id = g.away_team_id)
      )
    )
`;

const syncScheduledGameToGoogleCalendar = async ({ userId, gameId }) => {
  const connection = await getConnection(userId);
  if (!connection) return { status: 'not_connected' };

  try {
    const accessToken = await refreshAccessToken(connection.refresh_token_encrypted);
    const games = await calendarGameSelect(userId, gameId);
    if (games[0]) {
      await upsertGameEvent({
        accessToken,
        calendarId: connection.calendar_id,
        userId,
        game: games[0],
      });
    } else {
      await deleteGameEvent({
        accessToken,
        calendarId: connection.calendar_id,
        userId,
        gameId,
      });
    }
    await markSyncSuccess(userId);
    return { status: 'synced' };
  } catch (err) {
    await markSyncError(userId, err);
    throw err;
  }
};

const syncAllScheduledGamesForUser = async (userId, context = {}) => {
  const connection = context.connection || (await getConnection(userId));
  if (!connection) return { status: 'not_connected', synced: 0, removed: 0 };

  try {
    const accessToken =
      context.accessToken || (await refreshAccessToken(connection.refresh_token_encrypted));
    const games = await calendarGameSelect(userId);
    const calendarGameIds = new Set(games.map((game) => game.id));

    for (const game of games) {
      await upsertGameEvent({
        accessToken,
        calendarId: connection.calendar_id,
        userId,
        game,
      });
    }

    let removed = 0;
    const existingEvents = await listManagedEvents({
      accessToken,
      calendarId: connection.calendar_id,
    });
    for (const event of existingEvents) {
      const gameId = event.extendedProperties?.private?.hockeyTrackerGameId;
      if (!gameId || calendarGameIds.has(gameId)) continue;
      await deleteGameEvent({
        accessToken,
        calendarId: connection.calendar_id,
        userId,
        gameId,
      });
      removed += 1;
    }

    await markSyncSuccess(userId);
    return { status: 'synced', synced: games.length, removed };
  } catch (err) {
    await markSyncError(userId, err);
    throw err;
  }
};

const connectGoogleCalendar = async ({ userId, code }) => {
  requireGoogleCalendarConfig();
  const tokens = await exchangeAuthorizationCode(code);
  if (!tokens.access_token) {
    throw new GoogleCalendarError('Google did not return an access token', {
      status: 502,
      code: 'missing_access_token',
    });
  }

  const existing = await getConnection(userId);
  const refreshToken = tokens.refresh_token
    ? tokens.refresh_token
    : existing
      ? decryptRefreshToken(existing.refresh_token_encrypted)
      : null;
  if (!refreshToken) {
    throw new GoogleCalendarError('Google did not return offline access credentials', {
      status: 400,
      code: 'missing_refresh_token',
    });
  }

  let calendarId = existing?.calendar_id || null;
  if (calendarId && !(await calendarIsAccessible(tokens.access_token, calendarId))) {
    calendarId = null;
  }
  if (!calendarId) {
    const calendar = await createAppCalendar(tokens.access_token);
    calendarId = calendar?.id;
  }
  if (!calendarId) {
    throw new GoogleCalendarError('Google did not return a calendar identifier', {
      status: 502,
      code: 'missing_calendar_id',
    });
  }

  const encryptedRefreshToken = encryptRefreshToken(refreshToken);
  const [connection] = await sql`
    INSERT INTO user_google_calendar_connections (
      user_id, calendar_id, calendar_name, refresh_token_encrypted, connected_at, updated_at,
      last_sync_error
    )
    VALUES (
      ${userId}, ${calendarId}, ${DEFAULT_CALENDAR_NAME}, ${encryptedRefreshToken}, NOW(), NOW(), NULL
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
      calendar_id = EXCLUDED.calendar_id,
      calendar_name = EXCLUDED.calendar_name,
      refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
      connected_at = NOW(),
      updated_at = NOW(),
      last_sync_error = NULL
    RETURNING
      calendar_id,
      calendar_name,
      refresh_token_encrypted,
      connected_at,
      updated_at,
      last_synced_at,
      last_sync_error
  `;

  try {
    await syncAllScheduledGamesForUser(userId, {
      accessToken: tokens.access_token,
      connection,
    });
  } catch (err) {
    // The connection is still valid. Status exposes the sync error and users can retry.
    console.error('initial Google Calendar sync error:', err);
  }

  return { connected: true, calendar_name: DEFAULT_CALENDAR_NAME };
};

const disconnectGoogleCalendar = async (userId) => {
  const connection = await getConnection(userId);
  if (!connection) return { disconnected: true };

  try {
    const accessToken = await refreshAccessToken(connection.refresh_token_encrypted);
    await googleRequest(calendarUrl(connection.calendar_id), {
      accessToken,
      method: 'DELETE',
    });
  } catch (err) {
    // Revoked credentials or a manually deleted calendar must not trap the local connection.
    if (!(err instanceof GoogleCalendarError) || ![400, 401, 403, 404, 410].includes(err.status)) {
      console.error('Google Calendar cleanup error:', err);
    }
  }

  await sql`DELETE FROM user_google_calendar_connections WHERE user_id = ${userId}`;
  return { disconnected: true };
};

module.exports = {
  GoogleCalendarError,
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  getGoogleCalendarAuthorizationUrl,
  getGoogleCalendarStatus,
  isGoogleCalendarConfigured,
  syncAllScheduledGamesForUser,
  syncScheduledGameToGoogleCalendar,
  _private: {
    addOneDay,
    calendarGameSelect,
    decryptRefreshToken,
    encryptRefreshToken,
    eventForGame,
    eventIdForGame,
    googleRequest,
    upsertGameEvent,
  },
};
