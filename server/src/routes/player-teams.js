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

// ---------------------------------------------------------------------------
// PATCH /api/admin/player-teams
// Body: { player_id, team_id, season_id, jersey_number?, photo? }
// Updates jersey_number and/or photo on the active stint for this player/team/season.
// ---------------------------------------------------------------------------
router.patch('/', async (req, res) => {
  const { player_id, team_id, season_id, jersey_number, photo } = req.body;
  if (!player_id) return res.status(400).json({ error: 'player_id is required' });
  if (!team_id)   return res.status(400).json({ error: 'team_id is required' });
  if (!season_id) return res.status(400).json({ error: 'season_id is required' });

  const jerseyInBody = 'jersey_number' in req.body;
  const photoInBody  = 'photo' in req.body;

  try {
    const rows = await sql`
      UPDATE player_teams
      SET
        jersey_number = CASE WHEN ${jerseyInBody} THEN ${jersey_number ?? null} ELSE jersey_number END,
        photo         = CASE WHEN ${photoInBody}  THEN ${photo ?? null}         ELSE photo         END
      WHERE player_id = ${player_id}
        AND team_id   = ${team_id}
        AND season_id = ${season_id}
        AND end_date IS NULL
      RETURNING id, player_id, team_id, season_id, jersey_number, photo
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Player team record not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('player-teams update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
