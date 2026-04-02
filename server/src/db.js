const { neon } = require('@neondatabase/serverless');

const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error('POSTGRES_URL environment variable is not set');
}

// `sql` is a tagged-template function – every call opens a pooled HTTP connection
const sql = neon(connectionString);

/**
 * Run once at startup: create the users table if it doesn't exist.
 */
async function initSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      google_id    TEXT UNIQUE,
      display_name TEXT NOT NULL,
      email        TEXT UNIQUE NOT NULL,
      password     TEXT,
      photo        TEXT,
      role         TEXT NOT NULL DEFAULT 'user',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // Add role column to existing tables that were created before this migration
  await sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS leagues (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        TEXT NOT NULL,
      code        TEXT UNIQUE NOT NULL,
      description TEXT,
      logo        TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS teams (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        TEXT NOT NULL,
      code        TEXT UNIQUE NOT NULL,
      description TEXT,
      location    TEXT,
      logo        TEXT,
      league_id   UUID UNIQUE REFERENCES leagues(id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS seasons (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        TEXT NOT NULL,
      league_id   UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
      start_date  DATE,
      end_date    DATE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  console.log('Database schema ready');
}

module.exports = { sql, initSchema };

