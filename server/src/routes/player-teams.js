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

// ---------------------------------------------------------------------------
// GET /api/admin/player-teams/history/:playerId?season_id=
// Returns all stints for this player (optionally filtered to a season),
// newest first. Each row includes team name/logo via team_iterations.
// ---------------------------------------------------------------------------
router.get('/history/:playerId', async (req, res) => {
  const { playerId } = req.params;
  const { season_id } = req.query;

  try {
    const rows = await sql`
      SELECT
        pt.id, pt.player_id, pt.team_id, pt.season_id,
        pt.jersey_number, pt.photo,
        pt.start_date::text AS start_date,
        pt.end_date::text   AS end_date,
        pt.created_at,
        ti.name  AS team_name,
        ti.code  AS team_code,
        ti.logo  AS team_logo,
        t.primary_color,
        t.text_color
      FROM player_teams pt
      JOIN teams t ON t.id = pt.team_id
      LEFT JOIN LATERAL (
        SELECT name, code, logo FROM team_iterations
        WHERE team_id = pt.team_id
          AND (season_id = pt.season_id OR season_id IS NULL)
        ORDER BY CASE WHEN season_id = pt.season_id THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) ti ON true
      WHERE pt.player_id = ${playerId}
        ${season_id ? sql`AND pt.season_id = ${season_id}` : sql``}
      ORDER BY COALESCE(pt.start_date, pt.created_at::date) DESC, pt.created_at DESC
    `;
    return res.json(rows);
  } catch (err) {
    console.error('player-teams history error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/player-teams/trade
// Body: { player_id, season_id, to_team_id, trade_date, jersey_number? }
// Closes the player's current stint (sets end_date) and opens a new one on
// to_team_id starting on trade_date.
// ---------------------------------------------------------------------------
router.post('/trade', async (req, res) => {
  const { player_id, season_id, to_team_id, trade_date, jersey_number = null } = req.body;
  if (!player_id)  return res.status(400).json({ error: 'player_id is required' });
  if (!season_id)  return res.status(400).json({ error: 'season_id is required' });
  if (!to_team_id) return res.status(400).json({ error: 'to_team_id is required' });
  if (!trade_date) return res.status(400).json({ error: 'trade_date is required' });

  try {
    // 1. Find and close the current active stint
    const closed = await sql`
      UPDATE player_teams
      SET end_date = ${trade_date}
      WHERE player_id = ${player_id}
        AND season_id = ${season_id}
        AND end_date IS NULL
      RETURNING id, team_id
    `;
    if (closed.length === 0) {
      return res.status(404).json({ error: 'No active stint found for this player in this season' });
    }

    // 2. Open new stint on the destination team
    const created = await sql`
      INSERT INTO player_teams (player_id, team_id, season_id, start_date, jersey_number)
      VALUES (${player_id}, ${to_team_id}, ${season_id}, ${trade_date}, ${jersey_number ?? null})
      RETURNING id, player_id, team_id, season_id, jersey_number,
                start_date::text AS start_date, end_date::text AS end_date
    `;
    return res.status(201).json({
      from_team_id: closed[0].team_id,
      new_stint: created[0],
    });
  } catch (err) {
    console.error('player-teams trade error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
