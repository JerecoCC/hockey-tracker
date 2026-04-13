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
      SELECT s.id, s.name, s.league_id,
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
      SELECT s.id, s.name, s.league_id,
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
      RETURNING id, name, league_id, start_date::text AS start_date, end_date::text AS end_date, created_at
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
      RETURNING id, name, league_id, start_date::text AS start_date, end_date::text AS end_date, created_at
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

    // 1. Try the current season's explicit roster
    const current = await sql`
      SELECT t.id, t.name, t.code, t.logo, t.primary_color, t.text_color, t.secondary_color,
             false AS inherited
      FROM season_teams st
      JOIN teams t ON t.id = st.team_id
      WHERE st.season_id = ${seasonId}
      ORDER BY t.name
    `;
    if (current.length > 0) return res.json(current);

    // 2. Fall back to the most-recent prior season's roster
    const prevRows = await sql`
      SELECT id FROM seasons
      WHERE league_id = ${league_id}
        AND id <> ${seasonId}
      ORDER BY start_date DESC NULLS LAST, created_at DESC
      LIMIT 1
    `;
    if (prevRows.length === 0) return res.json([]);

    const inherited = await sql`
      SELECT t.id, t.name, t.code, t.logo, t.primary_color, t.text_color, t.secondary_color,
             true AS inherited
      FROM season_teams st
      JOIN teams t ON t.id = st.team_id
      WHERE st.season_id = ${prevRows[0].id}
      ORDER BY t.name
    `;
    return res.json(inherited);
  } catch (err) {
    console.error('season teams list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/seasons/:seasonId/teams
// Replace the full list of teams for this season.  Body: { team_ids: string[] }
// ---------------------------------------------------------------------------
router.put('/:seasonId/teams', async (req, res) => {
  const { seasonId } = req.params;
  const { team_ids } = req.body;

  if (!Array.isArray(team_ids)) {
    return res.status(400).json({ error: 'team_ids must be an array' });
  }

  try {
    const seasonRows = await sql`SELECT id FROM seasons WHERE id = ${seasonId}`;
    if (seasonRows.length === 0) return res.status(404).json({ error: 'Season not found' });

    await sql`DELETE FROM season_teams WHERE season_id = ${seasonId}`;
    for (const team_id of team_ids) {
      await sql`
        INSERT INTO season_teams (season_id, team_id)
        VALUES (${seasonId}, ${team_id})
        ON CONFLICT DO NOTHING
      `;
    }

    const teams = await sql`
      SELECT t.id, t.name, t.code, t.logo, t.primary_color, t.text_color, t.secondary_color
      FROM season_teams st
      JOIN teams t ON t.id = st.team_id
      WHERE st.season_id = ${seasonId}
      ORDER BY t.name
    `;
    return res.json({ season_id: seasonId, teams });
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'One or more teams not found' });
    console.error('season teams update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/seasons/:seasonId/groups
// Returns all groups for the season's league with resolved teams using a
// three-level fallback chain per group:
//   1. Current season explicit override  (src = 'season')
//   2. Most-recent prior season's override  (src = 'inherited')
//   3. League-level group_teams default  (src = 'default')
// Emits has_season_override and is_inherited flags per group.
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
        -- Groups that already have an explicit override for the current season
        cur_overrides AS (
          SELECT DISTINCT group_id FROM season_group_teams WHERE season_id = ${seasonId}
        ),
        -- Groups the previous season overrode that the current season has not touched
        prev_overrides AS (
          SELECT DISTINCT group_id FROM season_group_teams
          WHERE season_id = (SELECT id FROM prev)
            AND group_id NOT IN (SELECT group_id FROM cur_overrides)
        ),
        resolved AS (
          -- 1. Current season explicit override
          SELECT sgt.group_id, t.id AS team_id, t.name, t.code, t.logo,
                 'season' AS src
          FROM season_group_teams sgt
          JOIN teams t ON t.id = sgt.team_id
          WHERE sgt.season_id = ${seasonId}

          UNION ALL

          -- 2. Inherited from the previous season
          SELECT sgt.group_id, t.id, t.name, t.code, t.logo,
                 'inherited' AS src
          FROM season_group_teams sgt
          JOIN teams t ON t.id = sgt.team_id
          WHERE sgt.season_id = (SELECT id FROM prev)
            AND sgt.group_id NOT IN (SELECT group_id FROM cur_overrides)

          UNION ALL

          -- 3. League default (untouched by either season)
          SELECT gt.group_id, t.id, t.name, t.code, t.logo,
                 'default' AS src
          FROM group_teams gt
          JOIN teams t ON t.id = gt.team_id
          WHERE gt.group_id NOT IN (SELECT group_id FROM cur_overrides)
            AND gt.group_id NOT IN (SELECT group_id FROM prev_overrides)
        )
      SELECT
        g.id, g.league_id, g.parent_id, g.name, g.sort_order, g.created_at,
        COALESCE(
          json_agg(
            json_build_object('id', r.team_id, 'name', r.name, 'code', r.code, 'logo', r.logo)
            ORDER BY r.name
          ) FILTER (WHERE r.team_id IS NOT NULL),
          '[]'::json
        ) AS teams,
        BOOL_OR(r.src = 'season')    AS has_season_override,
        BOOL_OR(r.src = 'inherited') AS is_inherited
      FROM groups g
      LEFT JOIN resolved r ON r.group_id = g.id
      WHERE g.league_id = ${league_id}
      GROUP BY g.id
      ORDER BY g.parent_id NULLS FIRST, g.sort_order, g.name
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
      SELECT t.id, t.name, t.code, t.logo
      FROM season_group_teams sgt
      JOIN teams t ON t.id = sgt.team_id
      WHERE sgt.season_id = ${seasonId} AND sgt.group_id = ${groupId}
      ORDER BY t.name
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

