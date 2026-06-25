const router = require('express').Router();
const { requireAdmin } = require('../middleware/auth');
const { and, asc, eq, inArray } = require('drizzle-orm');
const { db, schema } = require('../db');

const { bracketRuleSets, bracketSlotRules, playoffQualificationFormats } = schema;

router.use(requireAdmin);

const ruleSetSelectShape = {
  id: bracketRuleSets.id,
  league_id: bracketRuleSets.leagueId,
  name: bracketRuleSets.name,
  qualification_format_id: bracketRuleSets.qualificationFormatId,
  qualification_format_name: playoffQualificationFormats.name,
  qualification_rules: playoffQualificationFormats.rules,
  round_names: bracketRuleSets.roundNames,
  matchup_names: bracketRuleSets.matchupNames,
  created_at: bracketRuleSets.createdAt,
};

const ruleSetReturningShape = {
  id: bracketRuleSets.id,
  league_id: bracketRuleSets.leagueId,
  name: bracketRuleSets.name,
  qualification_format_id: bracketRuleSets.qualificationFormatId,
  round_names: bracketRuleSets.roundNames,
  matchup_names: bracketRuleSets.matchupNames,
  created_at: bracketRuleSets.createdAt,
};

async function assertQualificationFormatBelongsToLeague(qualificationFormatId, leagueId) {
  if (!qualificationFormatId) return;
  const formats = await db
    .select({ id: playoffQualificationFormats.id })
    .from(playoffQualificationFormats)
    .where(
      and(
        eq(playoffQualificationFormats.id, qualificationFormatId),
        eq(playoffQualificationFormats.leagueId, leagueId),
      ),
    );
  if (formats.length === 0) {
    const err = new Error('qualification_format_id does not belong to this league');
    err.status = 400;
    throw err;
  }
}

// Helper: insert/replace all slot rules for a rule set
async function upsertSlots(ruleSetId, slots) {
  await db.delete(bracketSlotRules).where(eq(bracketSlotRules.ruleSetId, ruleSetId));
  if (slots.length > 0) {
    await db.insert(bracketSlotRules).values(slots.map((slot) => ({
      ruleSetId,
      slotKey: slot.slot_key,
      ruleType: slot.rule_type,
      rank: slot.rank ?? null,
      scope: slot.scope ?? null,
      groupId: slot.group_id ?? null,
      pool: slot.pool ?? [],
      choiceRef: slot.choice_ref ?? null,
      matchupRef: slot.matchup_ref ?? null,
    })));
  }
  return db
    .select({
      slot_key: bracketSlotRules.slotKey,
      rule_type: bracketSlotRules.ruleType,
      rank: bracketSlotRules.rank,
      scope: bracketSlotRules.scope,
      group_id: bracketSlotRules.groupId,
      pool: bracketSlotRules.pool,
      choice_ref: bracketSlotRules.choiceRef,
      matchup_ref: bracketSlotRules.matchupRef,
    })
    .from(bracketSlotRules)
    .where(eq(bracketSlotRules.ruleSetId, ruleSetId))
    .orderBy(asc(bracketSlotRules.slotKey));
}

// ---------------------------------------------------------------------------
// GET /api/admin/bracket-rule-sets?league_id=X  – list rule sets for a league
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const { league_id } = req.query;
  if (!league_id) return res.status(400).json({ error: 'league_id is required' });
  try {
    const rows = await db
      .select(ruleSetSelectShape)
      .from(bracketRuleSets)
      .leftJoin(
        playoffQualificationFormats,
        eq(bracketRuleSets.qualificationFormatId, playoffQualificationFormats.id),
      )
      .where(eq(bracketRuleSets.leagueId, league_id))
      .orderBy(asc(bracketRuleSets.name));
    if (rows.length === 0) return res.json([]);

    const slots = await db
      .select({
        rule_set_id: bracketSlotRules.ruleSetId,
        slot_key: bracketSlotRules.slotKey,
        rule_type: bracketSlotRules.ruleType,
        rank: bracketSlotRules.rank,
        scope: bracketSlotRules.scope,
        group_id: bracketSlotRules.groupId,
        pool: bracketSlotRules.pool,
        choice_ref: bracketSlotRules.choiceRef,
        matchup_ref: bracketSlotRules.matchupRef,
      })
      .from(bracketSlotRules)
      .where(inArray(bracketSlotRules.ruleSetId, rows.map((row) => row.id)))
      .orderBy(asc(bracketSlotRules.slotKey));

    const slotsByRuleSet = new Map();
    slots.forEach(({ rule_set_id, ...slot }) => {
      const current = slotsByRuleSet.get(rule_set_id) ?? [];
      current.push(slot);
      slotsByRuleSet.set(rule_set_id, current);
    });

    return res.json(rows.map((row) => ({ ...row, slots: slotsByRuleSet.get(row.id) ?? [] })));
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
    const sets = await db
      .select(ruleSetSelectShape)
      .from(bracketRuleSets)
      .leftJoin(
        playoffQualificationFormats,
        eq(bracketRuleSets.qualificationFormatId, playoffQualificationFormats.id),
      )
      .where(eq(bracketRuleSets.id, id));
    if (sets.length === 0) return res.status(404).json({ error: 'Rule set not found' });
    const slots = await db
      .select({
        slot_key: bracketSlotRules.slotKey,
        rule_type: bracketSlotRules.ruleType,
        rank: bracketSlotRules.rank,
        scope: bracketSlotRules.scope,
        group_id: bracketSlotRules.groupId,
        pool: bracketSlotRules.pool,
        choice_ref: bracketSlotRules.choiceRef,
        matchup_ref: bracketSlotRules.matchupRef,
      })
      .from(bracketSlotRules)
      .where(eq(bracketSlotRules.ruleSetId, id))
      .orderBy(asc(bracketSlotRules.slotKey));
    return res.json({ ...sets[0], slots });
  } catch (err) {
    console.error('bracket-rule-sets get error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/bracket-rule-sets  – create a rule set (optionally with slots)
// Body: { league_id, name, slots?: SlotRule[], round_names?, matchup_names? }
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const {
    league_id,
    name,
    qualification_format_id = null,
    slots = [],
    round_names = null,
    matchup_names = null,
  } = req.body;
  if (!league_id) return res.status(400).json({ error: 'league_id is required' });
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  try {
    await assertQualificationFormatBelongsToLeague(qualification_format_id, league_id);
    const sets = await db
      .insert(bracketRuleSets)
      .values({
        leagueId: league_id,
        name: name.trim(),
        qualificationFormatId: qualification_format_id || null,
        roundNames: round_names ?? null,
        matchupNames: matchup_names ?? null,
      })
      .returning(ruleSetReturningShape);
    const savedSlots = await upsertSlots(sets[0].id, slots);
    return res.status(201).json({ ...sets[0], slots: savedSlots });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    if (err.code === '23503') return res.status(400).json({ error: 'League not found' });
    console.error('bracket-rule-sets create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});


// ---------------------------------------------------------------------------
// PATCH /api/admin/bracket-rule-sets/:id  – rename a rule set
// Body: { name, round_names?, matchup_names? }
// ---------------------------------------------------------------------------
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, qualification_format_id, round_names, matchup_names } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const current = await db
      .select({ league_id: bracketRuleSets.leagueId })
      .from(bracketRuleSets)
      .where(eq(bracketRuleSets.id, id));
    if (current.length === 0) return res.status(404).json({ error: 'Rule set not found' });

    const changes = { name: name.trim() };
    if (qualification_format_id !== undefined) {
      await assertQualificationFormatBelongsToLeague(
        qualification_format_id,
        current[0].league_id,
      );
      changes.qualificationFormatId = qualification_format_id || null;
    }
    if (round_names !== undefined) changes.roundNames = round_names;
    if (matchup_names !== undefined) changes.matchupNames = matchup_names;

    const rows = await db
      .update(bracketRuleSets)
      .set(changes)
      .where(eq(bracketRuleSets.id, id))
      .returning(ruleSetReturningShape);
    return res.json(rows[0]);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
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
    const sets = await db
      .select({ id: bracketRuleSets.id })
      .from(bracketRuleSets)
      .where(eq(bracketRuleSets.id, id));
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
    const rows = await db
      .delete(bracketRuleSets)
      .where(eq(bracketRuleSets.id, id))
      .returning({ id: bracketRuleSets.id });
    if (rows.length === 0) return res.status(404).json({ error: 'Rule set not found' });
    return res.json({ message: 'Rule set deleted' });
  } catch (err) {
    console.error('bracket-rule-sets delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
