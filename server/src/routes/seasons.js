const router = require('express').Router();
const { requireAdmin } = require('../middleware/auth');
const { sql } = require('../db');

// All season routes require the admin role
router.use(requireAdmin);

// ---------------------------------------------------------------------------
// GET /api/admin/seasons  – list all seasons (with league info)
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const { league_id } = req.query;
  try {
    const seasons = league_id
      ? await sql`
          SELECT s.id, s.name, s.league_id,
                 (l.current_season_id = s.id) AS is_current,
                 s.is_ended,
                 s.start_date::text AS start_date, s.end_date::text AS end_date,
                 s.created_at,
                 l.name AS league_name, l.code AS league_code, l.logo AS league_logo
          FROM seasons s
          JOIN leagues l ON l.id = s.league_id
          WHERE s.league_id = ${league_id}
          ORDER BY (l.current_season_id = s.id) DESC, s.start_date DESC NULLS LAST, s.name ASC
        `
      : await sql`
          SELECT s.id, s.name, s.league_id,
                 (l.current_season_id = s.id) AS is_current,
                 s.is_ended,
                 s.start_date::text AS start_date, s.end_date::text AS end_date,
                 s.created_at,
                 l.name AS league_name, l.code AS league_code, l.logo AS league_logo
          FROM seasons s
          JOIN leagues l ON l.id = s.league_id
          ORDER BY (l.current_season_id = s.id) DESC, s.start_date DESC NULLS LAST, s.name ASC
        `;
    return res.json(seasons);
  } catch (err) {
    console.error('seasons list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/seasons/:id  – get a single season
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`
      SELECT s.id, s.name, s.league_id,
             (l.current_season_id = s.id) AS is_current,
             s.is_ended,
             s.start_date::text AS start_date, s.end_date::text AS end_date,
             s.created_at,
             l.name AS league_name, l.code AS league_code, l.logo AS league_logo
      FROM seasons s
      JOIN leagues l ON l.id = s.league_id
      WHERE s.id = ${id}
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Season not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('seasons get error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/seasons  – create a season
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const { league_id, name, start_date, end_date } = req.body;

  if (!league_id) return res.status(400).json({ error: 'league_id is required' });
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

  try {
    const leagueRows = await sql`SELECT id FROM leagues WHERE id = ${league_id}`;
    if (leagueRows.length === 0) return res.status(400).json({ error: 'League not found' });

    const rows = await sql`
      INSERT INTO seasons (name, league_id, start_date, end_date)
      VALUES (${name.trim()}, ${league_id}, ${start_date ?? null}, ${end_date ?? null})
      RETURNING id, name, league_id, FALSE AS is_current,
                start_date::text AS start_date, end_date::text AS end_date, created_at
    `;
    return res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json({ error: 'League not found' });
    }
    console.error('seasons create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/seasons/:id  – update a season
// ---------------------------------------------------------------------------
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { league_id, name, start_date, end_date } = req.body;

  try {
    // Fetch current row so we can merge partial updates
    const existing = await sql`
      SELECT id, name, league_id,
             start_date::text AS start_date, end_date::text AS end_date, is_ended
      FROM seasons WHERE id = ${id}
    `;
    if (existing.length === 0) return res.status(404).json({ error: 'Season not found' });
    const cur = existing[0];

    const mergedName      = name        !== undefined ? name.trim()          : cur.name;
    const mergedLeagueId  = league_id   !== undefined ? league_id            : cur.league_id;
    const mergedStartDate = start_date  !== undefined ? (start_date || null) : cur.start_date;
    const mergedEndDate   = end_date    !== undefined ? (end_date   || null) : cur.end_date;
    // Auto-set is_ended when an end_date is provided; never auto-clear it.
    const mergedIsEnded   = mergedEndDate ? true : cur.is_ended;

    if (!mergedName) return res.status(400).json({ error: 'name is required' });

    if (mergedLeagueId !== cur.league_id) {
      const leagueRows = await sql`SELECT id FROM leagues WHERE id = ${mergedLeagueId}`;
      if (leagueRows.length === 0) return res.status(400).json({ error: 'League not found' });
    }

    await sql`
      UPDATE seasons
      SET
        name       = ${mergedName},
        league_id  = ${mergedLeagueId},
        start_date = ${mergedStartDate},
        end_date   = ${mergedEndDate},
        is_ended   = ${mergedIsEnded}
      WHERE id = ${id}
    `;

    // If an end date is being set (or season is now marked ended), unset it as current.
    if (mergedEndDate || mergedIsEnded) {
      await sql`
        UPDATE leagues
        SET current_season_id = NULL
        WHERE id = ${mergedLeagueId} AND current_season_id = ${id}
      `;
    }

    const rows = await sql`
      SELECT s.id, s.name, s.league_id,
             (l.current_season_id = s.id) AS is_current,
             s.is_ended,
             s.start_date::text AS start_date, s.end_date::text AS end_date,
             s.created_at,
             l.name AS league_name, l.code AS league_code, l.logo AS league_logo
      FROM seasons s
      JOIN leagues l ON l.id = s.league_id
      WHERE s.id = ${id}
    `;
    return res.json(rows[0]);
  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json({ error: 'League not found' });
    }
    console.error('seasons update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/seasons/:id/current  – set or unset the current-season flag
// Body: { is_current: boolean }
// Uniqueness is enforced at the DB level: leagues.current_season_id is a FK
// that can only hold one season id per league at a time.
// ---------------------------------------------------------------------------
router.patch('/:id/current', async (req, res) => {
  const { id } = req.params;
  const { is_current } = req.body;

  if (typeof is_current !== 'boolean') {
    return res.status(400).json({ error: 'is_current must be a boolean' });
  }

  try {
    // Verify the season exists and fetch its league_id
    const existing = await sql`
      SELECT id, league_id FROM seasons WHERE id = ${id}
    `;
    if (existing.length === 0) return res.status(404).json({ error: 'Season not found' });

    const { league_id } = existing[0];

    if (is_current) {
      // Point the league's current_season_id at this season.
      // Any previous current season is implicitly unset — the FK column holds only one value.
      await sql`
        UPDATE leagues SET current_season_id = ${id} WHERE id = ${league_id}
      `;
    } else {
      // Only clear the FK if it currently points to this season.
      await sql`
        UPDATE leagues
        SET current_season_id = NULL
        WHERE id = ${league_id} AND current_season_id = ${id}
      `;
    }

    const rows = await sql`
      SELECT s.id, s.name, s.league_id,
             (l.current_season_id = s.id) AS is_current,
             s.is_ended,
             s.start_date::text AS start_date, s.end_date::text AS end_date,
             s.created_at,
             l.name AS league_name, l.code AS league_code, l.logo AS league_logo
      FROM seasons s
      JOIN leagues l ON l.id = s.league_id
      WHERE s.id = ${id}
    `;
    return res.json(rows[0]);
  } catch (err) {
    console.error('seasons set-current error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/seasons/:id  – delete a season
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`
      DELETE FROM seasons WHERE id = ${id} RETURNING id
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Season not found' });
    return res.json({ message: 'Season deleted' });
  } catch (err) {
    console.error('seasons delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/seasons/:seasonId/teams
// Returns the teams participating in this season.
// Falls back to the most-recent prior season's roster when none is set,
// tagging each row with inherited:true so the UI can distinguish.
// ---------------------------------------------------------------------------
router.get('/:seasonId/teams', async (req, res) => {
  const { seasonId } = req.params;
  try {
    const seasonRows = await sql`SELECT id, league_id, start_date::text FROM seasons WHERE id = ${seasonId}`;
    if (seasonRows.length === 0) return res.status(404).json({ error: 'Season not found' });
    const { league_id, start_date: seasonStartDate } = seasonRows[0];

    // 1. Try the current season's explicit roster.
    //    Resolve each team's identity using season FKs on team_iterations:
    //    - start_season_id marks when this version first applied
    //    - latest_season_id marks when it last applied (NULL = still active/current)
    //    The matching iteration is the one whose range covers this season's start_date.
    const current = await sql`
      SELECT
        t.id, iter.name, iter.code, iter.logo,
        t.primary_color, t.text_color, t.secondary_color, t.home_arena,
        false AS inherited
      FROM season_teams st
      JOIN teams t ON t.id = st.team_id
      LEFT JOIN LATERAL (
        (SELECT ti.name, ti.code, ti.logo FROM team_iterations ti
          LEFT JOIN seasons ss ON ss.id = ti.start_season_id
          LEFT JOIN seasons ls ON ls.id = ti.latest_season_id
          WHERE ti.team_id = t.id
            AND (ti.start_season_id  IS NULL OR ss.start_date <= ${seasonStartDate}::date)
            AND (ti.latest_season_id IS NULL OR ls.start_date >= ${seasonStartDate}::date)
          ORDER BY ss.start_date DESC NULLS LAST, ti.recorded_at DESC
          LIMIT 1)
        UNION ALL
        (SELECT ti.name, ti.code, ti.logo FROM team_iterations ti
          WHERE ti.team_id = t.id ORDER BY ti.recorded_at ASC LIMIT 1)
        LIMIT 1
      ) iter ON true
      WHERE st.season_id = ${seasonId}
      ORDER BY iter.name
    `;
    if (current.length > 0) return res.json(current);

    // 2. Fall back to the most-recent prior season's roster, versioned to that season.
    const prevRows = await sql`
      SELECT id, start_date::text AS prev_start_date FROM seasons
      WHERE league_id = ${league_id}
        AND id <> ${seasonId}
      ORDER BY start_date DESC NULLS LAST, created_at DESC
      LIMIT 1
    `;
    if (prevRows.length === 0) return res.json([]);

    const prevSeasonId = prevRows[0].id;
    const prevSeasonStartDate = prevRows[0].prev_start_date;
    const inherited = await sql`
      SELECT
        t.id, iter.name, iter.code, iter.logo,
        t.primary_color, t.text_color, t.secondary_color, t.home_arena,
        true AS inherited
      FROM season_teams st
      JOIN teams t ON t.id = st.team_id
      LEFT JOIN LATERAL (
        (SELECT ti.name, ti.code, ti.logo FROM team_iterations ti
          LEFT JOIN seasons ss ON ss.id = ti.start_season_id
          LEFT JOIN seasons ls ON ls.id = ti.latest_season_id
          WHERE ti.team_id = t.id
            AND (ti.start_season_id  IS NULL OR ss.start_date <= ${prevSeasonStartDate}::date)
            AND (ti.latest_season_id IS NULL OR ls.start_date >= ${prevSeasonStartDate}::date)
          ORDER BY ss.start_date DESC NULLS LAST, ti.recorded_at DESC
          LIMIT 1)
        UNION ALL
        (SELECT ti.name, ti.code, ti.logo FROM team_iterations ti
          WHERE ti.team_id = t.id ORDER BY ti.recorded_at ASC LIMIT 1)
        LIMIT 1
      ) iter ON true
      WHERE st.season_id = ${prevSeasonId}
      ORDER BY iter.name
    `;
    return res.json(inherited);
  } catch (err) {
    console.error('season teams list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/seasons/:seasonId/teams
// Replace the flat team roster for this season.  Body: { team_ids: string[] }
// Also creates/updates an auto group named after the season to represent the
// roster as a group (is_auto = true, season_id = seasonId).
// ---------------------------------------------------------------------------

/** Derive a human-readable name from season dates, e.g. "2024-25". */
function deriveSeasonGroupName(startDate, endDate) {
  if (!startDate) return 'Season Roster';
  const sy = parseInt(startDate.slice(0, 4), 10);
  if (!endDate) return String(sy);
  const ey = parseInt(endDate.slice(0, 4), 10);
  if (sy === ey) return String(sy);
  return `${sy}-${String(ey).slice(2)}`; // "2024-25"
}

router.put('/:seasonId/teams', async (req, res) => {
  const { seasonId } = req.params;
  const { team_ids } = req.body;

  if (!Array.isArray(team_ids)) {
    return res.status(400).json({ error: 'team_ids must be an array' });
  }

  try {
    const seasonRows = await sql`
      SELECT id, league_id, start_date::text, end_date::text
      FROM seasons WHERE id = ${seasonId}
    `;
    if (seasonRows.length === 0) return res.status(404).json({ error: 'Season not found' });
    const { league_id, start_date, end_date } = seasonRows[0];

    // ── 1. Find or create the auto group for this season ────────────────────
    const groupName = deriveSeasonGroupName(start_date, end_date);

    let autoGroupRows = await sql`
      SELECT id FROM groups
      WHERE season_id = ${seasonId} AND is_auto = true
      LIMIT 1
    `;
    let autoGroupId;
    if (autoGroupRows.length === 0) {
      const created = await sql`
        INSERT INTO groups (league_id, season_id, name, is_auto, sort_order)
        VALUES (${league_id}, ${seasonId}, ${groupName}, true, 0)
        RETURNING id
      `;
      autoGroupId = created[0].id;
    } else {
      autoGroupId = autoGroupRows[0].id;
    }

    // ── 2. Sync group_teams for the auto group ───────────────────────────────
    await sql`DELETE FROM group_teams WHERE group_id = ${autoGroupId}`;
    for (const team_id of team_ids) {
      await sql`
        INSERT INTO group_teams (group_id, team_id)
        VALUES (${autoGroupId}, ${team_id})
        ON CONFLICT DO NOTHING
      `;
    }

    // ── 3. Keep season_teams in sync (used for inheritance fallback) ─────────
    await sql`DELETE FROM season_teams WHERE season_id = ${seasonId}`;
    for (const team_id of team_ids) {
      await sql`
        INSERT INTO season_teams (season_id, team_id)
        VALUES (${seasonId}, ${team_id})
        ON CONFLICT DO NOTHING
      `;
      // Track the first and most-recent season each team has been added to.
      await sql`
        UPDATE teams SET
          start_season_id = CASE
            WHEN start_season_id IS NULL THEN ${seasonId}::uuid
            WHEN ${start_date ?? null}::date < (
              SELECT start_date FROM seasons WHERE id = start_season_id
            ) THEN ${seasonId}::uuid
            ELSE start_season_id
          END,
          latest_season_id = CASE
            -- First time ever added: latest must match start
            WHEN start_season_id IS NULL THEN ${seasonId}::uuid
            WHEN latest_season_id IS NULL THEN ${seasonId}::uuid
            WHEN ${start_date ?? null}::date > (
              SELECT start_date FROM seasons WHERE id = latest_season_id
            ) THEN ${seasonId}::uuid
            ELSE latest_season_id
          END
        WHERE id = ${team_id}::uuid
      `;
    }

    const teams = await sql`
      SELECT
        t.id, ti.name, ti.code, ti.logo,
        t.primary_color, t.text_color, t.secondary_color
      FROM group_teams gt
      JOIN teams t ON t.id = gt.team_id
      LEFT JOIN LATERAL (
        (SELECT ti2.name, ti2.code, ti2.logo FROM team_iterations ti2
          LEFT JOIN seasons ss ON ss.id = ti2.start_season_id
          LEFT JOIN seasons ls ON ls.id = ti2.latest_season_id
          WHERE ti2.team_id = t.id
            AND (ti2.start_season_id  IS NULL OR ss.start_date <= ${start_date}::date)
            AND (ti2.latest_season_id IS NULL OR ls.start_date >= ${start_date}::date)
          ORDER BY ss.start_date DESC NULLS LAST, ti2.recorded_at DESC
          LIMIT 1)
        UNION ALL
        (SELECT ti2.name, ti2.code, ti2.logo FROM team_iterations ti2
          WHERE ti2.team_id = t.id ORDER BY ti2.recorded_at ASC LIMIT 1)
        LIMIT 1
      ) ti ON true
      WHERE gt.group_id = ${autoGroupId}
      ORDER BY ti.name
    `;
    return res.json({ season_id: seasonId, auto_group_id: autoGroupId, teams });
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'One or more teams not found' });
    console.error('season teams update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/seasons/:seasonId/groups
// Returns:
//   - All non-auto league groups (season_id IS NULL) with a 3-level fallback
//     for their teams: current season override → prev season override → default
//   - The auto group for this season (is_auto = true, season_id = seasonId),
//     with its teams sourced directly from group_teams (src = 'auto').
//   - The auto group from the previous season if this season has none yet,
//     tagged src = 'inherited'.
// Emits has_season_override, is_inherited, and is_auto per group.
// ---------------------------------------------------------------------------
router.get('/:seasonId/groups', async (req, res) => {
  const { seasonId } = req.params;
  try {
    const seasonRows = await sql`SELECT id, league_id, start_date::text FROM seasons WHERE id = ${seasonId}`;
    if (seasonRows.length === 0) return res.status(404).json({ error: 'Season not found' });
    const { league_id, start_date: seasonStartDate } = seasonRows[0];

    const groups = await sql`
      WITH
        -- Most-recent other season in this league (the "previous" season)
        prev AS (
          SELECT id FROM seasons
          WHERE league_id = ${league_id}
            AND id <> ${seasonId}
          ORDER BY start_date DESC NULLS LAST, created_at DESC
          LIMIT 1
        ),
        -- Auto group for this season (if any)
        auto_group AS (
          SELECT id FROM groups
          WHERE season_id = ${seasonId} AND is_auto = true
          LIMIT 1
        ),
        -- Auto group from the previous season (used for inheritance when this season has none)
        prev_auto_group AS (
          SELECT id FROM groups
          WHERE season_id = (SELECT id FROM prev) AND is_auto = true
          LIMIT 1
        ),
        -- Groups that already have an explicit override for the current season (user groups only)
        cur_overrides AS (
          SELECT DISTINCT group_id FROM season_group_teams WHERE season_id = ${seasonId}
        ),
        -- Groups the previous season overrode that the current season has not touched
        prev_overrides AS (
          SELECT DISTINCT group_id FROM season_group_teams
          WHERE season_id = (SELECT id FROM prev)
            AND group_id NOT IN (SELECT group_id FROM cur_overrides)
        ),
        -- resolved: membership + source only (name/logo resolved later via versioned CTE)
        resolved AS (
          -- 1. Current season explicit override (user groups)
          SELECT sgt.group_id, sgt.team_id, 'season' AS src
          FROM season_group_teams sgt
          WHERE sgt.season_id = ${seasonId}

          UNION ALL

          -- 2. Inherited from the previous season (user groups not overridden this season)
          SELECT sgt.group_id, sgt.team_id, 'inherited' AS src
          FROM season_group_teams sgt
          WHERE sgt.season_id = (SELECT id FROM prev)
            AND sgt.group_id NOT IN (SELECT group_id FROM cur_overrides)

          UNION ALL

          -- 3. League default (user groups untouched by either season, not auto groups)
          SELECT gt.group_id, gt.team_id, 'default' AS src
          FROM group_teams gt
          WHERE gt.group_id NOT IN (SELECT group_id FROM cur_overrides)
            AND gt.group_id NOT IN (SELECT group_id FROM prev_overrides)
            AND gt.group_id NOT IN (SELECT id FROM auto_group)
            AND gt.group_id NOT IN (SELECT id FROM prev_auto_group)

          UNION ALL

          -- 4a. Auto group for this season — teams from group_teams directly
          SELECT gt.group_id, gt.team_id, 'auto' AS src
          FROM group_teams gt
          WHERE gt.group_id = (SELECT id FROM auto_group)

          UNION ALL

          -- 4b. Previous season's auto group — shown when this season has no auto group yet
          SELECT gt.group_id, gt.team_id, 'inherited' AS src
          FROM group_teams gt
          WHERE gt.group_id = (SELECT id FROM prev_auto_group)
            AND NOT EXISTS (SELECT 1 FROM auto_group)
        ),
        -- versioned: resolve each team's name/code/logo to the version active at this season.
        -- Uses the iteration explicitly linked to this season, or falls back to the most
        -- recent iteration recorded on or before the season's end date (so renames after the
        -- season ended never bleed back into the historical view).
        versioned AS (
          SELECT
            r.group_id,
            r.team_id,
            r.src,
            iter.name,
            iter.code,
            iter.logo,
            t.primary_color,
            t.text_color
          FROM resolved r
          JOIN teams t ON t.id = r.team_id
          LEFT JOIN LATERAL (
            (SELECT ti.name, ti.code, ti.logo FROM team_iterations ti
              LEFT JOIN seasons ss ON ss.id = ti.start_season_id
              LEFT JOIN seasons ls ON ls.id = ti.latest_season_id
              WHERE ti.team_id = t.id
                AND (ti.start_season_id  IS NULL OR ss.start_date <= ${seasonStartDate}::date)
                AND (ti.latest_season_id IS NULL OR ls.start_date >= ${seasonStartDate}::date)
              ORDER BY ss.start_date DESC NULLS LAST, ti.recorded_at DESC
              LIMIT 1)
            UNION ALL
            (SELECT ti.name, ti.code, ti.logo FROM team_iterations ti
              WHERE ti.team_id = t.id ORDER BY ti.recorded_at ASC LIMIT 1)
            LIMIT 1
          ) iter ON true
        )
      SELECT
        g.id, g.league_id, g.parent_id, g.name, g.sort_order, g.created_at,
        g.is_auto,
        COALESCE(
          json_agg(
            json_build_object('id', v.team_id, 'name', v.name, 'code', v.code, 'logo', v.logo,
                              'primary_color', v.primary_color, 'text_color', v.text_color)
            ORDER BY v.name
          ) FILTER (WHERE v.team_id IS NOT NULL),
          '[]'::json
        ) AS teams,
        BOOL_OR(v.src = 'season')    AS has_season_override,
        BOOL_OR(v.src = 'inherited') AS is_inherited
      FROM groups g
      LEFT JOIN versioned v ON v.group_id = g.id
      WHERE
        -- User groups (league-scoped, no season_id)
        (g.league_id = ${league_id} AND g.season_id IS NULL)
        -- Auto group for this season
        OR g.season_id = ${seasonId}
        -- Previous season's auto group when this season has no auto group yet
        OR (
          g.id = (SELECT id FROM prev_auto_group)
          AND NOT EXISTS (SELECT 1 FROM auto_group)
        )
      GROUP BY g.id
      ORDER BY g.is_auto DESC, g.parent_id NULLS FIRST, g.sort_order, g.name
    `;
    return res.json(groups);
  } catch (err) {
    console.error('season groups list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/seasons/:seasonId/groups/:groupId/teams
// Set season-specific team list for one group.  Body: { team_ids: string[] }
// ---------------------------------------------------------------------------
router.put('/:seasonId/groups/:groupId/teams', async (req, res) => {
  const { seasonId, groupId } = req.params;
  const { team_ids } = req.body;

  if (!Array.isArray(team_ids)) {
    return res.status(400).json({ error: 'team_ids must be an array' });
  }

  try {
    const [seasonRows, groupRows] = await Promise.all([
      sql`SELECT id, league_id, start_date::text FROM seasons WHERE id = ${seasonId}`,
      sql`SELECT id, league_id FROM groups  WHERE id = ${groupId}`,
    ]);
    if (seasonRows.length === 0) return res.status(404).json({ error: 'Season not found' });
    if (groupRows.length === 0)  return res.status(404).json({ error: 'Group not found' });
    if (seasonRows[0].league_id !== groupRows[0].league_id) {
      return res.status(400).json({ error: 'Season and group must belong to the same league' });
    }

    await sql`DELETE FROM season_group_teams WHERE season_id = ${seasonId} AND group_id = ${groupId}`;
    for (const team_id of team_ids) {
      await sql`
        INSERT INTO season_group_teams (season_id, group_id, team_id)
        VALUES (${seasonId}, ${groupId}, ${team_id})
        ON CONFLICT DO NOTHING
      `;
    }

    const { start_date: seasonStartDate } = seasonRows[0];
    const teams = await sql`
      SELECT t.id, ti.name, ti.code, ti.logo, t.primary_color, t.text_color
      FROM season_group_teams sgt
      JOIN teams t ON t.id = sgt.team_id
      LEFT JOIN LATERAL (
        (SELECT ti2.name, ti2.code, ti2.logo FROM team_iterations ti2
          LEFT JOIN seasons ss ON ss.id = ti2.start_season_id
          LEFT JOIN seasons ls ON ls.id = ti2.latest_season_id
          WHERE ti2.team_id = t.id
            AND (ti2.start_season_id  IS NULL OR ss.start_date <= ${seasonStartDate}::date)
            AND (ti2.latest_season_id IS NULL OR ls.start_date >= ${seasonStartDate}::date)
          ORDER BY ss.start_date DESC NULLS LAST, ti2.recorded_at DESC
          LIMIT 1)
        UNION ALL
        (SELECT ti2.name, ti2.code, ti2.logo FROM team_iterations ti2
          WHERE ti2.team_id = t.id ORDER BY ti2.recorded_at ASC LIMIT 1)
        LIMIT 1
      ) ti ON true
      WHERE sgt.season_id = ${seasonId} AND sgt.group_id = ${groupId}
      ORDER BY ti.name
    `;
    return res.json({ season_id: seasonId, group_id: groupId, teams });
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'One or more teams not found' });
    console.error('season group teams update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/seasons/:seasonId/groups/:groupId/teams
// Remove the season override — group reverts to its default team list.
// ---------------------------------------------------------------------------
router.delete('/:seasonId/groups/:groupId/teams', async (req, res) => {
  const { seasonId, groupId } = req.params;
  try {
    await sql`
      DELETE FROM season_group_teams WHERE season_id = ${seasonId} AND group_id = ${groupId}
    `;
    return res.json({ message: 'Season override removed; group reverts to defaults' });
  } catch (err) {
    console.error('season group teams reset error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/seasons/:id/stats  – aggregate player stats for a season
// ---------------------------------------------------------------------------
router.get('/:id/stats', async (req, res) => {
  const { id } = req.params;
  try {
    const skaters = await sql`
      WITH season_games AS (
        SELECT id FROM games WHERE season_id = ${id} AND status = 'final'
      ),
      player_gp AS (
        SELECT gr.player_id, COUNT(DISTINCT gr.game_id) AS gp
        FROM game_rosters gr
        WHERE gr.game_id IN (SELECT id FROM season_games)
        GROUP BY gr.player_id
      ),
      player_goals_agg AS (
        SELECT scorer_id AS player_id, COUNT(*) AS goals
        FROM goals
        WHERE game_id IN (SELECT id FROM season_games) AND goal_type != 'own'
        GROUP BY scorer_id
      ),
      player_assists_agg AS (
        SELECT player_id, COUNT(*) AS assists
        FROM (
          SELECT assist_1_id AS player_id FROM goals
            WHERE game_id IN (SELECT id FROM season_games) AND assist_1_id IS NOT NULL
          UNION ALL
          SELECT assist_2_id AS player_id FROM goals
            WHERE game_id IN (SELECT id FROM season_games) AND assist_2_id IS NOT NULL
        ) a
        GROUP BY player_id
      ),
      player_team AS (
        SELECT DISTINCT ON (pt.player_id)
          pt.player_id, pt.team_id, pt.jersey_number, pt.photo
        FROM player_teams pt
        WHERE pt.season_id = ${id}
        ORDER BY pt.player_id, pt.end_date DESC NULLS FIRST
      )
      SELECT
        p.id                                          AS player_id,
        p.first_name,
        p.last_name,
        COALESCE(ptr.photo, p.photo)                  AS photo,
        p.position,
        ptr.jersey_number,
        ptr.team_id,
        ti.code                                       AS team_code,
        ti.name                                       AS team_name,
        ti.logo                                       AS team_logo,
        t.primary_color                               AS team_primary_color,
        t.text_color                                  AS team_text_color,
        pgp.gp::int                                   AS gp,
        COALESCE(pg.goals,   0)::int                  AS goals,
        COALESCE(pa.assists, 0)::int                  AS assists,
        (COALESCE(pg.goals, 0) + COALESCE(pa.assists, 0))::int AS points
      FROM player_gp pgp
      JOIN players  p   ON p.id   = pgp.player_id
      LEFT JOIN player_team        ptr ON ptr.player_id = p.id
      LEFT JOIN teams              t   ON t.id          = ptr.team_id
      LEFT JOIN LATERAL (
        SELECT name, code, logo FROM team_iterations
        WHERE team_id = ptr.team_id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) ti ON true
      LEFT JOIN player_goals_agg   pg  ON pg.player_id  = p.id
      LEFT JOIN player_assists_agg pa  ON pa.player_id  = p.id
      WHERE p.position != 'G'
      ORDER BY points DESC, goals DESC, assists DESC, pgp.gp DESC
    `;

    const goalies = await sql`
      WITH season_games AS (
        SELECT id FROM games WHERE season_id = ${id} AND status = 'final'
      ),
      player_team AS (
        SELECT DISTINCT ON (pt.player_id)
          pt.player_id, pt.team_id, pt.jersey_number, pt.photo
        FROM player_teams pt
        WHERE pt.season_id = ${id}
        ORDER BY pt.player_id, pt.end_date DESC NULLS FIRST
      )
      SELECT
        p.id                                                   AS player_id,
        p.first_name,
        p.last_name,
        COALESCE(ptr.photo, p.photo)                           AS photo,
        ptr.jersey_number,
        ggs.team_id                                            AS team_id,
        ti.code                                                AS team_code,
        ti.name                                                AS team_name,
        ti.logo                                                AS team_logo,
        t.primary_color                                        AS team_primary_color,
        t.text_color                                           AS team_text_color,
        COUNT(DISTINCT ggs.game_id)::int                       AS gp,
        SUM(ggs.shots_against)::int                            AS shots_against,
        SUM(ggs.saves)::int                                    AS saves,
        SUM(ggs.shots_against - ggs.saves)::int                AS goals_against,
        CASE WHEN SUM(ggs.shots_against) > 0
          THEN ROUND(SUM(ggs.saves)::numeric / SUM(ggs.shots_against), 3)
          ELSE NULL END                                        AS save_pct,
        COUNT(*) FILTER (
          WHERE ggs.shots_against > 0
            AND ggs.shots_against = ggs.saves
        )::int                                                 AS shutouts,
        CASE WHEN COUNT(DISTINCT ggs.game_id) > 0
          THEN ROUND(
            (SUM(ggs.shots_against) - SUM(ggs.saves))::numeric
              / COUNT(DISTINCT ggs.game_id), 2)
          ELSE NULL END                                        AS gaa
      FROM game_goalie_stats ggs
      JOIN games   g   ON g.id  = ggs.game_id
                      AND g.season_id = ${id}
                      AND g.status    = 'final'
      JOIN players p   ON p.id  = ggs.goalie_id
      LEFT JOIN player_team ptr ON ptr.player_id = ggs.goalie_id
      LEFT JOIN teams       t   ON t.id          = ggs.team_id
      LEFT JOIN LATERAL (
        SELECT name, code, logo FROM team_iterations
        WHERE team_id = ggs.team_id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) ti ON true
      GROUP BY
        p.id, p.first_name, p.last_name, p.photo,
        ptr.photo, ptr.jersey_number,
        ggs.team_id, ti.code, ti.name, ti.logo,
        t.primary_color, t.text_color
      ORDER BY save_pct DESC NULLS LAST, saves DESC
    `;

    return res.json({ skaters, goalies });
  } catch (err) {
    console.error('season stats error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

