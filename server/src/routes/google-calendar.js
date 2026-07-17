const crypto = require('crypto');
const router = require('express').Router();
const {
  requireAuth,
  signGoogleCalendarState,
  verifyGoogleCalendarState,
} = require('../middleware/auth');
const {
  GoogleCalendarError,
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  getGoogleCalendarAuthorizationUrl,
  getGoogleCalendarStatus,
  syncAllScheduledGamesForUser,
} = require('../services/googleCalendar');

const CLIENT_URL = (process.env.CLIENT_URL || 'http://localhost:5173').trim();
const STATE_COOKIE = 'google_calendar_oauth_state';
const STATE_COOKIE_PATH = '/api/user/calendar/google';

const stateCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 10 * 60 * 1000,
  path: STATE_COOKIE_PATH,
});

const redirectToGames = (res, result, reason = null) => {
  const url = new URL('/games', CLIENT_URL);
  url.searchParams.set('google_calendar', result);
  if (reason) url.searchParams.set('reason', reason);
  return res.redirect(url.toString());
};

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  return (
    leftBuffer.length === rightBuffer.length &&
    leftBuffer.length > 0 &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
};

// Google returns to this endpoint without the app's Bearer token. The signed,
// short-lived state plus matching HttpOnly cookie bind the callback to the user
// who started the connection flow.
router.get('/callback', async (req, res) => {
  const cookieOptions = stateCookieOptions();
  const stateCookie = req.cookies?.[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE, { ...cookieOptions, maxAge: undefined });

  if (req.query.error) {
    return redirectToGames(res, 'error', 'access_denied');
  }
  if (typeof req.query.code !== 'string' || typeof req.query.state !== 'string') {
    return redirectToGames(res, 'error', 'invalid_callback');
  }

  try {
    const state = verifyGoogleCalendarState(req.query.state);
    if (!safeEqual(state.nonce, stateCookie)) {
      return redirectToGames(res, 'error', 'state_mismatch');
    }
    await connectGoogleCalendar({ userId: state.userId, code: req.query.code });
    return redirectToGames(res, 'connected');
  } catch (err) {
    console.error('Google Calendar callback error:', err);
    const reason = err instanceof GoogleCalendarError ? err.code : 'connection_failed';
    return redirectToGames(res, 'error', reason);
  }
});

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    return res.json(await getGoogleCalendarStatus(req.user.id));
  } catch (err) {
    console.error('Google Calendar status error:', err);
    return res.status(500).json({ error: 'Failed to load Google Calendar status' });
  }
});

router.post('/connect', async (req, res) => {
  try {
    const nonce = crypto.randomBytes(32).toString('base64url');
    const state = signGoogleCalendarState({ userId: req.user.id, nonce });
    const authorizationUrl = getGoogleCalendarAuthorizationUrl({
      state,
      loginHint: req.user.email,
    });
    res.cookie(STATE_COOKIE, nonce, stateCookieOptions());
    return res.json({ authorization_url: authorizationUrl });
  } catch (err) {
    console.error('Google Calendar connect error:', err);
    const status = err instanceof GoogleCalendarError ? err.status : 500;
    const error =
      err instanceof GoogleCalendarError
        ? err.message
        : 'Failed to start Google Calendar connection';
    return res.status(status).json({ error });
  }
});

router.post('/sync', async (req, res) => {
  const streamProgress = req.get('accept')?.includes('application/x-ndjson');
  const writeStreamItem = (item) => {
    if (res.writableEnded) return;
    res.write(`${JSON.stringify(item)}\n`);
  };

  try {
    if (streamProgress) {
      res.set({
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Accel-Buffering': 'no',
      });
    }

    const result = streamProgress
      ? await syncAllScheduledGamesForUser(req.user.id, {
          onProgress: (progress) => writeStreamItem({ type: 'progress', progress }),
        })
      : await syncAllScheduledGamesForUser(req.user.id);
    if (result.status === 'not_connected') {
      return res.status(409).json({ error: 'Google Calendar is not connected' });
    }
    if (streamProgress) {
      writeStreamItem({ type: 'result', result });
      return res.end();
    }
    return res.json(result);
  } catch (err) {
    console.error('Google Calendar manual sync error:', err);
    if (streamProgress && res.headersSent) {
      writeStreamItem({
        type: 'error',
        error: 'Failed to sync Google Calendar',
      });
      return res.end();
    }
    return res.status(502).json({ error: 'Failed to sync Google Calendar' });
  }
});

router.delete('/', async (req, res) => {
  try {
    return res.json(await disconnectGoogleCalendar(req.user.id));
  } catch (err) {
    console.error('Google Calendar disconnect error:', err);
    return res.status(500).json({ error: 'Failed to disconnect Google Calendar' });
  }
});

module.exports = router;
