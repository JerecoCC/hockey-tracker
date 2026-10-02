'use strict';

const { sql } = require('../db');

const VALID_BEST_OF = new Set([3, 5, 7]);

/**
 * Validates a rule set's per-round series lengths, keyed by round number string.
 * e.g. { "1": 3, "2": 5, "3": 5 }. Returns null when no round has a length.
 * Throws a 400-status error for anything else.
 */
function normalizeRoundBestOf(value) {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    const err = new Error('round_best_of must be an object keyed by round number');
    err.status = 400;
    throw err;
  }
  const normalized = {};
  for (const [round, bestOf] of Object.entries(value)) {
    if (bestOf == null || bestOf === '') continue;
    const roundNumber = Number(round);
    const bestOfNumber = Number(bestOf);
    if (!Number.isInteger(roundNumber) || roundNumber < 1 || roundNumber > 4) {
      const err = new Error('round_best_of keys must be round numbers 1-4');
      err.status = 400;
      throw err;
    }
    if (!VALID_BEST_OF.has(bestOfNumber)) {
      const err = new Error('round_best_of values must be 3, 5, or 7');
      err.status = 400;
      throw err;
    }
    normalized[String(roundNumber)] = bestOfNumber;
  }
  return Object.keys(normalized).length > 0 ? normalized : null;
}

/**
 * Wins needed to take a series in the given round of a season. The season's
 * bracket rule set can set a length per round; otherwise the season override
 * applies, then the league default.
 */
async function resolveSeriesGamesToWin(seasonId, round) {
  const rows = await sql`
    SELECT COALESCE(
      (brs.round_best_of ->> ${String(round)})::smallint,
      s.best_of_playoff,
      l.best_of_playoff
    ) AS best_of
    FROM seasons s
    JOIN leagues l ON l.id = s.league_id
    LEFT JOIN bracket_rule_sets brs ON brs.id = s.bracket_rule_set_id
    WHERE s.id = ${seasonId}
  `;
  const bestOf = rows[0]?.best_of ?? 7;
  return Math.ceil(bestOf / 2);
}

module.exports = { normalizeRoundBestOf, resolveSeriesGamesToWin };
