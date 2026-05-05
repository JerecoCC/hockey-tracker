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
  await sql`ALTER TABLE player_teams ADD COLUMN IF NOT EXISTS position TEXT CHECK (position IN ('C', 'LW', 'RW', 'D', 'G'))`;

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

  // ── Jersey number history ──────────────────────────────────────────────────
  // Tracks every jersey number a player wore within a stint, with the date the
  // number became effective. The current jersey_number on player_teams is a
  // denormalised copy of the most-recent entry here.
  // Changing a jersey number never creates a new stint — it appends a row here.
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
  // goal_type defaults to even-strength; own-goals have no assist columns.
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
                       'own'
                     )),
      period_time  TEXT CHECK (period_time ~ '^[0-9]{1,2}:[0-5][0-9]$'),
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
  // Migrate legacy 'empty-net' goal_type rows: mark empty_net = true and reclassify as
  // 'even-strength' (the most common scenario — adjust if other strengths existed).
  await sql`
    UPDATE goals
    SET empty_net = TRUE, goal_type = 'even-strength'
    WHERE goal_type = 'empty-net'
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
  // One row per goalie per game. shots_against and saves are entered manually.
  // save_pct is derived client-side as saves / shots_against.
  await sql`
    CREATE TABLE IF NOT EXISTS game_goalie_stats (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      game_id       UUID NOT NULL REFERENCES games(id)   ON DELETE CASCADE,
      team_id       UUID NOT NULL REFERENCES teams(id)   ON DELETE CASCADE,
      goalie_id     UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      shots_against SMALLINT NOT NULL DEFAULT 0 CHECK (shots_against >= 0),
      saves         SMALLINT NOT NULL DEFAULT 0 CHECK (saves >= 0),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (game_id, goalie_id)
    )
  `;

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

  // ── Helper function: best available photo for a player ───────────────────
  // Returns the photo from the most recent player_teams stint that has a
  // non-null photo (active stint first, then most-recently-started historical
  // stint). Used as COALESCE(pt.photo, best_player_photo(p.id), p.photo)
  // across roster, lineup, goalie, and shootout queries so the logic lives
  // in one place rather than being repeated as a LEFT JOIN LATERAL everywhere.
  await sql`
    CREATE OR REPLACE FUNCTION best_player_photo(pid uuid)
    RETURNS text
    LANGUAGE sql
    STABLE
    AS $$
      SELECT photo
      FROM   player_teams
      WHERE  player_id = pid
        AND  photo IS NOT NULL
      ORDER  BY end_date DESC NULLS FIRST, created_at DESC
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
  // slot_key   : 'r{round}m{matchupIndex}{away|home}', e.g. 'r1m0away'
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

  console.log('Database schema ready');
}

module.exports = { sql, initSchema };

