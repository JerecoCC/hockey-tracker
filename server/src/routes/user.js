const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { sql } = require('../db');

// All user routes require authentication (any role)
router.use(requireAuth);

// ---------------------------------------------------------------------------
// GET /api/user/favorites  – list the authenticated user's favourite team IDs
// ---------------------------------------------------------------------------
router.get('/favorites', async (req, res) => {
  const userId = req.user.id;
  try {
    const rows = await sql`
      SELECT team_id FROM user_favorite_teams
      WHERE user_id = ${userId}
      ORDER BY created_at ASC
    `;
    return res.json(rows.map((r) => r.team_id));
  } catch (err) {
    console.error('user favorites list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/user/favorites/:teamId  – add a team to favourites (idempotent)
// ---------------------------------------------------------------------------
router.post('/favorites/:teamId', async (req, res) => {
  const userId = req.user.id;
  const { teamId } = req.params;
  try {
    // Verify team exists
    const team = await sql`SELECT id FROM teams WHERE id = ${teamId}`;
    if (team.length === 0) return res.status(404).json({ error: 'Team not found' });

    await sql`
      INSERT INTO user_favorite_teams (user_id, team_id)
      VALUES (${userId}, ${teamId})
      ON CONFLICT DO NOTHING
    `;
    return res.status(201).json({ user_id: userId, team_id: teamId });
  } catch (err) {
    console.error('user favorites add error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/user/favorites/:teamId  – remove a team from favourites
// ---------------------------------------------------------------------------
router.delete('/favorites/:teamId', async (req, res) => {
  const userId = req.user.id;
  const { teamId } = req.params;
  try {
    await sql`
      DELETE FROM user_favorite_teams
      WHERE user_id = ${userId} AND team_id = ${teamId}
    `;
    return res.json({ message: 'Removed from favorites' });
  } catch (err) {
    console.error('user favorites remove error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
