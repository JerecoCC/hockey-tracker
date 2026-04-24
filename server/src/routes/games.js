'use strict';

const router = require('express').Router();
const { requireAdmin } = require('../middleware/auth');
const { sql } = require('../db');

router.use(requireAdmin);

// Resolves current team identity (name, code, logo) from team_iterations.
// Prefers the base iteration (season_id IS NULL) over season-specific ones.
const TEAM_IDENTITY = (alias, teamCol) => `
  LEFT JOIN LATERAL (
    SELECT name, code, logo FROM team_iterations
    WHERE team_id = ${teamCol}
    ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
    LIMIT 1
  ) ${alias} ON true
`;

// ---------------------------------------------------------------------------
// GET /api/admin/games
// Query params: season_id, team_id (home OR away), game_type, status
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const { season_id, team_id, game_type, status } = req.query;
  try {
    const games = await sql`
      SELECT
        g.id, g.season_id, g.game_type, g.status,
        g.scheduled_at, g.venue,
        g.home_score, g.away_score,
        g.home_score_reg, g.away_score_reg,
        g.overtime_periods, g.shootout,
        g.game_number, g.game_number_in_series,
        g.playoff_series_id, g.notes, g.current_period, g.created_at,
        g.p1_home_goals, g.p1_away_goals,
        g.p2_home_goals, g.p2_away_goals,
        g.p3_home_goals, g.p3_away_goals,
        -- Home team
        g.home_team_id,
        ht.name  AS home_team_name,
        ht.code  AS home_team_code,
        ht.logo  AS home_team_logo,
        t_home.primary_color AS home_team_primary_color,
        t_home.text_color    AS home_team_text_color,
        -- Away team
        g.away_team_id,
        at.name  AS away_team_name,
        at.code  AS away_team_code,
        at.logo  AS away_team_logo,
        t_away.primary_color AS away_team_primary_color,
        t_away.text_color    AS away_team_text_color
      FROM games g
      JOIN teams t_home ON t_home.id = g.home_team_id
      JOIN teams t_away ON t_away.id = g.away_team_id
      LEFT JOIN LATERAL (
        SELECT name, code, logo FROM team_iterations
        WHERE team_id = g.home_team_id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) ht ON true
      LEFT JOIN LATERAL (
        SELECT name, code, logo FROM team_iterations
        WHERE team_id = g.away_team_id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) at ON true
      WHERE
        (${season_id ?? null}::uuid IS NULL OR g.season_id    = ${season_id ?? null}::uuid)
        AND (${team_id   ?? null}::uuid IS NULL OR g.home_team_id = ${team_id ?? null}::uuid
                                                OR g.away_team_id = ${team_id ?? null}::uuid)
        AND (${game_type ?? null}::text IS NULL OR g.game_type   = ${game_type ?? null})
        AND (${status    ?? null}::text IS NULL OR g.status      = ${status    ?? null})
      ORDER BY g.scheduled_at ASC NULLS LAST, g.created_at ASC
    `;
    return res.json(games);
  } catch (err) {
    console.error('games list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/games/:id  – single game with period breakdown
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`
      SELECT
        g.id, g.season_id, g.game_type, g.status,
        g.scheduled_at, g.venue,
        g.home_score, g.away_score,
        g.home_score_reg, g.away_score_reg,
        g.overtime_periods, g.shootout,
        g.game_number, g.game_number_in_series,
        g.playoff_series_id, g.notes, g.current_period, g.created_at,
        g.p1_home_goals, g.p1_away_goals,
        g.p2_home_goals, g.p2_away_goals,
        g.p3_home_goals, g.p3_away_goals,
        g.home_team_id,
        ht.name AS home_team_name, ht.code AS home_team_code, ht.logo AS home_team_logo,
        t_home.primary_color AS home_team_primary_color,
        t_home.text_color    AS home_team_text_color,
        g.away_team_id,
        at.name AS away_team_name, at.code AS away_team_code, at.logo AS away_team_logo,
        t_away.primary_color AS away_team_primary_color,
        t_away.text_color    AS away_team_text_color,
        s.name AS season_name,
        l.id   AS league_id,
        l.name AS league_name
      FROM games g
      JOIN seasons s ON s.id = g.season_id
      JOIN leagues l ON l.id = s.league_id
      JOIN teams t_home ON t_home.id = g.home_team_id
      JOIN teams t_away ON t_away.id = g.away_team_id
      LEFT JOIN LATERAL (
        SELECT name, code, logo FROM team_iterations
        WHERE team_id = g.home_team_id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) ht ON true
      LEFT JOIN LATERAL (
        SELECT name, code, logo FROM team_iterations
        WHERE team_id = g.away_team_id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) at ON true
      WHERE g.id = ${id}
    `;

    if (rows.length === 0) return res.status(404).json({ error: 'Game not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('games get error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/games  – create a game
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const {
    season_id, home_team_id, away_team_id,
    scheduled_at = null, venue = null,
    game_type = 'regular', status = 'scheduled',
    home_score = null, away_score = null,
    home_score_reg = null, away_score_reg = null,
    overtime_periods = null, shootout = false,
    playoff_series_id = null, game_number_in_series = null,
    game_number = null, notes = null,
  } = req.body;

  if (!season_id || !home_team_id || !away_team_id) {
    return res.status(400).json({ error: 'season_id, home_team_id, and away_team_id are required' });
  }
  if (home_team_id === away_team_id) {
    return res.status(400).json({ error: 'home_team_id and away_team_id must be different' });
  }

  try {
    const rows = await sql`
      INSERT INTO games (
        season_id, home_team_id, away_team_id,
        scheduled_at, venue, game_type, status,
        home_score, away_score, home_score_reg, away_score_reg,
        overtime_periods, shootout,
        playoff_series_id, game_number_in_series, game_number, notes
      ) VALUES (
        ${season_id}, ${home_team_id}, ${away_team_id},
        ${scheduled_at}, ${venue}, ${game_type}, ${status},
        ${home_score}, ${away_score}, ${home_score_reg}, ${away_score_reg},
        ${overtime_periods}, ${shootout},
        ${playoff_series_id}, ${game_number_in_series}, ${game_number}, ${notes}
      )
      RETURNING id
    `;
    const game = await sql`
      SELECT
        g.id, g.season_id, g.game_type, g.status,
        g.scheduled_at, g.venue,
        g.home_score, g.away_score, g.home_score_reg, g.away_score_reg,
        g.overtime_periods, g.shootout,
        g.game_number, g.game_number_in_series,
        g.playoff_series_id, g.notes, g.current_period, g.created_at,
        g.p1_home_goals, g.p1_away_goals,
        g.p2_home_goals, g.p2_away_goals,
        g.p3_home_goals, g.p3_away_goals,
        g.home_team_id,
        ht.name AS home_team_name, ht.code AS home_team_code, ht.logo AS home_team_logo,
        t_home.primary_color AS home_team_primary_color,
        t_home.text_color    AS home_team_text_color,
        g.away_team_id,
        at.name AS away_team_name, at.code AS away_team_code, at.logo AS away_team_logo,
        t_away.primary_color AS away_team_primary_color,
        t_away.text_color    AS away_team_text_color
      FROM games g
      JOIN teams t_home ON t_home.id = g.home_team_id
      JOIN teams t_away ON t_away.id = g.away_team_id
      LEFT JOIN LATERAL (
        SELECT name, code, logo FROM team_iterations
        WHERE team_id = g.home_team_id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) ht ON true
      LEFT JOIN LATERAL (
        SELECT name, code, logo FROM team_iterations
        WHERE team_id = g.away_team_id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) at ON true
      WHERE g.id = ${rows[0].id}
    `;
    return res.status(201).json(game[0]);
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'Invalid season_id or team_id' });
    if (err.code === '23514') return res.status(400).json({ error: 'Invalid game_type or status value' });
    console.error('games create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/games/:id  – update a game
// ---------------------------------------------------------------------------
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    scheduled_at, venue, game_type, status,
    home_score, away_score, home_score_reg, away_score_reg,
    overtime_periods, shootout,
    playoff_series_id, game_number_in_series, game_number, notes,
    current_period,
    p1_home_goals, p1_away_goals,
    p2_home_goals, p2_away_goals,
    p3_home_goals, p3_away_goals,
  } = req.body;

  // Automatically set current_period to '1' when a game is started
  const effectivePeriod = status === 'in_progress' && current_period === undefined
    ? '1'
    : (current_period ?? null);

  try {
    const existing = await sql`SELECT id FROM games WHERE id = ${id}`;
    if (existing.length === 0) return res.status(404).json({ error: 'Game not found' });

    await sql`
      UPDATE games SET
        scheduled_at          = COALESCE(${scheduled_at          ?? null}, scheduled_at),
        venue                 = COALESCE(${venue                 ?? null}, venue),
        game_type             = COALESCE(${game_type             ?? null}, game_type),
        status                = COALESCE(${status                ?? null}, status),
        home_score            = COALESCE(${home_score            ?? null}, home_score),
        away_score            = COALESCE(${away_score            ?? null}, away_score),
        home_score_reg        = COALESCE(${home_score_reg        ?? null}, home_score_reg),
        away_score_reg        = COALESCE(${away_score_reg        ?? null}, away_score_reg),
        overtime_periods      = COALESCE(${overtime_periods      ?? null}, overtime_periods),
        shootout              = COALESCE(${shootout              ?? null}, shootout),
        playoff_series_id     = COALESCE(${playoff_series_id     ?? null}, playoff_series_id),
        game_number_in_series = COALESCE(${game_number_in_series ?? null}, game_number_in_series),
        game_number           = COALESCE(${game_number           ?? null}, game_number),
        notes                 = COALESCE(${notes                 ?? null}, notes),
        current_period        = COALESCE(${effectivePeriod},             current_period),
        p1_home_goals         = COALESCE(${p1_home_goals         ?? null}, p1_home_goals),
        p1_away_goals         = COALESCE(${p1_away_goals         ?? null}, p1_away_goals),
        p2_home_goals         = COALESCE(${p2_home_goals         ?? null}, p2_home_goals),
        p2_away_goals         = COALESCE(${p2_away_goals         ?? null}, p2_away_goals),
        p3_home_goals         = COALESCE(${p3_home_goals         ?? null}, p3_home_goals),
        p3_away_goals         = COALESCE(${p3_away_goals         ?? null}, p3_away_goals)
      WHERE id = ${id}
    `;
    const updated = await sql`
      SELECT
        g.id, g.season_id, g.game_type, g.status,
        g.scheduled_at, g.venue,
        g.home_score, g.away_score, g.home_score_reg, g.away_score_reg,
        g.overtime_periods, g.shootout,
        g.game_number, g.game_number_in_series,
        g.playoff_series_id, g.notes, g.current_period, g.created_at,
        g.p1_home_goals, g.p1_away_goals,
        g.p2_home_goals, g.p2_away_goals,
        g.p3_home_goals, g.p3_away_goals,
        g.home_team_id,
        ht.name AS home_team_name, ht.code AS home_team_code, ht.logo AS home_team_logo,
        t_home.primary_color AS home_team_primary_color,
        t_home.text_color    AS home_team_text_color,
        g.away_team_id,
        at.name AS away_team_name, at.code AS away_team_code, at.logo AS away_team_logo,
        t_away.primary_color AS away_team_primary_color,
        t_away.text_color    AS away_team_text_color
      FROM games g
      JOIN teams t_home ON t_home.id = g.home_team_id
      JOIN teams t_away ON t_away.id = g.away_team_id
      LEFT JOIN LATERAL (
        SELECT name, code, logo FROM team_iterations
        WHERE team_id = g.home_team_id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) ht ON true
      LEFT JOIN LATERAL (
        SELECT name, code, logo FROM team_iterations
        WHERE team_id = g.away_team_id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) at ON true
      WHERE g.id = ${id}
    `;
    return res.json(updated[0]);
  } catch (err) {
    if (err.code === '23514') return res.status(400).json({ error: 'Invalid game_type or status value' });
    console.error('games update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/games/:id
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`DELETE FROM games WHERE id = ${id} RETURNING id`;
    if (rows.length === 0) return res.status(404).json({ error: 'Game not found' });
    return res.status(204).send();
  } catch (err) {
    console.error('games delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/games/:id/lineup  – get starting lineup for both teams
// ---------------------------------------------------------------------------
router.get('/:id/lineup', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`
      SELECT
        gl.id,
        gl.game_id,
        gl.team_id,
        gl.player_id,
        gl.position_slot,
        p.first_name AS player_first_name,
        p.last_name  AS player_last_name,
        p.photo      AS player_photo,
        pt.jersey_number
      FROM game_lineups gl
      JOIN players p ON p.id = gl.player_id
      LEFT JOIN player_teams pt
        ON pt.player_id = gl.player_id
        AND pt.team_id  = gl.team_id
        AND pt.end_date IS NULL
      WHERE gl.game_id = ${id}
    `;
    return res.json(rows);
  } catch (err) {
    console.error('lineup get error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/games/:id/lineup  – upsert starting lineup for one team
// Body: { team_id, slots: [{ position_slot, player_id }] }
// player_id null/empty clears the slot.
// ---------------------------------------------------------------------------
router.put('/:id/lineup', async (req, res) => {
  const { id } = req.params;
  const { team_id, slots } = req.body;
  if (!team_id) return res.status(400).json({ error: 'team_id is required' });
  if (!Array.isArray(slots)) return res.status(400).json({ error: 'slots must be an array' });

  try {
    for (const { position_slot, player_id } of slots) {
      if (player_id) {
        await sql`
          INSERT INTO game_lineups (game_id, team_id, player_id, position_slot)
          VALUES (${id}, ${team_id}, ${player_id}, ${position_slot})
          ON CONFLICT (game_id, team_id, position_slot)
          DO UPDATE SET player_id = EXCLUDED.player_id
        `;
      } else {
        await sql`
          DELETE FROM game_lineups
          WHERE game_id = ${id} AND team_id = ${team_id} AND position_slot = ${position_slot}
        `;
      }
    }
    const rows = await sql`
      SELECT
        gl.id, gl.game_id, gl.team_id, gl.player_id, gl.position_slot,
        p.first_name AS player_first_name, p.last_name AS player_last_name,
        p.photo AS player_photo, pt.jersey_number
      FROM game_lineups gl
      JOIN players p ON p.id = gl.player_id
      LEFT JOIN player_teams pt
        ON pt.player_id = gl.player_id AND pt.team_id = gl.team_id AND pt.end_date IS NULL
      WHERE gl.game_id = ${id} AND gl.team_id = ${team_id}
    `;
    return res.json(rows);
  } catch (err) {
    console.error('lineup put error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/games/:id/lineup/:entryId  – remove one lineup entry
// ---------------------------------------------------------------------------
router.delete('/:id/lineup/:entryId', async (req, res) => {
  const { id, entryId } = req.params;
  try {
    const rows = await sql`
      DELETE FROM game_lineups WHERE id = ${entryId} AND game_id = ${id} RETURNING id
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Lineup entry not found' });
    return res.status(204).send();
  } catch (err) {
    console.error('lineup delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/games/:id/roster  – get game-day roster for both teams
// ---------------------------------------------------------------------------
router.get('/:id/roster', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`
      SELECT
        gr.id,
        gr.game_id,
        gr.team_id,
        gr.player_id,
        p.first_name,
        p.last_name,
        p.photo,
        p.position,
        pt.jersey_number
      FROM game_rosters gr
      JOIN players p ON p.id = gr.player_id
      LEFT JOIN player_teams pt
        ON pt.player_id = gr.player_id
        AND pt.team_id  = gr.team_id
        AND pt.end_date IS NULL
      WHERE gr.game_id = ${id}
      ORDER BY pt.jersey_number ASC NULLS LAST, p.last_name ASC
    `;
    return res.json(rows);
  } catch (err) {
    console.error('game roster get error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/games/:id/roster  – add players to game roster
// Body: { team_id, player_ids: string[] }
// ---------------------------------------------------------------------------
router.post('/:id/roster', async (req, res) => {
  const { id } = req.params;
  const { team_id, player_ids } = req.body;
  if (!team_id) return res.status(400).json({ error: 'team_id is required' });
  if (!Array.isArray(player_ids) || player_ids.length === 0) {
    return res.status(400).json({ error: 'player_ids must be a non-empty array' });
  }
  try {
    for (const player_id of player_ids) {
      await sql`
        INSERT INTO game_rosters (game_id, team_id, player_id)
        VALUES (${id}, ${team_id}, ${player_id})
        ON CONFLICT (game_id, team_id, player_id) DO NOTHING
      `;
    }
    const rows = await sql`
      SELECT
        gr.id, gr.game_id, gr.team_id, gr.player_id,
        p.first_name, p.last_name, p.photo, p.position,
        pt.jersey_number
      FROM game_rosters gr
      JOIN players p ON p.id = gr.player_id
      LEFT JOIN player_teams pt
        ON pt.player_id = gr.player_id
        AND pt.team_id  = gr.team_id
        AND pt.end_date IS NULL
      WHERE gr.game_id = ${id} AND gr.team_id = ${team_id}
      ORDER BY pt.jersey_number ASC NULLS LAST, p.last_name ASC
    `;
    return res.status(201).json(rows);
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'Invalid game_id, team_id, or player_id' });
    console.error('game roster post error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/games/:id/roster/:rosterId  – remove one player from roster
// ---------------------------------------------------------------------------
router.delete('/:id/roster/:rosterId', async (req, res) => {
  const { id, rosterId } = req.params;
  try {
    const rows = await sql`
      DELETE FROM game_rosters WHERE id = ${rosterId} AND game_id = ${id} RETURNING id
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Roster entry not found' });
    return res.status(204).send();
  } catch (err) {
    console.error('game roster delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/games/playoff-series  – list series (filter by season_id)
// ---------------------------------------------------------------------------
router.get('/playoff-series', async (req, res) => {
  const { season_id } = req.query;
  try {
    const series = await sql`
      SELECT
        ps.id, ps.season_id, ps.round, ps.series_letter,
        ps.home_team_id, ps.away_team_id,
        ps.games_to_win, ps.home_wins, ps.away_wins,
        ps.status, ps.winner_team_id, ps.created_at,
        ht.name AS home_team_name, ht.code AS home_team_code, ht.logo AS home_team_logo,
        at.name AS away_team_name, at.code AS away_team_code, at.logo AS away_team_logo
      FROM playoff_series ps
      LEFT JOIN LATERAL (
        SELECT name, code, logo FROM team_iterations
        WHERE team_id = ps.home_team_id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) ht ON true
      LEFT JOIN LATERAL (
        SELECT name, code, logo FROM team_iterations
        WHERE team_id = ps.away_team_id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) at ON true
      WHERE (${season_id ?? null}::uuid IS NULL OR ps.season_id = ${season_id ?? null}::uuid)
      ORDER BY ps.round ASC, ps.series_letter ASC NULLS LAST, ps.created_at ASC
    `;
    return res.json(series);
  } catch (err) {
    console.error('playoff series list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/games/playoff-series  – create a playoff series
// ---------------------------------------------------------------------------
router.post('/playoff-series', async (req, res) => {
  const {
    season_id, round, series_letter = null,
    home_team_id, away_team_id,
    games_to_win = 4, status = 'upcoming',
  } = req.body;

  if (!season_id || !home_team_id || !away_team_id || !round) {
    return res.status(400).json({ error: 'season_id, home_team_id, away_team_id, and round are required' });
  }
  if (home_team_id === away_team_id) {
    return res.status(400).json({ error: 'home_team_id and away_team_id must be different' });
  }

  try {
    const rows = await sql`
      INSERT INTO playoff_series (season_id, round, series_letter, home_team_id, away_team_id, games_to_win, status)
      VALUES (${season_id}, ${round}, ${series_letter}, ${home_team_id}, ${away_team_id}, ${games_to_win}, ${status})
      RETURNING id, season_id, round, series_letter, home_team_id, away_team_id,
                games_to_win, home_wins, away_wins, status, winner_team_id, created_at
    `;
    return res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'Invalid season_id or team_id' });
    console.error('playoff series create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/games/playoff-series/:seriesId  – update a playoff series
// ---------------------------------------------------------------------------
router.patch('/playoff-series/:seriesId', async (req, res) => {
  const { seriesId } = req.params;
  const { home_wins, away_wins, status, winner_team_id, series_letter, games_to_win } = req.body;

  try {
    const rows = await sql`
      UPDATE playoff_series SET
        home_wins      = COALESCE(${home_wins      ?? null}, home_wins),
        away_wins      = COALESCE(${away_wins      ?? null}, away_wins),
        status         = COALESCE(${status         ?? null}, status),
        winner_team_id = COALESCE(${winner_team_id ?? null}, winner_team_id),
        series_letter  = COALESCE(${series_letter  ?? null}, series_letter),
        games_to_win   = COALESCE(${games_to_win   ?? null}, games_to_win)
      WHERE id = ${seriesId}
      RETURNING id, season_id, round, series_letter, home_team_id, away_team_id,
                games_to_win, home_wins, away_wins, status, winner_team_id, created_at
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Playoff series not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('playoff series update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

