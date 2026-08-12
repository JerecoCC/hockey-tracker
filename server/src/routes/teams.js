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

const cleanText = (value) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
};

const splitDisplayName = (name) => {
  const cleanName = cleanText(name);
  if (!cleanName) return { placeName: null, teamName: null };
  const firstSpace = cleanName.indexOf(' ');
  if (firstSpace === -1) return { placeName: null, teamName: cleanName };
  return {
    placeName: cleanName.slice(0, firstSpace).trim() || null,
    teamName: cleanName.slice(firstSpace + 1).trim() || null,
  };
};

const resolveTeamIdentity = (body) => {
  const placeNameInBody = 'place_name' in body;
  const teamNameInBody = 'team_name' in body;
  const nameInBody = 'name' in body;
  const placeName = placeNameInBody ? cleanText(body.place_name) : undefined;
  const teamName = teamNameInBody ? cleanText(body.team_name) : undefined;

  if (placeNameInBody || teamNameInBody) {
    const displayName = [placeName, teamName].filter(Boolean).join(' ').trim();
    return { name: displayName || null, placeName, teamName, hasName: true, hasSplitName: true };
  }

  if (nameInBody) {
    const name = cleanText(body.name);
    const splitName = splitDisplayName(name);
    return {
      name,
      placeName: splitName.placeName,
      teamName: splitName.teamName,
      hasName: true,
      hasSplitName: false,
    };
  }

  return { name: undefined, placeName: undefined, teamName: undefined, hasName: false, hasSplitName: false };
};

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
// GET /api/admin/teams  – list all teams
// name/code/logo resolved from the latest base iteration (season_id IS NULL first).
// ---------------------------------------------------------------------------
router.get('/', async (_req, res) => {
  try {
    const teams = await sql`
      SELECT
        t.id, t.description, t.location, t.city, t.home_arena,
        t.league_id, t.primary_color, t.secondary_color, t.text_color, t.created_at,
        ti.name, ti.place_name, ti.team_name, ti.code,
        team_logo_default(ti.logo_dark, ti.logo_light) AS logo,
        ti.logo_dark,
        ti.logo_light,
        COALESCE(ti.icon, ti_icon.icon) AS icon
      FROM teams t
      LEFT JOIN LATERAL (
        SELECT
          name, place_name, team_name, code,
          team_logo_default(logo_dark, logo_light) AS logo,
          logo_dark, logo_light, icon
        FROM team_iterations
        WHERE team_id = t.id
        ORDER BY CASE WHEN end_date IS NULL THEN 0 ELSE 1 END, start_date DESC NULLS LAST, recorded_at DESC
        LIMIT 1
      ) ti ON true
      LEFT JOIN LATERAL (
        SELECT icon FROM team_iterations
        WHERE team_id = t.id AND icon IS NOT NULL
        ORDER BY recorded_at DESC
        LIMIT 1
      ) ti_icon ON true
      ORDER BY ti.name ASC
    `;
    return res.json(teams);
  } catch (err) {
    console.error('teams list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Seasons in which this team participated, newest first.
router.get('/:id/seasons', async (req, res) => {
  const { id } = req.params;
  try {
    const seasons = await sql`
      SELECT
        s.id, s.name, s.league_id,
        s.start_date::text AS start_date,
        s.started_at::text AS started_at,
        s.end_date::text AS end_date,
        (s.id = l.current_season_id) AS is_current,
        s.is_ended,
        s.playoffs_started,
        s.created_at
      FROM season_participant_teams participant
      JOIN seasons s ON s.id = participant.season_id
      JOIN leagues l ON l.id = s.league_id
      WHERE participant.team_id = ${id}
      ORDER BY s.start_date DESC NULLS LAST, s.created_at DESC, s.name DESC
    `;
    return res.json(seasons);
  } catch (err) {
    console.error('team seasons error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// A season projection is an editable template, not historical participation.
router.get('/:id/seasons/:seasonId/projected-lineup', async (req, res) => {
  const { id, seasonId } = req.params;
  try {
    const rows = await sql`
      SELECT
        slot.id, slot.season_id, slot.team_id, slot.player_id,
        slot.slot_key, slot.sort_order,
        p.first_name, p.last_name,
        COALESCE(roster.position, p.position) AS position,
        roster.jersey_number,
        COALESCE(best_player_photo(p.id, slot.season_id, slot.team_id), p.photo) AS photo
      FROM season_projected_lineup_slots slot
      JOIN players p ON p.id = slot.player_id
      LEFT JOIN player_season_rosters roster
        ON roster.player_id = slot.player_id
       AND roster.team_id = slot.team_id
       AND roster.season_id = slot.season_id
      WHERE slot.team_id = ${id}
        AND slot.season_id = ${seasonId}
      ORDER BY slot.sort_order, slot.slot_key
    `;
    return res.json(rows);
  } catch (err) {
    console.error('projected lineup get error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Moves the selected season's active roster to reserves. A projection locks
// the roster because projected players are promoted automatically when saved.
router.post('/:id/seasons/:seasonId/reset-roster', async (req, res) => {
  const { id, seasonId } = req.params;

  try {
    const transactionResults = await sql.transaction(
      (txn) => [
        txn`
          SELECT
            EXISTS(SELECT 1 FROM teams WHERE id = ${id}) AS team_exists,
            EXISTS(SELECT 1 FROM seasons WHERE id = ${seasonId}) AS season_exists,
            EXISTS(
              SELECT 1 FROM season_participant_teams
              WHERE team_id = ${id} AND season_id = ${seasonId}
            ) AS team_in_season,
            EXISTS(
              SELECT 1 FROM season_projected_lineup_slots
              WHERE team_id = ${id} AND season_id = ${seasonId}
            ) AS has_projected_lineup
        `,
        txn`
          UPDATE player_team_stints stint
          SET is_prospect = TRUE
          FROM seasons season
          WHERE stint.team_id = ${id}
            AND season.id = ${seasonId}
            AND stint.is_prospect = FALSE
            AND EXISTS (
              SELECT 1 FROM season_participant_teams
              WHERE team_id = ${id} AND season_id = ${seasonId}
            )
            AND COALESCE(stint.start_date, DATE '-infinity') <= COALESCE(season.end_date, DATE 'infinity')
            AND COALESCE(stint.end_date, DATE 'infinity') >= season.start_date
            AND EXISTS (
              SELECT 1
              FROM player_season_rosters roster
              WHERE roster.player_id = stint.player_id
                AND roster.team_id = ${id}
                AND roster.season_id = ${seasonId}
                AND roster.is_prospect = FALSE
            )
            AND NOT EXISTS (
              SELECT 1 FROM season_projected_lineup_slots
              WHERE team_id = ${id} AND season_id = ${seasonId}
            )
          RETURNING stint.player_id
        `,
        txn`
          UPDATE player_teams legacy
          SET is_prospect = TRUE
          WHERE legacy.team_id = ${id}
            AND legacy.season_id = ${seasonId}
            AND legacy.is_prospect = FALSE
            AND EXISTS (
              SELECT 1 FROM season_participant_teams
              WHERE team_id = ${id} AND season_id = ${seasonId}
            )
            AND NOT EXISTS (
              SELECT 1 FROM season_projected_lineup_slots
              WHERE team_id = ${id} AND season_id = ${seasonId}
            )
          RETURNING legacy.player_id
        `,
      ],
      { isolationLevel: 'Serializable' },
    );

    const [scope] = transactionResults[0] ?? [];
    if (!scope?.team_exists || !scope?.season_exists) {
      return res.status(404).json({ error: 'Team or season not found' });
    }
    if (!scope.team_in_season) {
      return res.status(409).json({ error: 'Team does not participate in this season' });
    }
    if (scope.has_projected_lineup) {
      return res.status(409).json({ error: 'Roster cannot be reset after a projected lineup is set' });
    }

    const resetPlayerIds = new Set([
      ...(transactionResults[1] ?? []).map((row) => row.player_id),
      ...(transactionResults[2] ?? []).map((row) => row.player_id),
    ]);
    return res.json({ reset_count: resetPlayerIds.size });
  } catch (err) {
    console.error('reset roster error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Replaces the projection after verifying every player belongs to the team for
// this season. Assigned reserves are promoted to the roster atomically with
// the projection update.
router.put('/:id/seasons/:seasonId/projected-lineup', async (req, res) => {
  const { id, seasonId } = req.params;
  const { slots } = req.body;
  if (!Array.isArray(slots)) return res.status(400).json({ error: 'slots must be an array' });
  if (slots.length > 30) return res.status(400).json({ error: 'slots cannot contain more than 30 rows' });

  const normalized = slots.map((slot, index) => ({
    slot_key: typeof slot?.slot_key === 'string' ? slot.slot_key.trim().toUpperCase() : '',
    player_id: typeof slot?.player_id === 'string' ? slot.player_id.trim() : '',
    sort_order: index,
  }));
  const slotKeys = new Set();
  const playerIds = new Set();
  for (const slot of normalized) {
    if (!/^[A-Z0-9_-]{1,24}$/.test(slot.slot_key)) {
      return res.status(400).json({ error: 'Each slot_key must be 1-24 letters, numbers, underscores, or dashes' });
    }
    if (!slot.player_id) return res.status(400).json({ error: 'Each slot requires player_id' });
    if (slotKeys.has(slot.slot_key)) return res.status(400).json({ error: `Duplicate slot_key: ${slot.slot_key}` });
    if (playerIds.has(slot.player_id)) return res.status(400).json({ error: 'A player can only occupy one projected slot' });
    slotKeys.add(slot.slot_key);
    playerIds.add(slot.player_id);
  }

  try {
    const [scope] = await sql`
      SELECT
        EXISTS(SELECT 1 FROM teams WHERE id = ${id}) AS team_exists,
        EXISTS(SELECT 1 FROM seasons WHERE id = ${seasonId}) AS season_exists,
        EXISTS(
          SELECT 1 FROM season_participant_teams
          WHERE team_id = ${id} AND season_id = ${seasonId}
        ) AS team_in_season
    `;
    if (!scope?.team_exists || !scope?.season_exists) {
      return res.status(404).json({ error: 'Team or season not found' });
    }
    if (!scope.team_in_season) {
      return res.status(409).json({ error: 'Team does not participate in this season' });
    }

    if (normalized.length > 0) {
      const invalid = await sql`
        SELECT input.player_id
        FROM jsonb_to_recordset(${JSON.stringify(normalized)}::jsonb)
          AS input(player_id uuid, slot_key text, sort_order smallint)
        LEFT JOIN player_season_rosters roster
          ON roster.player_id = input.player_id
         AND roster.team_id = ${id}
         AND roster.season_id = ${seasonId}
        WHERE roster.player_id IS NULL
      `;
      if (invalid.length > 0) {
        return res.status(400).json({
          error: 'Projected lineup players must be members of this team for the season',
          invalid_player_ids: invalid.map((row) => row.player_id),
        });
      }
    }

    const serializedSlots = JSON.stringify(normalized);
    const transactionResults = await sql.transaction(
      (txn) => [
        txn`
          UPDATE player_team_stints stint
          SET is_prospect = FALSE
          FROM jsonb_to_recordset(${serializedSlots}::jsonb)
            AS input(player_id uuid, slot_key text, sort_order smallint),
            seasons season
          WHERE stint.player_id = input.player_id
            AND stint.team_id = ${id}
            AND stint.is_prospect = TRUE
            AND season.id = ${seasonId}
            AND COALESCE(stint.start_date, DATE '-infinity') <= COALESCE(season.end_date, DATE 'infinity')
            AND COALESCE(stint.end_date, DATE 'infinity') >= season.start_date
        `,
        txn`
          UPDATE player_teams legacy
          SET is_prospect = FALSE
          FROM jsonb_to_recordset(${serializedSlots}::jsonb)
            AS input(player_id uuid, slot_key text, sort_order smallint)
          WHERE legacy.player_id = input.player_id
            AND legacy.team_id = ${id}
            AND legacy.season_id = ${seasonId}
            AND legacy.is_prospect = TRUE
        `,
        txn`
          DELETE FROM season_projected_lineup_slots
          WHERE team_id = ${id} AND season_id = ${seasonId}
        `,
        txn`
          INSERT INTO season_projected_lineup_slots (
            season_id, team_id, player_id, slot_key, sort_order
          )
          SELECT ${seasonId}, ${id}, input.player_id, input.slot_key, input.sort_order
          FROM jsonb_to_recordset(${serializedSlots}::jsonb)
            AS input(player_id uuid, slot_key text, sort_order smallint)
        `,
        txn`
          SELECT id, season_id, team_id, player_id, slot_key, sort_order
          FROM season_projected_lineup_slots
          WHERE team_id = ${id} AND season_id = ${seasonId}
          ORDER BY sort_order, slot_key
        `,
      ],
      { isolationLevel: 'Serializable' },
    );
    const rows = transactionResults[4] ?? [];
    return res.json(rows);
  } catch (err) {
    console.error('projected lineup put error:', err);
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
        ti.name, ti.place_name, ti.team_name, ti.code,
        team_logo_default(ti.logo_dark, ti.logo_light) AS logo,
        ti.logo_dark,
        ti.logo_light,
        COALESCE(ti.icon, ti_icon.icon) AS icon,
        l.name AS league_name, l.code AS league_code, l.logo AS league_logo,
        l.primary_color AS league_primary_color, l.text_color AS league_text_color,
        t.start_season_id,
        t.latest_season_id,
        ss.start_date::text AS start_season_start_date,
        ls.end_date::text   AS latest_season_end_date
      FROM teams t
      LEFT JOIN LATERAL (
        SELECT
          name, place_name, team_name, code,
          team_logo_default(logo_dark, logo_light) AS logo,
          logo_dark, logo_light, icon
        FROM team_iterations
        WHERE team_id = t.id
        ORDER BY CASE WHEN end_date IS NULL THEN 0 ELSE 1 END, start_date DESC NULLS LAST, recorded_at DESC
        LIMIT 1
      ) ti ON true
      LEFT JOIN LATERAL (
        SELECT icon FROM team_iterations
        WHERE team_id = t.id AND icon IS NOT NULL
        ORDER BY recorded_at DESC
        LIMIT 1
      ) ti_icon ON true
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
// ---------------------------------------------------------------------------
// GET /api/admin/teams/:id/awards - winner awards for one team.
// ---------------------------------------------------------------------------
router.get('/:id/awards', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`
      SELECT
        sar.id,
        la.id AS award_id,
        sa.id AS season_award_id,
        la.name AS award_name,
        la.description AS award_description,
        la.competition_scope,
        la.stat_key,
        s.id AS season_id,
        s.name AS season_name,
        sa.awarded_at::text AS awarded_at,
        t.id AS team_id,
        ti.name AS team_name,
        ti.place_name AS team_place_name,
        ti.team_name AS team_team_name,
        ti.code AS team_code,
        ti.logo AS team_logo,
        ti.logo_dark AS team_logo_dark,
        ti.logo_light AS team_logo_light,
        t.primary_color AS team_primary_color,
        t.secondary_color AS team_secondary_color,
        t.text_color AS team_text_color
      FROM season_award_recipients sar
      JOIN season_awards sa ON sa.id = sar.season_award_id
      JOIN league_awards la ON la.id = sa.award_id
      JOIN seasons s ON s.id = sa.season_id
      LEFT JOIN teams t ON t.id = sar.team_id
      LEFT JOIN LATERAL (
        SELECT
          name,
          place_name,
          team_name,
          code,
          team_logo_default(logo_dark, logo_light) AS logo,
          team_logo_dark(logo_dark, logo_light) AS logo_dark,
          team_logo_light(logo_dark, logo_light) AS logo_light
        FROM team_iterations
        WHERE team_id = t.id
        ORDER BY
          CASE
            WHEN (start_date IS NULL OR start_date <= COALESCE(sa.awarded_at, s.end_date, s.start_date, CURRENT_DATE))
             AND (end_date IS NULL OR end_date >= COALESCE(sa.awarded_at, s.start_date, CURRENT_DATE))
            THEN 0
            WHEN end_date IS NULL THEN 1
            ELSE 2
          END,
          start_date DESC NULLS LAST,
          recorded_at DESC
        LIMIT 1
      ) ti ON TRUE
      WHERE sar.recipient_type = 'team'
        AND sar.role = 'winner'
        AND sar.team_id = ${id}
      ORDER BY
        s.start_date DESC NULLS LAST,
        s.created_at DESC,
        la.sort_order ASC,
        la.name ASC,
        sar.id ASC
    `;
    return res.json(rows);
  } catch (err) {
    console.error('team awards error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  const {
    code, description, location, city, home_arena,
    logo_dark, logo_light, icon,
    league_id, primary_color, secondary_color, text_color,
  } = req.body;
  const identity = resolveTeamIdentity(req.body);

  if (identity.hasSplitName && !identity.teamName) {
    return res.status(400).json({ error: 'team_name is required' });
  }
  if (!identity.name) {
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
      INSERT INTO team_iterations (team_id, name, place_name, team_name, code, logo_dark, logo_light, icon)
      VALUES (
        ${teamId},
        ${identity.name},
        ${identity.placeName ?? null},
        ${identity.teamName ?? null},
        ${code.trim().toUpperCase()},
        ${logo_dark ?? null},
        ${logo_light ?? null},
        ${icon ?? null}
      )
    `;

    // Return the full team with resolved identity
    const full = await sql`
      SELECT
        t.id, t.description, t.location, t.city, t.home_arena,
        t.league_id, t.primary_color, t.secondary_color, t.text_color, t.created_at,
        ti.name, ti.place_name, ti.team_name, ti.code,
        team_logo_default(ti.logo_dark, ti.logo_light) AS logo,
        ti.logo_dark,
        ti.logo_light,
        COALESCE(ti.icon, ti_icon.icon) AS icon
      FROM teams t
      LEFT JOIN LATERAL (
        SELECT
          name, place_name, team_name, code,
          team_logo_default(logo_dark, logo_light) AS logo,
          logo_dark, logo_light, icon
        FROM team_iterations
        WHERE team_id = t.id
        ORDER BY CASE WHEN end_date IS NULL THEN 0 ELSE 1 END, start_date DESC NULLS LAST, recorded_at DESC
        LIMIT 1
      ) ti ON true
      LEFT JOIN LATERAL (
        SELECT icon FROM team_iterations
        WHERE team_id = t.id AND icon IS NOT NULL
        ORDER BY recorded_at DESC
        LIMIT 1
      ) ti_icon ON true
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
  const {
    code, description, location, city, home_arena,
    logo_dark, logo_light, icon,
    league_id, primary_color, secondary_color, text_color,
    start_season_id, latest_season_id,
  } = req.body;
  const identity = resolveTeamIdentity(req.body);
  const descriptionInBody     = 'description'      in req.body;
  const logoDarkInBody        = 'logo_dark'        in req.body;
  const logoLightInBody       = 'logo_light'       in req.body;
  const iconInBody            = 'icon'             in req.body;
  const primaryColorInBody    = 'primary_color'    in req.body;
  const secondaryColorInBody  = 'secondary_color'  in req.body;
  const textColorInBody       = 'text_color'       in req.body;
  const startSeasonInBody     = 'start_season_id'  in req.body;
  const latestSeasonInBody    = 'latest_season_id' in req.body;

  if (identity.hasSplitName && !identity.teamName) {
    return res.status(400).json({ error: 'team_name cannot be empty' });
  }
  if (identity.hasName && !identity.name) {
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
    const hasIdentity = identity.hasName || code !== undefined || logoDarkInBody || logoLightInBody || iconInBody;
    if (hasIdentity) {
      const baseIter = await sql`
        SELECT id FROM team_iterations
        WHERE team_id = ${id}
        ORDER BY CASE WHEN end_date IS NULL THEN 0 ELSE 1 END, start_date DESC NULLS LAST, recorded_at DESC
        LIMIT 1
      `;
      if (baseIter.length > 0) {
        await sql`
          UPDATE team_iterations SET
            name = COALESCE(${identity.name ?? null}, name),
            place_name = CASE WHEN ${identity.hasName} THEN ${identity.placeName ?? null} ELSE place_name END,
            team_name = CASE WHEN ${identity.hasName} THEN ${identity.teamName ?? null} ELSE team_name END,
            code = COALESCE(${code ? code.trim().toUpperCase() : null}, code),
            logo_dark = CASE WHEN ${logoDarkInBody} THEN ${logo_dark ?? null} ELSE logo_dark END,
            logo_light = CASE WHEN ${logoLightInBody} THEN ${logo_light ?? null} ELSE logo_light END,
            icon = CASE WHEN ${iconInBody} THEN ${icon ?? null} ELSE icon END
          WHERE id = ${baseIter[0].id}
        `;
      } else {
        await sql`
          INSERT INTO team_iterations (team_id, name, place_name, team_name, code, logo_dark, logo_light, icon)
          VALUES (
            ${id},
            ${identity.name ?? ''},
            ${identity.placeName ?? null},
            ${identity.teamName ?? null},
            ${code ? code.trim().toUpperCase() : ''},
            ${logoDarkInBody ? (logo_dark ?? null) : null},
            ${logoLightInBody ? (logo_light ?? null) : null},
            ${iconInBody ? (icon ?? null) : null}
          )
        `;
      }
    }

    // ── Non-identity fields → teams table ──────────────────────────────────
    await sql`
      UPDATE teams SET
        description      = CASE WHEN ${descriptionInBody}     THEN ${description     ?? null}      ELSE description      END,
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
        ti.name, ti.place_name, ti.team_name, ti.code,
        team_logo_default(ti.logo_dark, ti.logo_light) AS logo,
        ti.logo_dark,
        ti.logo_light,
        COALESCE(ti.icon, ti_icon.icon) AS icon
      FROM teams t
      LEFT JOIN LATERAL (
        SELECT
          name, place_name, team_name, code,
          team_logo_default(logo_dark, logo_light) AS logo,
          logo_dark, logo_light, icon
        FROM team_iterations
        WHERE team_id = t.id
        ORDER BY CASE WHEN end_date IS NULL THEN 0 ELSE 1 END, start_date DESC NULLS LAST, recorded_at DESC
        LIMIT 1
      ) ti ON true
      LEFT JOIN LATERAL (
        SELECT icon FROM team_iterations
        WHERE team_id = t.id AND icon IS NOT NULL
        ORDER BY recorded_at DESC
        LIMIT 1
      ) ti_icon ON true
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
        ti.id, ti.team_id, ti.name, ti.place_name, ti.team_name, ti.code,
        team_logo_default(ti.logo_dark, ti.logo_light) AS logo,
        ti.logo_dark,
        ti.logo_light,
        ti.icon, ti.note, ti.recorded_at,
        ti.start_date::text AS start_date,
        ti.end_date::text AS end_date
      FROM team_iterations ti
      WHERE ti.team_id = ${id}
      ORDER BY ti.start_date DESC NULLS LAST, ti.recorded_at DESC
    `;
    return res.json(rows);
  } catch (err) {
    console.error('team iterations list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/teams/:id/iterations  – record a new identity snapshot
// Body: { name, code?, logo_dark?, logo_light?, note? }
// ---------------------------------------------------------------------------
router.post('/:id/iterations', async (req, res) => {
  const { id } = req.params;
  const { code, logo_dark, logo_light, icon, note, start_date, end_date } = req.body;
  const identity = resolveTeamIdentity(req.body);

  if (identity.hasSplitName && !identity.teamName) {
    return res.status(400).json({ error: 'team_name is required' });
  }
  if (!identity.name) {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    const teamRows = await sql`SELECT id FROM teams WHERE id = ${id}`;
    if (teamRows.length === 0) return res.status(404).json({ error: 'Team not found' });

    const rows = await sql`
      INSERT INTO team_iterations (team_id, name, place_name, team_name, code, logo_dark, logo_light, icon, note, start_date, end_date)
      VALUES (
        ${id},
        ${identity.name},
        ${identity.placeName ?? null},
        ${identity.teamName ?? null},
        ${code ? code.trim().toUpperCase() : null},
        ${logo_dark ?? null},
        ${logo_light ?? null},
        ${icon ?? null},
        ${note?.trim() ?? null},
        ${start_date ?? null}::date,
        ${end_date ?? null}::date
      )
      RETURNING id
    `;

    const full = await sql`
      SELECT
        ti.id, ti.team_id, ti.name, ti.place_name, ti.team_name, ti.code,
        team_logo_default(ti.logo_dark, ti.logo_light) AS logo,
        ti.logo_dark,
        ti.logo_light,
        ti.icon, ti.note, ti.recorded_at,
        ti.start_date::text AS start_date,
        ti.end_date::text AS end_date
      FROM team_iterations ti
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
// Body: { name?, code?, logo_dark?, logo_light?, note? }
// ---------------------------------------------------------------------------
router.patch('/:id/iterations/:iterationId', async (req, res) => {
  const { id, iterationId } = req.params;
  const { code, logo_dark, logo_light, icon, note, start_date, end_date } = req.body;
  const identity = resolveTeamIdentity(req.body);
  const logoDarkInBody       = 'logo_dark'        in req.body;
  const logoLightInBody      = 'logo_light'       in req.body;
  const iconInBody           = 'icon'             in req.body;
  const noteInBody           = 'note'             in req.body;
  const startDateInBody      = 'start_date'        in req.body;
  const endDateInBody        = 'end_date'          in req.body;

  if (identity.hasSplitName && !identity.teamName) {
    return res.status(400).json({ error: 'team_name cannot be empty' });
  }
  if (identity.hasName && !identity.name) {
    return res.status(400).json({ error: 'name cannot be empty' });
  }

  try {
    const rows = await sql`
      UPDATE team_iterations SET
        name             = COALESCE(${identity.name ?? null}, name),
        place_name       = CASE WHEN ${identity.hasName} THEN ${identity.placeName ?? null} ELSE place_name END,
        team_name        = CASE WHEN ${identity.hasName} THEN ${identity.teamName ?? null} ELSE team_name END,
        code             = COALESCE(${code ? code.trim().toUpperCase() : null}, code),
        logo_dark        = CASE WHEN ${logoDarkInBody}      THEN ${logo_dark ?? null}        ELSE logo_dark        END,
        logo_light       = CASE WHEN ${logoLightInBody}     THEN ${logo_light ?? null}       ELSE logo_light       END,
        icon             = CASE WHEN ${iconInBody}          THEN ${icon ?? null}             ELSE icon             END,
        note             = CASE WHEN ${noteInBody}          THEN ${note?.trim() ?? null}     ELSE note             END,
        start_date       = CASE WHEN ${startDateInBody}    THEN ${start_date ?? null}::date ELSE start_date END,
        end_date         = CASE WHEN ${endDateInBody}      THEN ${end_date ?? null}::date   ELSE end_date   END
      WHERE id = ${iterationId} AND team_id = ${id}
      RETURNING id
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Iteration not found' });

    const full = await sql`
      SELECT
        ti.id, ti.team_id, ti.name, ti.place_name, ti.team_name, ti.code,
        team_logo_default(ti.logo_dark, ti.logo_light) AS logo,
        ti.logo_dark,
        ti.logo_light,
        ti.icon, ti.note, ti.recorded_at,
        ti.start_date::text AS start_date,
        ti.end_date::text AS end_date
      FROM team_iterations ti
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

