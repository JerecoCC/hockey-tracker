const path = require('path');
const router = require('express').Router();
const multer = require('multer');
const { put } = require('@vercel/blob');
const { requireAdmin } = require('../middleware/auth');
const { sql } = require('../db');

// ---------------------------------------------------------------------------
// Multer – memory storage only (buffer passed to Vercel Blob)
// ---------------------------------------------------------------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    const isSvg = file.mimetype === 'image/svg+xml'
      || /\.(svg)$/i.test(file.originalname)
      || file.mimetype === 'text/xml'
      || file.mimetype === 'application/xml';
    if (file.mimetype.startsWith('image/') || isSvg) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// All team routes require the admin role
router.use(requireAdmin);

// ---------------------------------------------------------------------------
// POST /api/admin/teams/upload  – upload a logo image to Vercel Blob
// ---------------------------------------------------------------------------
router.post('/upload', upload.single('logo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const ext = path.extname(req.file.originalname);
    const filename = `teams/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const blob = await put(filename, req.file.buffer, {
      access: 'public',
      contentType: req.file.mimetype,
    });
    return res.json({ url: blob.url });
  } catch (err) {
    console.error('blob upload error:', err);
    return res.status(500).json({ error: 'Failed to upload image' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/teams  – list all teams
// name/code/logo resolved from the latest base iteration (season_id IS NULL first).
// ---------------------------------------------------------------------------
router.get('/', async (_req, res) => {
  try {
    const teams = await sql`
      SELECT
        t.id, t.description, t.location, t.city, t.home_arena,
        t.league_id, t.primary_color, t.secondary_color, t.text_color, t.created_at,
        ti.name, ti.code, ti.logo
      FROM teams t
      LEFT JOIN LATERAL (
        SELECT name, code, logo FROM team_iterations
        WHERE team_id = t.id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) ti ON true
      ORDER BY ti.name ASC
    `;
    return res.json(teams);
  } catch (err) {
    console.error('teams list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/teams/:id  – get a single team (with league info)
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`
      SELECT
        t.id, t.description, t.location, t.city, t.home_arena,
        t.league_id, t.primary_color, t.secondary_color, t.text_color, t.created_at,
        ti.name, ti.code, ti.logo,
        l.name AS league_name, l.code AS league_code, l.logo AS league_logo,
        l.primary_color AS league_primary_color, l.text_color AS league_text_color,
        t.start_season_id,
        t.latest_season_id,
        ss.start_date::text AS start_season_start_date,
        ls.end_date::text   AS latest_season_end_date
      FROM teams t
      LEFT JOIN LATERAL (
        SELECT name, code, logo FROM team_iterations
        WHERE team_id = t.id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) ti ON true
      LEFT JOIN leagues l ON l.id = t.league_id
      LEFT JOIN seasons ss ON ss.id = t.start_season_id
      LEFT JOIN seasons ls ON ls.id = t.latest_season_id
      WHERE t.id = ${id}
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Team not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('teams get error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/teams  – create a team + auto-create its base iteration
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const { name, code, description, location, city, home_arena, logo, league_id, primary_color, secondary_color, text_color } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'name is required' });
  }
  if (!code || typeof code !== 'string' || code.trim() === '') {
    return res.status(400).json({ error: 'code is required' });
  }
  try {
    // Insert the team record (no name/code/logo — those live in iterations)
    const teamRows = await sql`
      INSERT INTO teams (description, location, city, home_arena, league_id, primary_color, secondary_color, text_color)
      VALUES (
        ${description ?? null},
        ${location ?? null},
        ${city ?? null},
        ${home_arena ?? null},
        ${league_id ?? null},
        ${primary_color ?? '#334155'},
        ${secondary_color ?? '#1e293b'},
        ${text_color ?? '#ffffff'}
      )
      RETURNING id
    `;
    const teamId = teamRows[0].id;

    // Auto-create the base iteration (season_id = NULL = current identity)
    await sql`
      INSERT INTO team_iterations (team_id, season_id, name, code, logo)
      VALUES (${teamId}, NULL, ${name.trim()}, ${code.trim().toUpperCase()}, ${logo ?? null})
    `;

    // Return the full team with resolved identity
    const full = await sql`
      SELECT
        t.id, t.description, t.location, t.city, t.home_arena,
        t.league_id, t.primary_color, t.secondary_color, t.text_color, t.created_at,
        ti.name, ti.code, ti.logo
      FROM teams t
      LEFT JOIN LATERAL (
        SELECT name, code, logo FROM team_iterations
        WHERE team_id = t.id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) ti ON true
      WHERE t.id = ${teamId}
    `;
    return res.status(201).json(full[0]);
  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json({ error: 'The specified league does not exist' });
    }
    console.error('teams create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/teams/:id  – update a team
// name/code/logo  → update (or create) the base iteration (season_id IS NULL)
// everything else → update the teams row directly
// ---------------------------------------------------------------------------
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, code, description, location, city, home_arena, logo, league_id, primary_color, secondary_color, text_color, start_season_id, latest_season_id } = req.body;
  const logoInBody            = 'logo'             in req.body;
  const primaryColorInBody    = 'primary_color'    in req.body;
  const secondaryColorInBody  = 'secondary_color'  in req.body;
  const textColorInBody       = 'text_color'       in req.body;
  const startSeasonInBody     = 'start_season_id'  in req.body;
  const latestSeasonInBody    = 'latest_season_id' in req.body;

  if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
    return res.status(400).json({ error: 'name cannot be empty' });
  }
  if (code !== undefined && (typeof code !== 'string' || code.trim() === '')) {
    return res.status(400).json({ error: 'code cannot be empty' });
  }

  try {
    // Verify team exists
    const exists = await sql`SELECT id FROM teams WHERE id = ${id}`;
    if (exists.length === 0) return res.status(404).json({ error: 'Team not found' });

    // ── Identity fields → base iteration (season_id IS NULL) ───────────────
    const hasIdentity = name !== undefined || code !== undefined || logoInBody;
    if (hasIdentity) {
      const baseIter = await sql`
        SELECT id FROM team_iterations
        WHERE team_id = ${id} AND season_id IS NULL
        ORDER BY recorded_at DESC
        LIMIT 1
      `;
      if (baseIter.length > 0) {
        await sql`
          UPDATE team_iterations SET
            name = COALESCE(${name?.trim() ?? null}, name),
            code = COALESCE(${code ? code.trim().toUpperCase() : null}, code),
            logo = CASE WHEN ${logoInBody} THEN ${logo ?? null} ELSE logo END
          WHERE id = ${baseIter[0].id}
        `;
      } else {
        await sql`
          INSERT INTO team_iterations (team_id, season_id, name, code, logo)
          VALUES (
            ${id}, NULL,
            ${name?.trim() ?? ''},
            ${code ? code.trim().toUpperCase() : ''},
            ${logoInBody ? (logo ?? null) : null}
          )
        `;
      }
    }

    // ── Non-identity fields → teams table ──────────────────────────────────
    await sql`
      UPDATE teams SET
        description      = COALESCE(${description  ?? null}, description),
        location         = COALESCE(${location     ?? null}, location),
        city             = COALESCE(${city         ?? null}, city),
        home_arena       = COALESCE(${home_arena   ?? null}, home_arena),
        league_id        = COALESCE(${league_id    ?? null}, league_id),
        primary_color    = CASE WHEN ${primaryColorInBody}   THEN ${primary_color   || '#334155'} ELSE primary_color   END,
        secondary_color  = CASE WHEN ${secondaryColorInBody} THEN ${secondary_color || '#1e293b'} ELSE secondary_color END,
        text_color       = CASE WHEN ${textColorInBody}      THEN ${text_color      || '#ffffff'}  ELSE text_color      END,
        start_season_id  = CASE WHEN ${startSeasonInBody}    THEN ${start_season_id  ?? null}      ELSE start_season_id  END,
        latest_season_id = CASE WHEN ${latestSeasonInBody}   THEN ${latest_season_id ?? null}      ELSE latest_season_id END
      WHERE id = ${id}
    `;

    // Return full team with resolved identity
    const full = await sql`
      SELECT
        t.id, t.description, t.location, t.city, t.home_arena,
        t.league_id, t.primary_color, t.secondary_color, t.text_color, t.created_at,
        ti.name, ti.code, ti.logo
      FROM teams t
      LEFT JOIN LATERAL (
        SELECT name, code, logo FROM team_iterations
        WHERE team_id = t.id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) ti ON true
      WHERE t.id = ${id}
    `;
    return res.json(full[0]);
  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json({ error: 'The specified league does not exist' });
    }
    console.error('teams update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/teams/:id/iterations  – list recorded identity snapshots
// ---------------------------------------------------------------------------
router.get('/:id/iterations', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`
      SELECT
        ti.id, ti.team_id, ti.name, ti.code, ti.logo, ti.note, ti.recorded_at,
        ti.start_season_id, ss.name AS start_season_name,
        ti.latest_season_id, ls.name AS latest_season_name
      FROM team_iterations ti
      LEFT JOIN seasons ss ON ss.id = ti.start_season_id
      LEFT JOIN seasons ls ON ls.id = ti.latest_season_id
      WHERE ti.team_id = ${id}
      ORDER BY ss.start_date DESC NULLS LAST, ti.recorded_at DESC
    `;
    return res.json(rows);
  } catch (err) {
    console.error('team iterations list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/teams/:id/iterations  – record a new identity snapshot
// Body: { name, code?, logo?, season_id?, note? }
// ---------------------------------------------------------------------------
router.post('/:id/iterations', async (req, res) => {
  const { id } = req.params;
  const { name, code, logo, note, start_season_id, latest_season_id } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    const teamRows = await sql`SELECT id FROM teams WHERE id = ${id}`;
    if (teamRows.length === 0) return res.status(404).json({ error: 'Team not found' });

    const rows = await sql`
      INSERT INTO team_iterations (team_id, name, code, logo, note, start_season_id, latest_season_id)
      VALUES (
        ${id},
        ${name.trim()},
        ${code ? code.trim().toUpperCase() : null},
        ${logo ?? null},
        ${note?.trim() ?? null},
        ${start_season_id ?? null},
        ${latest_season_id ?? null}
      )
      RETURNING id
    `;

    const full = await sql`
      SELECT
        ti.id, ti.team_id, ti.name, ti.code, ti.logo, ti.note, ti.recorded_at,
        ti.start_season_id, ss.name AS start_season_name,
        ti.latest_season_id, ls.name AS latest_season_name
      FROM team_iterations ti
      LEFT JOIN seasons ss ON ss.id = ti.start_season_id
      LEFT JOIN seasons ls ON ls.id = ti.latest_season_id
      WHERE ti.id = ${rows[0].id}
    `;
    return res.status(201).json(full[0]);
  } catch (err) {
    console.error('team iterations create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/teams/:id/iterations/:iterationId  – update a snapshot
// Body: { name?, code?, logo?, season_id?, note? }
// ---------------------------------------------------------------------------
router.patch('/:id/iterations/:iterationId', async (req, res) => {
  const { id, iterationId } = req.params;
  const { name, code, logo, note, start_season_id, latest_season_id } = req.body;
  const logoInBody           = 'logo'             in req.body;
  const noteInBody           = 'note'             in req.body;
  const startSeasonInBody    = 'start_season_id'  in req.body;
  const latestSeasonInBody = 'latest_season_id' in req.body;

  if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
    return res.status(400).json({ error: 'name cannot be empty' });
  }

  try {
    const rows = await sql`
      UPDATE team_iterations SET
        name             = COALESCE(${name?.trim() ?? null}, name),
        code             = COALESCE(${code ? code.trim().toUpperCase() : null}, code),
        logo             = CASE WHEN ${logoInBody}          THEN ${logo ?? null}             ELSE logo             END,
        note             = CASE WHEN ${noteInBody}          THEN ${note?.trim() ?? null}     ELSE note             END,
        start_season_id  = CASE WHEN ${startSeasonInBody}  THEN ${start_season_id ?? null}  ELSE start_season_id  END,
        latest_season_id = CASE WHEN ${latestSeasonInBody} THEN ${latest_season_id ?? null} ELSE latest_season_id END
      WHERE id = ${iterationId} AND team_id = ${id}
      RETURNING id
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Iteration not found' });

    const full = await sql`
      SELECT
        ti.id, ti.team_id, ti.name, ti.code, ti.logo, ti.note, ti.recorded_at,
        ti.start_season_id, ss.name AS start_season_name,
        ti.latest_season_id, ls.name AS latest_season_name
      FROM team_iterations ti
      LEFT JOIN seasons ss ON ss.id = ti.start_season_id
      LEFT JOIN seasons ls ON ls.id = ti.latest_season_id
      WHERE ti.id = ${iterationId}
    `;
    return res.json(full[0]);
  } catch (err) {
    console.error('team iterations update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/teams/:id/iterations/:iterationId  – remove a snapshot
// ---------------------------------------------------------------------------
router.delete('/:id/iterations/:iterationId', async (req, res) => {
  const { id, iterationId } = req.params;
  try {
    const rows = await sql`
      DELETE FROM team_iterations
      WHERE id = ${iterationId} AND team_id = ${id}
      RETURNING id
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Iteration not found' });
    return res.json({ message: 'Iteration deleted' });
  } catch (err) {
    console.error('team iterations delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/teams/:id  – delete a team
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`
      DELETE FROM teams WHERE id = ${id} RETURNING id
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Team not found' });
    return res.json({ message: 'Team deleted' });
  } catch (err) {
    console.error('teams delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

