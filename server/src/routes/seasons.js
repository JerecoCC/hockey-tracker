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
      SELECT s.id, s.name, s.league_id, s.start_date, s.end_date, s.created_at,
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
      SELECT s.id, s.name, s.league_id, s.start_date, s.end_date, s.created_at,
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
      RETURNING id, name, league_id, start_date, end_date, created_at
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
    const existing = await sql`SELECT * FROM seasons WHERE id = ${id}`;
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
      RETURNING id, name, league_id, start_date, end_date, created_at
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

module.exports = router;

