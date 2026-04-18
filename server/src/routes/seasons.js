const router = require('express').Router();
const { requireAdmin } = require('../middleware/auth');
const { sql } = require('../db');

/**
 * Generate a season name from its league code and dates.
 * Examples:
 *   NHL / 2024-09-01 / 2025-04-30 → "NHL 2024–25"
 *   NHL / 2025-01-01 / 2025-04-30 → "NHL 2025"
 *   NHL / (no dates)               → "NHL"
 */
function generateSeasonName(league_code, start_date, end_date) {
  const prefix = league_code ? `${league_code} ` : '';
  // Extract year directly from the YYYY-MM-DD string — no Date parsing needed,
  // so the result is always the US calendar date regardless of server timezone.
  const startYear = start_date ? Number(start_date.slice(0, 4)) : null;
  const endYear   = end_date   ? Number(end_date.slice(0, 4))   : null;
  if (startYear && endYear && startYear !== endYear) {
    return `${prefix}${startYear}–${String(endYear).slice(-2)}`;
  }
  const year = startYear ?? endYear;
  return year ? `${prefix}${year}` : prefix.trim();
}

// All season routes require the admin role
router.use(requireAdmin);

// ---------------------------------------------------------------------------
// GET /api/admin/seasons  – list all seasons (with league info)
// ---------------------------------------------------------------------------
router.get('/', async (_req, res) => {
  try {
    const seasons = await sql`
      SELECT s.id, s.name, s.league_id, s.is_current,
             s.start_date::text AS start_date, s.end_date::text AS end_date,
             s.created_at,
             l.name AS league_name, l.code AS league_code, l.logo AS league_logo
      FROM seasons s
      JOIN leagues l ON l.id = s.league_id
      ORDER BY s.start_date DESC NULLS LAST, s.name ASC
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
      SELECT s.id, s.name, s.league_id, s.is_current,
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
  const { league_id, start_date, end_date } = req.body;

  if (!league_id) {
    return res.status(400).json({ error: 'league_id is required' });
  }

  try {
    const leagueRows = await sql`SELECT code FROM leagues WHERE id = ${league_id}`;
    if (leagueRows.length === 0) return res.status(400).json({ error: 'League not found' });
    const league_code = leagueRows[0].code;

    const name = generateSeasonName(league_code, start_date ?? null, end_date ?? null);

    const rows = await sql`
      INSERT INTO seasons (name, league_id, start_date, end_date)
      VALUES (${name}, ${league_id}, ${start_date ?? null}, ${end_date ?? null})
      RETURNING id, name, league_id, is_current, start_date::text AS start_date, end_date::text AS end_date, created_at
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
  const { league_id, start_date, end_date } = req.body;

  try {
    // Fetch the current row so we can merge and re-generate the name
    const existing = await sql`
      SELECT id, name, league_id,
             start_date::text AS start_date, end_date::text AS end_date,
             created_at
      FROM seasons WHERE id = ${id}
    `;
    if (existing.length === 0) return res.status(404).json({ error: 'Season not found' });
    const cur = existing[0];

    const mergedStartDate = start_date !== undefined ? (start_date || null) : cur.start_date;
    const mergedEndDate   = end_date   !== undefined ? (end_date   || null) : cur.end_date;
    const mergedLeagueId  = league_id ?? cur.league_id;

    // Re-fetch league code in case the league changed
    const leagueRows = await sql`SELECT code FROM leagues WHERE id = ${mergedLeagueId}`;
    if (leagueRows.length === 0) return res.status(400).json({ error: 'League not found' });
    const league_code = leagueRows[0].code;

    const newName = generateSeasonName(league_code, mergedStartDate, mergedEndDate);

    const rows = await sql`
      UPDATE seasons
      SET
        name       = ${newName},
        league_id  = ${mergedLeagueId},
        start_date = ${mergedStartDate},
        end_date   = ${mergedEndDate}
      WHERE id = ${id}
      RETURNING id, name, league_id, is_current, start_date::text AS start_date, end_date::text AS end_date, created_at
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
// Setting true atomically clears the flag on every other season in the same
// league so there is always at most one current season per league.
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
      // Clear the flag on every other season in the same league first
      await sql`
        UPDATE seasons SET is_current = FALSE WHERE league_id = ${league_id}
      `;
    }

    const rows = await sql`
      UPDATE seasons
      SET is_current = ${is_current}
      WHERE id = ${id}
      RETURNING id, name, league_id, is_current,
                start_date::text AS start_date, end_date::text AS end_date, created_at
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
    const seasonRows = await sql`SELECT id, league_id FROM seasons WHERE id = ${seasonId}`;
    if (seasonRows.length === 0) return res.status(404).json({ error: 'Season not found' });
    const { league_id } = seasonRows[0];

    // 1. Try the current season's explicit roster, versioning identity via season_id match
    const current = await sql`
      SELECT
        t.id, iter.name, iter.code, iter.logo,
        t.primary_color, t.text_color, t.secondary_color,
        false AS inherited
      FROM season_teams st
      JOIN teams t ON t.id = st.team_id
      LEFT JOIN LATERAL (
        SELECT ti.name, ti.code, ti.logo FROM team_iterations ti
        LEFT JOIN seasons s ON s.id = ti.season_id
        WHERE ti.team_id = t.id
        ORDER BY
          CASE WHEN ti.season_id = ${seasonId} THEN 0 ELSE 1 END,
          s.start_date DESC NULLS LAST,
          ti.recorded_at DESC
        LIMIT 1
      ) iter ON true
      WHERE st.season_id = ${seasonId}
      ORDER BY iter.name
    `;
    if (current.length > 0) return res.json(current);

    // 2. Fall back to the most-recent prior season's roster, versioned to that season
    const prevRows = await sql`
      SELECT id FROM seasons
      WHERE league_id = ${league_id}
        AND id <> ${seasonId}
      ORDER BY start_date DESC NULLS LAST, created_at DESC
      LIMIT 1
    `;
    if (prevRows.length === 0) return res.json([]);

    const prevSeasonId = prevRows[0].id;
    const inherited = await sql`
      SELECT
        t.id, iter.name, iter.code, iter.logo,
        t.primary_color, t.text_color, t.secondary_color,
        true AS inherited
      FROM season_teams st
      JOIN teams t ON t.id = st.team_id
      LEFT JOIN LATERAL (
        SELECT ti.name, ti.code, ti.logo FROM team_iterations ti
        LEFT JOIN seasons s ON s.id = ti.season_id
        WHERE ti.team_id = t.id
        ORDER BY
          CASE WHEN ti.season_id = ${prevSeasonId} THEN 0 ELSE 1 END,
          s.start_date DESC NULLS LAST,
          ti.recorded_at DESC
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
        SELECT name, code, logo FROM team_iterations
        WHERE team_id = t.id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
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
    const seasonRows = await sql`SELECT id, league_id FROM seasons WHERE id = ${seasonId}`;
    if (seasonRows.length === 0) return res.status(404).json({ error: 'Season not found' });
    const { league_id } = seasonRows[0];

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
        -- versioned: resolve name/code/logo via season_id match, falling back to
        -- the most recent prior iteration ordered by the linked season's start_date.
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
            SELECT ti.name, ti.code, ti.logo FROM team_iterations ti
            LEFT JOIN seasons s ON s.id = ti.season_id
            WHERE ti.team_id = t.id
            ORDER BY
              CASE WHEN ti.season_id = ${seasonId} THEN 0 ELSE 1 END,
              s.start_date DESC NULLS LAST,
              ti.recorded_at DESC
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
      sql`SELECT id, league_id FROM seasons WHERE id = ${seasonId}`,
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

    const teams = await sql`
      SELECT t.id, ti.name, ti.code, ti.logo, t.primary_color, t.text_color
      FROM season_group_teams sgt
      JOIN teams t ON t.id = sgt.team_id
      LEFT JOIN LATERAL (
        SELECT name, code, logo FROM team_iterations
        WHERE team_id = t.id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
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

module.exports = router;

