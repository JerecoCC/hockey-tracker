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
// POST /api/admin/player-teams
// Body: { player_id, team_id, season_id, jersey_number?, photo?, position?, start_date?, end_date? }
// Creates a new stint row directly. Returns 409 if the unique active-stint index fires
// (i.e. the player already has an open stint in this season and end_date is omitted).
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const { player_id, team_id, season_id, jersey_number, photo, position, start_date, end_date } = req.body;
  if (!player_id) return res.status(400).json({ error: 'player_id is required' });
  if (!team_id)   return res.status(400).json({ error: 'team_id is required' });
  if (!season_id) return res.status(400).json({ error: 'season_id is required' });

  try {
    const rows = await sql`
      INSERT INTO player_teams
        (player_id, team_id, season_id, jersey_number, photo, position, start_date, end_date)
      VALUES (
        ${player_id}, ${team_id}, ${season_id},
        ${jersey_number ?? null},
        ${photo ?? null},
        ${position ?? null},
        ${start_date ?? null}::date,
        ${end_date   ?? null}::date
      )
      RETURNING id, player_id, team_id, season_id, jersey_number, photo, position,
                start_date::text AS start_date, end_date::text AS end_date
    `;
    return res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'Player already has an active stint in this season. Set an end date or close the existing stint first.',
      });
    }
    console.error('player-teams create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/player-teams
// Body: { player_id, team_id, season_id, jersey_number?, photo?, position?, effective_date? }
// Updates jersey_number, photo, and/or position on the active stint for this player/team/season.
// When jersey_number changes, the old value is preserved in jersey_number_history
// so that game queries can resolve the correct number by date.
// ---------------------------------------------------------------------------
router.patch('/', async (req, res) => {
  const { player_id, team_id, season_id, jersey_number, photo, position, effective_date } = req.body;
  if (!player_id) return res.status(400).json({ error: 'player_id is required' });
  if (!team_id)   return res.status(400).json({ error: 'team_id is required' });
  if (!season_id) return res.status(400).json({ error: 'season_id is required' });

  const jerseyInBody   = 'jersey_number' in req.body;
  const photoInBody    = 'photo' in req.body;
  const positionInBody = 'position' in req.body;

  try {
    // If jersey_number is changing, record history before the update.
    if (jerseyInBody && jersey_number != null) {
      const [current] = await sql`
        SELECT id, jersey_number,
               COALESCE(start_date, created_at::date) AS effective_start
        FROM player_teams
        WHERE player_id = ${player_id}
          AND team_id   = ${team_id}
          AND season_id = ${season_id}
          AND end_date IS NULL
      `;
      if (current && current.jersey_number !== jersey_number) {
        const changeDate = effective_date ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
        // Seed initial history if none exists for this stint yet.
        const existingHistory = await sql`
          SELECT 1 FROM jersey_number_history WHERE player_teams_id = ${current.id} LIMIT 1
        `;
        if (existingHistory.length === 0 && current.jersey_number != null) {
          // If the effective_date is backdated before the stint's natural start, use the
          // season start date so the old jersey's entry always sorts before the new one.
          let seedDate = current.effective_start;
          if (seedDate >= changeDate) {
            const [season] = await sql`
              SELECT start_date::text AS start_date FROM seasons
              JOIN player_teams ON player_teams.season_id = seasons.id
              WHERE player_teams.id = ${current.id}
            `;
            seedDate = season?.start_date ?? changeDate;
          }
          await sql`
            INSERT INTO jersey_number_history (player_teams_id, jersey_number, effective_from)
            VALUES (${current.id}, ${current.jersey_number}, ${seedDate})
          `;
        }
        // Record the new number going forward.
        await sql`
          INSERT INTO jersey_number_history (player_teams_id, jersey_number, effective_from)
          VALUES (${current.id}, ${jersey_number}, ${changeDate})
        `;
      }
    }

    const rows = await sql`
      UPDATE player_teams
      SET
        jersey_number = CASE WHEN ${jerseyInBody}   THEN ${jersey_number ?? null} ELSE jersey_number END,
        photo         = CASE WHEN ${photoInBody}     THEN ${photo ?? null}         ELSE photo         END,
        position      = CASE WHEN ${positionInBody}  THEN ${position ?? null}      ELSE position      END
      WHERE player_id = ${player_id}
        AND team_id   = ${team_id}
        AND season_id = ${season_id}
        AND end_date IS NULL
      RETURNING id, player_id, team_id, season_id, jersey_number, photo, position
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
        pt.jersey_number, pt.photo, pt.position,
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
      ORDER BY pt.end_date DESC NULLS FIRST, COALESCE(pt.start_date, pt.created_at::date) DESC, pt.created_at DESC
    `;
    return res.json(rows);
  } catch (err) {
    console.error('player-teams history error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/player-teams/history/:playerId/jerseys
// Returns all jersey_number_history rows across every stint of a player,
// ordered by stint then effective_from ASC. Callers can group by
// player_teams_id to display a per-stint jersey number timeline.
// ---------------------------------------------------------------------------
router.get('/history/:playerId/jerseys', async (req, res) => {
  const { playerId } = req.params;
  try {
    const rows = await sql`
      SELECT
        jnh.id,
        jnh.player_teams_id,
        jnh.jersey_number,
        jnh.effective_from::text AS effective_from
      FROM jersey_number_history jnh
      JOIN player_teams pt ON pt.id = jnh.player_teams_id
      WHERE pt.player_id = ${playerId}
      ORDER BY jnh.player_teams_id, jnh.effective_from ASC
    `;
    return res.json(rows);
  } catch (err) {
    console.error('jersey history error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/player-teams/:id
// Body: { team_id?, season_id?, jersey_number?, photo?, position?, start_date?, end_date? }
// Updates editable fields on a specific stint row by its UUID.
// ---------------------------------------------------------------------------
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { team_id, season_id, jersey_number, photo, position, start_date, end_date } = req.body;

  const teamInBody      = 'team_id'       in req.body;
  const seasonInBody    = 'season_id'     in req.body;
  const jerseyInBody    = 'jersey_number' in req.body;
  const photoInBody     = 'photo'         in req.body;
  const positionInBody  = 'position'      in req.body;
  const startDateInBody = 'start_date'    in req.body;
  const endDateInBody   = 'end_date'      in req.body;

  try {
    const rows = await sql`
      UPDATE player_teams
      SET
        team_id       = CASE WHEN ${teamInBody}      THEN ${team_id}::uuid                   ELSE team_id       END,
        season_id     = CASE WHEN ${seasonInBody}    THEN ${season_id}::uuid                 ELSE season_id     END,
        jersey_number = CASE WHEN ${jerseyInBody}    THEN ${jersey_number ?? null}            ELSE jersey_number END,
        photo         = CASE WHEN ${photoInBody}     THEN ${photo ?? null}                    ELSE photo         END,
        position      = CASE WHEN ${positionInBody}  THEN ${position ?? null}                 ELSE position      END,
        start_date    = CASE WHEN ${startDateInBody} THEN ${start_date ?? null}::date         ELSE start_date    END,
        end_date      = CASE WHEN ${endDateInBody}   THEN ${end_date ?? null}::date           ELSE end_date      END
      WHERE id = ${id}
      RETURNING
        id, player_id, team_id, season_id,
        jersey_number, photo, position,
        start_date::text AS start_date,
        end_date::text   AS end_date
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Stint not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('player-teams patch/:id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/player-teams/bulk-trade
// Body: { players: [{ player_id, jersey_number?, position? }], season_id, to_team_id, trade_date }
// Closes each player's current active stint and opens a new one on to_team_id.
// Returns { traded: [...], failed: [player_ids that had no active stint] }
// ---------------------------------------------------------------------------
router.post('/bulk-trade', async (req, res) => {
  const { players, season_id, to_team_id, trade_date } = req.body;

  if (!Array.isArray(players) || players.length === 0)
    return res.status(400).json({ error: 'players must be a non-empty array' });
  if (!season_id)  return res.status(400).json({ error: 'season_id is required' });
  if (!to_team_id) return res.status(400).json({ error: 'to_team_id is required' });
  if (!trade_date) return res.status(400).json({ error: 'trade_date is required' });

  try {
    const traded = [];
    const failed = [];

    for (const { player_id, jersey_number = null, position = null } of players) {
      // Close the current active stint
      const closed = await sql`
        UPDATE player_teams
        SET end_date = ${trade_date}
        WHERE player_id = ${player_id}
          AND season_id = ${season_id}
          AND end_date IS NULL
        RETURNING id, team_id
      `;

      if (closed.length === 0) {
        failed.push(player_id);
        continue;
      }

      // Open new stint on the destination team
      const created = await sql`
        INSERT INTO player_teams (player_id, team_id, season_id, start_date, jersey_number, position)
        VALUES (${player_id}, ${to_team_id}, ${season_id}, ${trade_date}, ${jersey_number}, ${position})
        RETURNING id, player_id, team_id, season_id, jersey_number, position,
                  start_date::text AS start_date, end_date::text AS end_date
      `;
      traded.push(created[0]);
    }

    return res.status(201).json({ traded, failed });
  } catch (err) {
    console.error('player-teams bulk-trade error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/player-teams/trade
// Body: { player_id, season_id, to_team_id, trade_date, jersey_number?, position? }
// Closes the player's current stint (sets end_date) and opens a new one on
// to_team_id starting on trade_date.
// ---------------------------------------------------------------------------
router.post('/trade', async (req, res) => {
  const { player_id, season_id, to_team_id, trade_date, jersey_number = null, position = null } = req.body;
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
      INSERT INTO player_teams (player_id, team_id, season_id, start_date, jersey_number, position)
      VALUES (${player_id}, ${to_team_id}, ${season_id}, ${trade_date}, ${jersey_number}, ${position})
      RETURNING id, player_id, team_id, season_id, jersey_number, position,
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
