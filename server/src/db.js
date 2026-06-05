const { neon } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-http');
const schema = require('./schema');

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
const db = drizzle(sql, { schema });

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
      icon        TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    ALTER TABLE leagues ADD COLUMN IF NOT EXISTS icon TEXT
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

  await sql`
    CREATE TABLE IF NOT EXISTS league_awards (
      id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      league_id               UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
      name                    TEXT NOT NULL,
      description             TEXT,
      recipient_type          TEXT NOT NULL DEFAULT 'player',
      selection_method        TEXT NOT NULL DEFAULT 'manual',
      stat_key                TEXT,
      awarded_after_playoffs  BOOLEAN NOT NULL DEFAULT true,
      active                  BOOLEAN NOT NULL DEFAULT true,
      sort_order              INT NOT NULL DEFAULT 0,
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (league_id, name)
    )
  `;
  await sql`ALTER TABLE league_awards ADD COLUMN IF NOT EXISTS description TEXT`;
  await sql`ALTER TABLE league_awards ADD COLUMN IF NOT EXISTS recipient_type TEXT NOT NULL DEFAULT 'player'`;
  await sql`ALTER TABLE league_awards ADD COLUMN IF NOT EXISTS selection_method TEXT NOT NULL DEFAULT 'manual'`;
  await sql`ALTER TABLE league_awards ADD COLUMN IF NOT EXISTS stat_key TEXT`;
  await sql`ALTER TABLE league_awards ADD COLUMN IF NOT EXISTS awarded_after_playoffs BOOLEAN NOT NULL DEFAULT true`;
  await sql`ALTER TABLE league_awards ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true`;
  await sql`ALTER TABLE league_awards ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0`;

  await sql`
    CREATE TABLE IF NOT EXISTS season_awards (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      season_id   UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
      award_id    UUID NOT NULL REFERENCES league_awards(id) ON DELETE CASCADE,
      awarded_at  DATE,
      notes       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (season_id, award_id)
    )
  `;
  await sql`ALTER TABLE season_awards ADD COLUMN IF NOT EXISTS awarded_at DATE`;
  await sql`ALTER TABLE season_awards ADD COLUMN IF NOT EXISTS notes TEXT`;

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
      place_name  TEXT,
      team_name   TEXT,
      code        TEXT,
      logo        TEXT,
      icon        TEXT,
      note        TEXT,
      start_date  DATE,
      end_date    DATE,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // Migration: drop legacy effective_from column if it still exists
  await sql`ALTER TABLE team_iterations DROP COLUMN IF EXISTS effective_from`;
  // Migration: date-based iteration windows replaced season-linked windows.
  await sql`
    ALTER TABLE team_iterations ADD COLUMN IF NOT EXISTS
      season_id UUID REFERENCES seasons(id) ON DELETE SET NULL
  `;
  await sql`ALTER TABLE team_iterations ADD COLUMN IF NOT EXISTS start_date DATE`;
  await sql`ALTER TABLE team_iterations ADD COLUMN IF NOT EXISTS end_date DATE`;
  await sql`ALTER TABLE team_iterations ADD COLUMN IF NOT EXISTS code TEXT`;
  await sql`ALTER TABLE team_iterations ADD COLUMN IF NOT EXISTS icon TEXT`;
  await sql`ALTER TABLE team_iterations ADD COLUMN IF NOT EXISTS place_name TEXT`;
  await sql`ALTER TABLE team_iterations ADD COLUMN IF NOT EXISTS team_name TEXT`;
  await sql`
    ALTER TABLE team_iterations ADD COLUMN IF NOT EXISTS
      start_season_id UUID REFERENCES seasons(id) ON DELETE SET NULL
  `;
  await sql`
    ALTER TABLE team_iterations ADD COLUMN IF NOT EXISTS
      latest_season_id UUID REFERENCES seasons(id) ON DELETE SET NULL
  `;
  // await sql`
  //   UPDATE team_iterations ti
  //   SET start_date = COALESCE(ti.start_date, ss.start_date),
  //       end_date   = COALESCE(ti.end_date, ls.end_date)
  //   FROM seasons ss
  //   LEFT JOIN seasons ls ON ls.id = ti.latest_season_id
  //   WHERE ti.start_season_id = ss.id
  //     AND (ti.start_date IS NULL OR ti.end_date IS NULL)
  // `;
  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'team_iterations' AND column_name = 'season_id'
      ) THEN
        UPDATE team_iterations ti
        SET start_date = COALESCE(ti.start_date, s.start_date),
            end_date   = COALESCE(ti.end_date, s.end_date)
        FROM seasons s
        WHERE ti.season_id = s.id;
      END IF;
    END $$
  `;

  await sql`
    UPDATE team_iterations ti
    SET
      place_name = CASE
        WHEN c.place_hint IS NOT NULL AND lower(btrim(ti.name)) LIKE lower(c.place_hint) || ' %' THEN c.place_hint
        WHEN position(' ' IN btrim(ti.name)) > 0 THEN split_part(btrim(ti.name), ' ', 1)
        ELSE NULL
      END,
      team_name = CASE
        WHEN c.place_hint IS NOT NULL AND lower(btrim(ti.name)) LIKE lower(c.place_hint) || ' %' THEN btrim(substr(btrim(ti.name), length(c.place_hint) + 2))
        WHEN position(' ' IN btrim(ti.name)) > 0 THEN btrim(substr(btrim(ti.name), position(' ' IN btrim(ti.name)) + 1))
        ELSE btrim(ti.name)
      END
    FROM teams t
    CROSS JOIN LATERAL (
      SELECT COALESCE(NULLIF(btrim(t.city), ''), NULLIF(btrim(t.location), '')) AS place_hint
    ) c
    WHERE ti.team_id = t.id
      AND (ti.place_name IS NULL OR btrim(ti.place_name) = '')
      AND (ti.team_name IS NULL OR btrim(ti.team_name) = '')
      AND ti.name IS NOT NULL
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
        INSERT INTO team_iterations (team_id, name, code, logo, recorded_at)
        SELECT t.id, t.name, t.code, t.logo, NOW()
        FROM teams t
        WHERE NOT EXISTS (
          SELECT 1 FROM team_iterations ti
          WHERE ti.team_id = t.id
        );
      END IF;
    END $$
  `;

  await sql`
    UPDATE team_iterations ti
    SET
      place_name = CASE
        WHEN c.place_hint IS NOT NULL AND lower(btrim(ti.name)) LIKE lower(c.place_hint) || ' %' THEN c.place_hint
        WHEN position(' ' IN btrim(ti.name)) > 0 THEN split_part(btrim(ti.name), ' ', 1)
        ELSE NULL
      END,
      team_name = CASE
        WHEN c.place_hint IS NOT NULL AND lower(btrim(ti.name)) LIKE lower(c.place_hint) || ' %' THEN btrim(substr(btrim(ti.name), length(c.place_hint) + 2))
        WHEN position(' ' IN btrim(ti.name)) > 0 THEN btrim(substr(btrim(ti.name), position(' ' IN btrim(ti.name)) + 1))
        ELSE btrim(ti.name)
      END
    FROM teams t
    CROSS JOIN LATERAL (
      SELECT COALESCE(NULLIF(btrim(t.city), ''), NULLIF(btrim(t.location), '')) AS place_hint
    ) c
    WHERE ti.team_id = t.id
      AND (ti.place_name IS NULL OR btrim(ti.place_name) = '')
      AND (ti.team_name IS NULL OR btrim(ti.team_name) = '')
      AND ti.name IS NOT NULL
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
      -- Generic headshot (no team branding). Team/season photos live on player_photos.
      photo          TEXT,
      date_of_birth  DATE,
      birth_city     TEXT,
      birth_country  TEXT,
      nationality    TEXT,
      height_cm      SMALLINT,
      weight_lbs     SMALLINT,
      position       TEXT CHECK (position IN ('C', 'LW', 'RW', 'F', 'D', 'LD', 'RD', 'G')),
      shoots         TEXT CHECK (shoots IN ('L', 'R')),
      is_active      BOOLEAN NOT NULL DEFAULT TRUE,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Migrations for columns added after the table was first created
  await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE`;

  // Expand position check constraint to include 'F' (generic Forward)
  await sql`ALTER TABLE players DROP CONSTRAINT IF EXISTS players_position_check`;
  await sql`ALTER TABLE players ADD CONSTRAINT players_position_check CHECK (position IN ('C', 'LW', 'RW', 'F', 'D', 'LD', 'RD', 'G'))`;

  await sql`
    CREATE TABLE IF NOT EXISTS season_award_recipients (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      season_award_id  UUID NOT NULL REFERENCES season_awards(id) ON DELETE CASCADE,
      recipient_type   TEXT NOT NULL,
      player_id        UUID REFERENCES players(id) ON DELETE CASCADE,
      team_id          UUID REFERENCES teams(id) ON DELETE CASCADE,
      role             TEXT NOT NULL DEFAULT 'nominee',
      rank             SMALLINT,
      vote_points      INT,
      stat_value       TEXT,
      notes            TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE season_award_recipients ADD COLUMN IF NOT EXISTS recipient_type TEXT NOT NULL DEFAULT 'player'`;
  await sql`ALTER TABLE season_award_recipients ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'nominee'`;
  await sql`ALTER TABLE season_award_recipients ADD COLUMN IF NOT EXISTS rank SMALLINT`;
  await sql`ALTER TABLE season_award_recipients ADD COLUMN IF NOT EXISTS vote_points INT`;
  await sql`ALTER TABLE season_award_recipients ADD COLUMN IF NOT EXISTS stat_value TEXT`;
  await sql`ALTER TABLE season_award_recipients ADD COLUMN IF NOT EXISTS notes TEXT`;

  // Player roster stints: one row per player-team-season stint.
  // A mid-season trade is recorded by setting end_date on the current row
  // and inserting a new row for the new team.
  // jersey_number is stint-specific; team/season headshots live on player_photos.
  // League is intentionally omitted — derivable via team.league_id.
  await sql`
    CREATE TABLE IF NOT EXISTS player_teams (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      player_id      UUID NOT NULL REFERENCES players(id)  ON DELETE CASCADE,
      team_id        UUID NOT NULL REFERENCES teams(id)    ON DELETE CASCADE,
      season_id      UUID NOT NULL REFERENCES seasons(id)  ON DELETE CASCADE,
      jersey_number  SMALLINT,
      is_prospect    BOOLEAN NOT NULL DEFAULT FALSE,
      photo          TEXT,
      acquisition_type TEXT,
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
  await sql`ALTER TABLE player_teams ADD COLUMN IF NOT EXISTS position TEXT CHECK (position IN ('C', 'LW', 'RW', 'F', 'D', 'LD', 'RD', 'G'))`;
  await sql`ALTER TABLE player_teams ADD COLUMN IF NOT EXISTS acquisition_type TEXT`;
  await sql`ALTER TABLE player_teams ADD COLUMN IF NOT EXISTS is_prospect BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE player_teams DROP CONSTRAINT IF EXISTS player_teams_acquisition_type_check`;
  await sql`ALTER TABLE player_teams DROP CONSTRAINT IF EXISTS player_teams_check`;
  await sql`
    ALTER TABLE player_teams ADD CONSTRAINT player_teams_acquisition_type_check
    CHECK (acquisition_type IN ('draft', 'trade', 'free_agency', 'waivers', 'signing', 'expansion_draft', 'team_transfer', 'loan', 'other'))
  `;

  // Player photos are one per player/team/season. They are intentionally
  // separate from stints so an in-season trade can inherit the latest season
  // photo without duplicating it on every player_teams row.
  await sql`
    CREATE TABLE IF NOT EXISTS player_photos (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      player_id  UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      season_id  UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
      photo      TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (player_id, team_id, season_id)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS player_photos_lookup
      ON player_photos (player_id, season_id, team_id, created_at DESC)
  `;
  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'player_teams' AND column_name = 'photo'
      ) THEN
        INSERT INTO player_photos (player_id, team_id, season_id, photo, created_at)
        SELECT DISTINCT ON (player_id, team_id, season_id)
          player_id, team_id, season_id, photo, created_at
        FROM player_teams
        WHERE photo IS NOT NULL
        ORDER BY player_id, team_id, season_id, end_date DESC NULLS FIRST, created_at DESC
        ON CONFLICT (player_id, team_id, season_id) DO NOTHING;
      END IF;
    END $$
  `;

  // Expand player_teams position check constraint to include 'F', 'LD', 'RD'
  await sql`ALTER TABLE player_teams DROP CONSTRAINT IF EXISTS player_teams_position_check`;
  await sql`ALTER TABLE player_teams ADD CONSTRAINT player_teams_position_check CHECK (position IN ('C', 'LW', 'RW', 'F', 'D', 'LD', 'RD', 'G'))`;

  // Migrate primary key from composite (player_id, team_id, season_id) → id UUID.
  // Old databases were created with the composite PK; new ones already have id as PK.
  // We detect the old state by checking if id is NOT already the primary key column.
  await sql`
    DO $$
    DECLARE
      pk_col TEXT;
    BEGIN
      -- Find the column(s) in the current PK for player_teams
      SELECT string_agg(a.attname, ',' ORDER BY a.attnum)
        INTO pk_col
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = 'player_teams'::regclass
          AND i.indisprimary;

      -- Only run if the PK is NOT already solely on "id"
      IF pk_col IS DISTINCT FROM 'id' THEN
        -- Fill id for any rows that somehow still have NULL
        UPDATE player_teams SET id = gen_random_uuid() WHERE id IS NULL;
        -- Drop the old composite PK
        ALTER TABLE player_teams DROP CONSTRAINT IF EXISTS player_teams_pkey;
        -- Promote id to be the sole primary key
        ALTER TABLE player_teams ADD PRIMARY KEY (id);
      END IF;
    END
    $$
  `;

  // Only one active (end_date IS NULL) stint per player per season at a time.
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS player_teams_one_active_per_season
      ON player_teams (player_id, season_id)
      WHERE end_date IS NULL
  `;

  // Career/team stints are intentionally separate from season roster rows.
  // player_teams answers "who is on this season roster"; player_team_stints
  // answers "when was this player associated with this team across their career".
  await sql`
    CREATE TABLE IF NOT EXISTS player_team_stints (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      player_id        UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      team_id          UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      position         TEXT CHECK (position IN ('C', 'LW', 'RW', 'F', 'D', 'LD', 'RD', 'G')),
      acquisition_type TEXT CHECK (acquisition_type IN ('draft', 'trade', 'free_agency', 'waivers', 'signing', 'expansion_draft', 'team_transfer', 'loan', 'other')),
      start_date       DATE,
      end_date         DATE,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE player_team_stints ADD COLUMN IF NOT EXISTS position TEXT`;
  await sql`ALTER TABLE player_team_stints ADD COLUMN IF NOT EXISTS acquisition_type TEXT`;
  await sql`ALTER TABLE player_team_stints ADD COLUMN IF NOT EXISTS start_date DATE`;
  await sql`ALTER TABLE player_team_stints ADD COLUMN IF NOT EXISTS end_date DATE`;
  await sql`ALTER TABLE player_team_stints DROP CONSTRAINT IF EXISTS player_team_stints_position_check`;
  await sql`
    ALTER TABLE player_team_stints ADD CONSTRAINT player_team_stints_position_check
    CHECK (position IN ('C', 'LW', 'RW', 'F', 'D', 'LD', 'RD', 'G'))
  `;
  await sql`ALTER TABLE player_team_stints DROP CONSTRAINT IF EXISTS player_team_stints_acquisition_type_check`;
  await sql`
    ALTER TABLE player_team_stints ADD CONSTRAINT player_team_stints_acquisition_type_check
    CHECK (acquisition_type IN ('draft', 'trade', 'free_agency', 'waivers', 'signing', 'expansion_draft', 'team_transfer', 'loan', 'other'))
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS player_team_stints_player_dates
      ON player_team_stints (player_id, start_date DESC NULLS LAST, created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS player_team_stints_active_lookup
      ON player_team_stints (player_id, team_id)
      WHERE end_date IS NULL
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM _migrations WHERE name = 'backfill_player_team_stints_v1'
      ) THEN
        WITH ordered AS (
          SELECT
            pt.*,
            pt.start_date AS explicit_start,
            COALESCE(pt.start_date, s.start_date, pt.created_at::date) AS sort_start,
            COALESCE(pt.end_date, s.end_date) AS effective_end,
            LAG(pt.team_id) OVER (
              PARTITION BY pt.player_id
              ORDER BY COALESCE(pt.start_date, s.start_date, pt.created_at::date), pt.created_at, pt.id
            ) AS prev_team_id
          FROM player_teams pt
          LEFT JOIN seasons s ON s.id = pt.season_id
        ),
        grouped AS (
          SELECT
            *,
            SUM(CASE WHEN prev_team_id IS DISTINCT FROM team_id THEN 1 ELSE 0 END) OVER (
              PARTITION BY player_id
              ORDER BY sort_start, created_at, id
            ) AS stint_group
          FROM ordered
        ),
        collapsed AS (
          SELECT
            player_id,
            team_id,
            MIN(explicit_start) AS start_date,
            CASE
              WHEN BOOL_OR(end_date IS NULL) THEN NULL
              ELSE MAX(effective_end)
            END AS end_date,
            (ARRAY_AGG(position ORDER BY sort_start DESC NULLS LAST, created_at DESC))[1] AS position,
            (ARRAY_AGG(acquisition_type ORDER BY sort_start ASC NULLS LAST, created_at ASC))[1] AS acquisition_type,
            MIN(created_at) AS created_at
          FROM grouped
          GROUP BY player_id, team_id, stint_group
        )
        INSERT INTO player_team_stints (
          player_id, team_id, position, acquisition_type, start_date, end_date, created_at
        )
        SELECT player_id, team_id, position, acquisition_type, start_date, end_date, created_at
        FROM collapsed
        ORDER BY created_at;

        INSERT INTO _migrations (name) VALUES ('backfill_player_team_stints_v1');
      END IF;
    END $$;
  `;

  // ── Jersey number history ──────────────────────────────────────────────────
  // Tracks every jersey number a player wore within a stint, with the date the
  // number became effective. The current jersey_number on player_teams is a
  // denormalised copy of the most-recent entry here.
  // Changing a jersey number never creates a new stint — it appends a row here.
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM _migrations WHERE name = 'clear_synthesized_player_team_stint_start_dates_v1'
      ) THEN
        UPDATE player_team_stints pts
        SET start_date = NULL
        WHERE pts.start_date IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM player_teams pt
            WHERE pt.player_id = pts.player_id
              AND pt.team_id = pts.team_id
              AND pt.start_date IS NOT NULL
          )
          AND EXISTS (
            SELECT 1
            FROM player_teams pt
            JOIN seasons s ON s.id = pt.season_id
            WHERE pt.player_id = pts.player_id
              AND pt.team_id = pts.team_id
              AND s.start_date = pts.start_date
          );

        INSERT INTO _migrations (name) VALUES ('clear_synthesized_player_team_stint_start_dates_v1');
      END IF;
    END $$;
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS jersey_number_history (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      player_teams_id UUID NOT NULL REFERENCES player_teams(id) ON DELETE CASCADE,
      jersey_number   SMALLINT NOT NULL,
      effective_from  DATE NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS jnh_player_teams_effective
      ON jersey_number_history (player_teams_id, effective_from DESC)
  `;

  // Flag exactly one season per league as the "current" season.
  // is_current is kept for backward-compat but is no longer the source of truth —
  // leagues.current_season_id is the authoritative FK and enforces uniqueness at the DB level.
  await sql`
    ALTER TABLE seasons ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT FALSE
  `;
  await sql`
    ALTER TABLE seasons ADD COLUMN IF NOT EXISTS is_ended BOOLEAN NOT NULL DEFAULT FALSE
  `;
  // games_per_season: target number of regular-season games per team for this season.
  await sql`
    ALTER TABLE seasons ADD COLUMN IF NOT EXISTS games_per_season SMALLINT
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

  // best_of_playoff: default series length for this league's playoffs (3, 5, or 7 total games).
  // Renamed from best_of — handle both old and new column names idempotently.
  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leagues' AND column_name = 'best_of'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leagues' AND column_name = 'best_of_playoff'
      ) THEN
        ALTER TABLE leagues RENAME COLUMN best_of TO best_of_playoff;
      END IF;
    END $$
  `;
  await sql`
    ALTER TABLE leagues
      ADD COLUMN IF NOT EXISTS best_of_playoff SMALLINT NOT NULL DEFAULT 7
        CHECK (best_of_playoff IN (3, 5, 7))
  `;

  // best_of_shootout: number of rounds before sudden death in a shootout (3, 5, or 7).
  await sql`
    ALTER TABLE leagues
      ADD COLUMN IF NOT EXISTS best_of_shootout SMALLINT NOT NULL DEFAULT 3
        CHECK (best_of_shootout IN (3, 5, 7))
  `;

  // scoring_system: point system used by this league ('3-2-1-0' or '2-1-0').
  await sql`
    ALTER TABLE leagues
      ADD COLUMN IF NOT EXISTS scoring_system TEXT NOT NULL DEFAULT '2-1-0'
        CHECK (scoring_system IN ('3-2-1-0', '2-1-0'))
  `;

  // ── Playoff series ────────────────────────────────────────────────────────
  // One row per best-of-N playoff matchup. Games reference this via FK.
  // round: 1=First Round / Wild Card, 2=Second Round, 3=Conference Finals, 4=Stanley Cup Final
  // games_to_win: 4 for best-of-7 (the standard), 3 for best-of-5, etc.
  await sql`
    CREATE TABLE IF NOT EXISTS playoff_series (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      season_id      UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
      round          SMALLINT NOT NULL CHECK (round BETWEEN 1 AND 4),
      series_letter  TEXT,
      home_team_id   UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      away_team_id   UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      games_to_win   SMALLINT NOT NULL DEFAULT 4,
      home_wins      SMALLINT NOT NULL DEFAULT 0,
      away_wins      SMALLINT NOT NULL DEFAULT 0,
      status         TEXT NOT NULL DEFAULT 'upcoming'
                       CHECK (status IN ('upcoming', 'active', 'complete')),
      winner_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT playoff_series_different_teams CHECK (home_team_id != away_team_id)
    )
  `;

  // ── Games ─────────────────────────────────────────────────────────────────
  // Core game record. Team identity (name/code/logo) is resolved at query time
  // from team_iterations, consistent with the rest of the data model.
  //
  // overtime_periods: 0 = regulation, 1 = 1 OT period, 2 = 2 OT, etc.
  // home/away_score_reg: score at end of regulation (for OT/SO detection).
  // game_number: sequential number within the regular season.
  // game_number_in_series: which game within a playoff series (1–7).
  await sql`
    CREATE TABLE IF NOT EXISTS games (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      season_id             UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
      home_team_id          UUID NOT NULL REFERENCES teams(id)   ON DELETE CASCADE,
      away_team_id          UUID NOT NULL REFERENCES teams(id)   ON DELETE CASCADE,
      scheduled_at          TIMESTAMPTZ,
      venue                 TEXT,
      game_type             TEXT NOT NULL DEFAULT 'regular'
                              CHECK (game_type IN ('preseason', 'regular', 'playoff')),
      status                TEXT NOT NULL DEFAULT 'scheduled'
                              CHECK (status IN ('scheduled', 'in_progress', 'final', 'postponed', 'cancelled')),
      home_score            SMALLINT,
      away_score            SMALLINT,
      home_score_reg        SMALLINT,
      away_score_reg        SMALLINT,
      overtime_periods      SMALLINT,
      shootout              BOOLEAN NOT NULL DEFAULT false,
      playoff_series_id     UUID REFERENCES playoff_series(id) ON DELETE SET NULL,
      game_number_in_series SMALLINT,
      game_number           SMALLINT,
      notes                 TEXT,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT games_different_teams CHECK (home_team_id != away_team_id)
    )
  `;

  // Migration: track which period is actively being played
  await sql`
    ALTER TABLE games ADD COLUMN IF NOT EXISTS
      current_period TEXT CHECK (current_period IN ('1', '2', '3', 'OT', 'SO'))
  `;

  // Migration: track which team shoots first in a shootout (NULL = not applicable / not yet set)
  await sql`
    ALTER TABLE games ADD COLUMN IF NOT EXISTS
      shootout_first_team_id UUID REFERENCES teams(id) ON DELETE SET NULL
  `;

  // Migration: separate time-of-day for the game (stored as TEXT, e.g. "19:30")
  await sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS scheduled_time TEXT`;

  // Migration: actual game start / end timestamps (distinct from the pre-game scheduled_at)
  await sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS time_start TIMESTAMPTZ`;
  await sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS time_end   TIMESTAMPTZ`;

  // Migration: drop stored score columns — scores are always derived from the goals table at query time.
  await sql`ALTER TABLE games DROP COLUMN IF EXISTS home_score`;
  await sql`ALTER TABLE games DROP COLUMN IF EXISTS away_score`;
  await sql`ALTER TABLE games DROP COLUMN IF EXISTS home_score_reg`;
  await sql`ALTER TABLE games DROP COLUMN IF EXISTS away_score_reg`;

  // Migration: drop redundant period-by-period goal columns (scores are now derived from the goals table)
  await sql`ALTER TABLE games DROP COLUMN IF EXISTS p1_home_goals`;
  await sql`ALTER TABLE games DROP COLUMN IF EXISTS p1_away_goals`;
  await sql`ALTER TABLE games DROP COLUMN IF EXISTS p2_home_goals`;
  await sql`ALTER TABLE games DROP COLUMN IF EXISTS p2_away_goals`;
  await sql`ALTER TABLE games DROP COLUMN IF EXISTS p3_home_goals`;
  await sql`ALTER TABLE games DROP COLUMN IF EXISTS p3_away_goals`;

  // Migration: game_periods table has been removed; scoring breakdown is derived
  // from the goals table at query time. Drop if it still exists on older DBs.
  await sql`DROP TABLE IF EXISTS game_periods`;

  // ── Goals ─────────────────────────────────────────────────────────────────
  // One row per goal scored. scorer_id / assist_1_id / assist_2_id FK to
  // players so credit can be attributed even if roster data changes later.
  // period: '1' | '2' | '3' | 'OT' | 'SO' — mirrors games.current_period.
  // goal_type defaults to even-strength; modifiers like empty-net and penalty-shot
  // are tracked independently so strengths can be combined with them.
  await sql`
    CREATE TABLE IF NOT EXISTS goals (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      game_id      UUID NOT NULL REFERENCES games(id)    ON DELETE CASCADE,
      team_id      UUID NOT NULL REFERENCES teams(id)    ON DELETE CASCADE,
      period       TEXT NOT NULL CHECK (period IN ('1', '2', '3', 'OT', 'SO')),
      goal_type    TEXT NOT NULL DEFAULT 'even-strength'
                     CHECK (goal_type IN (
                       'even-strength',
                       'power-play',
                       'shorthanded',
                       'empty-net',
                       'penalty-shot',
                       'awarded',
                       'own'
                     )),
      period_time  TEXT CHECK (period_time ~ '^[0-9]{1,2}:[0-5][0-9]$'),
      penalty_shot BOOLEAN NOT NULL DEFAULT FALSE,
      scorer_id    UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      assist_1_id  UUID REFERENCES players(id) ON DELETE SET NULL,
      assist_2_id  UUID REFERENCES players(id) ON DELETE SET NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // ── Game star-of-game columns ─────────────────────────────────────────────
  await sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS star_1_id UUID REFERENCES players(id) ON DELETE SET NULL`;
  await sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS star_2_id UUID REFERENCES players(id) ON DELETE SET NULL`;
  await sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS star_3_id UUID REFERENCES players(id) ON DELETE SET NULL`;

  // ── Goals column migrations ────────────────────────────────────────────────
  // period_time was added after the initial table creation; add it if absent.
  await sql`
    ALTER TABLE goals ADD COLUMN IF NOT EXISTS
      period_time TEXT CHECK (period_time ~ '^[0-9]{1,2}:[0-5][0-9]$')
  `;
  // empty_net is a modifier independent of goal_type (e.g. a shorthanded empty-net goal).
  await sql`
    ALTER TABLE goals ADD COLUMN IF NOT EXISTS empty_net BOOLEAN NOT NULL DEFAULT FALSE
  `;
  await sql`
    ALTER TABLE goals ADD COLUMN IF NOT EXISTS penalty_shot BOOLEAN NOT NULL DEFAULT FALSE
  `;
  // Migrate legacy 'empty-net' goal_type rows: mark empty_net = true and reclassify as
  // 'even-strength' (the most common scenario — adjust if other strengths existed).
  await sql`
    UPDATE goals
    SET empty_net = TRUE, goal_type = 'even-strength'
    WHERE goal_type = 'empty-net'
  `;
  await sql`
    UPDATE goals
    SET penalty_shot = TRUE, goal_type = 'even-strength'
    WHERE goal_type = 'penalty-shot'
  `;

  // ── Game starting lineup ───────────────────────────────────────────────────
  // One row per team per game. Each position slot is a nullable FK to players.
  // Replaces game_lineups (6 rows per team) with a single compact row per team.
  // Slots: center, left_wing, right_wing, defense_1, defense_2, goalie.
  await sql`
    CREATE TABLE IF NOT EXISTS game_starting_lineup (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      game_id       UUID NOT NULL REFERENCES games(id)   ON DELETE CASCADE,
      team_id       UUID NOT NULL REFERENCES teams(id)   ON DELETE CASCADE,
      center_id     UUID REFERENCES players(id) ON DELETE SET NULL,
      left_wing_id  UUID REFERENCES players(id) ON DELETE SET NULL,
      right_wing_id UUID REFERENCES players(id) ON DELETE SET NULL,
      defense_1_id  UUID REFERENCES players(id) ON DELETE SET NULL,
      defense_2_id  UUID REFERENCES players(id) ON DELETE SET NULL,
      goalie_id     UUID REFERENCES players(id) ON DELETE SET NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (game_id, team_id)
    )
  `;

  // One-time data migration: pivot game_lineups rows (one per slot) into
  // game_starting_lineup rows (one per team per game), then drop the old table.
  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'game_lineups'
      ) THEN
        INSERT INTO game_starting_lineup
          (game_id, team_id, center_id, left_wing_id, right_wing_id, defense_1_id, defense_2_id, goalie_id)
        SELECT
          game_id,
          team_id,
          MAX(CASE WHEN position_slot = 'C'  THEN player_id::text END)::uuid,
          MAX(CASE WHEN position_slot = 'LW' THEN player_id::text END)::uuid,
          MAX(CASE WHEN position_slot = 'RW' THEN player_id::text END)::uuid,
          MAX(CASE WHEN position_slot = 'D1' THEN player_id::text END)::uuid,
          MAX(CASE WHEN position_slot = 'D2' THEN player_id::text END)::uuid,
          MAX(CASE WHEN position_slot = 'G'  THEN player_id::text END)::uuid
        FROM game_lineups
        GROUP BY game_id, team_id
        ON CONFLICT (game_id, team_id) DO NOTHING;
      END IF;
    END $$
  `;

  await sql`DROP TABLE IF EXISTS game_lineups`;

  // ── Game rosters ───────────────────────────────────────────────────────────
  // Game-day squad: which players are participating in a specific game.
  // Decoupled from player_teams (the season-wide roster) so removing a player
  // from a game does not affect their standing on the team for the season.
  await sql`
    CREATE TABLE IF NOT EXISTS game_rosters (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      game_id     UUID NOT NULL REFERENCES games(id)   ON DELETE CASCADE,
      team_id     UUID NOT NULL REFERENCES teams(id)   ON DELETE CASCADE,
      player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (game_id, team_id, player_id)
    )
  `;

  // ── Shots on goal per period (now stored inline on games) ─────────────────
  // period_shots is a JSONB array: [{ period, home_shots, away_shots }, ...]
  // Replaces the old game_period_shots table.
  await sql`
    ALTER TABLE games ADD COLUMN IF NOT EXISTS
      period_shots JSONB NOT NULL DEFAULT '[]'
  `;

  // One-time data migration: copy rows from game_period_shots (if it still
  // exists) into games.period_shots as a sorted JSONB array.
  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'game_period_shots'
      ) THEN
        UPDATE games g
        SET period_shots = COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'period',     gps.period,
                'home_shots', gps.home_shots,
                'away_shots', gps.away_shots
              )
              ORDER BY CASE gps.period
                WHEN '1'  THEN 1 WHEN '2' THEN 2 WHEN '3' THEN 3
                WHEN 'OT' THEN 4 WHEN 'SO' THEN 5 ELSE 6 END
            )
            FROM game_period_shots gps
            WHERE gps.game_id = g.id
          ),
          '[]'::jsonb
        )
        WHERE EXISTS (
          SELECT 1 FROM game_period_shots gps WHERE gps.game_id = g.id
        );
      END IF;
    END $$
  `;

  await sql`DROP TABLE IF EXISTS game_period_shots`;

  // ── Goalie stats ───────────────────────────────────────────────────────────
  // One row per goalie per game. shots_against is entered manually.
  // goals_against is derived from the goals table based on entered_period window.
  // saves = shots_against - goals_against (computed server-side).
  // entered_period: the period the goalie entered (NULL = started from period 1).
  await sql`
    CREATE TABLE IF NOT EXISTS game_goalie_stats (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      game_id       UUID NOT NULL REFERENCES games(id)   ON DELETE CASCADE,
      team_id       UUID NOT NULL REFERENCES teams(id)   ON DELETE CASCADE,
      goalie_id     UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      shots_against SMALLINT NOT NULL DEFAULT 0 CHECK (shots_against >= 0),
      entered_period TEXT CHECK (entered_period IN ('1','2','3','OT','SO')),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (game_id, goalie_id)
    )
  `;
  // Migration: add entered_period if missing, drop saves if still present.
  await sql`ALTER TABLE game_goalie_stats ADD COLUMN IF NOT EXISTS entered_period TEXT CHECK (entered_period IN ('1','2','3','OT','SO'))`;
  await sql`ALTER TABLE game_goalie_stats DROP COLUMN IF EXISTS saves`;
  await sql`ALTER TABLE game_goalie_stats ADD COLUMN IF NOT EXISTS sub_time TEXT CHECK (sub_time ~ '^[0-9]{1,2}:[0-5][0-9]$')`;
  await sql`ALTER TABLE game_goalie_stats ADD COLUMN IF NOT EXISTS goals_against INTEGER CHECK (goals_against >= 0)`;

  // ── Goalie stints ─────────────────────────────────────────────────────────
  // One row per goalie stint within a game. Supports a goalie being pulled and
  // re-inserted any number of times (including within the same period).
  // entered_period/entered_time mark the stint start; exited_period/exited_time
  // mark the stint end (NULL exit = goalie was still in net at game end).
  // shots_against and goals_against are stored per-stint; goals_against NULL
  // means "fall back to derivation from the goals table for this window".
  // stint_ord is 1-based and unique per (game_id, team_id).
  // Phase 1 of the goalie-stints migration: this table is dual-written from
  // the same admin endpoints that write game_goalie_stats; reads still come
  // from game_goalie_stats. See rebuild_goalie_stints() below.
  await sql`
    CREATE TABLE IF NOT EXISTS game_goalie_stints (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      game_id         UUID NOT NULL REFERENCES games(id)   ON DELETE CASCADE,
      team_id         UUID NOT NULL REFERENCES teams(id)   ON DELETE CASCADE,
      goalie_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      stint_ord       SMALLINT NOT NULL CHECK (stint_ord >= 1),
      entered_period  TEXT NOT NULL CHECK (entered_period IN ('1','2','3','OT','SO')),
      entered_time    TEXT CHECK (entered_time ~ '^[0-9]{1,2}:[0-5][0-9]$'),
      exited_period   TEXT CHECK (exited_period  IN ('1','2','3','OT','SO')),
      exited_time     TEXT CHECK (exited_time   ~ '^[0-9]{1,2}:[0-5][0-9]$'),
      shots_against   SMALLINT NOT NULL DEFAULT 0 CHECK (shots_against >= 0),
      goals_against   INTEGER  CHECK (goals_against >= 0),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (game_id, team_id, stint_ord)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS game_goalie_stints_game_idx   ON game_goalie_stints(game_id)`;
  await sql`CREATE INDEX IF NOT EXISTS game_goalie_stints_goalie_idx ON game_goalie_stints(goalie_id)`;

  // ── Helper function: rebuild_goalie_stints ────────────────────────────────
  // Idempotently rebuilds the per-stint rows for an entire game from the
  // legacy game_goalie_stats table. Called from each admin write endpoint
  // (PUT/POST switch/DELETE) so the stints table stays in sync without
  // requiring callers to perform multiple ordered statements. Will be removed
  // in Phase 5 once the legacy table is dropped.
  await sql`
    CREATE OR REPLACE FUNCTION rebuild_goalie_stints(p_game_id uuid)
    RETURNS void
    LANGUAGE plpgsql
    AS $func$
    BEGIN
      DELETE FROM game_goalie_stints WHERE game_id = p_game_id;
      INSERT INTO game_goalie_stints (
        game_id, team_id, goalie_id, stint_ord,
        entered_period, entered_time, exited_period, exited_time,
        shots_against, goals_against
      )
      WITH period_vals (p, v) AS (
        VALUES ('1',1),('2',2),('3',3),('OT',4),('SO',5)
      ),
      ordered AS (
        SELECT
          gs.game_id, gs.team_id, gs.goalie_id,
          gs.shots_against, gs.goals_against,
          COALESCE(gs.entered_period, '1')                                    AS entered_period,
          gs.sub_time                                                         AS entered_time,
          ROW_NUMBER() OVER (PARTITION BY gs.team_id ORDER BY pv.v)::smallint AS stint_ord,
          LEAD(COALESCE(gs.entered_period, '1')) OVER (
            PARTITION BY gs.team_id ORDER BY pv.v
          )                                                                   AS exited_period,
          LEAD(gs.sub_time) OVER (
            PARTITION BY gs.team_id ORDER BY pv.v
          )                                                                   AS exited_time
        FROM game_goalie_stats gs
        JOIN period_vals pv ON pv.p = COALESCE(gs.entered_period, '1')
        WHERE gs.game_id = p_game_id
      )
      SELECT
        game_id, team_id, goalie_id, stint_ord,
        entered_period, entered_time, exited_period, exited_time,
        shots_against, goals_against
      FROM ordered;
    END;
    $func$
  `;

  // ── Helper function: rebuild_legacy_goalie_stats ─────────────────────────
  // Reverse direction of rebuild_goalie_stints: summarizes all stints for a
  // game back into the legacy game_goalie_stats table (one row per goalie).
  // Called from each /goalie-stints write endpoint so consumers that still
  // read the legacy table (notably seasons.js) keep working until Phase 5.
  // The reduction is lossy by design — multi-stint goalies collapse to:
  //   shots_against    = SUM(stints.shots_against)
  //   entered_period   = first stint's entered_period (NULL if starter from P1 puck-drop)
  //   sub_time         = first stint's entered_time   (NULL if starter from P1 puck-drop)
  //   goals_against    = SUM(stints.goals_against) when ALL stints have an
  //                      override; NULL otherwise so the legacy CTE can derive.
  // Will be removed in Phase 5 when the legacy table is dropped.
  await sql`
    CREATE OR REPLACE FUNCTION rebuild_legacy_goalie_stats(p_game_id uuid)
    RETURNS void
    LANGUAGE plpgsql
    AS $func$
    BEGIN
      DELETE FROM game_goalie_stats WHERE game_id = p_game_id;
      WITH period_vals (p, v) AS (
        VALUES ('1',1),('2',2),('3',3),('OT',4),('SO',5)
      ),
      stint_pos AS (
        SELECT
          st.id, st.game_id, st.team_id, st.goalie_id, st.stint_ord,
          st.entered_period, st.entered_time,
          st.shots_against, st.goals_against AS override_ga,
          pv.v * 100000
            + COALESCE(
                SPLIT_PART(st.entered_time, ':', 1)::int * 60
                + SPLIT_PART(st.entered_time, ':', 2)::int,
                0
              ) AS pos
        FROM game_goalie_stints st
        JOIN period_vals pv ON pv.p = st.entered_period
        WHERE st.game_id = p_game_id
      ),
      per_goalie AS (
        SELECT
          game_id, team_id, goalie_id,
          SUM(shots_against)::smallint            AS total_sa,
          SUM(COALESCE(override_ga, 0))::int      AS sum_overrides,
          BOOL_AND(override_ga IS NOT NULL)       AS all_overrides
        FROM stint_pos
        GROUP BY game_id, team_id, goalie_id
      ),
      first_stint AS (
        SELECT DISTINCT ON (game_id, team_id, goalie_id)
          game_id, team_id, goalie_id,
          entered_period AS first_entered_period,
          entered_time   AS first_entered_time,
          stint_ord      AS first_stint_ord
        FROM stint_pos
        ORDER BY game_id, team_id, goalie_id, stint_ord
      )
      INSERT INTO game_goalie_stats (
        game_id, team_id, goalie_id, shots_against,
        entered_period, sub_time, goals_against
      )
      SELECT
        pg.game_id, pg.team_id, pg.goalie_id, pg.total_sa,
        CASE WHEN fs.first_stint_ord = 1
              AND fs.first_entered_period = '1'
              AND fs.first_entered_time IS NULL
             THEN NULL ELSE fs.first_entered_period END,
        CASE WHEN fs.first_stint_ord = 1
              AND fs.first_entered_period = '1'
              AND fs.first_entered_time IS NULL
             THEN NULL ELSE fs.first_entered_time END,
        CASE WHEN pg.all_overrides THEN pg.sum_overrides ELSE NULL END
      FROM per_goalie pg
      JOIN first_stint fs
        ON fs.game_id = pg.game_id
       AND fs.team_id = pg.team_id
       AND fs.goalie_id = pg.goalie_id;
    END;
    $func$
  `;

  // One-time backfill: if the stints table is empty but legacy stats exist,
  // rebuild every game with goalie stats. Safe to re-run — the function does a
  // full DELETE+INSERT per game, but the guard ensures we only pay the cost
  // once. After Phase 1 ships, every write keeps the table in sync.
  const stintsCount = await sql`SELECT COUNT(*)::int AS c FROM game_goalie_stints`;
  if (stintsCount[0].c === 0) {
    await sql`
      SELECT rebuild_goalie_stints(g.id)
      FROM games g
      WHERE EXISTS (SELECT 1 FROM game_goalie_stats gs WHERE gs.game_id = g.id)
    `;
  }

  // ── Shootout attempts ──────────────────────────────────────────────────────
  // One row per shot attempt in a shootout (both scored and missed).
  // attempt_order is the overall sequence number across both teams (1-based).
  await sql`
    CREATE TABLE IF NOT EXISTS shootout_attempts (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      game_id       UUID NOT NULL REFERENCES games(id)   ON DELETE CASCADE,
      team_id       UUID NOT NULL REFERENCES teams(id)   ON DELETE CASCADE,
      shooter_id    UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      scored        BOOLEAN NOT NULL DEFAULT FALSE,
      attempt_order INT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // ── Megan Carter jersey-number migration ──────────────────────────────────
  // If her jersey change (23 → 27) was recorded as two separate stints on the
  // same team/season, consolidate them:
  //   1. Insert history entries on the surviving (jersey 27) stint.
  //   2. Back-date that stint's start_date to the original start of the 23 stint.
  //   3. Delete the now-redundant closed (jersey 23) stint.
  // Idempotent: skips the whole block if any history already exists for her.
  await sql`
    DO $$
    DECLARE
      v_player_id    UUID;
      v_old_id       UUID;
      v_new_id       UUID;
      v_old_start    DATE;
      v_change_date  DATE;
    BEGIN
      SELECT id INTO v_player_id
        FROM players
        WHERE first_name = 'Megan' AND last_name = 'Carter'
        LIMIT 1;
      IF v_player_id IS NULL THEN RETURN; END IF;

      -- Skip if already migrated
      IF EXISTS (
        SELECT 1 FROM jersey_number_history jnh
        JOIN player_teams pt ON pt.id = jnh.player_teams_id
        WHERE pt.player_id = v_player_id
      ) THEN RETURN; END IF;

      -- Find the closed jersey-23 stint and the active jersey-27 stint
      -- on the same team and season.
      SELECT
        old_pt.id,
        new_pt.id,
        COALESCE(old_pt.start_date, old_pt.created_at::date),
        COALESCE(new_pt.start_date, old_pt.end_date + INTERVAL '1 day')::date
      INTO v_old_id, v_new_id, v_old_start, v_change_date
      FROM player_teams old_pt
      JOIN player_teams new_pt
        ON  new_pt.player_id  = old_pt.player_id
        AND new_pt.team_id    = old_pt.team_id
        AND new_pt.season_id  = old_pt.season_id
        AND new_pt.jersey_number = 27
        AND new_pt.end_date IS NULL
      WHERE old_pt.player_id    = v_player_id
        AND old_pt.jersey_number = 23
        AND old_pt.end_date IS NOT NULL
      LIMIT 1;

      IF v_new_id IS NULL THEN RETURN; END IF;

      -- Record jersey 23 from original start
      INSERT INTO jersey_number_history (player_teams_id, jersey_number, effective_from)
        VALUES (v_new_id, 23, v_old_start);

      -- Record jersey 27 from change date
      INSERT INTO jersey_number_history (player_teams_id, jersey_number, effective_from)
        VALUES (v_new_id, 27, v_change_date);

      -- Extend the surviving stint back to the original start
      UPDATE player_teams SET start_date = v_old_start WHERE id = v_new_id;

      -- Remove the now-redundant closed stint
      DELETE FROM player_teams WHERE id = v_old_id;
    END$$
  `;

  // ── User favourite teams ───────────────────────────────────────────────────
  // Connects a user to any number of teams across any league.
  await sql`
    CREATE TABLE IF NOT EXISTS user_favorite_teams (
      user_id    UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
      team_id    UUID NOT NULL REFERENCES teams(id)  ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, team_id)
    )
  `;

  // ── User watched games ─────────────────────────────────────────────────────
  // Connects a user to games they plan to watch and/or have already watched.
  await sql`
    CREATE TABLE IF NOT EXISTS user_watched_games (
      user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game_id    UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      watched_at TIMESTAMPTZ,
      watched_on DATE,
      skipped_at TIMESTAMPTZ,
      scheduled_for DATE,
      PRIMARY KEY (user_id, game_id)
    )
  `;
  await sql`ALTER TABLE user_watched_games ALTER COLUMN watched_at DROP NOT NULL`;
  await sql`ALTER TABLE user_watched_games ALTER COLUMN watched_at DROP DEFAULT`;
  await sql`ALTER TABLE user_watched_games ADD COLUMN IF NOT EXISTS watched_on DATE`;
  await sql`ALTER TABLE user_watched_games ADD COLUMN IF NOT EXISTS skipped_at TIMESTAMPTZ`;
  await sql`ALTER TABLE user_watched_games ADD COLUMN IF NOT EXISTS scheduled_for DATE`;
  await sql`
    UPDATE user_watched_games
    SET watched_on = watched_at::date
    WHERE watched_on IS NULL AND watched_at IS NOT NULL
  `;

  // ── Helper function: best available photo for a player ───────────────────
  // Returns the best team/season photo. Exact team-season photo wins; otherwise
  // inherit the latest photo from the same season, then the latest overall.
  // across roster, lineup, goalie, and shootout queries so the logic lives
  // in one place rather than being repeated as a LEFT JOIN LATERAL everywhere.
  await sql`DROP FUNCTION IF EXISTS best_player_photo(uuid)`;
  await sql`DROP FUNCTION IF EXISTS best_player_photo(uuid, uuid, uuid)`;
  await sql`
    CREATE OR REPLACE FUNCTION best_player_photo(pid uuid, sid uuid DEFAULT NULL, tid uuid DEFAULT NULL)
    RETURNS text
    LANGUAGE sql
    STABLE
    AS $$
      SELECT NULLIF(photo, '')
      FROM   player_photos
      WHERE  player_id = pid
        AND  NULLIF(photo, '') IS NOT NULL
        AND  (sid IS NULL OR season_id = sid OR NOT EXISTS (
          SELECT 1 FROM player_photos pp_same
          WHERE pp_same.player_id = pid AND pp_same.season_id = sid
        ))
      ORDER  BY
        CASE
          WHEN sid IS NOT NULL AND tid IS NOT NULL AND season_id = sid AND team_id = tid THEN 0
          WHEN sid IS NOT NULL AND season_id = sid THEN 1
          ELSE 2
        END,
        created_at DESC
      LIMIT  1
    $$
  `;

  // ── Group role ────────────────────────────────────────────────────────────
  // Semantic role of a top-level group used by the playoff qualification engine.
  // 'conference' — a conference-level grouping (e.g. Eastern, Western).
  // 'division'   — a division-level grouping (e.g. Atlantic, Metropolitan).
  // NULL          — the group has no special playoff role.
  await sql`
    ALTER TABLE groups
      ADD COLUMN IF NOT EXISTS role TEXT
        CHECK (role IN ('conference', 'division'))
  `;

  // ── League playoff qualification format ───────────────────────────────────
  // JSONB array of qualification rules evaluated in order.
  // Each rule: { scope: 'league'|'conference'|'division', method: 'top'|'wildcard', count: N }
  // Examples:
  //   PWHL (top 4 overall): [{"scope":"league","method":"top","count":4}]
  //   NHL  (top 3/div + 2 WC/conf):
  //     [{"scope":"division","method":"top","count":3},
  //      {"scope":"conference","method":"wildcard","count":2}]
  await sql`
    ALTER TABLE leagues
      ADD COLUMN IF NOT EXISTS playoff_format JSONB
  `;

  // playoff_format on seasons — per-season override of the qualification rules.
  // Stored as ordered JSONB array identical in shape to leagues.playoff_format.
  await sql`
    ALTER TABLE seasons
      ADD COLUMN IF NOT EXISTS playoff_format JSONB
  `;

  // ── Bracket rule sets ─────────────────────────────────────────────────────
  // A named, reusable collection of bracket slot assignment rules owned by a
  // league.  Multiple seasons in the same league can reference the same set so
  // the bracket structure only needs to be configured once.
  await sql`
    CREATE TABLE IF NOT EXISTS bracket_rule_sets (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      league_id   UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // ── Bracket slot rules ────────────────────────────────────────────────────
  // One row per configured bracket slot within a rule set.  Slots with no rule
  // ('none') are omitted — they default to unassigned at query time.
  //
  // slot_key   : 'r{round}m{matchupIndex}{team1|team2}', e.g. 'r1m0team1'
  //              team1 always holds home-ice advantage for the series.
  // rule_type  : 'seed' | 'choice' | 'unchosen' | 'winner'
  //   seed     — #rank team from scope (league / conference / division)
  //   choice   — a high seed picks from a pool of eligibles (pool JSONB)
  //   unchosen — the leftover team after a choice pick (choice_ref → slot_key)
  //   winner   — winner of a prior-round matchup (matchup_ref e.g. 'r1m0')
  await sql`
    CREATE TABLE IF NOT EXISTS bracket_slot_rules (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_set_id  UUID NOT NULL REFERENCES bracket_rule_sets(id) ON DELETE CASCADE,
      slot_key     TEXT NOT NULL,
      rule_type    TEXT NOT NULL
                     CHECK (rule_type IN ('seed', 'choice', 'unchosen', 'winner')),
      rank         SMALLINT CHECK (rank BETWEEN 1 AND 16),
      scope        TEXT CHECK (scope IN ('league', 'conference', 'division', 'specific_conference', 'specific_division')),
      group_id     UUID REFERENCES groups(id) ON DELETE SET NULL,
      pool         JSONB NOT NULL DEFAULT '[]',
      choice_ref   TEXT,
      matchup_ref  TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (rule_set_id, slot_key)
    )
  `;

  // ── Migrate slot_key suffix: home→team2, away→team1 ─────────────────────────
  // The old convention used 'home'/'away'; the new convention uses 'team1'/'team2'
  // where team1 always holds home-ice advantage.
  await sql`
    UPDATE bracket_slot_rules
    SET slot_key = regexp_replace(
                    regexp_replace(slot_key, 'home$', 'team2'),
                    'away$', 'team1')
    WHERE slot_key ~ '(home|away)$'
  `;

  // ── Widen bracket_slot_rules.scope to include specific_conference / specific_division ──
  // Wrapped in a single DO block so it is one round-trip to Neon and fully atomic.
  await sql`
    DO $$
    BEGIN
      ALTER TABLE bracket_slot_rules
        DROP CONSTRAINT IF EXISTS bracket_slot_rules_scope_check;
      ALTER TABLE bracket_slot_rules
        ADD CONSTRAINT bracket_slot_rules_scope_check
          CHECK (scope IN ('league', 'conference', 'division', 'specific_conference', 'specific_division'));
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END $$
  `;

  // ── Add group_id to bracket_slot_rules (for specific_conference / specific_division) ──
  await sql`
    ALTER TABLE bracket_slot_rules
      ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL
  `;

  // ── Link seasons to a bracket rule set ───────────────────────────────────
  // ON DELETE SET NULL keeps the season intact when a rule set is deleted.
  await sql`
    ALTER TABLE seasons
      ADD COLUMN IF NOT EXISTS bracket_rule_set_id UUID
        REFERENCES bracket_rule_sets(id) ON DELETE SET NULL
  `;

  // Custom display names for each playoff round, keyed by round number string.
  // e.g. { "1": "Wild Card", "2": "Division Series", "3": "Conference Finals", "4": "Stanley Cup Final" }
  // Null means all rounds fall back to the default label (getRoundLabel).
  await sql`
    ALTER TABLE bracket_rule_sets
      ADD COLUMN IF NOT EXISTS round_names JSONB
  `;

  // Game-rule overrides per season — nullable, falls back to league defaults when NULL.
  // best_of_playoff: number of games needed to win a series (2=Bo3, 3=Bo5, 4=Bo7).
  await sql`
    ALTER TABLE seasons
      ADD COLUMN IF NOT EXISTS best_of_playoff SMALLINT
        CHECK (best_of_playoff IN (3, 5, 7))
  `;
  // best_of_shootout: rounds before sudden death in a shootout (3, 5, or 7).
  await sql`
    ALTER TABLE seasons
      ADD COLUMN IF NOT EXISTS best_of_shootout SMALLINT
        CHECK (best_of_shootout IN (3, 5, 7))
  `;
  // scoring_system: points awarded per game result for this season.
  await sql`
    ALTER TABLE seasons
      ADD COLUMN IF NOT EXISTS scoring_system TEXT
        CHECK (scoring_system IN ('2-1-0', '3-2-1-0'))
  `;

  // playoffs_started: true once the admin has formally ended the regular season
  // and the bracket / playoff matchup configuration phase has begun.
  // Distinct from is_ended (which marks the whole season complete, including playoffs).
  await sql`
    ALTER TABLE seasons
      ADD COLUMN IF NOT EXISTS playoffs_started BOOLEAN NOT NULL DEFAULT FALSE
  `;

  // ── One-time data migration tracking ─────────────────────────────────────────
  // Lightweight table so non-idempotent data fixes run exactly once.
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Player acquisition type backfill
  // One-time player acquisition type backfill for older roster data.
  // The values remain valid for future use; this only reclassifies existing rows
  // that were recorded before Expansion Draft and Team Transfer were available.
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM _migrations WHERE name = 'backfill_player_team_acquisition_types_v1'
      ) THEN
        UPDATE player_teams
        SET acquisition_type = CASE acquisition_type
          WHEN 'other' THEN 'expansion_draft'
          WHEN 'loan' THEN 'team_transfer'
          ELSE acquisition_type
        END
        WHERE acquisition_type IN ('other', 'loan');

        INSERT INTO _migrations (name) VALUES ('backfill_player_team_acquisition_types_v1');
      END IF;
    END $$
  `;

  // ── Swap home/away on existing scheduled playoff games ────────────────────
  // The old bracket slot convention used 'home'/'away' suffixes where 'away'
  // mapped to Team 1 (home ice). The new convention uses 'team1'/'team2', and
  // home_team_id in both the series and generated games must be Team 1.
  // This one-time fix swaps home_team_id ↔ away_team_id for all scheduled
  // playoff games so they match the corrected seeding logic.
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM _migrations WHERE name = 'swap_playoff_game_home_away_v1'
      ) THEN
        UPDATE games
        SET home_team_id = away_team_id,
            away_team_id = home_team_id
        WHERE game_type = 'playoff'
          AND status    = 'scheduled';

        INSERT INTO _migrations (name) VALUES ('swap_playoff_game_home_away_v1');
      END IF;
    END $$
  `;

  // ── Backfill playoff series win counts from finalized games ──────────────
  // Before automatic win tracking was added, home_wins / away_wins were never
  // incremented when a game was finalized. This one-time migration recalculates
  // win counts for every playoff series by counting goals in final games.
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM _migrations WHERE name = 'backfill_playoff_series_wins_v1'
      ) THEN
        UPDATE playoff_series ps
        SET
          home_wins = wins.home_wins,
          away_wins = wins.away_wins,
          status = CASE
            WHEN wins.home_wins >= ps.games_to_win OR wins.away_wins >= ps.games_to_win THEN 'complete'
            WHEN wins.home_wins > 0 OR wins.away_wins > 0 THEN 'active'
            ELSE ps.status
          END,
          winner_team_id = CASE
            WHEN wins.home_wins >= ps.games_to_win THEN ps.home_team_id
            WHEN wins.away_wins >= ps.games_to_win THEN ps.away_team_id
            ELSE ps.winner_team_id
          END
        FROM (
          SELECT
            g.playoff_series_id,
            SUM(CASE
              WHEN goal_counts.home_goals > goal_counts.away_goals AND g.home_team_id = ps2.home_team_id THEN 1
              WHEN goal_counts.away_goals > goal_counts.home_goals AND g.away_team_id = ps2.home_team_id THEN 1
              ELSE 0
            END)::int AS home_wins,
            SUM(CASE
              WHEN goal_counts.home_goals > goal_counts.away_goals AND g.home_team_id = ps2.away_team_id THEN 1
              WHEN goal_counts.away_goals > goal_counts.home_goals AND g.away_team_id = ps2.away_team_id THEN 1
              ELSE 0
            END)::int AS away_wins
          FROM games g
          JOIN playoff_series ps2 ON ps2.id = g.playoff_series_id
          JOIN LATERAL (
            SELECT
              COUNT(*) FILTER (WHERE go.team_id = g.home_team_id) AS home_goals,
              COUNT(*) FILTER (WHERE go.team_id = g.away_team_id) AS away_goals
            FROM goals go
            WHERE go.game_id = g.id
          ) goal_counts ON true
          WHERE g.status = 'final'
            AND g.playoff_series_id IS NOT NULL
          GROUP BY g.playoff_series_id
        ) wins
        WHERE ps.id = wins.playoff_series_id;

        INSERT INTO _migrations (name) VALUES ('backfill_playoff_series_wins_v1');
      END IF;
    END $$
  `;

  // ── bracket_slot_key on playoff_series ───────────────────────────────────
  // Stores the bracket matchup key (e.g. 'r1m0', 'r2m1') so the server can
  // look up which next-round slot a completed series feeds into and
  // auto-create that next-round series when both feeder series are done.
  await sql`
    ALTER TABLE playoff_series
      ADD COLUMN IF NOT EXISTS bracket_slot_key TEXT
  `;

  // ── Allow partial series (one team TBD) ──────────────────────────────────
  // A series can be created with only one team known when an admin manually
  // advances a winner before the opposing series has finished.  Both columns
  // are filled in (and games generated) only when both teams are determined.
  await sql`ALTER TABLE playoff_series ALTER COLUMN home_team_id DROP NOT NULL`;
  await sql`ALTER TABLE playoff_series ALTER COLUMN away_team_id DROP NOT NULL`;

  console.log('Database schema ready');
}

module.exports = { sql, db, schema, initSchema };

