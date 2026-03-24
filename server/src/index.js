require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport');

const { initSchema, sql } = require('./db');
require('./config/passport');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'hockey-tracker-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', async (_req, res) => {
  try {
    const result = await sql`SELECT NOW() AS db_time`;
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: { connected: true, db_time: result[0].db_time },
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: { connected: false, error: err.message },
    });
  }
});

// ---------------------------------------------------------------------------
// Start – run DB migrations then listen (local dev only)
// ---------------------------------------------------------------------------
if (require.main === module) {
  // Running directly: `node src/index.js` or `npm run dev:server`
  initSchema()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Failed to initialise database schema:', err);
      process.exit(1);
    });
} else {
  // Imported as a module (Vercel serverless) – init schema in the background
  initSchema().catch(console.error);
}

// Export for Vercel serverless
module.exports = app;

