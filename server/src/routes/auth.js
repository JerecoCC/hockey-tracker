const router = require('express').Router();
const passport = require('passport');
const bcrypt = require('bcryptjs');
const { signToken, requireAuth } = require('../middleware/auth');
const { sql } = require('../db');

const CLIENT_URL = (process.env.CLIENT_URL || 'http://localhost:5173').trim();

/** Shared safe user shape returned to the client */
function toPublicUser(row) {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    photo: row.photo || '',
    role: row.role || 'user',
  };
}

// ---------------------------------------------------------------------------
// POST /api/auth/signup
// ---------------------------------------------------------------------------
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const hash = await bcrypt.hash(password, 12);
    const rows = await sql`
      INSERT INTO users (display_name, email, password)
      VALUES (${name}, ${email}, ${hash})
      RETURNING *
    `;
    const user = rows[0];
    const token = signToken({ id: user.id, email: user.email, role: user.role });
    return res.status(201).json({ token, user: toPublicUser(user) });
  } catch (err) {
    console.error('signup error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const rows = await sql`SELECT * FROM users WHERE email = ${email}`;
    const user = rows[0];

    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role });
    return res.json({ token, user: toPublicUser(user) });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/auth/google  – kick off OAuth flow
// ---------------------------------------------------------------------------
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// ---------------------------------------------------------------------------
// GET /api/auth/google/callback  – Google redirects here
// ---------------------------------------------------------------------------
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: `${CLIENT_URL}/login?error=oauth_failed` }),
  (req, res) => {
    const token = signToken({ id: req.user.id, email: req.user.email, role: req.user.role });
    res.redirect(`${CLIENT_URL}/auth/callback?token=${token}`);
  }
);

// ---------------------------------------------------------------------------
// GET /api/auth/me  – protected route
// ---------------------------------------------------------------------------
router.get('/me', requireAuth, async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM users WHERE id = ${req.user.id}`;
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    return res.json(toPublicUser(rows[0]));
  } catch (err) {
    console.error('me error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------
router.post('/logout', (req, res) => {
  req.logout?.(() => {});
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;

