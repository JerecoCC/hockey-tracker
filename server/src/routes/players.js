const express = require('express');
const router = express.Router();
const { sql } = require('../db');
const { requireAdmin } = require('../middleware/auth');

router.use(requireAdmin);

// ---------------------------------------------------------------------------
// GET /api/admin/players  – list all players
// Supports optional ?league_id= or ?team_id= to scope results.
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const { league_id, team_id } = req.query;
  try {
    const players = league_id
      ? await sql`
          SELECT
            p.id, p.first_name, p.last_name, p.photo,
            p.date_of_birth::text AS date_of_birth,
            p.birth_city, p.birth_country, p.nationality,
            p.height_cm, p.weight_lbs, p.position, p.shoots,
            p.is_active, p.created_at
          FROM players p
          WHERE EXISTS (
            SELECT 1 FROM player_teams pt
            JOIN teams t ON t.id = pt.team_id
            WHERE pt.player_id = p.id AND t.league_id = ${league_id}
          )
          ORDER BY p.last_name, p.first_name
        `
      : team_id
      ? await sql`
          SELECT
            p.id, p.first_name, p.last_name, p.photo,
            p.date_of_birth::text AS date_of_birth,
            p.birth_city, p.birth_country, p.nationality,
            p.height_cm, p.weight_lbs, p.position, p.shoots,
            p.is_active, p.created_at
          FROM players p
          WHERE EXISTS (
            SELECT 1 FROM player_teams pt
            WHERE pt.player_id = p.id AND pt.team_id = ${team_id}
          )
          ORDER BY p.last_name, p.first_name
        `
      : await sql`
          SELECT
            id, first_name, last_name, photo,
            date_of_birth::text AS date_of_birth,
            birth_city, birth_country, nationality,
            height_cm, weight_lbs, position, shoots,
            is_active, created_at
          FROM players ORDER BY last_name, first_name
        `;
    return res.json(players);
  } catch (err) {
    console.error('players list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/players/:id  – get a single player
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`
      SELECT
        id, first_name, last_name, photo,
        date_of_birth::text AS date_of_birth,
        birth_city, birth_country, nationality,
        height_cm, weight_lbs, position, shoots,
        is_active, created_at
      FROM players WHERE id = ${id}
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Player not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('players get error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/players  – create a player
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const {
    first_name, last_name, position, shoots,
    date_of_birth, birth_city, birth_country, nationality,
    height_cm, weight_lbs, is_active,
  } = req.body;

  if (!first_name || typeof first_name !== 'string' || first_name.trim() === '') {
    return res.status(400).json({ error: 'first_name is required' });
  }
  if (!last_name || typeof last_name !== 'string' || last_name.trim() === '') {
    return res.status(400).json({ error: 'last_name is required' });
  }

  try {
    const rows = await sql`
      INSERT INTO players (
        first_name, last_name, position, shoots,
        date_of_birth, birth_city, birth_country, nationality,
        height_cm, weight_lbs, is_active
      ) VALUES (
        ${first_name.trim()}, ${last_name.trim()},
        ${position ?? null}, ${shoots ?? null},
        ${date_of_birth ?? null}, ${birth_city?.trim() ?? null},
        ${birth_country?.trim().toUpperCase() ?? null}, ${nationality?.trim().toUpperCase() ?? null},
        ${height_cm ?? null}, ${weight_lbs ?? null},
        ${is_active ?? true}
      )
      RETURNING
        id, first_name, last_name, photo,
        date_of_birth::text AS date_of_birth,
        birth_city, birth_country, nationality,
        height_cm, weight_lbs, position, shoots,
        is_active, created_at
    `;
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error('players create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/players/bulk  – create multiple players in one request
// Body: { players: [{ first_name, last_name, position, shoots }, ...] }
// ---------------------------------------------------------------------------
router.post('/bulk', async (req, res) => {
  const { players } = req.body;

  if (!Array.isArray(players) || players.length === 0) {
    return res.status(400).json({ error: 'players must be a non-empty array' });
  }

  // Validate every row before touching the DB
  for (let i = 0; i < players.length; i++) {
    const { first_name, last_name, position, shoots } = players[i];
    if (!first_name || typeof first_name !== 'string' || !first_name.trim())
      return res.status(400).json({ error: `Row ${i + 1}: first_name is required` });
    if (!last_name || typeof last_name !== 'string' || !last_name.trim())
      return res.status(400).json({ error: `Row ${i + 1}: last_name is required` });
    if (!position)
      return res.status(400).json({ error: `Row ${i + 1}: position is required` });
    if (!shoots)
      return res.status(400).json({ error: `Row ${i + 1}: shoots is required` });
  }

  try {
    const created = [];
    for (const { first_name, last_name, position, shoots } of players) {
      const rows = await sql`
        INSERT INTO players (first_name, last_name, position, shoots, is_active)
        VALUES (
          ${first_name.trim()}, ${last_name.trim()},
          ${position}, ${shoots}, true
        )
        RETURNING
          id, first_name, last_name, photo,
          date_of_birth::text AS date_of_birth,
          birth_city, birth_country, nationality,
          height_cm, weight_lbs, position, shoots,
          is_active, created_at
      `;
      created.push(rows[0]);
    }
    return res.status(201).json({ created });
  } catch (err) {
    console.error('players bulk create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/players/:id  – update a player
// ---------------------------------------------------------------------------
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    first_name, last_name, position, shoots,
    date_of_birth, birth_city, birth_country, nationality,
    height_cm, weight_lbs, is_active,
  } = req.body;

  const firstNameInBody    = 'first_name'    in req.body;
  const lastNameInBody     = 'last_name'     in req.body;
  const positionInBody     = 'position'      in req.body;
  const shootsInBody       = 'shoots'        in req.body;
  const dobInBody          = 'date_of_birth' in req.body;
  const birthCityInBody    = 'birth_city'    in req.body;
  const birthCountryInBody = 'birth_country' in req.body;
  const nationalityInBody  = 'nationality'   in req.body;
  const heightInBody       = 'height_cm'     in req.body;
  const weightInBody       = 'weight_lbs'    in req.body;
  const isActiveInBody     = 'is_active'     in req.body;

  try {
    const rows = await sql`
      UPDATE players SET
        first_name    = CASE WHEN ${firstNameInBody}    THEN ${first_name?.trim() ?? null}                    ELSE first_name    END,
        last_name     = CASE WHEN ${lastNameInBody}     THEN ${last_name?.trim() ?? null}                     ELSE last_name     END,
        position      = CASE WHEN ${positionInBody}     THEN ${position ?? null}                              ELSE position      END,
        shoots        = CASE WHEN ${shootsInBody}       THEN ${shoots ?? null}                                ELSE shoots        END,
        date_of_birth = CASE WHEN ${dobInBody}          THEN ${date_of_birth ?? null}                         ELSE date_of_birth END,
        birth_city    = CASE WHEN ${birthCityInBody}    THEN ${birth_city?.trim() ?? null}                    ELSE birth_city    END,
        birth_country = CASE WHEN ${birthCountryInBody} THEN ${birth_country?.trim().toUpperCase() ?? null}   ELSE birth_country END,
        nationality   = CASE WHEN ${nationalityInBody}  THEN ${nationality?.trim().toUpperCase() ?? null}     ELSE nationality   END,
        height_cm     = CASE WHEN ${heightInBody}       THEN ${height_cm ?? null}                             ELSE height_cm     END,
        weight_lbs    = CASE WHEN ${weightInBody}       THEN ${weight_lbs ?? null}                            ELSE weight_lbs    END,
        is_active     = CASE WHEN ${isActiveInBody}     THEN ${is_active ?? true}                             ELSE is_active     END
      WHERE id = ${id}
      RETURNING
        id, first_name, last_name, photo,
        date_of_birth::text AS date_of_birth,
        birth_city, birth_country, nationality,
        height_cm, weight_lbs, position, shoots,
        is_active, created_at
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Player not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('players update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/players/:id  – delete a player
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`DELETE FROM players WHERE id = ${id} RETURNING id`;
    if (rows.length === 0) return res.status(404).json({ error: 'Player not found' });
    return res.json({ message: 'Player deleted' });
  } catch (err) {
    console.error('players delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
