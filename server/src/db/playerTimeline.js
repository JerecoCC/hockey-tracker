/**
 * Installs the canonical temporal player model.
 *
 * Read player_season_rosters and write player_team_stints /
 * player_jersey_stints. The view derives each season's roster from the team
 * stints alone; the legacy player_teams snapshots are kept on disk for now but
 * no longer feed it, since they disagreed with the stints mostly where the
 * stints had since been corrected.
 */
async function ensurePlayerTimelineSchema(sql) {
  await sql`
    ALTER TABLE player_team_stints
      ADD COLUMN IF NOT EXISTS is_prospect BOOLEAN NOT NULL DEFAULT FALSE
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS player_jersey_stints (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      player_id      UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      jersey_number  SMALLINT NOT NULL CHECK (jersey_number BETWEEN 0 AND 99),
      start_date     DATE NOT NULL,
      end_date       DATE,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (end_date IS NULL OR end_date >= start_date)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS season_projected_lineup_slots (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      season_id   UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
      team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      slot_key    TEXT NOT NULL,
      sort_order  SMALLINT NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (season_id, team_id, slot_key),
      UNIQUE (season_id, team_id, player_id)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS season_projected_lineup_team_lookup
      ON season_projected_lineup_slots (season_id, team_id, sort_order, slot_key)
  `;

  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM _migrations WHERE name = 'canonical_player_timelines_v1'
      ) THEN
        -- Preserve the latest known roster role on the long-lived affiliation.
        WITH latest AS (
          SELECT DISTINCT ON (pt.player_id, pt.team_id)
            pt.player_id,
            pt.team_id,
            pt.is_prospect
          FROM player_teams pt
          JOIN seasons s ON s.id = pt.season_id
          ORDER BY
            pt.player_id,
            pt.team_id,
            s.start_date DESC NULLS LAST,
            pt.created_at DESC,
            pt.id DESC
        )
        UPDATE player_team_stints pts
        SET is_prospect = latest.is_prospect
        FROM latest
        WHERE latest.player_id = pts.player_id
          AND latest.team_id = pts.team_id;

        -- The previous migration intentionally kept unknown dates null. For
        -- derived season rosters we need a conservative lower bound, so use
        -- the earliest season in which the affiliation is explicitly recorded.
        WITH inferred AS (
          SELECT
            pts.id,
            MIN(COALESCE(pt.start_date, s.start_date, pt.created_at::date)) AS start_date
          FROM player_team_stints pts
          JOIN player_teams pt
            ON pt.player_id = pts.player_id
           AND pt.team_id = pts.team_id
          JOIN seasons s ON s.id = pt.season_id
          WHERE pts.start_date IS NULL
            AND pts.import_source IS NULL
          GROUP BY pts.id
        )
        UPDATE player_team_stints pts
        SET start_date = inferred.start_date
        FROM inferred
        WHERE pts.id = inferred.id
          AND inferred.start_date IS NOT NULL;

        -- Resolve multiple legacy open affiliations using the next known team
        -- start. Imported timelines keep their source-provided boundaries.
        WITH ordered AS (
          SELECT
            id,
            LEAD(start_date) OVER (
              PARTITION BY player_id
              ORDER BY start_date, created_at, id
            ) AS next_start
          FROM player_team_stints
          WHERE start_date IS NOT NULL
        )
        UPDATE player_team_stints pts
        SET end_date = ordered.next_start - 1
        FROM ordered
        WHERE pts.id = ordered.id
          AND pts.import_source IS NULL
          AND pts.end_date IS NULL
          AND ordered.next_start IS NOT NULL;

        -- Convert season-bound jersey snapshots and the existing change log
        -- into one effective-dated timeline. Repeated identical numbers across
        -- adjacent seasons collapse into a single assignment.
        WITH raw_events AS (
          SELECT
            pt.player_id,
            jnh.jersey_number,
            jnh.effective_from AS event_date,
            2 AS priority,
            jnh.created_at
          FROM jersey_number_history jnh
          JOIN player_teams pt ON pt.id = jnh.player_teams_id

          UNION ALL

          SELECT
            pt.player_id,
            pt.jersey_number,
            COALESCE(pt.start_date, s.start_date, pt.created_at::date) AS event_date,
            1 AS priority,
            pt.created_at
          FROM player_teams pt
          JOIN seasons s ON s.id = pt.season_id
          WHERE pt.jersey_number IS NOT NULL
        ),
        deduped AS (
          SELECT DISTINCT ON (player_id, event_date)
            player_id, jersey_number, event_date, created_at
          FROM raw_events
          WHERE event_date IS NOT NULL
          ORDER BY player_id, event_date, priority DESC, created_at DESC
        ),
        marked AS (
          SELECT
            *,
            CASE
              WHEN LAG(jersey_number) OVER (
                PARTITION BY player_id ORDER BY event_date, created_at
              ) IS DISTINCT FROM jersey_number
              THEN 1 ELSE 0
            END AS starts_group
          FROM deduped
        ),
        grouped AS (
          SELECT
            *,
            SUM(starts_group) OVER (
              PARTITION BY player_id ORDER BY event_date, created_at
            ) AS jersey_group
          FROM marked
        ),
        assignments AS (
          SELECT
            player_id,
            jersey_number,
            MIN(event_date) AS start_date,
            LEAD(MIN(event_date)) OVER (
              PARTITION BY player_id ORDER BY MIN(event_date)
            ) - 1 AS end_date,
            MIN(created_at) AS created_at
          FROM grouped
          GROUP BY player_id, jersey_number, jersey_group
        )
        INSERT INTO player_jersey_stints (
          player_id, jersey_number, start_date, end_date, created_at
        )
        SELECT player_id, jersey_number, start_date, end_date, created_at
        FROM assignments;

        INSERT INTO _migrations (name) VALUES ('canonical_player_timelines_v1');
      END IF;
    END $$
  `;

  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM _migrations
        WHERE name = 'canonical_player_timelines_v3_player_wide_jerseys'
      ) THEN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'player_jersey_stints'
            AND column_name = 'team_id'
        ) THEN
          CREATE TEMP TABLE canonical_player_jersey_stints ON COMMIT DROP AS
          WITH deduped AS (
            SELECT DISTINCT ON (player_id, start_date)
              id,
              player_id,
              jersey_number,
              start_date,
              created_at
            FROM player_jersey_stints
            ORDER BY player_id, start_date, created_at DESC, id DESC
          ),
          marked AS (
            SELECT
              *,
              CASE
                WHEN LAG(jersey_number) OVER (
                  PARTITION BY player_id ORDER BY start_date, created_at, id
                ) IS DISTINCT FROM jersey_number
                THEN 1 ELSE 0
              END AS starts_group
            FROM deduped
          ),
          grouped AS (
            SELECT
              *,
              SUM(starts_group) OVER (
                PARTITION BY player_id ORDER BY start_date, created_at, id
              ) AS jersey_group
            FROM marked
          ),
          collapsed AS (
            SELECT
              (ARRAY_AGG(id ORDER BY start_date, created_at, id))[1] AS id,
              player_id,
              jersey_number,
              MIN(start_date) AS start_date,
              MIN(created_at) AS created_at
            FROM grouped
            GROUP BY player_id, jersey_number, jersey_group
          )
          SELECT
            id,
            player_id,
            jersey_number,
            start_date,
            LEAD(start_date) OVER (
              PARTITION BY player_id ORDER BY start_date, created_at, id
            ) - 1 AS end_date,
            created_at
          FROM collapsed;

          DROP VIEW IF EXISTS player_season_rosters;
          TRUNCATE player_jersey_stints;
          ALTER TABLE player_jersey_stints DROP COLUMN team_id;

          INSERT INTO player_jersey_stints (
            id, player_id, jersey_number, start_date, end_date, created_at
          )
          SELECT id, player_id, jersey_number, start_date, end_date, created_at
          FROM canonical_player_jersey_stints;
        END IF;

        INSERT INTO _migrations (name)
        VALUES ('canonical_player_timelines_v3_player_wide_jerseys');
      END IF;
    END $$
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS player_jersey_stints_lookup
      ON player_jersey_stints (player_id, start_date DESC, end_date)
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS player_jersey_stints_effective_start_unique
      ON player_jersey_stints (player_id, start_date)
  `;

  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM _migrations
        WHERE name = 'canonical_player_timelines_v2_exclusive_boundaries'
      ) THEN
        WITH next_stints AS (
          SELECT
            current_stint.id,
            MIN(next_stint.start_date) AS next_start
          FROM player_team_stints current_stint
          JOIN player_team_stints next_stint
            ON next_stint.player_id = current_stint.player_id
           AND next_stint.id <> current_stint.id
           AND next_stint.start_date IS NOT NULL
           AND current_stint.end_date = next_stint.start_date
          WHERE current_stint.import_source IS NULL
          GROUP BY current_stint.id
        )
        UPDATE player_team_stints stint
        SET end_date = next_stints.next_start - 1
        FROM next_stints
        WHERE stint.id = next_stints.id;

        INSERT INTO _migrations (name)
        VALUES ('canonical_player_timelines_v2_exclusive_boundaries');
      END IF;
    END $$
  `;

  await sql`
    CREATE OR REPLACE VIEW season_participant_teams AS
    SELECT season_id, team_id
    FROM season_teams

    UNION

    SELECT season.id AS season_id, alignment_team.team_id
    FROM seasons season
    JOIN group_alignment_sets alignment
      ON alignment.id = season.group_alignment_set_id
     AND alignment.structure_type = 'league'
    JOIN group_alignment_set_teams alignment_team
      ON alignment_team.alignment_set_id = alignment.id

    UNION

    SELECT override.season_id, override.team_id
    FROM season_alignment_group_teams override
    JOIN seasons season ON season.id = override.season_id
    JOIN group_alignment_sets alignment
      ON alignment.id = season.group_alignment_set_id
     AND alignment.structure_type = 'groups'
    JOIN group_alignment_groups alignment_group
      ON alignment_group.id = override.alignment_group_id
     AND alignment_group.alignment_set_id = alignment.id

    UNION

    SELECT season.id AS season_id, alignment_team.team_id
    FROM seasons season
    JOIN group_alignment_sets alignment
      ON alignment.id = season.group_alignment_set_id
     AND alignment.structure_type = 'groups'
    JOIN group_alignment_groups alignment_group
      ON alignment_group.alignment_set_id = alignment.id
    JOIN group_alignment_teams alignment_team
      ON alignment_team.alignment_group_id = alignment_group.id
    WHERE NOT EXISTS (
      SELECT 1
      FROM season_alignment_group_teams override
      WHERE override.season_id = season.id
        AND override.alignment_group_id = alignment_group.id
    )

    UNION

    SELECT season_id, team_id
    FROM season_group_teams
  `;

  await sql`
    CREATE OR REPLACE VIEW player_season_rosters AS
    SELECT
      pts.id,
      pts.player_id,
      pts.team_id,
      season.id AS season_id,
      jersey.jersey_number,
      pts.is_prospect,
      pts.position,
      NULL::text AS photo,
      pts.acquisition_type,
      pts.start_date,
      pts.end_date,
      pts.created_at,
      pts.id AS player_team_stint_id,
      'derived'::text AS roster_source
    FROM player_team_stints pts
    JOIN teams team ON team.id = pts.team_id
    JOIN season_participant_teams season_team ON season_team.team_id = pts.team_id
    JOIN seasons season
      ON season.id = season_team.season_id
     AND season.league_id = team.league_id
     AND COALESCE(pts.start_date, DATE '-infinity') <= COALESCE(season.end_date, DATE 'infinity')
     AND COALESCE(pts.end_date, DATE 'infinity') >= season.start_date
    LEFT JOIN LATERAL (
      SELECT pjs.jersey_number
      FROM player_jersey_stints pjs
      WHERE pjs.player_id = pts.player_id
        AND pjs.start_date <= LEAST(
          COALESCE(pts.end_date, DATE 'infinity'),
          COALESCE(season.end_date, CURRENT_DATE)
        )
        AND (
          pjs.end_date IS NULL
          OR pjs.end_date >= GREATEST(
            COALESCE(pts.start_date, DATE '-infinity'),
            season.start_date
          )
        )
      ORDER BY pjs.start_date DESC, pjs.created_at DESC
      LIMIT 1
    ) jersey ON TRUE
  `;

  await mergeDuplicateTeamStints(sql);
  await ensureGameRosterJerseyNumbers(sql);
  await correctStintBoundariesFromGames(sql);
}

/**
 * Repairs two kinds of stint boundary the data audit found:
 *
 * 1. Players who dressed in a preseason game before their new stint began,
 *    left over from roster adds that opened on the season start. The stint is
 *    pulled back to the first game they played for that team.
 * 2. An older stint on another team that runs into the newer one, most often
 *    by a day because provider imports were skipped by the v2 boundary fix.
 *    It now ends the day before the next team begins.
 *
 * Game days are read as the stored schedule day (UTC), which is what the app
 * displays. Three players whose trade records need a manual look are left
 * exactly as they are.
 */
async function correctStintBoundariesFromGames(sql) {
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM _migrations WHERE name = 'player_team_stints_game_boundaries_v1'
      ) THEN
        WITH game_days AS (
          SELECT gr.player_id, gr.team_id, (g.scheduled_at AT TIME ZONE 'UTC')::date AS day
          FROM game_rosters gr
          JOIN games g ON g.id = gr.game_id
          WHERE g.status = 'final'
            AND g.game_type = 'preseason'
            AND g.scheduled_at IS NOT NULL
            AND gr.player_id NOT IN (
              '6672ce7b-40cc-4ae6-a4e1-d6bfd9671fdb', -- Samuel Ersson
              '32d82fec-f765-4664-a563-a3933ad8db92', -- Logan Mailloux
              'a6a176d9-3d19-40af-9c6c-dddf2473f066'  -- Cole Smith
            )
        ),
        uncovered AS (
          SELECT d.player_id, d.team_id, d.day
          FROM game_days d
          WHERE NOT EXISTS (
            SELECT 1 FROM player_team_stints s
            WHERE s.player_id = d.player_id
              AND s.team_id = d.team_id
              AND (s.start_date IS NULL OR s.start_date <= d.day)
              AND (s.end_date IS NULL OR s.end_date >= d.day)
          )
        ),
        attached AS (
          SELECT u.day, (
            SELECT s.id FROM player_team_stints s
            WHERE s.player_id = u.player_id
              AND s.team_id = u.team_id
              AND s.start_date > u.day
            ORDER BY s.start_date
            LIMIT 1
          ) AS stint_id
          FROM uncovered u
        ),
        backdate AS (
          SELECT stint_id AS id, min(day) AS new_start
          FROM attached
          WHERE stint_id IS NOT NULL
          GROUP BY stint_id
        )
        UPDATE player_team_stints stint
        SET start_date = backdate.new_start
        FROM backdate
        WHERE stint.id = backdate.id;

        -- Runs after the backdating so each previous team ends before the
        -- corrected start rather than the old one.
        WITH trim AS (
          SELECT a.id, min(b.start_date) - 1 AS new_end
          FROM player_team_stints a
          JOIN player_team_stints b
            ON b.player_id = a.player_id
           AND b.team_id <> a.team_id
           AND COALESCE(a.start_date, DATE '-infinity') < b.start_date
           AND a.end_date IS NOT NULL
           AND a.end_date >= b.start_date
           AND (b.end_date IS NULL OR b.end_date > a.end_date)
          WHERE a.player_id NOT IN (
            '6672ce7b-40cc-4ae6-a4e1-d6bfd9671fdb', -- Samuel Ersson
            '32d82fec-f765-4664-a563-a3933ad8db92', -- Logan Mailloux
            'a6a176d9-3d19-40af-9c6c-dddf2473f066'  -- Cole Smith
          )
          GROUP BY a.id
        )
        UPDATE player_team_stints stint
        SET end_date = trim.new_end
        FROM trim
        WHERE stint.id = trim.id;

        INSERT INTO _migrations (name) VALUES ('player_team_stints_game_boundaries_v1');
      END IF;
    END $$
  `;
}

/**
 * The same affiliation recorded twice (same player, team and window) used to
 * sit behind one legacy snapshot; now that rosters read the stints directly it
 * would list the player twice. Keeps the most complete row.
 */
async function mergeDuplicateTeamStints(sql) {
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM _migrations WHERE name = 'player_team_stints_merge_duplicates_v1'
      ) THEN
        WITH ranked AS (
          SELECT
            id,
            row_number() OVER (
              PARTITION BY player_id, team_id, start_date, end_date
              ORDER BY
                (position IS NOT NULL) DESC,
                (acquisition_type IS NOT NULL) DESC,
                created_at
            ) AS rn
          FROM player_team_stints
        )
        DELETE FROM player_team_stints stint
        USING ranked
        WHERE stint.id = ranked.id AND ranked.rn > 1;

        INSERT INTO _migrations (name) VALUES ('player_team_stints_merge_duplicates_v1');
      END IF;
    END $$
  `;
}

/**
 * A game roster records the number each player actually wore, so a finished
 * game no longer depends on the jersey timeline being right after the fact and
 * the next game can default to what was worn last. Games without a recorded
 * number still fall back to the jersey timeline when read.
 */
async function ensureGameRosterJerseyNumbers(sql) {
  await sql`
    ALTER TABLE game_rosters
      ADD COLUMN IF NOT EXISTS jersey_number SMALLINT
        CHECK (jersey_number BETWEEN 0 AND 99)
  `;

  // Only finished games are frozen: a scheduled game should still pick up a
  // number change made before it is played.
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM _migrations WHERE name = 'game_roster_jersey_numbers_v1'
      ) THEN
        UPDATE game_rosters gr
        SET jersey_number = (
          SELECT pjs.jersey_number
          FROM player_jersey_stints pjs
          WHERE pjs.player_id = gr.player_id
            AND pjs.start_date <= g.scheduled_at::date
            AND (pjs.end_date IS NULL OR pjs.end_date >= g.scheduled_at::date)
          ORDER BY pjs.start_date DESC, pjs.created_at DESC
          LIMIT 1
        )
        FROM games g
        WHERE g.id = gr.game_id
          AND g.status = 'final'
          AND g.scheduled_at IS NOT NULL
          AND gr.jersey_number IS NULL;

        INSERT INTO _migrations (name) VALUES ('game_roster_jersey_numbers_v1');
      END IF;
    END $$
  `;
}

module.exports = { ensurePlayerTimelineSchema };
