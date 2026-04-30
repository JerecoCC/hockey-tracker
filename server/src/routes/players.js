const path = require('path');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { put } = require('@vercel/blob');
const { sql } = require('../db');
const { requireAdmin } = require('../middleware/auth');

// ---------------------------------------------------------------------------
// Multer – memory storage for player photo uploads
// ---------------------------------------------------------------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

router.use(requireAdmin);

// ---------------------------------------------------------------------------
// POST /api/admin/players/upload  – upload a player photo to Vercel Blob
// ---------------------------------------------------------------------------
router.post('/upload', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const ext = path.extname(req.file.originalname);
    const filename = `players/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const blob = await put(filename, req.file.buffer, {
      access: 'public',
      contentType: req.file.mimetype,
    });
    return res.json({ url: blob.url });
  } catch (err) {
    console.error('player photo upload error:', err);
    return res.status(500).json({ error: 'Failed to upload image' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/players  – list all players
// Supports optional ?league_id= or ?team_id= to scope results.
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const { league_id, team_id, season_id } = req.query;
  try {
    const players = league_id && season_id
      ? await sql`
          SELECT
            id, first_name, last_name, photo,
            date_of_birth::text AS date_of_birth,
            birth_city, birth_country, nationality,
            height_cm, weight_lbs, position, shoots,
            is_active, created_at,
            jersey_number, team_name, team_code, team_logo, primary_color, text_color
          FROM (
            SELECT DISTINCT ON (p.id)
              p.id, p.first_name, p.last_name,
              COALESCE(pt.photo, p.photo) AS photo,
              p.date_of_birth,
              p.birth_city, p.birth_country, p.nationality,
              p.height_cm, p.weight_lbs, p.position, p.shoots,
              p.is_active, p.created_at,
              pt.jersey_number,
              ti.name       AS team_name,
              ti.code       AS team_code,
              ti.logo       AS team_logo,
              t.primary_color,
              t.text_color
            FROM players p
            JOIN player_teams pt ON pt.player_id = p.id
                                AND pt.season_id  = ${season_id}
            JOIN teams        t  ON t.id          = pt.team_id
                                AND t.league_id   = ${league_id}
            LEFT JOIN LATERAL (
              SELECT name, code, logo FROM team_iterations
              WHERE team_id = t.id
                AND (season_id = ${season_id} OR season_id IS NULL)
              ORDER BY CASE WHEN season_id = ${season_id} THEN 0 ELSE 1 END, recorded_at DESC
              LIMIT 1
            ) ti ON TRUE
            ORDER BY p.id
          ) sub
          ORDER BY last_name, first_name
        `
      : league_id
      ? await sql`
          SELECT
            id, first_name, last_name, photo,
            date_of_birth::text AS date_of_birth,
            birth_city, birth_country, nationality,
            height_cm, weight_lbs, position, shoots,
            is_active, created_at,
            jersey_number, team_name, team_code, team_logo, primary_color, text_color
          FROM (
            SELECT DISTINCT ON (p.id)
              p.id, p.first_name, p.last_name,
              COALESCE(pt.photo, p.photo) AS photo,
              p.date_of_birth,
              p.birth_city, p.birth_country, p.nationality,
              p.height_cm, p.weight_lbs, p.position, p.shoots,
              p.is_active, p.created_at,
              pt.jersey_number,
              ti.name       AS team_name,
              ti.code       AS team_code,
              ti.logo       AS team_logo,
              t.primary_color,
              t.text_color
            FROM players p
            JOIN player_teams pt ON pt.player_id = p.id
            JOIN teams        t  ON t.id          = pt.team_id
                                AND t.league_id   = ${league_id}
            LEFT JOIN LATERAL (
              SELECT name, code, logo FROM team_iterations
              WHERE team_id = t.id
              ORDER BY season_id DESC NULLS LAST
              LIMIT 1
            ) ti ON TRUE
            ORDER BY p.id, pt.season_id DESC
          ) sub
          ORDER BY last_name, first_name
        `
      : team_id && season_id
      ? await sql`
          SELECT
            id, first_name, last_name, photo,
            date_of_birth::text AS date_of_birth,
            birth_city, birth_country, nationality,
            height_cm, weight_lbs, position, shoots,
            is_active, created_at,
            jersey_number, team_name, primary_color, text_color
          FROM (
            SELECT DISTINCT ON (p.id)
              p.id, p.first_name, p.last_name,
              COALESCE(pt.photo, p.photo) AS photo,
              p.date_of_birth,
              p.birth_city, p.birth_country, p.nationality,
              p.height_cm, p.weight_lbs, p.position, p.shoots,
              p.is_active, p.created_at,
              pt.jersey_number,
              ti.name       AS team_name,
              t.primary_color,
              t.text_color
            FROM players p
            JOIN player_teams pt ON pt.player_id  = p.id
                                AND pt.team_id    = ${team_id}
                                AND pt.season_id  = ${season_id}
                                AND (pt.start_date IS NULL OR pt.start_date <= CURRENT_DATE)
                                AND (pt.end_date   IS NULL OR pt.end_date   >= CURRENT_DATE)
            JOIN teams        t  ON t.id           = pt.team_id
            LEFT JOIN LATERAL (
              SELECT name FROM team_iterations
              WHERE team_id = t.id
              ORDER BY season_id DESC NULLS LAST
              LIMIT 1
            ) ti ON TRUE
            ORDER BY p.id
          ) sub
          ORDER BY last_name, first_name
        `
      : team_id
      ? await sql`
          SELECT
            id, first_name, last_name, photo,
            date_of_birth::text AS date_of_birth,
            birth_city, birth_country, nationality,
            height_cm, weight_lbs, position, shoots,
            is_active, created_at,
            jersey_number, team_name, primary_color, text_color
          FROM (
            SELECT DISTINCT ON (p.id)
              p.id, p.first_name, p.last_name, p.photo,
              p.date_of_birth,
              p.birth_city, p.birth_country, p.nationality,
              p.height_cm, p.weight_lbs, p.position, p.shoots,
              p.is_active, p.created_at,
              pt.jersey_number,
              ti.name       AS team_name,
              t.primary_color,
              t.text_color
            FROM players p
            JOIN player_teams pt ON pt.player_id = p.id
                                AND pt.team_id   = ${team_id}
            JOIN teams        t  ON t.id          = pt.team_id
            LEFT JOIN LATERAL (
              SELECT name FROM team_iterations
              WHERE team_id = t.id
              ORDER BY season_id DESC NULLS LAST
              LIMIT 1
            ) ti ON TRUE
            ORDER BY p.id, pt.season_id DESC
          ) sub
          ORDER BY last_name, first_name
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
// GET /api/admin/players/:id/stats  – career stats for one player
// Returns one row per season (aggregated across any mid-season trades).
// Columns: season_id, season_name, jersey_number, gp, goals, assists, points,
//          team_id, team_name, team_logo, primary_color, text_color
// ---------------------------------------------------------------------------
router.get('/:id/stats', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`
      WITH player_seasons AS (
        SELECT DISTINCT season_id FROM player_teams WHERE player_id = ${id}
      ),
      gp_counts AS (
        SELECT ga.season_id, COUNT(DISTINCT gr.game_id) AS gp
        FROM game_rosters gr
        JOIN games ga ON ga.id = gr.game_id
        WHERE gr.player_id = ${id}
        GROUP BY ga.season_id
      ),
      goal_counts AS (
        SELECT ga.season_id, COUNT(*) AS goals
        FROM goals gl
        JOIN games ga ON ga.id = gl.game_id
        WHERE gl.scorer_id = ${id}
        GROUP BY ga.season_id
      ),
      assist_counts AS (
        SELECT ga.season_id, COUNT(*) AS assists
        FROM goals gl
        JOIN games ga ON ga.id = gl.game_id
        WHERE gl.assist_1_id = ${id} OR gl.assist_2_id = ${id}
        GROUP BY ga.season_id
      ),
      latest_team AS (
        SELECT DISTINCT ON (pt.season_id)
          pt.season_id, pt.team_id, pt.jersey_number
        FROM player_teams pt
        WHERE pt.player_id = ${id}
        ORDER BY pt.season_id, pt.end_date DESC NULLS FIRST, pt.created_at DESC
      )
      SELECT
        s.id         AS season_id,
        s.name       AS season_name,
        lt.jersey_number,
        COALESCE(gc.gp, 0)      AS gp,
        COALESCE(gl.goals, 0)   AS goals,
        COALESCE(ac.assists, 0) AS assists,
        COALESCE(gl.goals, 0) + COALESCE(ac.assists, 0) AS points,
        lt.team_id,
        ti.name  AS team_name,
        ti.logo  AS team_logo,
        t.primary_color,
        t.text_color
      FROM player_seasons ps
      JOIN seasons s ON s.id = ps.season_id
      LEFT JOIN latest_team lt ON lt.season_id = ps.season_id
      LEFT JOIN gp_counts gc ON gc.season_id = ps.season_id
      LEFT JOIN goal_counts gl ON gl.season_id = ps.season_id
      LEFT JOIN assist_counts ac ON ac.season_id = ps.season_id
      LEFT JOIN teams t ON t.id = lt.team_id
      LEFT JOIN LATERAL (
        SELECT name, logo FROM team_iterations
        WHERE team_id = lt.team_id
        ORDER BY CASE WHEN season_id = ps.season_id THEN 0 ELSE 1 END,
                 recorded_at DESC
        LIMIT 1
      ) ti ON lt.team_id IS NOT NULL
      ORDER BY s.created_at DESC
    `;
    return res.json(rows);
  } catch (err) {
    console.error('players stats error:', err);
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
  }

  try {
    const created = [];
    for (const { first_name, last_name, position, shoots } of players) {
      const rows = await sql`
        INSERT INTO players (first_name, last_name, position, shoots, is_active)
        VALUES (
          ${first_name.trim()}, ${last_name.trim()},
          ${position}, ${shoots ?? null}, true
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
