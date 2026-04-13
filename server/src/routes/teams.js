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
// ---------------------------------------------------------------------------
router.get('/', async (_req, res) => {
  try {
    const teams = await sql`
      SELECT id, name, code, description, location, city, home_arena, logo, league_id, primary_color, secondary_color, text_color, created_at
      FROM teams
      ORDER BY name ASC
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
      SELECT t.id, t.name, t.code, t.description, t.location, t.city, t.home_arena, t.logo, t.league_id, t.primary_color, t.secondary_color, t.text_color, t.created_at,
             l.name AS league_name, l.code AS league_code, l.logo AS league_logo,
             l.primary_color AS league_primary_color, l.text_color AS league_text_color
      FROM teams t
      LEFT JOIN leagues l ON l.id = t.league_id
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
// POST /api/admin/teams  – create a team
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
    const rows = await sql`
      INSERT INTO teams (name, code, description, location, city, home_arena, logo, league_id, primary_color, secondary_color, text_color)
      VALUES (
        ${name.trim()},
        ${code.trim().toUpperCase()},
        ${description ?? null},
        ${location ?? null},
        ${city ?? null},
        ${home_arena ?? null},
        ${logo ?? null},
        ${league_id ?? null},
        ${primary_color ?? '#334155'},
        ${secondary_color ?? '#1e293b'},
        ${text_color ?? '#ffffff'}
      )
      RETURNING id, name, code, description, location, city, home_arena, logo, league_id, primary_color, secondary_color, text_color, created_at
    `;
    return res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      const msg = err.detail?.includes('(code)')
        ? 'A team with that code already exists in this league'
        : 'A unique constraint was violated';
      return res.status(409).json({ error: msg });
    }
    if (err.code === '23503') {
      return res.status(400).json({ error: 'The specified league does not exist' });
    }
    console.error('teams create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/teams/:id  – update a team
// ---------------------------------------------------------------------------
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, code, description, location, city, home_arena, logo, league_id, primary_color, secondary_color, text_color } = req.body;
  const logoInBody             = 'logo'             in req.body;
  const primaryColorInBody     = 'primary_color'    in req.body;
  const secondaryColorInBody   = 'secondary_color'  in req.body;
  const textColorInBody        = 'text_color'       in req.body;

  if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
    return res.status(400).json({ error: 'name cannot be empty' });
  }
  if (code !== undefined && (typeof code !== 'string' || code.trim() === '')) {
    return res.status(400).json({ error: 'code cannot be empty' });
  }

  try {
    const rows = await sql`
      UPDATE teams
      SET
        name          = COALESCE(${name?.trim() ?? null}, name),
        code          = COALESCE(${code ? code.trim().toUpperCase() : null}, code),
        description   = COALESCE(${description ?? null}, description),
        location      = COALESCE(${location ?? null}, location),
        city          = COALESCE(${city ?? null}, city),
        home_arena    = COALESCE(${home_arena ?? null}, home_arena),
        logo            = CASE WHEN ${logoInBody}           THEN ${logo ?? null}                      ELSE logo            END,
        league_id       = COALESCE(${league_id ?? null}, league_id),
        primary_color   = CASE WHEN ${primaryColorInBody}   THEN ${primary_color   || '#334155'}      ELSE primary_color   END,
        secondary_color = CASE WHEN ${secondaryColorInBody} THEN ${secondary_color || '#1e293b'}      ELSE secondary_color END,
        text_color      = CASE WHEN ${textColorInBody}      THEN ${text_color      || '#ffffff'}      ELSE text_color      END
      WHERE id = ${id}
      RETURNING id, name, code, description, location, city, home_arena, logo, league_id, primary_color, secondary_color, text_color, created_at
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Team not found' });
    return res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      const msg = err.detail?.includes('(code)')
        ? 'A team with that code already exists in this league'
        : 'A unique constraint was violated';
      return res.status(409).json({ error: msg });
    }
    if (err.code === '23503') {
      return res.status(400).json({ error: 'The specified league does not exist' });
    }
    console.error('teams update error:', err);
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

