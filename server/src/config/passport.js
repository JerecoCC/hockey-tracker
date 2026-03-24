const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { sql } = require('../db');

// ---------------------------------------------------------------------------
// Serialize / deserialize – store only the user id in the session
// ---------------------------------------------------------------------------
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const rows = await sql`SELECT * FROM users WHERE id = ${id}`;
    done(null, rows[0] || false);
  } catch (err) {
    done(err);
  }
});

// ---------------------------------------------------------------------------
// Google OAuth 2.0 strategy
// ---------------------------------------------------------------------------
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        'http://localhost:5000/api/auth/google/callback',
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value || '';
        const displayName = profile.displayName;
        const photo = profile.photos?.[0]?.value || '';

        // Upsert: insert if not exists, update photo/name if it does
        const rows = await sql`
          INSERT INTO users (google_id, display_name, email, photo)
          VALUES (${googleId}, ${displayName}, ${email}, ${photo})
          ON CONFLICT (google_id) DO UPDATE
            SET display_name = EXCLUDED.display_name,
                photo        = EXCLUDED.photo
          RETURNING *
        `;
        return done(null, rows[0]);
      } catch (err) {
        return done(err);
      }
    }
  )
);

module.exports = {};

