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
      code        TEXT NOT NULL,
      description TEXT,
      location    TEXT,
      logo        TEXT,
      league_id   UUID REFERENCES leagues(id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (code, league_id)
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
  await sql`
    CREATE TABLE IF NOT EXISTS groups (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      league_id  UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
      parent_id  UUID REFERENCES groups(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS group_teams (
      group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (group_id, team_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS season_group_teams (
      season_id  UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
      group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (season_id, group_id, team_id)
    )
  `;

  // Which teams are participating in a given season (season-level roster)
  await sql`
    CREATE TABLE IF NOT EXISTS season_teams (
      season_id  UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
      team_id    UUID NOT NULL REFERENCES teams(id)   ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (season_id, team_id)
    )
  `;

  // Add primary_color and text_color to teams
  await sql`
    ALTER TABLE teams ADD COLUMN IF NOT EXISTS primary_color TEXT NOT NULL DEFAULT '#334155'
  `;
  await sql`
    ALTER TABLE teams ADD COLUMN IF NOT EXISTS text_color TEXT NOT NULL DEFAULT '#ffffff'
  `;
  await sql`
    ALTER TABLE teams ADD COLUMN IF NOT EXISTS city TEXT
  `;
  await sql`
    ALTER TABLE teams ADD COLUMN IF NOT EXISTS home_arena TEXT
  `;
  await sql`
    ALTER TABLE teams ADD COLUMN IF NOT EXISTS secondary_color TEXT NOT NULL DEFAULT '#1e293b'
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

  // Migrate teams.code from a global UNIQUE to a per-league UNIQUE(code, league_id)
  await sql`
    DO $$
    DECLARE
      c_name TEXT;
    BEGIN
      -- Drop the old single-column unique constraint on code, if it still exists
      SELECT tc.constraint_name INTO c_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema    = kcu.table_schema
      WHERE tc.table_name      = 'teams'
        AND tc.constraint_type = 'UNIQUE'
        AND kcu.column_name    = 'code'
        AND (
          SELECT COUNT(*) FROM information_schema.key_column_usage
          WHERE constraint_name = tc.constraint_name
            AND table_schema    = tc.table_schema
        ) = 1;

      IF c_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE teams DROP CONSTRAINT ' || quote_ident(c_name);
      END IF;

      -- Add the composite constraint if it doesn't already exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name      = 'teams'
          AND constraint_type = 'UNIQUE'
          AND constraint_name = 'teams_code_league_id_key'
      ) THEN
        ALTER TABLE teams ADD CONSTRAINT teams_code_league_id_key UNIQUE (code, league_id);
      END IF;
    END $$
  `;
  // Auto-generated season groups: season_id scopes the group to one season;
  // is_auto distinguishes system-created groups from user-created ones.
  await sql`
    ALTER TABLE groups ADD COLUMN IF NOT EXISTS
      season_id UUID REFERENCES seasons(id) ON DELETE CASCADE
  `;
  await sql`
    ALTER TABLE groups ADD COLUMN IF NOT EXISTS
      is_auto BOOLEAN NOT NULL DEFAULT false
  `;

  console.log('Database schema ready');
}

module.exports = { sql, initSchema };

