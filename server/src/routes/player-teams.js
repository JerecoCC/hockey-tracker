const router = require('express').Router();
const { requireAdmin } = require('../middleware/auth');
const { sql } = require('../db');

router.use(requireAdmin);

// ---------------------------------------------------------------------------
// POST /api/admin/player-teams/bulk
// Body: { team_id, season_id, players: [{ player_id, jersey_number? }] }
// Inserts player_teams rows, skipping duplicates via ON CONFLICT DO NOTHING.
// Returns { created: [...], skipped: N }
// ---------------------------------------------------------------------------
router.post('/bulk', async (req, res) => {
  const { team_id, season_id, players } = req.body;

  if (!team_id) return res.status(400).json({ error: 'team_id is required' });
  if (!season_id) return res.status(400).json({ error: 'season_id is required' });
  if (!Array.isArray(players) || players.length === 0)
    return res.status(400).json({ error: 'players must be a non-empty array' });

  for (let i = 0; i < players.length; i++) {
    if (!players[i].player_id)
      return res.status(400).json({ error: `Row ${i + 1}: player_id is required` });
  }

  try {
    const created = [];
    for (const { player_id, jersey_number = null } of players) {
      const rows = await sql`
        INSERT INTO player_teams (player_id, team_id, season_id, jersey_number)
        VALUES (${player_id}, ${team_id}, ${season_id}, ${jersey_number})
        ON CONFLICT (player_id, season_id) WHERE end_date IS NULL DO NOTHING
        RETURNING id, player_id, team_id, season_id, jersey_number
      `;
      if (rows.length > 0) created.push(rows[0]);
    }
    return res.status(201).json({ created, skipped: players.length - created.length });
  } catch (err) {
    console.error('player-teams bulk error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
