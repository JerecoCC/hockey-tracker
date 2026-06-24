const path = require('path');
const router = require('express').Router();
const multer = require('multer');
const { put } = require('@vercel/blob');
const { requireAdmin } = require('../middleware/auth');
const { sql } = require('../db');
const { normalizeIcoBuffer } = require('../lib/ico');

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
    const isIco = file.mimetype === 'image/x-icon'
      || file.mimetype === 'image/vnd.microsoft.icon'
      || /\.(ico)$/i.test(file.originalname);
    if (file.mimetype.startsWith('image/') || isSvg || isIco) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

const uploadContentType = (file) => {
  if (/\.(ico)$/i.test(file.originalname)) return 'image/x-icon';
  return file.mimetype;
};

const uploadBuffer = (file) => {
  if (/\.(ico)$/i.test(file.originalname)) return normalizeIcoBuffer(file.buffer);
  return file.buffer;
};

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
    const blob = await put(filename, uploadBuffer(req.file), {
      access: 'public',
      contentType: uploadContentType(req.file),
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
      SELECT
        l.id, l.name, l.code, l.logo, l.icon, l.primary_color, l.text_color,
        l.best_of_playoff, l.best_of_shootout, l.scoring_system, l.playoff_format,
        CASE
          WHEN cs.id IS NULL OR cs.is_ended THEN 'postseason'
          WHEN cs.playoffs_started THEN 'playoffs'
          ELSE 'regular'
        END AS season_phase
      FROM leagues l
      LEFT JOIN seasons cs ON cs.id = l.current_season_id
      ORDER BY l.name ASC
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
      SELECT
        l.id, l.name, l.code, l.description, l.logo, l.icon, l.primary_color, l.text_color,
        l.best_of_playoff, l.best_of_shootout, l.scoring_system, l.playoff_format,
        CASE
          WHEN cs.id IS NULL OR cs.is_ended THEN 'postseason'
          WHEN cs.playoffs_started THEN 'playoffs'
          ELSE 'regular'
        END AS season_phase,
        l.created_at
      FROM leagues l
      LEFT JOIN seasons cs ON cs.id = l.current_season_id
      WHERE l.id = ${id}
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'League not found' });

    const [teams, seasons] = await Promise.all([
      sql`
        SELECT
          t.id, t.description, t.location, t.league_id, t.created_at,
          t.primary_color, t.secondary_color, t.text_color,
          ti.name, ti.place_name, ti.team_name, ti.code,
          ti.logo, ti.logo_dark, ti.logo_light, COALESCE(ti.icon, ti_icon.icon) AS icon
        FROM teams t
        LEFT JOIN LATERAL (
          SELECT name, place_name, team_name, code, team_logo_default(logo_dark, logo_light) AS logo, logo_dark, logo_light, icon FROM team_iterations
          WHERE team_id = t.id
          ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
          LIMIT 1
        ) ti ON true
        LEFT JOIN LATERAL (
          SELECT icon FROM team_iterations
          WHERE team_id = t.id AND icon IS NOT NULL
          ORDER BY recorded_at DESC
          LIMIT 1
        ) ti_icon ON true
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
  const { name, code, description, logo, icon, primary_color, text_color, best_of_playoff, best_of_shootout, scoring_system, playoff_format } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'name is required' });
  }
  if (!code || typeof code !== 'string' || code.trim() === '') {
    return res.status(400).json({ error: 'code is required' });
  }

  try {
    const rows = await sql`
      INSERT INTO leagues (name, code, description, logo, icon, primary_color, text_color, best_of_playoff, best_of_shootout, scoring_system, playoff_format)
      VALUES (
        ${name.trim()},
        ${code.trim().toUpperCase()},
        ${description ?? null},
        ${logo ?? null},
        ${icon ?? null},
        ${primary_color ?? '#334155'},
        ${text_color ?? '#ffffff'},
        ${best_of_playoff ?? 7},
        ${best_of_shootout ?? 3},
        ${scoring_system ?? '2-1-0'},
        ${playoff_format ? JSON.stringify(playoff_format) : null}
      )
      RETURNING id, name, code, description, logo, icon, primary_color, text_color, best_of_playoff, best_of_shootout, scoring_system, playoff_format, created_at
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
  const { name, code, description, logo, icon, primary_color, text_color, best_of_playoff, best_of_shootout, scoring_system, playoff_format } = req.body;
  const logoInBody           = 'logo' in req.body;
  const iconInBody           = 'icon' in req.body;
  const playoffFormatInBody  = 'playoff_format' in req.body;

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
        logo          = CASE WHEN ${logoInBody}          THEN ${logo ?? null}                             ELSE logo           END,
        icon          = CASE WHEN ${iconInBody}          THEN ${icon ?? null}                             ELSE icon           END,
        primary_color    = COALESCE(${primary_color ?? null}, primary_color),
        text_color       = COALESCE(${text_color ?? null}, text_color),
        best_of_playoff  = COALESCE(${best_of_playoff ?? null}, best_of_playoff),
        best_of_shootout = COALESCE(${best_of_shootout ?? null}, best_of_shootout),
        scoring_system   = COALESCE(${scoring_system ?? null}, scoring_system),
        playoff_format   = CASE WHEN ${playoffFormatInBody} THEN ${playoff_format ? JSON.stringify(playoff_format) : null}::jsonb ELSE playoff_format END
      WHERE id = ${id}
      RETURNING id, name, code, description, logo, icon, primary_color, text_color, best_of_playoff, best_of_shootout, scoring_system, playoff_format, created_at
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
// ---------------------------------------------------------------------------
// GET /api/admin/leagues/:id/awards - league-wide award definitions
// ---------------------------------------------------------------------------
router.get('/:id/awards', async (req, res) => {
  const { id } = req.params;
  try {
    const awards = await sql`
      SELECT id, league_id, name, description, recipient_type, selection_method,
             stat_key, awarded_after_playoffs, uses_nominees, allow_multiple_winners,
             uses_team_selection, active, sort_order, created_at
      FROM league_awards
      WHERE league_id = ${id} AND active = true
      ORDER BY sort_order ASC, name ASC
    `;
    return res.json(awards);
  } catch (err) {
    console.error('league awards list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/leagues/:id/awards - create a league-wide award definition
// ---------------------------------------------------------------------------
router.post('/:id/awards', async (req, res) => {
  const { id } = req.params;
  const {
    name,
    description,
    recipient_type = 'player',
    selection_method = 'manual',
    stat_key,
    awarded_after_playoffs = true,
    uses_nominees = selection_method === 'voted',
    allow_multiple_winners = false,
    uses_team_selection = false,
    sort_order = 0,
  } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'name is required' });
  }
  if (!['player', 'team'].includes(recipient_type)) {
    return res.status(400).json({ error: 'recipient_type must be player or team' });
  }
  if (!['manual', 'voted', 'automatic', 'playoff'].includes(selection_method)) {
    return res.status(400).json({ error: 'selection_method is invalid' });
  }

  try {
    const rows = await sql`
      INSERT INTO league_awards (
        league_id, name, description, recipient_type, selection_method, stat_key,
        awarded_after_playoffs, uses_nominees, allow_multiple_winners, uses_team_selection,
        sort_order, active
      )
      VALUES (
        ${id},
        ${name.trim()},
        ${description?.trim() || null},
        ${recipient_type},
        ${selection_method},
        ${stat_key || null},
        ${!!awarded_after_playoffs},
        ${!!uses_nominees},
        ${!!allow_multiple_winners},
        ${!!uses_team_selection},
        ${Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0},
        true
      )
      ON CONFLICT (league_id, name) DO UPDATE SET
        description = EXCLUDED.description,
        recipient_type = EXCLUDED.recipient_type,
        selection_method = EXCLUDED.selection_method,
        stat_key = EXCLUDED.stat_key,
        awarded_after_playoffs = EXCLUDED.awarded_after_playoffs,
        uses_nominees = EXCLUDED.uses_nominees,
        allow_multiple_winners = EXCLUDED.allow_multiple_winners,
        uses_team_selection = EXCLUDED.uses_team_selection,
        sort_order = EXCLUDED.sort_order,
        active = true
      RETURNING *
    `;
    return res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23503') return res.status(404).json({ error: 'League not found' });
    console.error('league award create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/leagues/:id/awards/:awardId - update an award definition
// ---------------------------------------------------------------------------
router.patch('/:id/awards/:awardId', async (req, res) => {
  const { id, awardId } = req.params;
  const {
    name,
    description,
    recipient_type,
    selection_method,
    stat_key,
    awarded_after_playoffs,
    uses_nominees,
    allow_multiple_winners,
    uses_team_selection,
    sort_order,
  } = req.body;

  if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
    return res.status(400).json({ error: 'name cannot be empty' });
  }
  if (recipient_type !== undefined && !['player', 'team'].includes(recipient_type)) {
    return res.status(400).json({ error: 'recipient_type must be player or team' });
  }
  if (
    selection_method !== undefined &&
    !['manual', 'voted', 'automatic', 'playoff'].includes(selection_method)
  ) {
    return res.status(400).json({ error: 'selection_method is invalid' });
  }

  const descriptionInBody = 'description' in req.body;
  const statKeyInBody = 'stat_key' in req.body;
  const awardedAfterInBody = 'awarded_after_playoffs' in req.body;
  const usesNomineesInBody = 'uses_nominees' in req.body;
  const allowMultipleWinnersInBody = 'allow_multiple_winners' in req.body;
  const usesTeamSelectionInBody = 'uses_team_selection' in req.body;
  const sortOrderInBody = 'sort_order' in req.body;

  try {
    const rows = await sql`
      UPDATE league_awards
      SET
        name = COALESCE(${name?.trim() ?? null}, name),
        description = CASE WHEN ${descriptionInBody} THEN ${description?.trim() || null} ELSE description END,
        recipient_type = COALESCE(${recipient_type ?? null}, recipient_type),
        selection_method = COALESCE(${selection_method ?? null}, selection_method),
        stat_key = CASE WHEN ${statKeyInBody} THEN ${stat_key || null} ELSE stat_key END,
        awarded_after_playoffs = CASE WHEN ${awardedAfterInBody} THEN ${!!awarded_after_playoffs} ELSE awarded_after_playoffs END,
        uses_nominees = CASE WHEN ${usesNomineesInBody} THEN ${!!uses_nominees} ELSE uses_nominees END,
        allow_multiple_winners = CASE WHEN ${allowMultipleWinnersInBody} THEN ${!!allow_multiple_winners} ELSE allow_multiple_winners END,
        uses_team_selection = CASE WHEN ${usesTeamSelectionInBody} THEN ${!!uses_team_selection} ELSE uses_team_selection END,
        sort_order = CASE WHEN ${sortOrderInBody} THEN ${Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0} ELSE sort_order END,
        active = true
      WHERE id = ${awardId} AND league_id = ${id}
      RETURNING *
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Award not found' });
    return res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An award with that name already exists' });
    }
    console.error('league award update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/leagues/:id/awards/:awardId - deactivate a definition
// ---------------------------------------------------------------------------
router.delete('/:id/awards/:awardId', async (req, res) => {
  const { id, awardId } = req.params;
  try {
    const rows = await sql`
      UPDATE league_awards
      SET active = false
      WHERE id = ${awardId} AND league_id = ${id}
      RETURNING id
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Award not found' });
    return res.json({ message: 'Award removed' });
  } catch (err) {
    console.error('league award delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

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

