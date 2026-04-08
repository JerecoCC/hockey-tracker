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
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name       TEXT NOT NULL,
      league_id  UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
      start_date DATE,
      end_date   DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // Drop type column from databases created before this migration
  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'seasons' AND column_name = 'type'
      ) THEN
        ALTER TABLE seasons DROP COLUMN type;
      END IF;
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'seasons' AND column_name = 'season_type'
      ) THEN
        ALTER TABLE seasons DROP COLUMN season_type;
      END IF;
    END $$
  `;
  // Drop the erroneous UNIQUE constraint on teams.league_id – a league can have many teams
  await sql`
    DO $$
    DECLARE
      c_name TEXT;
    BEGIN
      SELECT kcu.constraint_name INTO c_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema    = kcu.table_schema
      WHERE tc.table_name      = 'teams'
        AND tc.constraint_type = 'UNIQUE'
        AND kcu.column_name    = 'league_id';

      IF c_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE teams DROP CONSTRAINT ' || quote_ident(c_name);
      END IF;
    END $$
  `;
  console.log('Database schema ready');
}

module.exports = { sql, initSchema };

