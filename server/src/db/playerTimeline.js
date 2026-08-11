/**
 * Installs the canonical temporal player model while preserving player_teams
 * as a legacy season snapshot during the migration period.
 *
 * New code should read player_season_rosters and write player_team_stints /
 * player_jersey_stints. The compatibility view returns legacy rows when they
 * exist and derives only missing season rows from an overlapping team stint.
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
      team_id        UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      jersey_number  SMALLINT NOT NULL CHECK (jersey_number BETWEEN 0 AND 99),
      start_date     DATE NOT NULL,
      end_date       DATE,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (end_date IS NULL OR end_date >= start_date)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS player_jersey_stints_lookup
      ON player_jersey_stints (player_id, team_id, start_date DESC, end_date)
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS player_jersey_stints_effective_start_unique
      ON player_jersey_stints (player_id, team_id, start_date)
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
            pt.team_id,
            jnh.jersey_number,
            jnh.effective_from AS event_date,
            2 AS priority,
            jnh.created_at
          FROM jersey_number_history jnh
          JOIN player_teams pt ON pt.id = jnh.player_teams_id

          UNION ALL

          SELECT
            pt.player_id,
            pt.team_id,
            pt.jersey_number,
            COALESCE(pt.start_date, s.start_date, pt.created_at::date) AS event_date,
            1 AS priority,
            pt.created_at
          FROM player_teams pt
          JOIN seasons s ON s.id = pt.season_id
          WHERE pt.jersey_number IS NOT NULL
        ),
        deduped AS (
          SELECT DISTINCT ON (player_id, team_id, event_date)
            player_id, team_id, jersey_number, event_date, created_at
          FROM raw_events
          WHERE event_date IS NOT NULL
          ORDER BY player_id, team_id, event_date, priority DESC, created_at DESC
        ),
        marked AS (
          SELECT
            *,
            CASE
              WHEN LAG(jersey_number) OVER (
                PARTITION BY player_id, team_id ORDER BY event_date, created_at
              ) IS DISTINCT FROM jersey_number
              THEN 1 ELSE 0
            END AS starts_group
          FROM deduped
        ),
        grouped AS (
          SELECT
            *,
            SUM(starts_group) OVER (
              PARTITION BY player_id, team_id ORDER BY event_date, created_at
            ) AS jersey_group
          FROM marked
        ),
        assignments AS (
          SELECT
            player_id,
            team_id,
            jersey_number,
            MIN(event_date) AS start_date,
            LEAD(MIN(event_date)) OVER (
              PARTITION BY player_id, team_id ORDER BY MIN(event_date)
            ) - 1 AS end_date,
            MIN(created_at) AS created_at
          FROM grouped
          GROUP BY player_id, team_id, jersey_number, jersey_group
        )
        INSERT INTO player_jersey_stints (
          player_id, team_id, jersey_number, start_date, end_date, created_at
        )
        SELECT player_id, team_id, jersey_number, start_date, end_date, created_at
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
      pt.id,
      pt.player_id,
      pt.team_id,
      pt.season_id,
      COALESCE(jersey.jersey_number, pt.jersey_number) AS jersey_number,
      pt.is_prospect,
      pt.position,
      pt.photo,
      pt.acquisition_type,
      pt.start_date,
      pt.end_date,
      pt.created_at,
      affiliation.id AS player_team_stint_id,
      'legacy'::text AS roster_source
    FROM player_teams pt
    JOIN seasons season ON season.id = pt.season_id
    LEFT JOIN LATERAL (
      SELECT pts.id
      FROM player_team_stints pts
      WHERE pts.player_id = pt.player_id
        AND pts.team_id = pt.team_id
        AND COALESCE(pts.start_date, DATE '-infinity') <= COALESCE(season.end_date, DATE 'infinity')
        AND COALESCE(pts.end_date, DATE 'infinity') >= season.start_date
      ORDER BY pts.start_date DESC NULLS LAST, pts.created_at DESC
      LIMIT 1
    ) affiliation ON TRUE
    LEFT JOIN LATERAL (
      SELECT pjs.jersey_number
      FROM player_jersey_stints pjs
      WHERE pjs.player_id = pt.player_id
        AND pjs.team_id = pt.team_id
        AND pjs.start_date <= COALESCE(season.end_date, CURRENT_DATE)
        AND (pjs.end_date IS NULL OR pjs.end_date >= season.start_date)
      ORDER BY pjs.start_date DESC, pjs.created_at DESC
      LIMIT 1
    ) jersey ON TRUE

    UNION ALL

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
        AND pjs.team_id = pts.team_id
        AND pjs.start_date <= COALESCE(season.end_date, CURRENT_DATE)
        AND (pjs.end_date IS NULL OR pjs.end_date >= season.start_date)
      ORDER BY pjs.start_date DESC, pjs.created_at DESC
      LIMIT 1
    ) jersey ON TRUE
    WHERE NOT EXISTS (
      SELECT 1
      FROM player_teams legacy
      WHERE legacy.player_id = pts.player_id
        AND legacy.team_id = pts.team_id
        AND legacy.season_id = season.id
    )
  `;
}

module.exports = { ensurePlayerTimelineSchema };
