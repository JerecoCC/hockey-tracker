const router = require('express').Router();
const { requireAdmin } = require('../middleware/auth');
const { sql } = require('../db');

router.use(requireAdmin);

const ACQUISITION_TYPES = new Set([
  'draft',
  'trade',
  'free_agency',
  'waivers',
  'signing',
  'foundational_signing',
  'expansion_signing',
  'expansion_draft',
  'team_transfer',
  'loan',
  'other',
]);
const normalizeAcquisitionType = (value) => (value === '' || value == null ? null : value);
const isValidAcquisitionType = (value) => value == null || ACQUISITION_TYPES.has(value);
const isValidDateOnly = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const isValidJerseyNumber = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 99;
};

const upsertCareerStint = async ({
  player_id,
  team_id,
  position = null,
  acquisition_type = null,
  start_date = null,
  end_date = null,
}) => {
  const rows = (await sql`
    WITH existing AS (
      SELECT id
      FROM player_team_stints
      WHERE player_id = ${player_id}
        AND team_id = ${team_id}
        AND end_date IS NULL
      ORDER BY start_date DESC NULLS LAST, created_at DESC
      LIMIT 1
    ),
    updated AS (
      UPDATE player_team_stints pts
      SET
        position = COALESCE(${position}, pts.position),
        acquisition_type = COALESCE(${acquisition_type}, pts.acquisition_type),
        start_date = COALESCE(pts.start_date, ${start_date}::date),
        end_date = CASE WHEN ${end_date}::date IS NULL THEN pts.end_date ELSE ${end_date}::date END
      FROM existing
      WHERE pts.id = existing.id
      RETURNING pts.*
    ),
    inserted AS (
      INSERT INTO player_team_stints (
        player_id, team_id, position, acquisition_type, start_date, end_date
      )
      SELECT
        ${player_id}, ${team_id}, ${position}, ${acquisition_type},
        ${start_date}::date, ${end_date}::date
      WHERE NOT EXISTS (SELECT 1 FROM existing)
      RETURNING *
    )
    SELECT * FROM updated
    UNION ALL
    SELECT * FROM inserted
  `) ?? [];
  return rows[0] ?? null;
};

const closeActiveCareerStints = (player_id, end_date) => sql`
  UPDATE player_team_stints
  SET end_date = ${end_date}::date
  WHERE player_id = ${player_id}
    AND end_date IS NULL
  RETURNING id, team_id
`;

const playerHasStatsForTeam = async (playerId, teamId) => {
  const rows = (await sql`
    SELECT
      EXISTS (
        SELECT 1
        FROM game_player_stats
        WHERE player_id = ${playerId}
          AND team_id = ${teamId}
        LIMIT 1
      ) AS has_player_stats,
      EXISTS (
        SELECT 1
        FROM game_goalie_stints
        WHERE goalie_id = ${playerId}
          AND team_id = ${teamId}
        LIMIT 1
      ) AS has_goalie_stats
  `) ?? [];
  return Boolean(rows[0]?.has_player_stats || rows[0]?.has_goalie_stats);
};

const mapHistoryRow = (row) => ({
  id: row.id,
  player_id: row.player_id,
  team_id: row.team_id,
  season_id: row.season_id,
  roster_player_team_id: row.roster_player_team_id,
  jersey_number: row.jersey_number,
  is_prospect: row.is_prospect ?? false,
  photo: row.photo,
  position: row.position,
  acquisition_type: row.acquisition_type,
  start_date: row.start_date,
  end_date: row.end_date,
  created_at: row.created_at,
  has_stats: Boolean(row.has_player_stats || row.has_goalie_stats),
  can_delete: !Boolean(row.has_player_stats || row.has_goalie_stats),
  team: {
    id: row.team_id,
    name: row.team_name,
    code: row.team_code,
    logo: row.team_logo,
    logo_dark: row.team_logo_dark,
    logo_light: row.team_logo_light,
    primary_color: row.primary_color,
    text_color: row.text_color,
  },
});

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
    for (const { player_id, jersey_number = null, is_prospect = false } of players) {
      const rows = await sql`
        INSERT INTO player_teams (player_id, team_id, season_id, jersey_number, is_prospect)
        VALUES (${player_id}, ${team_id}, ${season_id}, ${jersey_number}, ${!!is_prospect})
        ON CONFLICT (player_id, season_id) WHERE end_date IS NULL DO NOTHING
        RETURNING id, player_id, team_id, season_id, jersey_number, is_prospect
      `;
      if (rows.length > 0) {
        await upsertCareerStint({ player_id, team_id });
        created.push(rows[0]);
      }
    }
    return res.status(201).json({ created, skipped: players.length - created.length });
  } catch (err) {
    console.error('player-teams bulk error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/player-teams
// Body: { player_id, team_id, season_id, jersey_number?, photo?, position?, acquisition_type?, start_date?, end_date? }
// Creates a new stint row directly. Returns 409 if the unique active-stint index fires
// (i.e. the player already has an open stint in this season and end_date is omitted).
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const { player_id, team_id, season_id, jersey_number, photo, position, start_date, end_date } = req.body;
  const is_prospect = !!req.body.is_prospect;
  const acquisition_type = normalizeAcquisitionType(req.body.acquisition_type);
  if (!player_id) return res.status(400).json({ error: 'player_id is required' });
  if (!team_id)   return res.status(400).json({ error: 'team_id is required' });
  if (!season_id) return res.status(400).json({ error: 'season_id is required' });
  if (!isValidAcquisitionType(acquisition_type)) return res.status(400).json({ error: 'Invalid acquisition_type' });

  try {
    const rows = await sql`
      INSERT INTO player_teams
        (player_id, team_id, season_id, jersey_number, is_prospect, position, acquisition_type, start_date, end_date)
      VALUES (
        ${player_id}, ${team_id}, ${season_id},
        ${jersey_number ?? null},
        ${is_prospect},
        ${position ?? null},
        ${acquisition_type},
        ${start_date ?? null}::date,
        ${end_date   ?? null}::date
      )
      RETURNING id, player_id, team_id, season_id, jersey_number, is_prospect, position, acquisition_type,
                start_date::text AS start_date, end_date::text AS end_date
    `;
    if (photo) {
      await sql`
        INSERT INTO player_photos (player_id, team_id, season_id, photo)
        VALUES (${player_id}, ${team_id}, ${season_id}, ${photo})
        ON CONFLICT (player_id, team_id, season_id)
        DO UPDATE SET photo = EXCLUDED.photo, created_at = NOW()
      `;
    }
    await upsertCareerStint({
      player_id,
      team_id,
      position: position ?? null,
      acquisition_type,
      start_date: start_date ?? null,
      end_date: end_date ?? null,
    });
    rows[0].photo = photo ?? null;
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
// Updates jersey_number and/or position on the active stint; photo is stored per player/team/season.
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
  const prospectInBody = 'is_prospect' in req.body;

  if (jerseyInBody && jersey_number != null && !effective_date) {
    return res.status(400).json({ error: 'effective_date is required when changing jersey number' });
  }

  try {
    // If jersey_number is changing, record history before the update.
    if (jerseyInBody && jersey_number != null) {
      const [current] = await sql`
        SELECT
          pt.id,
          pt.jersey_number,
          COALESCE(pt.start_date, s.start_date, pt.created_at::date)::text AS effective_start,
          s.start_date::text AS season_start
        FROM player_teams pt
        LEFT JOIN seasons s ON s.id = pt.season_id
        WHERE pt.player_id = ${player_id}
          AND pt.team_id   = ${team_id}
          AND pt.season_id = ${season_id}
          AND pt.end_date IS NULL
      `;
      if (current && current.jersey_number !== jersey_number) {
        const changeDate = effective_date;
        // Seed initial history if none exists for this stint yet.
        const existingHistory = await sql`
          SELECT 1 FROM jersey_number_history WHERE player_teams_id = ${current.id} LIMIT 1
        `;
        if (existingHistory.length === 0 && current.jersey_number != null) {
          // Prefer the roster/season start for the old number. If the change
          // predates that, fall back to season start so the old entry can sort
          // before the new one.
          let seedDate = current.effective_start;
          if (seedDate >= changeDate) {
            seedDate = current.season_start ?? changeDate;
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

    let rows = await sql`
      UPDATE player_teams
      SET
        jersey_number = CASE WHEN ${jerseyInBody}   THEN ${jersey_number ?? null} ELSE jersey_number END,
        position      = CASE WHEN ${positionInBody}  THEN ${position ?? null}      ELSE position      END,
        is_prospect   = CASE WHEN ${prospectInBody}  THEN ${!!req.body.is_prospect} ELSE is_prospect END
      WHERE player_id = ${player_id}
        AND team_id   = ${team_id}
        AND season_id = ${season_id}
        AND end_date IS NULL
      RETURNING id, player_id, team_id, season_id, jersey_number, is_prospect, position
    `;

    if (
      rows.length === 0 &&
      prospectInBody &&
      !jerseyInBody &&
      !photoInBody &&
      !positionInBody
    ) {
      rows = await sql`
        UPDATE player_teams
        SET is_prospect = ${!!req.body.is_prospect}
        WHERE id = (
          SELECT id
          FROM player_teams
          WHERE player_id = ${player_id}
            AND team_id   = ${team_id}
            AND season_id = ${season_id}
          ORDER BY end_date DESC NULLS FIRST, created_at DESC
          LIMIT 1
        )
        RETURNING id, player_id, team_id, season_id, jersey_number, is_prospect, position
      `;
    }

    if (rows.length === 0) return res.status(404).json({ error: 'Player team record not found' });
    if (photoInBody) {
      if (photo) {
        await sql`
          INSERT INTO player_photos (player_id, team_id, season_id, photo)
          VALUES (${player_id}, ${team_id}, ${season_id}, ${photo})
          ON CONFLICT (player_id, team_id, season_id)
          DO UPDATE SET photo = EXCLUDED.photo, created_at = NOW()
        `;
      } else {
        await sql`
          DELETE FROM player_photos
          WHERE player_id = ${player_id} AND team_id = ${team_id} AND season_id = ${season_id}
        `;
      }
    }
    rows[0].photo = photoInBody ? (photo ?? null) : null;
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
        pts.id,
        pts.player_id,
        pts.team_id,
        roster.id AS roster_player_team_id,
        roster.season_id,
        roster.jersey_number,
        roster.is_prospect,
        best_player_photo(pts.player_id, roster.season_id, pts.team_id) AS photo,
        COALESCE(pts.position, roster.position) AS position,
        pts.acquisition_type,
        pts.start_date::text AS start_date,
        pts.end_date::text AS end_date,
        pts.created_at,
        ti.name AS team_name,
        ti.code AS team_code,
        ti.logo AS team_logo,
        ti.logo_dark AS team_logo_dark,
        ti.logo_light AS team_logo_light,
        t.primary_color,
        t.text_color,
        EXISTS (
          SELECT 1
          FROM game_player_stats gps
          WHERE gps.player_id = pts.player_id
            AND gps.team_id = pts.team_id
          LIMIT 1
        ) AS has_player_stats,
        EXISTS (
          SELECT 1
          FROM game_goalie_stints ggs
          WHERE ggs.goalie_id = pts.player_id
            AND ggs.team_id = pts.team_id
          LIMIT 1
        ) AS has_goalie_stats
      FROM player_team_stints pts
      JOIN teams t ON t.id = pts.team_id
      LEFT JOIN LATERAL (
        SELECT pt.*
        FROM player_teams pt
        LEFT JOIN seasons s ON s.id = pt.season_id
        WHERE pt.player_id = pts.player_id
          AND pt.team_id = pts.team_id
          AND (${season_id ?? null}::uuid IS NULL OR pt.season_id = ${season_id ?? null}::uuid)
        ORDER BY
          CASE WHEN pt.end_date IS NULL THEN 0 ELSE 1 END,
          COALESCE(pt.end_date, pt.start_date, s.start_date, pt.created_at::date) DESC NULLS LAST,
          COALESCE(pt.start_date, s.start_date, pt.created_at::date) DESC NULLS LAST,
          pt.created_at DESC
        LIMIT 1
      ) roster ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          name,
          code,
          team_logo_default(logo_dark, logo_light) AS logo,
          team_logo_dark(logo_dark, logo_light) AS logo_dark,
          team_logo_light(logo_dark, logo_light) AS logo_light
        FROM team_iterations
        WHERE team_id = pts.team_id
        ORDER BY
          CASE
            WHEN (start_date IS NULL OR start_date <= COALESCE(pts.end_date, CURRENT_DATE))
             AND (end_date IS NULL OR end_date >= COALESCE(pts.start_date, pts.created_at::date))
            THEN 0
            WHEN end_date IS NULL THEN 1
            ELSE 2
          END,
          start_date DESC NULLS LAST,
          recorded_at DESC
        LIMIT 1
      ) ti ON TRUE
      WHERE pts.player_id = ${playerId}
        AND (
          ${season_id ?? null}::uuid IS NULL
          OR roster.id IS NOT NULL
        )
      ORDER BY
        CASE WHEN pts.end_date IS NULL THEN 0 ELSE 1 END,
        COALESCE(pts.end_date, pts.start_date, pts.created_at::date) DESC NULLS LAST,
        COALESCE(pts.start_date, pts.created_at::date) DESC NULLS LAST,
        pts.created_at DESC
    `;
    return res.json(rows.map(mapHistoryRow));
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
// PATCH /api/admin/player-teams/history/jerseys/:id
// Updates a stored jersey_number_history row and syncs the active player_teams
// jersey to the latest dated history entry for that stint.
// ---------------------------------------------------------------------------
router.patch('/history/jerseys/:id', async (req, res) => {
  const { id } = req.params;
  const { jersey_number, effective_from } = req.body;
  if (!isValidJerseyNumber(jersey_number)) {
    return res.status(400).json({ error: 'jersey_number must be an integer between 0 and 99' });
  }
  if (!isValidDateOnly(effective_from)) {
    return res.status(400).json({ error: 'effective_from must be a YYYY-MM-DD date' });
  }

  try {
    const rows = await sql`
      UPDATE jersey_number_history
      SET
        jersey_number = ${Number(jersey_number)},
        effective_from = ${effective_from}::date
      WHERE id = ${id}
      RETURNING id, player_teams_id, jersey_number, effective_from::text AS effective_from
    `;
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Jersey history row not found' });
    }

    await sql`
      WITH latest AS (
        SELECT player_teams_id, jersey_number
        FROM jersey_number_history
        WHERE player_teams_id = ${rows[0].player_teams_id}
        ORDER BY effective_from DESC, created_at DESC, id DESC
        LIMIT 1
      )
      UPDATE player_teams pt
      SET jersey_number = latest.jersey_number
      FROM latest
      WHERE pt.id = latest.player_teams_id
    `;

    return res.json(rows[0]);
  } catch (err) {
    console.error('jersey history update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/player-teams/history/jerseys/:id
// Deletes a stored jersey_number_history row and syncs the active player_teams
// jersey to the remaining latest dated history entry for that stint.
// ---------------------------------------------------------------------------
router.delete('/history/jerseys/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const rows = await sql`
      WITH deleted AS (
        DELETE FROM jersey_number_history
        WHERE id = ${id}
        RETURNING id, player_teams_id, jersey_number, effective_from::text AS effective_from
      ),
      latest AS (
        SELECT
          deleted.player_teams_id,
          latest_history.jersey_number
        FROM deleted
        LEFT JOIN LATERAL (
          SELECT jersey_number
          FROM jersey_number_history
          WHERE player_teams_id = deleted.player_teams_id
          ORDER BY effective_from DESC, created_at DESC, id DESC
          LIMIT 1
        ) latest_history ON TRUE
      ),
      synced AS (
        UPDATE player_teams pt
        SET jersey_number = latest.jersey_number
        FROM latest
        WHERE pt.id = latest.player_teams_id
        RETURNING pt.id
      )
      SELECT * FROM deleted
    `;
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Jersey history row not found' });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error('jersey history delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/player-teams/history/:playerId/photos
// Returns one photo row per season/team membership, with saved photos when
// present and provider-generated season URLs as display fallbacks.
// ---------------------------------------------------------------------------
router.get('/history/:playerId/photos', async (req, res) => {
  const { playerId } = req.params;
  try {
    const rows = await sql`
      WITH season_membership AS (
        SELECT DISTINCT ON (pt.player_id, pt.team_id, pt.season_id)
          pt.player_id,
          pt.team_id,
          pt.season_id,
          pt.start_date,
          pt.end_date,
          pt.created_at
        FROM player_teams pt
        WHERE pt.player_id = ${playerId}
        ORDER BY
          pt.player_id,
          pt.team_id,
          pt.season_id,
          CASE WHEN pt.end_date IS NULL THEN 0 ELSE 1 END,
          COALESCE(pt.end_date, pt.start_date, pt.created_at::date) DESC NULLS LAST,
          COALESCE(pt.start_date, pt.created_at::date) DESC NULLS LAST,
          pt.created_at DESC
      )
      SELECT
        pp.id,
        sm.player_id,
        sm.team_id,
        sm.season_id,
        COALESCE(pp.photo, player_provider_photo(sm.player_id, sm.season_id, sm.team_id)) AS photo,
        pp.created_at,
        s.name AS season_name,
        ti.name AS team_name,
        (pp.id IS NOT NULL) AS has_saved_photo
      FROM season_membership sm
      JOIN seasons s ON s.id = sm.season_id
      LEFT JOIN LATERAL (
        SELECT id, NULLIF(photo, '') AS photo, created_at
        FROM player_photos
        WHERE player_id = sm.player_id
          AND team_id = sm.team_id
          AND season_id = sm.season_id
          AND NULLIF(photo, '') IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 1
      ) pp ON true
      LEFT JOIN LATERAL (
        SELECT name FROM team_iterations
        WHERE team_id = sm.team_id
        ORDER BY
          CASE
            WHEN (start_date IS NULL OR start_date <= COALESCE(s.end_date, CURRENT_DATE))
             AND (end_date IS NULL OR end_date >= COALESCE(s.start_date, s.created_at::date))
            THEN 0
            WHEN end_date IS NULL THEN 1
            ELSE 2
          END,
          start_date DESC NULLS LAST,
          recorded_at DESC
        LIMIT 1
      ) ti ON true
      ORDER BY
        s.start_date DESC NULLS LAST,
        s.created_at DESC,
        COALESCE(sm.start_date, sm.created_at::date) DESC NULLS LAST,
        pp.created_at DESC NULLS LAST
    `;
    return res.json(rows);
  } catch (err) {
    console.error('player photo history error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/player-teams/history/:playerId/photos
// Body: { team_id, season_id, photo }
// Upserts one player photo for that player/team/season.
// ---------------------------------------------------------------------------
router.post('/history/:playerId/photos', async (req, res) => {
  const { playerId } = req.params;
  const { team_id, season_id, photo } = req.body;

  if (!team_id) return res.status(400).json({ error: 'team_id is required' });
  if (!season_id) return res.status(400).json({ error: 'season_id is required' });
  if (!photo) return res.status(400).json({ error: 'photo is required' });

  try {
    const rows = await sql`
      INSERT INTO player_photos (player_id, team_id, season_id, photo)
      VALUES (${playerId}, ${team_id}, ${season_id}, ${photo})
      ON CONFLICT (player_id, team_id, season_id)
      DO UPDATE SET photo = EXCLUDED.photo, created_at = NOW()
      RETURNING id, player_id, team_id, season_id, photo, created_at
    `;
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error('player photo upsert error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/player-teams/history/photos/:id
// Deletes one saved player photo record.
// ---------------------------------------------------------------------------
router.delete('/history/photos/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const rows = await sql`
      DELETE FROM player_photos
      WHERE id = ${id}
      RETURNING id, player_id, team_id, season_id, photo, created_at
    `;
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Player photo row not found' });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error('player photo delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/player-teams/:id
// Body: { team_id?, season_id?, jersey_number?, photo?, position?, acquisition_type?, start_date?, end_date? }
// Updates editable fields on a specific stint row by its UUID.
// ---------------------------------------------------------------------------
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { team_id, season_id, jersey_number, photo, position, start_date, end_date } = req.body;
  const acquisition_type = normalizeAcquisitionType(req.body.acquisition_type);

  const teamInBody      = 'team_id'       in req.body;
  const seasonInBody    = 'season_id'     in req.body;
  const jerseyInBody    = 'jersey_number' in req.body;
  const prospectInBody  = 'is_prospect'   in req.body;
  const photoInBody     = 'photo'         in req.body;
  const positionInBody  = 'position'      in req.body;
  const acquisitionInBody = 'acquisition_type' in req.body;
  const startDateInBody = 'start_date'    in req.body;
  const endDateInBody   = 'end_date'      in req.body;
  const rosterSeasonId = seasonInBody ? season_id : null;
  if (!isValidAcquisitionType(acquisition_type)) return res.status(400).json({ error: 'Invalid acquisition_type' });

  try {
    const stintRows = (await sql`
      UPDATE player_team_stints
      SET
        team_id       = CASE WHEN ${teamInBody}      THEN ${team_id}::uuid                   ELSE team_id       END,
        position      = CASE WHEN ${positionInBody}  THEN ${position ?? null}                 ELSE position      END,
        acquisition_type = CASE WHEN ${acquisitionInBody} THEN ${acquisition_type}             ELSE acquisition_type END,
        start_date    = CASE WHEN ${startDateInBody} THEN ${start_date ?? null}::date         ELSE start_date    END,
        end_date      = CASE WHEN ${endDateInBody}   THEN ${end_date ?? null}::date           ELSE end_date      END
      WHERE id = ${id}
      RETURNING
        id, player_id, team_id,
        position, acquisition_type,
        start_date::text AS start_date,
        end_date::text AS end_date
    `) ?? [];

    if (stintRows.length > 0) {
      let [roster] = (await sql`
        SELECT id, team_id, season_id, jersey_number, is_prospect, position
        FROM player_teams
        WHERE player_id = ${stintRows[0].player_id}
          AND team_id = ${stintRows[0].team_id}
          AND (${rosterSeasonId}::uuid IS NULL OR season_id = ${rosterSeasonId}::uuid)
        ORDER BY end_date DESC NULLS FIRST, created_at DESC
        LIMIT 1
      `) ?? [];
      if (roster && (jerseyInBody || prospectInBody || positionInBody)) {
        [roster] = (await sql`
          UPDATE player_teams
          SET
            jersey_number = CASE WHEN ${jerseyInBody}   THEN ${jersey_number ?? null}  ELSE jersey_number END,
            is_prospect   = CASE WHEN ${prospectInBody} THEN ${!!req.body.is_prospect} ELSE is_prospect   END,
            position      = CASE WHEN ${positionInBody} THEN ${position ?? null}       ELSE position      END
          WHERE id = ${roster.id}
          RETURNING id, team_id, season_id, jersey_number, is_prospect, position
        `) ?? [];
      }
      const photoSeasonId = roster?.season_id ?? (seasonInBody ? season_id : null);
      const photoTeamId = roster?.team_id ?? stintRows[0].team_id;
      if (photoInBody && photoSeasonId) {
        if (photo) {
          await sql`
            INSERT INTO player_photos (player_id, team_id, season_id, photo)
            VALUES (${stintRows[0].player_id}, ${photoTeamId}, ${photoSeasonId}, ${photo})
            ON CONFLICT (player_id, team_id, season_id)
            DO UPDATE SET photo = EXCLUDED.photo, created_at = NOW()
          `;
        } else {
          await sql`
            DELETE FROM player_photos
            WHERE player_id = ${stintRows[0].player_id} AND team_id = ${photoTeamId} AND season_id = ${photoSeasonId}
          `;
        }
      }
      return res.json({
        ...stintRows[0],
        season_id: roster?.season_id ?? (seasonInBody ? season_id : null),
        roster_player_team_id: roster?.id ?? null,
        jersey_number: roster?.jersey_number ?? null,
        is_prospect: roster?.is_prospect ?? false,
        photo: photoInBody ? (photo ?? null) : null,
      });
    }

    const rows = await sql`
      UPDATE player_teams
      SET
        team_id       = CASE WHEN ${teamInBody}      THEN ${team_id}::uuid                   ELSE team_id       END,
        season_id     = CASE WHEN ${seasonInBody}    THEN ${season_id}::uuid                 ELSE season_id     END,
        jersey_number = CASE WHEN ${jerseyInBody}    THEN ${jersey_number ?? null}            ELSE jersey_number END,
        is_prospect   = CASE WHEN ${prospectInBody}  THEN ${!!req.body.is_prospect}           ELSE is_prospect   END,
        position      = CASE WHEN ${positionInBody}  THEN ${position ?? null}                 ELSE position      END,
        acquisition_type = CASE WHEN ${acquisitionInBody} THEN ${acquisition_type}             ELSE acquisition_type END,
        start_date    = CASE WHEN ${startDateInBody} THEN ${start_date ?? null}::date         ELSE start_date    END,
        end_date      = CASE WHEN ${endDateInBody}   THEN ${end_date ?? null}::date           ELSE end_date      END
      WHERE id = ${id}
      RETURNING
        id, player_id, team_id, season_id,
        jersey_number, is_prospect, position, acquisition_type,
        start_date::text AS start_date,
        end_date::text   AS end_date
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Stint not found' });
    if (photoInBody) {
      const photoTeamId = teamInBody ? team_id : rows[0].team_id;
      const photoSeasonId = seasonInBody ? season_id : rows[0].season_id;
      if (photo) {
        await sql`
          INSERT INTO player_photos (player_id, team_id, season_id, photo)
          VALUES (${rows[0].player_id}, ${photoTeamId}, ${photoSeasonId}, ${photo})
          ON CONFLICT (player_id, team_id, season_id)
          DO UPDATE SET photo = EXCLUDED.photo, created_at = NOW()
        `;
      } else {
        await sql`
          DELETE FROM player_photos
          WHERE player_id = ${rows[0].player_id} AND team_id = ${photoTeamId} AND season_id = ${photoSeasonId}
        `;
      }
    }
    rows[0].photo = photoInBody ? (photo ?? null) : null;
    return res.json(rows[0]);
  } catch (err) {
    console.error('player-teams patch/:id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/player-teams/:id
// Removes a player's association with a team for that season.
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const stintRows = (await sql`
      SELECT id, player_id, team_id
      FROM player_team_stints
      WHERE id = ${id}
    `) ?? [];
    if (stintRows.length > 0) {
      const hasStats = await playerHasStatsForTeam(stintRows[0].player_id, stintRows[0].team_id);
      if (hasStats) {
        return res.status(409).json({
          error: 'Cannot delete team stint while player has stats for this team.',
        });
      }
      // Career stints are not FK-linked to season roster rows, so remove any
      // roster remnants for the same player/team once the no-stats guard passes.
      await sql`
        WITH target AS (
          SELECT ${stintRows[0].player_id}::uuid AS player_id, ${stintRows[0].team_id}::uuid AS team_id
        ),
        deleted_roster_rows AS (
          DELETE FROM player_teams pt
          USING target
          WHERE pt.player_id = target.player_id
            AND pt.team_id = target.team_id
          RETURNING pt.id
        )
        DELETE FROM player_team_stints
        WHERE id = ${id}
      `;
      return res.json({ message: 'Stint deleted' });
    }

    const rows = await sql`
      SELECT id, player_id, team_id
      FROM player_teams
      WHERE id = ${id}
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Stint not found' });

    const hasStats = await playerHasStatsForTeam(rows[0].player_id, rows[0].team_id);
    if (hasStats) {
      return res.status(409).json({
        error: 'Cannot delete team stint while player has stats for this team.',
      });
    }
    await sql`
      DELETE FROM player_teams
      WHERE id = ${id}
    `;
    return res.json({ message: 'Player removed from team' });
  } catch (err) {
    console.error('player-teams delete/:id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/player-teams/bulk-trade
// Body: { players: [{ player_id, jersey_number?, position? }], season_id, to_team_id, trade_date, acquisition_type? }
// Closes each player's current active stint and opens a new one on to_team_id.
// Returns { traded: [...], failed: [player_ids that had no active stint] }
// ---------------------------------------------------------------------------
router.post('/bulk-trade', async (req, res) => {
  const { players, season_id, to_team_id, trade_date } = req.body;
  const acquisition_type =
    'acquisition_type' in req.body ? normalizeAcquisitionType(req.body.acquisition_type) : 'trade';

  if (!Array.isArray(players) || players.length === 0)
    return res.status(400).json({ error: 'players must be a non-empty array' });
  if (!season_id)  return res.status(400).json({ error: 'season_id is required' });
  if (!to_team_id) return res.status(400).json({ error: 'to_team_id is required' });
  if (!trade_date) return res.status(400).json({ error: 'trade_date is required' });
  if (!isValidAcquisitionType(acquisition_type)) return res.status(400).json({ error: 'Invalid acquisition_type' });

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

      await closeActiveCareerStints(player_id, trade_date);

      // Open new stint on the destination team
      const created = await sql`
        INSERT INTO player_teams (player_id, team_id, season_id, start_date, jersey_number, position, acquisition_type)
        VALUES (${player_id}, ${to_team_id}, ${season_id}, ${trade_date}, ${jersey_number}, ${position}, ${acquisition_type})
        RETURNING id, player_id, team_id, season_id, jersey_number, position, acquisition_type,
                  start_date::text AS start_date, end_date::text AS end_date
      `;
      await upsertCareerStint({
        player_id,
        team_id: to_team_id,
        position,
        acquisition_type,
        start_date: trade_date,
      });
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
// Body: { player_id, season_id, to_team_id, trade_date, jersey_number?, position?, acquisition_type? }
// Closes the player's current stint (sets end_date) and opens a new one on
// to_team_id starting on trade_date.
// ---------------------------------------------------------------------------
router.post('/trade', async (req, res) => {
  const { player_id, season_id, to_team_id, trade_date, jersey_number = null, position = null } = req.body;
  const acquisition_type =
    'acquisition_type' in req.body ? normalizeAcquisitionType(req.body.acquisition_type) : 'trade';
  if (!player_id)  return res.status(400).json({ error: 'player_id is required' });
  if (!season_id)  return res.status(400).json({ error: 'season_id is required' });
  if (!to_team_id) return res.status(400).json({ error: 'to_team_id is required' });
  if (!trade_date) return res.status(400).json({ error: 'trade_date is required' });
  if (!isValidAcquisitionType(acquisition_type)) return res.status(400).json({ error: 'Invalid acquisition_type' });

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

    await closeActiveCareerStints(player_id, trade_date);

    // 2. Open new stint on the destination team
    const created = await sql`
      INSERT INTO player_teams (player_id, team_id, season_id, start_date, jersey_number, position, acquisition_type)
      VALUES (${player_id}, ${to_team_id}, ${season_id}, ${trade_date}, ${jersey_number}, ${position}, ${acquisition_type})
      RETURNING id, player_id, team_id, season_id, jersey_number, position, acquisition_type,
                start_date::text AS start_date, end_date::text AS end_date
    `;
    await upsertCareerStint({
      player_id,
      team_id: to_team_id,
      position,
      acquisition_type,
      start_date: trade_date,
    });
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
