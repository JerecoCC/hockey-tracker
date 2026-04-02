const router = require('express').Router();
const { requireAdmin } = require('../middleware/auth');
const { sql } = require('../db');

/**
 * Generate a season name from its dates and type.
 * Examples:
 *   2024-09-01 / 2025-04-30 / regular  → "2024–25 Regular Season"
 *   2024-09-01 / 2025-04-30 / playoffs → "2024–25 Playoffs"
 *   2025-01-01 / 2025-04-30 / regular  → "2025 Regular Season"
 *   (no dates)                / regular  → "Regular Season"
 */
function generateSeasonName(start_date, end_date, type) {
  const typeName = type === 'playoffs' ? 'Playoffs' : 'Regular Season';
  // Append T12:00:00 to avoid UTC-offset day shifts when parsing date-only strings
  const startYear = start_date ? new Date(start_date + 'T12:00:00').getFullYear() : null;
  const endYear   = end_date   ? new Date(end_date   + 'T12:00:00').getFullYear() : null;
  if (startYear && endYear && startYear !== endYear) {
    return `${startYear}–${String(endYear).slice(-2)} ${typeName}`;
  }
  const year = startYear ?? endYear;
  return year ? `${year} ${typeName}` : typeName;
}

// All season routes require the admin role
router.use(requireAdmin);

// ---------------------------------------------------------------------------
// GET /api/admin/seasons  – list all seasons (with league info)
// ---------------------------------------------------------------------------
router.get('/', async (_req, res) => {
  try {
    const seasons = await sql`
      SELECT s.id, s.name, s.type, s.league_id, s.start_date, s.end_date, s.created_at,
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
      SELECT s.id, s.name, s.type, s.league_id, s.start_date, s.end_date, s.created_at,
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
  const { type: rawType, league_id, start_date, end_date } = req.body;

  if (!league_id) {
    return res.status(400).json({ error: 'league_id is required' });
  }
  const type = (rawType === 'playoffs') ? 'playoffs' : 'regular';
  const name = generateSeasonName(start_date ?? null, end_date ?? null, type);

  try {
    const rows = await sql`
      INSERT INTO seasons (name, type, league_id, start_date, end_date)
      VALUES (${name}, ${type}, ${league_id}, ${start_date ?? null}, ${end_date ?? null})
      RETURNING id, name, type, league_id, start_date, end_date, created_at
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
  const { type: rawType, league_id, start_date, end_date } = req.body;

  try {
    // Fetch the current row so we can merge and re-generate the name
    const existing = await sql`SELECT * FROM seasons WHERE id = ${id}`;
    if (existing.length === 0) return res.status(404).json({ error: 'Season not found' });
    const cur = existing[0];

    const mergedType      = rawType !== undefined ? ((rawType === 'playoffs') ? 'playoffs' : 'regular') : cur.type;
    const mergedStartDate = start_date !== undefined ? (start_date || null) : cur.start_date;
    const mergedEndDate   = end_date   !== undefined ? (end_date   || null) : cur.end_date;
    const mergedLeagueId  = league_id ?? cur.league_id;
    const newName = generateSeasonName(mergedStartDate, mergedEndDate, mergedType);

    const rows = await sql`
      UPDATE seasons
      SET
        name      = ${newName},
        type      = ${mergedType},
        league_id = ${mergedLeagueId},
        start_date = ${mergedStartDate},
        end_date   = ${mergedEndDate}
      WHERE id = ${id}
      RETURNING id, name, type, league_id, start_date, end_date, created_at
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

