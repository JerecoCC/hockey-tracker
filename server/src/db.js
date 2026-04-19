const { neon } = require('@neondatabase/serverless');

const rawUrl = process.env.POSTGRES_URL;

if (!rawUrl) {
  throw new Error('POSTGRES_URL environment variable is not set');
}

// Append a startup option so every Neon HTTP session uses US Eastern time.
// This ensures NOW(), CURRENT_TIMESTAMP, and TIMESTAMPTZ display all use
// America/New_York regardless of where the server process runs.
const sep = rawUrl.includes('?') ? '&' : '?';
const connectionString = `${rawUrl}${sep}options=-c%20TimeZone%3DAmerica/New_York`;

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

      -- Add the composite constraint only if the code column still exists
      -- (a later migration drops it, which also removes this constraint automatically)
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'teams' AND column_name = 'code'
      ) AND NOT EXISTS (
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

  // Explicit team identity snapshots — recorded manually, not on every edit.
  // name/code/logo live here, not on teams.
  await sql`
    CREATE TABLE IF NOT EXISTS team_iterations (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      season_id   UUID REFERENCES seasons(id) ON DELETE SET NULL,
      name        TEXT NOT NULL,
      code        TEXT,
      logo        TEXT,
      note        TEXT,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // Migration: drop legacy effective_from column if it still exists
  await sql`ALTER TABLE team_iterations DROP COLUMN IF EXISTS effective_from`;
  // Migration: add columns added after initial creation
  await sql`
    ALTER TABLE team_iterations ADD COLUMN IF NOT EXISTS
      season_id UUID REFERENCES seasons(id) ON DELETE SET NULL
  `;
  await sql`ALTER TABLE team_iterations ADD COLUMN IF NOT EXISTS code TEXT`;
  await sql`
    ALTER TABLE team_iterations ADD COLUMN IF NOT EXISTS
      start_season_id UUID REFERENCES seasons(id) ON DELETE SET NULL
  `;
  await sql`
    ALTER TABLE team_iterations ADD COLUMN IF NOT EXISTS
      latest_season_id UUID REFERENCES seasons(id) ON DELETE SET NULL
  `;

  // Migration: for any existing team that has no base iteration yet,
  // create one from the teams columns (only runs while those columns still exist).
  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'teams' AND column_name = 'name'
      ) THEN
        INSERT INTO team_iterations (team_id, season_id, name, code, logo, recorded_at)
        SELECT t.id, NULL, t.name, t.code, t.logo, NOW()
        FROM teams t
        WHERE NOT EXISTS (
          SELECT 1 FROM team_iterations ti
          WHERE ti.team_id = t.id AND ti.season_id IS NULL
        );
      END IF;
    END $$
  `;

  // Migration: drop identity columns from teams (code drop also removes the
  // teams_code_league_id_key constraint automatically).
  await sql`ALTER TABLE teams DROP COLUMN IF EXISTS name`;
  await sql`ALTER TABLE teams DROP COLUMN IF EXISTS code`;
  await sql`ALTER TABLE teams DROP COLUMN IF EXISTS logo`;

  // Track the first and most-recent season a team has been added to.
  await sql`
    ALTER TABLE teams ADD COLUMN IF NOT EXISTS
      start_season_id UUID REFERENCES seasons(id) ON DELETE SET NULL
  `;
  await sql`
    ALTER TABLE teams ADD COLUMN IF NOT EXISTS
      latest_season_id UUID REFERENCES seasons(id) ON DELETE SET NULL
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS players (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      first_name     TEXT NOT NULL,
      last_name      TEXT NOT NULL,
      -- Generic headshot (no team branding). Season-specific photos live on player_teams.
      photo          TEXT,
      date_of_birth  DATE,
      birth_city     TEXT,
      birth_country  TEXT,
      nationality    TEXT,
      height_cm      SMALLINT,
      weight_lbs     SMALLINT,
      position       TEXT CHECK (position IN ('C', 'LW', 'RW', 'D', 'G')),
      shoots         TEXT CHECK (shoots IN ('L', 'R')),
      is_active      BOOLEAN NOT NULL DEFAULT TRUE,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Migrations for columns added after the table was first created
  await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE`;

  // Player roster stints: one row per player-team-season stint.
  // A mid-season trade is recorded by setting end_date on the current row
  // and inserting a new row for the new team.
  // jersey_number and photo are stint-specific (team jersey, team headshot).
  // League is intentionally omitted — derivable via team.league_id.
  await sql`
    CREATE TABLE IF NOT EXISTS player_teams (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      player_id      UUID NOT NULL REFERENCES players(id)  ON DELETE CASCADE,
      team_id        UUID NOT NULL REFERENCES teams(id)    ON DELETE CASCADE,
      season_id      UUID NOT NULL REFERENCES seasons(id)  ON DELETE CASCADE,
      jersey_number  SMALLINT,
      photo          TEXT,
      start_date     DATE,
      -- NULL means the player is currently on this team
      end_date       DATE,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Migrations for columns added after player_teams was first created
  await sql`ALTER TABLE player_teams ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid()`;
  await sql`ALTER TABLE player_teams ADD COLUMN IF NOT EXISTS photo TEXT`;
  await sql`ALTER TABLE player_teams ADD COLUMN IF NOT EXISTS start_date DATE`;
  await sql`ALTER TABLE player_teams ADD COLUMN IF NOT EXISTS end_date DATE`;

  // Only one active (end_date IS NULL) stint per player per season at a time.
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS player_teams_one_active_per_season
      ON player_teams (player_id, season_id)
      WHERE end_date IS NULL
  `;

  // Flag exactly one season per league as the "current" season.
  // is_current is kept for backward-compat but is no longer the source of truth —
  // leagues.current_season_id is the authoritative FK and enforces uniqueness at the DB level.
  await sql`
    ALTER TABLE seasons ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT FALSE
  `;
  // Drop the old partial-unique-index approach now that the FK on leagues enforces uniqueness.
  await sql`DROP INDEX IF EXISTS seasons_one_current_per_league`;

  // current_season_id on leagues is the single source of truth.
  // ON DELETE SET NULL keeps the league intact even if the current season is deleted.
  await sql`
    ALTER TABLE leagues
      ADD COLUMN IF NOT EXISTS current_season_id UUID
        REFERENCES seasons(id) ON DELETE SET NULL
  `;

  console.log('Database schema ready');
}

module.exports = { sql, initSchema };

