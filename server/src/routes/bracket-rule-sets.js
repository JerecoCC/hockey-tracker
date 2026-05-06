const router = require('express').Router();
const { requireAdmin } = require('../middleware/auth');
const { sql } = require('../db');

router.use(requireAdmin);

// Helper: insert/replace all slot rules for a rule set
async function upsertSlots(ruleSetId, slots) {
  await sql`DELETE FROM bracket_slot_rules WHERE rule_set_id = ${ruleSetId}`;
  for (const slot of slots) {
    await sql`
      INSERT INTO bracket_slot_rules
        (rule_set_id, slot_key, rule_type, rank, scope, group_id, pool, choice_ref, matchup_ref)
      VALUES (
        ${ruleSetId},
        ${slot.slot_key},
        ${slot.rule_type},
        ${slot.rank ?? null},
        ${slot.scope ?? null},
        ${slot.group_id ?? null},
        ${slot.pool ? JSON.stringify(slot.pool) : '[]'}::jsonb,
        ${slot.choice_ref ?? null},
        ${slot.matchup_ref ?? null}
      )
    `;
  }
  return sql`
    SELECT slot_key, rule_type, rank, scope, group_id, pool, choice_ref, matchup_ref
    FROM bracket_slot_rules
    WHERE rule_set_id = ${ruleSetId}
    ORDER BY slot_key
  `;
}

// ---------------------------------------------------------------------------
// GET /api/admin/bracket-rule-sets?league_id=X  – list rule sets for a league
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const { league_id } = req.query;
  if (!league_id) return res.status(400).json({ error: 'league_id is required' });
  try {
    const rows = await sql`
      SELECT id, league_id, name, created_at
      FROM bracket_rule_sets
      WHERE league_id = ${league_id}
      ORDER BY name ASC
    `;
    return res.json(rows);
  } catch (err) {
    console.error('bracket-rule-sets list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/bracket-rule-sets/:id  – get one rule set with its slot rules
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const sets = await sql`
      SELECT id, league_id, name, created_at
      FROM bracket_rule_sets WHERE id = ${id}
    `;
    if (sets.length === 0) return res.status(404).json({ error: 'Rule set not found' });
    const slots = await sql`
      SELECT slot_key, rule_type, rank, scope, group_id, pool, choice_ref, matchup_ref
      FROM bracket_slot_rules WHERE rule_set_id = ${id} ORDER BY slot_key
    `;
    return res.json({ ...sets[0], slots });
  } catch (err) {
    console.error('bracket-rule-sets get error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/bracket-rule-sets  – create a rule set (optionally with slots)
// Body: { league_id, name, slots?: SlotRule[] }
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const { league_id, name, slots = [] } = req.body;
  if (!league_id) return res.status(400).json({ error: 'league_id is required' });
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const sets = await sql`
      INSERT INTO bracket_rule_sets (league_id, name)
      VALUES (${league_id}, ${name.trim()})
      RETURNING id, league_id, name, created_at
    `;
    const savedSlots = await upsertSlots(sets[0].id, slots);
    return res.status(201).json({ ...sets[0], slots: savedSlots });
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'League not found' });
    console.error('bracket-rule-sets create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});


// ---------------------------------------------------------------------------
// PATCH /api/admin/bracket-rule-sets/:id  – rename a rule set
// Body: { name }
// ---------------------------------------------------------------------------
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const rows = await sql`
      UPDATE bracket_rule_sets SET name = ${name.trim()}
      WHERE id = ${id}
      RETURNING id, league_id, name, created_at
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Rule set not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('bracket-rule-sets patch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/bracket-rule-sets/:id/slots  – replace all slots in a rule set
// Body: { slots: SlotRule[] }
// ---------------------------------------------------------------------------
router.put('/:id/slots', async (req, res) => {
  const { id } = req.params;
  const { slots = [] } = req.body;
  try {
    const sets = await sql`SELECT id FROM bracket_rule_sets WHERE id = ${id}`;
    if (sets.length === 0) return res.status(404).json({ error: 'Rule set not found' });
    const savedSlots = await upsertSlots(id, slots);
    return res.json({ id, slots: savedSlots });
  } catch (err) {
    console.error('bracket-rule-sets put slots error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/bracket-rule-sets/:id  – delete a rule set
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`
      DELETE FROM bracket_rule_sets WHERE id = ${id} RETURNING id
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Rule set not found' });
    return res.json({ message: 'Rule set deleted' });
  } catch (err) {
    console.error('bracket-rule-sets delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
