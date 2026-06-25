const router = require('express').Router();
const { requireAdmin } = require('../middleware/auth');
const { asc, eq } = require('drizzle-orm');
const { db, schema } = require('../db');

const { playoffQualificationFormats } = schema;

router.use(requireAdmin);

const VALID_SCOPES = new Set(['league', 'conference', 'division']);
const VALID_METHODS = new Set(['top', 'wildcard']);

function normalizeRules(rules) {
  if (!Array.isArray(rules)) {
    const err = new Error('rules must be an array');
    err.status = 400;
    throw err;
  }

  return rules.map((rule, index) => {
    const scope = rule?.scope;
    const method = rule?.method;
    const count = Number(rule?.count);

    if (!VALID_SCOPES.has(scope)) {
      const err = new Error(`rules.${index}.scope is invalid`);
      err.status = 400;
      throw err;
    }
    if (!VALID_METHODS.has(method)) {
      const err = new Error(`rules.${index}.method is invalid`);
      err.status = 400;
      throw err;
    }
    if (!Number.isInteger(count) || count < 1 || count > 32) {
      const err = new Error(`rules.${index}.count must be between 1 and 32`);
      err.status = 400;
      throw err;
    }

    return { scope, method, count };
  });
}

const returningShape = {
  id: playoffQualificationFormats.id,
  league_id: playoffQualificationFormats.leagueId,
  name: playoffQualificationFormats.name,
  rules: playoffQualificationFormats.rules,
  created_at: playoffQualificationFormats.createdAt,
};

// ---------------------------------------------------------------------------
// GET /api/admin/playoff-qualification-formats?league_id=X
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const { league_id } = req.query;
  if (!league_id) return res.status(400).json({ error: 'league_id is required' });

  try {
    const rows = await db
      .select(returningShape)
      .from(playoffQualificationFormats)
      .where(eq(playoffQualificationFormats.leagueId, league_id))
      .orderBy(asc(playoffQualificationFormats.name));
    return res.json(rows);
  } catch (err) {
    console.error('playoff-qualification-formats list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/playoff-qualification-formats/:id
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const rows = await db
      .select(returningShape)
      .from(playoffQualificationFormats)
      .where(eq(playoffQualificationFormats.id, id));
    if (rows.length === 0) return res.status(404).json({ error: 'Qualification format not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('playoff-qualification-formats get error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/playoff-qualification-formats
// Body: { league_id, name, rules }
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const { league_id, name, rules = [] } = req.body;
  if (!league_id) return res.status(400).json({ error: 'league_id is required' });
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  try {
    const normalizedRules = normalizeRules(rules);
    const rows = await db
      .insert(playoffQualificationFormats)
      .values({
        leagueId: league_id,
        name: name.trim(),
        rules: normalizedRules,
      })
      .returning(returningShape);
    return res.status(201).json(rows[0]);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    if (err.code === '23503') return res.status(400).json({ error: 'League not found' });
    console.error('playoff-qualification-formats create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/playoff-qualification-formats/:id
// Body: { name, rules }
// ---------------------------------------------------------------------------
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, rules } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  try {
    const changes = { name: name.trim() };
    if (rules !== undefined) changes.rules = normalizeRules(rules);

    const rows = await db
      .update(playoffQualificationFormats)
      .set(changes)
      .where(eq(playoffQualificationFormats.id, id))
      .returning(returningShape);
    if (rows.length === 0) return res.status(404).json({ error: 'Qualification format not found' });
    return res.json(rows[0]);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('playoff-qualification-formats patch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/playoff-qualification-formats/:id
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const rows = await db
      .delete(playoffQualificationFormats)
      .where(eq(playoffQualificationFormats.id, id))
      .returning({ id: playoffQualificationFormats.id });
    if (rows.length === 0) return res.status(404).json({ error: 'Qualification format not found' });
    return res.json({ message: 'Qualification format deleted' });
  } catch (err) {
    console.error('playoff-qualification-formats delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
