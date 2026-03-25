const router = require('express').Router();
const { requireAdmin } = require('../middleware/auth');
const { sql } = require('../db');

// All league routes require the admin role
router.use(requireAdmin);

// ---------------------------------------------------------------------------
// GET /api/admin/leagues  – list all leagues
// ---------------------------------------------------------------------------
router.get('/', async (_req, res) => {
  try {
    const leagues = await sql`
      SELECT id, name, code, description, logo, created_at
      FROM leagues
      ORDER BY name ASC
    `;
    return res.json(leagues);
  } catch (err) {
    console.error('leagues list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/leagues/:id  – get a single league
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`
      SELECT id, name, code, description, logo, created_at
      FROM leagues
      WHERE id = ${id}
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'League not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('leagues get error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/leagues  – create a league
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const { name, code, description, logo } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'name is required' });
  }
  if (!code || typeof code !== 'string' || code.trim() === '') {
    return res.status(400).json({ error: 'code is required' });
  }

  try {
    const rows = await sql`
      INSERT INTO leagues (name, code, description, logo)
      VALUES (${name.trim()}, ${code.trim().toUpperCase()}, ${description ?? null}, ${logo ?? null})
      RETURNING id, name, code, description, logo, created_at
    `;
    return res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A league with that code already exists' });
    }
    console.error('leagues create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/leagues/:id  – update a league
// ---------------------------------------------------------------------------
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, code, description, logo } = req.body;

  if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
    return res.status(400).json({ error: 'name cannot be empty' });
  }
  if (code !== undefined && (typeof code !== 'string' || code.trim() === '')) {
    return res.status(400).json({ error: 'code cannot be empty' });
  }

  try {
    const rows = await sql`
      UPDATE leagues
      SET
        name        = COALESCE(${name?.trim() ?? null}, name),
        code        = COALESCE(${code ? code.trim().toUpperCase() : null}, code),
        description = COALESCE(${description ?? null}, description),
        logo        = COALESCE(${logo ?? null}, logo)
      WHERE id = ${id}
      RETURNING id, name, code, description, logo, created_at
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'League not found' });
    return res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A league with that code already exists' });
    }
    console.error('leagues update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/leagues/:id  – delete a league
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`
      DELETE FROM leagues WHERE id = ${id} RETURNING id
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'League not found' });
    return res.json({ message: 'League deleted' });
  } catch (err) {
    console.error('leagues delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

