const router = require('express').Router();
const { and, desc, eq, sql: ormSql } = require('drizzle-orm');
const { requireAdmin } = require('../middleware/auth');
const { sql, db, schema } = require('../db');

router.use(requireAdmin);

const { playerTeams, teams } = schema;

const ACQUISITION_TYPES = new Set(['draft', 'trade', 'free_agency', 'waivers', 'signing', 'call_up', 'loan', 'other']);
const normalizeAcquisitionType = (value) => (value === '' || value == null ? null : value);
const isValidAcquisitionType = (value) => value == null || ACQUISITION_TYPES.has(value);
const hasPlayerTeamsAcquisitionType = async () => {
  const [row] = await sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'player_teams'
        AND column_name = 'acquisition_type'
    ) AS exists
  `;
  return !!row?.exists;
};

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
// Body: { player_id, team_id, season_id, jersey_number?, photo?, position?, acquisition_type?, start_date?, end_date? }
// Creates a new stint row directly. Returns 409 if the unique active-stint index fires
// (i.e. the player already has an open stint in this season and end_date is omitted).
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const { player_id, team_id, season_id, jersey_number, photo, position, start_date, end_date } = req.body;
  const acquisition_type = normalizeAcquisitionType(req.body.acquisition_type);
  if (!player_id) return res.status(400).json({ error: 'player_id is required' });
  if (!team_id)   return res.status(400).json({ error: 'team_id is required' });
  if (!season_id) return res.status(400).json({ error: 'season_id is required' });
  if (!isValidAcquisitionType(acquisition_type)) return res.status(400).json({ error: 'Invalid acquisition_type' });

  try {
    const rows = await sql`
      INSERT INTO player_teams
        (player_id, team_id, season_id, jersey_number, position, acquisition_type, start_date, end_date)
      VALUES (
        ${player_id}, ${team_id}, ${season_id},
        ${jersey_number ?? null},
        ${position ?? null},
        ${acquisition_type},
        ${start_date ?? null}::date,
        ${end_date   ?? null}::date
      )
      RETURNING id, player_id, team_id, season_id, jersey_number, position, acquisition_type,
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
        position      = CASE WHEN ${positionInBody}  THEN ${position ?? null}      ELSE position      END
      WHERE player_id = ${player_id}
        AND team_id   = ${team_id}
        AND season_id = ${season_id}
        AND end_date IS NULL
      RETURNING id, player_id, team_id, season_id, jersey_number, position
    `;
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
    const hasAcquisitionType = await hasPlayerTeamsAcquisitionType();
    const teamIterationOrder = ormSql`
      ORDER BY
        CASE
          WHEN (ti.start_date IS NULL OR ti.start_date <= COALESCE(${playerTeams.endDate}, s.end_date, CURRENT_DATE))
           AND (ti.end_date IS NULL OR ti.end_date >= COALESCE(${playerTeams.startDate}, s.start_date, ${playerTeams.createdAt}::date))
          THEN 0
          WHEN ti.end_date IS NULL THEN 1
          ELSE 2
        END,
        ti.start_date DESC NULLS LAST,
        ti.recorded_at DESC
      LIMIT 1
    `;
    const rows = await db
      .select({
        id: playerTeams.id,
        player_id: playerTeams.playerId,
        team_id: playerTeams.teamId,
        season_id: playerTeams.seasonId,
        jersey_number: playerTeams.jerseyNumber,
        photo: ormSql`best_player_photo(${playerTeams.playerId}, ${playerTeams.seasonId}, ${playerTeams.teamId})`,
        position: playerTeams.position,
        acquisition_type: hasAcquisitionType ? playerTeams.acquisitionType : ormSql`NULL::text`,
        start_date: ormSql`${playerTeams.startDate}::text`,
        end_date: ormSql`${playerTeams.endDate}::text`,
        created_at: playerTeams.createdAt,
        team_name: ormSql`(
          SELECT ti.name
          FROM team_iterations ti
          JOIN seasons s ON s.id = ${playerTeams.seasonId}
          WHERE ti.team_id = ${playerTeams.teamId}
          ${teamIterationOrder}
        )`,
        team_code: ormSql`(
          SELECT ti.code
          FROM team_iterations ti
          JOIN seasons s ON s.id = ${playerTeams.seasonId}
          WHERE ti.team_id = ${playerTeams.teamId}
          ${teamIterationOrder}
        )`,
        team_logo: ormSql`(
          SELECT ti.logo
          FROM team_iterations ti
          JOIN seasons s ON s.id = ${playerTeams.seasonId}
          WHERE ti.team_id = ${playerTeams.teamId}
          ${teamIterationOrder}
        )`,
        primary_color: teams.primaryColor,
        text_color: teams.textColor,
      })
      .from(playerTeams)
      .innerJoin(teams, eq(teams.id, playerTeams.teamId))
      .where(and(
        eq(playerTeams.playerId, playerId),
        season_id ? eq(playerTeams.seasonId, season_id) : undefined,
      ))
      .orderBy(
        desc(playerTeams.endDate),
        ormSql`COALESCE(${playerTeams.startDate}, ${playerTeams.createdAt}::date) DESC`,
        desc(playerTeams.createdAt),
      );
    return res.json(rows.map((row) => ({
      id: row.id,
      player_id: row.player_id,
      team_id: row.team_id,
      season_id: row.season_id,
      jersey_number: row.jersey_number,
      photo: row.photo,
      position: row.position,
      acquisition_type: row.acquisition_type,
      start_date: row.start_date,
      end_date: row.end_date,
      created_at: row.created_at,
      team: {
        id: row.team_id,
        name: row.team_name,
        code: row.team_code,
        logo: row.team_logo,
        primary_color: row.primary_color,
        text_color: row.text_color,
      },
    })));
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
// GET /api/admin/player-teams/history/:playerId/photos
// Returns player photo rows, independent from player_teams stints.
// ---------------------------------------------------------------------------
router.get('/history/:playerId/photos', async (req, res) => {
  const { playerId } = req.params;
  try {
    const rows = await sql`
      SELECT
        pp.id,
        pp.player_id,
        pp.team_id,
        pp.season_id,
        pp.photo,
        pp.created_at,
        s.name AS season_name,
        ti.name AS team_name
      FROM player_photos pp
      JOIN seasons s ON s.id = pp.season_id
      LEFT JOIN LATERAL (
        SELECT name FROM team_iterations
        WHERE team_id = pp.team_id
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
      WHERE pp.player_id = ${playerId}
      ORDER BY s.start_date DESC NULLS LAST, pp.created_at DESC
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
  const photoInBody     = 'photo'         in req.body;
  const positionInBody  = 'position'      in req.body;
  const acquisitionInBody = 'acquisition_type' in req.body;
  const startDateInBody = 'start_date'    in req.body;
  const endDateInBody   = 'end_date'      in req.body;
  if (!isValidAcquisitionType(acquisition_type)) return res.status(400).json({ error: 'Invalid acquisition_type' });

  try {
    const rows = await sql`
      UPDATE player_teams
      SET
        team_id       = CASE WHEN ${teamInBody}      THEN ${team_id}::uuid                   ELSE team_id       END,
        season_id     = CASE WHEN ${seasonInBody}    THEN ${season_id}::uuid                 ELSE season_id     END,
        jersey_number = CASE WHEN ${jerseyInBody}    THEN ${jersey_number ?? null}            ELSE jersey_number END,
        position      = CASE WHEN ${positionInBody}  THEN ${position ?? null}                 ELSE position      END,
        acquisition_type = CASE WHEN ${acquisitionInBody} THEN ${acquisition_type}             ELSE acquisition_type END,
        start_date    = CASE WHEN ${startDateInBody} THEN ${start_date ?? null}::date         ELSE start_date    END,
        end_date      = CASE WHEN ${endDateInBody}   THEN ${end_date ?? null}::date           ELSE end_date      END
      WHERE id = ${id}
      RETURNING
        id, player_id, team_id, season_id,
        jersey_number, position, acquisition_type,
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
// POST /api/admin/player-teams/bulk-trade
// Body: { players: [{ player_id, jersey_number?, position? }], season_id, to_team_id, trade_date, acquisition_type? }
// Closes each player's current active stint and opens a new one on to_team_id.
// Returns { traded: [...], failed: [player_ids that had no active stint] }
// ---------------------------------------------------------------------------
router.post('/bulk-trade', async (req, res) => {
  const { players, season_id, to_team_id, trade_date } = req.body;
  const acquisition_type = normalizeAcquisitionType(req.body.acquisition_type) ?? 'trade';

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

      // Open new stint on the destination team
      const created = await sql`
        INSERT INTO player_teams (player_id, team_id, season_id, start_date, jersey_number, position, acquisition_type)
        VALUES (${player_id}, ${to_team_id}, ${season_id}, ${trade_date}, ${jersey_number}, ${position}, ${acquisition_type})
        RETURNING id, player_id, team_id, season_id, jersey_number, position, acquisition_type,
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
// Body: { player_id, season_id, to_team_id, trade_date, jersey_number?, position?, acquisition_type? }
// Closes the player's current stint (sets end_date) and opens a new one on
// to_team_id starting on trade_date.
// ---------------------------------------------------------------------------
router.post('/trade', async (req, res) => {
  const { player_id, season_id, to_team_id, trade_date, jersey_number = null, position = null } = req.body;
  const acquisition_type = normalizeAcquisitionType(req.body.acquisition_type) ?? 'trade';
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

    // 2. Open new stint on the destination team
    const created = await sql`
      INSERT INTO player_teams (player_id, team_id, season_id, start_date, jersey_number, position, acquisition_type)
      VALUES (${player_id}, ${to_team_id}, ${season_id}, ${trade_date}, ${jersey_number}, ${position}, ${acquisition_type})
      RETURNING id, player_id, team_id, season_id, jersey_number, position, acquisition_type,
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
