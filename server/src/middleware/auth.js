const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'hockey-tracker-jwt-secret';
const JWT_EXPIRES_IN = '7d';
const GOOGLE_CALENDAR_STATE_AUDIENCE = 'google-calendar-connect';
const TOKEN_ISSUER = 'hockey-tracker';

/**
 * Sign a JWT for the given user payload.
 */
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function signGoogleCalendarState({ userId, nonce }) {
  return jwt.sign({ userId, nonce, purpose: GOOGLE_CALENDAR_STATE_AUDIENCE }, JWT_SECRET, {
    expiresIn: '10m',
    audience: GOOGLE_CALENDAR_STATE_AUDIENCE,
    issuer: TOKEN_ISSUER,
  });
}

function verifyGoogleCalendarState(state) {
  const payload = jwt.verify(state, JWT_SECRET, {
    audience: GOOGLE_CALENDAR_STATE_AUDIENCE,
    issuer: TOKEN_ISSUER,
  });
  if (payload.purpose !== GOOGLE_CALENDAR_STATE_AUDIENCE || !payload.userId || !payload.nonce) {
    throw new Error('Invalid Google Calendar OAuth state');
  }
  return payload;
}

/**
 * Express middleware – verifies the Bearer token in the Authorization header.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Express middleware – requires the user to be authenticated AND have role 'admin'.
 */
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: admin access required' });
    }
    next();
  });
}

module.exports = {
  signToken,
  signGoogleCalendarState,
  verifyGoogleCalendarState,
  requireAuth,
  requireAdmin,
};
