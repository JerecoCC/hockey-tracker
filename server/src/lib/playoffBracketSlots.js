const MATCHUP_KEY_RE = /^r([0-9]+)m([0-9]+)$/;
const SLOT_KEY_RE = /^r([0-9]+)m([0-9]+)team[12]$/;

const compareMatchupKeys = (a, b) => {
  const ma = a.match(MATCHUP_KEY_RE);
  const mb = b.match(MATCHUP_KEY_RE);
  if (!ma || !mb) return a.localeCompare(b);
  return Number(ma[1]) - Number(mb[1]) || Number(ma[2]) - Number(mb[2]);
};

const normalizeSeasonBracketSlotKeys = async (sql, seasonId, bracketRuleSetId) => {
  if (!bracketRuleSetId) return [];

  const ruleRows = await sql`
    SELECT slot_key
    FROM bracket_slot_rules
    WHERE rule_set_id = ${bracketRuleSetId}
      AND slot_key ~ '^r[0-9]+m[0-9]+team[12]$'
    ORDER BY slot_key
  `;

  const expectedByRound = new Map();
  for (const row of ruleRows) {
    const m = row.slot_key.match(SLOT_KEY_RE);
    if (!m) continue;
    const round = Number(m[1]);
    const matchupKey = `r${m[1]}m${m[2]}`;
    if (!expectedByRound.has(round)) expectedByRound.set(round, []);
    if (!expectedByRound.get(round).includes(matchupKey)) {
      expectedByRound.get(round).push(matchupKey);
    }
  }

  for (const [round, keys] of expectedByRound) {
    expectedByRound.set(round, [...keys].sort(compareMatchupKeys));
  }

  const seriesRows = await sql`
    SELECT id, round, bracket_slot_key, created_at
    FROM playoff_series
    WHERE season_id = ${seasonId}
    ORDER BY round ASC, created_at ASC, id ASC
  `;

  const byRound = new Map();
  for (const row of seriesRows) {
    if (!byRound.has(row.round)) byRound.set(row.round, []);
    byRound.get(row.round).push(row);
  }

  const updates = [];

  for (const [round, rows] of byRound) {
    const expectedKeys = expectedByRound.get(Number(round)) ?? [];
    if (expectedKeys.length === 0) continue;

    const used = new Set();
    const reservedIds = new Set();

    for (const row of rows) {
      const currentKey = row.bracket_slot_key;
      if (currentKey && expectedKeys.includes(currentKey) && !used.has(currentKey)) {
        used.add(currentKey);
        reservedIds.add(row.id);
      }
    }

    for (const row of rows) {
      if (reservedIds.has(row.id)) {
        continue;
      }

      const currentKey = row.bracket_slot_key;
      if (currentKey && expectedKeys.includes(currentKey) && used.has(currentKey)) {
        // Duplicate valid slot key — reassign if another expected slot is free.
      }

      const replacement = expectedKeys.find((key) => !used.has(key));
      if (!replacement) continue;
      used.add(replacement);

      if (replacement !== currentKey) {
        updates.push({ id: row.id, bracket_slot_key: replacement });
      }
    }
  }

  for (const update of updates) {
    await sql`
      UPDATE playoff_series
      SET bracket_slot_key = ${update.bracket_slot_key}
      WHERE id = ${update.id}
    `;
  }

  return updates;
};

module.exports = { normalizeSeasonBracketSlotKeys };