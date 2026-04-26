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

// All league routes require the admin role
router.use(requireAdmin);

// ---------------------------------------------------------------------------
// POST /api/admin/leagues/upload  – upload a logo image to Vercel Blob
// ---------------------------------------------------------------------------
router.post('/upload', upload.single('logo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const ext = path.extname(req.file.originalname);
    const filename = `leagues/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
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
// GET /api/admin/leagues  – list all leagues
// ---------------------------------------------------------------------------
router.get('/', async (_req, res) => {
  try {
    const leagues = await sql`
      SELECT id, name, code, logo, primary_color, text_color, best_of_playoff, best_of_shootout
      FROM leagues
      ORDER BY name ASC
    `;
    return res.json(leagues);
  } catch (err) {
    console.error('leagues list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/leagues/:id  – league + associated teams + seasons
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`
      SELECT id, name, code, description, logo, primary_color, text_color, best_of_playoff, best_of_shootout, created_at
      FROM leagues
      WHERE id = ${id}
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'League not found' });

    const [teams, seasons] = await Promise.all([
      sql`
        SELECT
          t.id, t.description, t.location, t.league_id, t.created_at,
          t.primary_color, t.secondary_color, t.text_color,
          ti.name, ti.code, ti.logo
        FROM teams t
        LEFT JOIN LATERAL (
          SELECT name, code, logo FROM team_iterations
          WHERE team_id = t.id
          ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
          LIMIT 1
        ) ti ON true
        WHERE t.league_id = ${id}
        ORDER BY ti.name ASC
      `,
      sql`
        SELECT s.id, s.name, s.league_id,
               s.start_date::text AS start_date, s.end_date::text AS end_date,
               s.created_at,
               (l.current_season_id = s.id) AS is_current
        FROM seasons s
        JOIN leagues l ON l.id = s.league_id
        WHERE s.league_id = ${id}
        ORDER BY (l.current_season_id = s.id) DESC, s.start_date DESC NULLS LAST, s.name ASC
      `,
    ]);

    return res.json({ ...rows[0], teams, seasons });
  } catch (err) {
    console.error('league details error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/leagues  – create a league
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const { name, code, description, logo, primary_color, text_color, best_of_playoff, best_of_shootout } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'name is required' });
  }
  if (!code || typeof code !== 'string' || code.trim() === '') {
    return res.status(400).json({ error: 'code is required' });
  }

  try {
    const rows = await sql`
      INSERT INTO leagues (name, code, description, logo, primary_color, text_color, best_of_playoff, best_of_shootout)
      VALUES (
        ${name.trim()},
        ${code.trim().toUpperCase()},
        ${description ?? null},
        ${logo ?? null},
        ${primary_color ?? '#334155'},
        ${text_color ?? '#ffffff'},
        ${best_of_playoff ?? 7},
        ${best_of_shootout ?? 3}
      )
      RETURNING id, name, code, description, logo, primary_color, text_color, best_of_playoff, best_of_shootout, created_at
    `;
    return res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A league with that code already exists' });
    }
    console.error('leagues create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/leagues/:id  – update a league
// ---------------------------------------------------------------------------
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, code, description, logo, primary_color, text_color, best_of_playoff, best_of_shootout } = req.body;
  const logoInBody = 'logo' in req.body;

  if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
    return res.status(400).json({ error: 'name cannot be empty' });
  }
  if (code !== undefined && (typeof code !== 'string' || code.trim() === '')) {
    return res.status(400).json({ error: 'code cannot be empty' });
  }

  try {
    const rows = await sql`
      UPDATE leagues
      SET
        name          = COALESCE(${name?.trim() ?? null}, name),
        code          = COALESCE(${code ? code.trim().toUpperCase() : null}, code),
        description   = COALESCE(${description ?? null}, description),
        logo          = CASE WHEN ${logoInBody} THEN ${logo ?? null} ELSE logo END,
        primary_color    = COALESCE(${primary_color ?? null}, primary_color),
        text_color       = COALESCE(${text_color ?? null}, text_color),
        best_of_playoff  = COALESCE(${best_of_playoff ?? null}, best_of_playoff),
        best_of_shootout = COALESCE(${best_of_shootout ?? null}, best_of_shootout)
      WHERE id = ${id}
      RETURNING id, name, code, description, logo, primary_color, text_color, best_of_playoff, best_of_shootout, created_at
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'League not found' });
    return res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A league with that code already exists' });
    }
    console.error('leagues update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/leagues/:id  – delete a league
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`
      DELETE FROM leagues WHERE id = ${id} RETURNING id
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'League not found' });
    return res.json({ message: 'League deleted' });
  } catch (err) {
    console.error('leagues delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

