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
        g.scheduled_at, g.scheduled_time, g.venue,
        g.overtime_periods, g.shootout,
        g.playoff_series_id, g.notes, g.current_period, g.created_at,
        g.star_1_id, g.star_2_id, g.star_3_id,
        gs.period_scores,
        g.period_shots,
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
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          json_agg(
            json_build_object('period', period, 'home_goals', home_cnt, 'away_goals', away_cnt)
            ORDER BY CASE period WHEN '1' THEN 1 WHEN '2' THEN 2 WHEN '3' THEN 3 WHEN 'OT' THEN 4 WHEN 'SO' THEN 5 ELSE 6 END
          ),
          '[]'::json
        ) AS period_scores
        FROM (
          SELECT
            go.period,
            COUNT(*) FILTER (WHERE go.team_id = g.home_team_id) AS home_cnt,
            COUNT(*) FILTER (WHERE go.team_id = g.away_team_id) AS away_cnt
          FROM goals go
          WHERE go.game_id = g.id
          GROUP BY go.period
        ) ps
      ) gs ON true
      WHERE
        (${season_id ?? null}::uuid IS NULL OR g.season_id    = ${season_id ?? null}::uuid)
        AND (${team_id   ?? null}::uuid IS NULL OR g.home_team_id = ${team_id ?? null}::uuid
                                                OR g.away_team_id = ${team_id ?? null}::uuid)
        AND (${game_type ?? null}::text IS NULL OR g.game_type   = ${game_type ?? null})
        AND (${status    ?? null}::text IS NULL OR g.status      = ${status    ?? null})
      ORDER BY g.scheduled_at DESC NULLS LAST, g.scheduled_time DESC NULLS LAST, g.created_at DESC
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
        g.scheduled_at, g.scheduled_time, g.venue,
        g.time_start, g.time_end,
        g.overtime_periods, g.shootout, g.shootout_first_team_id,
        g.playoff_series_id, g.notes, g.current_period, g.created_at,
        g.star_1_id, g.star_2_id, g.star_3_id,
        gs.period_scores,
        g.period_shots,
        g.home_team_id,
        ht.name AS home_team_name, ht.code AS home_team_code, ht.logo AS home_team_logo,
        t_home.primary_color   AS home_team_primary_color,
        t_home.secondary_color AS home_team_secondary_color,
        t_home.text_color      AS home_team_text_color,
        g.away_team_id,
        at.name AS away_team_name, at.code AS away_team_code, at.logo AS away_team_logo,
        t_away.primary_color   AS away_team_primary_color,
        t_away.secondary_color AS away_team_secondary_color,
        t_away.text_color      AS away_team_text_color,
        s.name AS season_name,
        l.id   AS league_id,
        l.name AS league_name,
        l.best_of_shootout,
        home_l5.home_last_five,
        away_l5.away_last_five
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
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          json_agg(
            json_build_object('period', period, 'home_goals', home_cnt, 'away_goals', away_cnt)
            ORDER BY CASE period WHEN '1' THEN 1 WHEN '2' THEN 2 WHEN '3' THEN 3 WHEN 'OT' THEN 4 WHEN 'SO' THEN 5 ELSE 6 END
          ),
          '[]'::json
        ) AS period_scores
        FROM (
          SELECT
            go.period,
            COUNT(*) FILTER (WHERE go.team_id = g.home_team_id) AS home_cnt,
            COUNT(*) FILTER (WHERE go.team_id = g.away_team_id) AS away_cnt
          FROM goals go
          WHERE go.game_id = g.id
          GROUP BY go.period
        ) ps
      ) gs ON true
      -- Last 5 final games for the home team within this season
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          json_agg(
            json_build_object(
              'game_id',          lg.id,
              'scheduled_at',     lg.scheduled_at,
              'home_score',       lg.home_score,
              'away_score',       lg.away_score,
              'overtime_periods', lg.overtime_periods,
              'shootout',         lg.shootout,
              'result', CASE
                WHEN (lg.home_team_id = g.home_team_id AND lg.home_score > lg.away_score)
                  OR (lg.away_team_id = g.home_team_id AND lg.away_score > lg.home_score) THEN 'W'
                WHEN (lg.home_team_id = g.home_team_id AND lg.home_score < lg.away_score)
                  OR (lg.away_team_id = g.home_team_id AND lg.away_score < lg.home_score) THEN 'L'
                ELSE 'T'
              END,
              'opponent_team_id', CASE WHEN lg.home_team_id = g.home_team_id THEN lg.away_team_id ELSE lg.home_team_id END,
              'opponent_name',    opp_ti.name,
              'opponent_code',    opp_ti.code,
              'opponent_logo',    opp_ti.logo,
              'is_home',          (lg.home_team_id = g.home_team_id)
            ) ORDER BY lg.scheduled_at DESC NULLS LAST, lg.created_at DESC
          ),
          '[]'::json
        ) AS home_last_five
        FROM (
          SELECT
            g2.id, g2.scheduled_at, g2.created_at, g2.overtime_periods, g2.shootout,
            g2.home_team_id, g2.away_team_id,
            (SELECT COUNT(*) FROM goals WHERE game_id = g2.id AND team_id = g2.home_team_id)::int AS home_score,
            (SELECT COUNT(*) FROM goals WHERE game_id = g2.id AND team_id = g2.away_team_id)::int AS away_score
          FROM games g2
          WHERE g2.season_id = g.season_id
            AND g2.id != g.id
            AND g2.status = 'final'
            AND (g2.home_team_id = g.home_team_id OR g2.away_team_id = g.home_team_id)
            AND g2.scheduled_at < g.scheduled_at
          ORDER BY g2.scheduled_at DESC NULLS LAST, g2.created_at DESC
          LIMIT 5
        ) lg
        LEFT JOIN LATERAL (
          SELECT name, code, logo FROM team_iterations
          WHERE team_id = CASE WHEN lg.home_team_id = g.home_team_id THEN lg.away_team_id ELSE lg.home_team_id END
          ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
          LIMIT 1
        ) opp_ti ON true
      ) home_l5 ON true
      -- Last 5 final games for the away team within this season
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          json_agg(
            json_build_object(
              'game_id',          lg.id,
              'scheduled_at',     lg.scheduled_at,
              'home_score',       lg.home_score,
              'away_score',       lg.away_score,
              'overtime_periods', lg.overtime_periods,
              'shootout',         lg.shootout,
              'result', CASE
                WHEN (lg.home_team_id = g.away_team_id AND lg.home_score > lg.away_score)
                  OR (lg.away_team_id = g.away_team_id AND lg.away_score > lg.home_score) THEN 'W'
                WHEN (lg.home_team_id = g.away_team_id AND lg.home_score < lg.away_score)
                  OR (lg.away_team_id = g.away_team_id AND lg.away_score < lg.home_score) THEN 'L'
                ELSE 'T'
              END,
              'opponent_team_id', CASE WHEN lg.home_team_id = g.away_team_id THEN lg.away_team_id ELSE lg.home_team_id END,
              'opponent_name',    opp_ti.name,
              'opponent_code',    opp_ti.code,
              'opponent_logo',    opp_ti.logo,
              'is_home',          (lg.home_team_id = g.away_team_id)
            ) ORDER BY lg.scheduled_at DESC NULLS LAST, lg.created_at DESC
          ),
          '[]'::json
        ) AS away_last_five
        FROM (
          SELECT
            g2.id, g2.scheduled_at, g2.created_at, g2.overtime_periods, g2.shootout,
            g2.home_team_id, g2.away_team_id,
            (SELECT COUNT(*) FROM goals WHERE game_id = g2.id AND team_id = g2.home_team_id)::int AS home_score,
            (SELECT COUNT(*) FROM goals WHERE game_id = g2.id AND team_id = g2.away_team_id)::int AS away_score
          FROM games g2
          WHERE g2.season_id = g.season_id
            AND g2.id != g.id
            AND g2.status = 'final'
            AND (g2.home_team_id = g.away_team_id OR g2.away_team_id = g.away_team_id)
            AND g2.scheduled_at < g.scheduled_at
          ORDER BY g2.scheduled_at DESC NULLS LAST, g2.created_at DESC
          LIMIT 5
        ) lg
        LEFT JOIN LATERAL (
          SELECT name, code, logo FROM team_iterations
          WHERE team_id = CASE WHEN lg.home_team_id = g.away_team_id THEN lg.away_team_id ELSE lg.home_team_id END
          ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
          LIMIT 1
        ) opp_ti ON true
      ) away_l5 ON true
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
    scheduled_at = null, scheduled_time = null, venue = null,
    game_type = 'regular', status = 'scheduled',
    overtime_periods = null, shootout = false,
    playoff_series_id = null, notes = null,
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
        scheduled_at, scheduled_time, venue, game_type, status,
        overtime_periods, shootout,
        playoff_series_id, notes
      ) VALUES (
        ${season_id}, ${home_team_id}, ${away_team_id},
        ${scheduled_at}, ${scheduled_time}, ${venue}, ${game_type}, ${status},
        ${overtime_periods}, ${shootout},
        ${playoff_series_id}, ${notes}
      )
      RETURNING id
    `;
    const game = await sql`
      SELECT
        g.id, g.season_id, g.game_type, g.status,
        g.scheduled_at, g.scheduled_time, g.venue,
        g.time_start, g.time_end,
        g.overtime_periods, g.shootout,
        g.playoff_series_id, g.notes, g.current_period, g.created_at,
        g.star_1_id, g.star_2_id, g.star_3_id,
        gs.period_scores,
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
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          json_agg(
            json_build_object('period', period, 'home_goals', home_cnt, 'away_goals', away_cnt)
            ORDER BY CASE period WHEN '1' THEN 1 WHEN '2' THEN 2 WHEN '3' THEN 3 WHEN 'OT' THEN 4 WHEN 'SO' THEN 5 ELSE 6 END
          ),
          '[]'::json
        ) AS period_scores
        FROM (
          SELECT
            go.period,
            COUNT(*) FILTER (WHERE go.team_id = g.home_team_id) AS home_cnt,
            COUNT(*) FILTER (WHERE go.team_id = g.away_team_id) AS away_cnt
          FROM goals go
          WHERE go.game_id = g.id
          GROUP BY go.period
        ) ps
      ) gs ON true
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
    scheduled_at, scheduled_time, venue, game_type, status,
    time_start, time_end,
    overtime_periods, shootout,
    playoff_series_id, notes,
    current_period,
    star_1_id, star_2_id, star_3_id,
    shootout_first_team_id,
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
        scheduled_time        = COALESCE(${scheduled_time        ?? null}, scheduled_time),
        venue                 = COALESCE(${venue                 ?? null}, venue),
        game_type             = COALESCE(${game_type             ?? null}, game_type),
        status                = COALESCE(${status                ?? null}, status),
        overtime_periods      = CASE
                                  WHEN ${status ?? null} = 'final' AND ${overtime_periods ?? null}::smallint IS NULL
                                  THEN CASE WHEN current_period IN ('OT', 'SO') THEN 1 ELSE overtime_periods END
                                  ELSE COALESCE(${overtime_periods ?? null}::smallint, overtime_periods)
                                END,
        shootout              = CASE
                                  WHEN ${status ?? null} = 'final' AND ${shootout ?? null}::boolean IS NULL
                                  THEN (current_period = 'SO')
                                  ELSE COALESCE(${shootout ?? null}::boolean, shootout)
                                END,
        playoff_series_id     = COALESCE(${playoff_series_id     ?? null}, playoff_series_id),
        notes                 = COALESCE(${notes                 ?? null}, notes),
        current_period        = COALESCE(${effectivePeriod},             current_period),
        star_1_id             = COALESCE(${star_1_id             ?? null}, star_1_id),
        star_2_id             = COALESCE(${star_2_id             ?? null}, star_2_id),
        star_3_id                = COALESCE(${star_3_id                ?? null}, star_3_id),
        time_start               = COALESCE(${time_start               ?? null}, time_start),
        time_end                 = COALESCE(${time_end                 ?? null}, time_end),
        shootout_first_team_id   = COALESCE(${shootout_first_team_id   ?? null}, shootout_first_team_id)
      WHERE id = ${id}
    `;
    const updated = await sql`
      SELECT
        g.id, g.season_id, g.game_type, g.status,
        g.scheduled_at, g.scheduled_time, g.venue,
        g.time_start, g.time_end,
        g.overtime_periods, g.shootout, g.shootout_first_team_id,
        g.playoff_series_id, g.notes, g.current_period, g.created_at,
        g.star_1_id, g.star_2_id, g.star_3_id,
        gs.period_scores,
        g.period_shots,
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
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          json_agg(
            json_build_object('period', period, 'home_goals', home_cnt, 'away_goals', away_cnt)
            ORDER BY CASE period WHEN '1' THEN 1 WHEN '2' THEN 2 WHEN '3' THEN 3 WHEN 'OT' THEN 4 WHEN 'SO' THEN 5 ELSE 6 END
          ),
          '[]'::json
        ) AS period_scores
        FROM (
          SELECT
            go.period,
            COUNT(*) FILTER (WHERE go.team_id = g.home_team_id) AS home_cnt,
            COUNT(*) FILTER (WHERE go.team_id = g.away_team_id) AS away_cnt
          FROM goals go
          WHERE go.game_id = g.id
          GROUP BY go.period
        ) ps
      ) gs ON true
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
// Falls back to the most-recent finished game's lineup per team when the
// current game has no lineup set yet, tagging those rows inherited:true.
//
// game_starting_lineup stores one row per team with a column per slot.
// CROSS JOIN LATERAL unpivots those 6 columns into one row per filled slot,
// preserving the LineupEntry shape the client expects.
// ---------------------------------------------------------------------------
router.get('/:id/lineup', async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Resolve the game's two team IDs.
    const gameRows = await sql`SELECT home_team_id, away_team_id FROM games WHERE id = ${id}`;
    if (gameRows.length === 0) return res.status(404).json({ error: 'Game not found' });
    const { home_team_id, away_team_id } = gameRows[0];

    // 2a. Determine which teams already have a saved lineup row for this game.
    //     Use row existence — not slot content — so a team whose saved lineup
    //     had players deleted (ON DELETE SET NULL) is still treated as covered
    //     and does not accidentally inherit from a previous game.
    const coveredRows = await sql`
      SELECT team_id FROM game_starting_lineup WHERE game_id = ${id}
    `;
    const teamsCovered = new Set(coveredRows.map((r) => r.team_id));
    const teamsToInherit = [home_team_id, away_team_id].filter((t) => !teamsCovered.has(t));

    // 2b. Fetch and unpivot the saved slots for covered teams.
    const current = await sql`
      SELECT
        sl.id::text || '-' || slot.position_slot AS id,
        sl.game_id,
        sl.team_id,
        slot.player_id,
        slot.position_slot,
        p.first_name  AS player_first_name,
        p.last_name   AS player_last_name,
        COALESCE(pt.photo, p.photo) AS player_photo,
        pt.jersey_number,
        false AS inherited
      FROM game_starting_lineup sl
      CROSS JOIN LATERAL (VALUES
        ('C',  sl.center_id),
        ('LW', sl.left_wing_id),
        ('RW', sl.right_wing_id),
        ('D1', sl.defense_1_id),
        ('D2', sl.defense_2_id),
        ('G',  sl.goalie_id)
      ) AS slot(position_slot, player_id)
      JOIN players p ON p.id = slot.player_id
      LEFT JOIN player_teams pt
        ON pt.player_id = slot.player_id AND pt.team_id = sl.team_id AND pt.end_date IS NULL
      WHERE sl.game_id = ${id}
        AND slot.player_id IS NOT NULL
    `;

    // 4. For each uncovered team, inherit the lineup from their most-recent
    //    finished game that has a saved starting lineup.  We skip games that
    //    were played without ever setting a lineup (no row in
    //    game_starting_lineup), so the chain correctly reaches the last game
    //    where a lineup was actually recorded — even if several consecutive
    //    games in between had no saved lineup.
    const inheritedRows = [];
    for (const teamId of teamsToInherit) {
      const rows = await sql`
        SELECT
          sl.id::text || '-' || slot.position_slot AS id,
          ${id}::uuid AS game_id,
          sl.team_id,
          slot.player_id,
          slot.position_slot,
          p.first_name  AS player_first_name,
          p.last_name   AS player_last_name,
          COALESCE(pt.photo, p.photo) AS player_photo,
          pt.jersey_number,
          true AS inherited
        FROM games g
        JOIN game_starting_lineup sl ON sl.game_id = g.id AND sl.team_id = ${teamId}
        CROSS JOIN LATERAL (VALUES
          ('C',  sl.center_id),
          ('LW', sl.left_wing_id),
          ('RW', sl.right_wing_id),
          ('D1', sl.defense_1_id),
          ('D2', sl.defense_2_id),
          ('G',  sl.goalie_id)
        ) AS slot(position_slot, player_id)
        JOIN players p ON p.id = slot.player_id
        LEFT JOIN player_teams pt
          ON pt.player_id = slot.player_id AND pt.team_id = sl.team_id AND pt.end_date IS NULL
        WHERE (g.home_team_id = ${teamId} OR g.away_team_id = ${teamId})
          AND g.status = 'final'
          AND g.id <> ${id}
          AND slot.player_id IS NOT NULL
        ORDER BY g.scheduled_at DESC NULLS LAST, g.created_at DESC
        LIMIT 6
      `;
      inheritedRows.push(...rows);
    }

    return res.json([...current, ...inheritedRows]);
  } catch (err) {
    console.error('lineup get error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/games/:id/lineup  – upsert starting lineup for one team
// Body: { team_id, slots: [{ position_slot, player_id }] }
// Writes a single row into game_starting_lineup (one row per team per game).
// ---------------------------------------------------------------------------
router.put('/:id/lineup', async (req, res) => {
  const { id } = req.params;
  const { team_id, slots } = req.body;
  if (!team_id) return res.status(400).json({ error: 'team_id is required' });
  if (!Array.isArray(slots)) return res.status(400).json({ error: 'slots must be an array' });

  try {
    // Build a map from position_slot → player_id (null = clear that slot).
    const slotMap = {};
    for (const { position_slot, player_id } of slots) {
      slotMap[position_slot] = player_id || null;
    }

    const centerId    = slotMap['C']  ?? null;
    const leftWingId  = slotMap['LW'] ?? null;
    const rightWingId = slotMap['RW'] ?? null;
    const defense1Id  = slotMap['D1'] ?? null;
    const defense2Id  = slotMap['D2'] ?? null;
    const goalieId    = slotMap['G']  ?? null;

    // Single UPSERT — one row per (game, team).
    await sql`
      INSERT INTO game_starting_lineup
        (game_id, team_id, center_id, left_wing_id, right_wing_id, defense_1_id, defense_2_id, goalie_id)
      VALUES
        (${id}, ${team_id}, ${centerId}, ${leftWingId}, ${rightWingId}, ${defense1Id}, ${defense2Id}, ${goalieId})
      ON CONFLICT (game_id, team_id) DO UPDATE SET
        center_id     = EXCLUDED.center_id,
        left_wing_id  = EXCLUDED.left_wing_id,
        right_wing_id = EXCLUDED.right_wing_id,
        defense_1_id  = EXCLUDED.defense_1_id,
        defense_2_id  = EXCLUDED.defense_2_id,
        goalie_id     = EXCLUDED.goalie_id
    `;

    // Return the saved slots in unpivoted LineupEntry shape.
    const rows = await sql`
      SELECT
        sl.id::text || '-' || slot.position_slot AS id,
        sl.game_id,
        sl.team_id,
        slot.player_id,
        slot.position_slot,
        p.first_name  AS player_first_name,
        p.last_name   AS player_last_name,
        COALESCE(pt.photo, p.photo) AS player_photo,
        pt.jersey_number
      FROM game_starting_lineup sl
      CROSS JOIN LATERAL (VALUES
        ('C',  sl.center_id),
        ('LW', sl.left_wing_id),
        ('RW', sl.right_wing_id),
        ('D1', sl.defense_1_id),
        ('D2', sl.defense_2_id),
        ('G',  sl.goalie_id)
      ) AS slot(position_slot, player_id)
      JOIN players p ON p.id = slot.player_id
      LEFT JOIN player_teams pt
        ON pt.player_id = slot.player_id AND pt.team_id = sl.team_id AND pt.end_date IS NULL
      WHERE sl.game_id = ${id}
        AND sl.team_id = ${team_id}
        AND slot.player_id IS NOT NULL
    `;
    return res.json(rows);
  } catch (err) {
    console.error('lineup put error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/games/:id/lineup/:teamId  – clear a team's starting lineup
// Removes the single game_starting_lineup row for this (game, team) pair.
// ---------------------------------------------------------------------------
router.delete('/:id/lineup/:teamId', async (req, res) => {
  const { id, teamId } = req.params;
  try {
    const rows = await sql`
      DELETE FROM game_starting_lineup
      WHERE game_id = ${id} AND team_id = ${teamId}
      RETURNING id
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Lineup not found' });
    return res.status(204).send();
  } catch (err) {
    console.error('lineup delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/games/:id/roster  – get game-day roster for both teams
// Falls back to the most-recent finished game's roster per team (home OR away)
// when the current game has no roster entries yet, tagging those rows inherited:true.
// ---------------------------------------------------------------------------
router.get('/:id/roster', async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Resolve the game's two team IDs.
    const gameRows = await sql`SELECT home_team_id, away_team_id FROM games WHERE id = ${id}`;
    if (gameRows.length === 0) return res.status(404).json({ error: 'Game not found' });
    const { home_team_id, away_team_id } = gameRows[0];

    // 2. Fetch any existing roster entries for this game.
    const current = await sql`
      SELECT
        gr.id, gr.game_id, gr.team_id, gr.player_id,
        p.first_name, p.last_name,
        COALESCE(pt.photo, p.photo) AS photo,
        p.position, pt.jersey_number,
        false AS inherited
      FROM game_rosters gr
      JOIN players p ON p.id = gr.player_id
      LEFT JOIN player_teams pt
        ON pt.player_id = gr.player_id AND pt.team_id = gr.team_id AND pt.end_date IS NULL
      WHERE gr.game_id = ${id}
      ORDER BY pt.jersey_number ASC NULLS LAST, p.last_name ASC
    `;

    // 3. Determine which teams still need a roster.
    const teamsCovered = new Set(current.map((r) => r.team_id));
    const teamsToInherit = [home_team_id, away_team_id].filter((t) => !teamsCovered.has(t));

    // 4. For each uncovered team, inherit the roster from their most-recent finished game.
    //    Queries are per-team to avoid JS array → ANY() which the Neon HTTP driver does not support.
    const inheritedRows = [];
    for (const teamId of teamsToInherit) {
      // Step A: find the most-recent finished game this team played in (home OR away).
      const lastGameRows = await sql`
        SELECT id AS game_id
        FROM games
        WHERE (home_team_id = ${teamId} OR away_team_id = ${teamId})
          AND status = 'final'
          AND id <> ${id}
        ORDER BY scheduled_at DESC NULLS LAST, created_at DESC
        LIMIT 1
      `;
      if (lastGameRows.length === 0) continue;

      // Step B: fetch that game's roster for this team.
      const rows = await sql`
        SELECT
          gr.id, ${id}::uuid AS game_id, gr.team_id, gr.player_id,
          p.first_name, p.last_name,
          COALESCE(pt.photo, p.photo) AS photo,
          p.position, pt.jersey_number,
          true AS inherited
        FROM game_rosters gr
        JOIN players p ON p.id = gr.player_id
        LEFT JOIN player_teams pt
          ON pt.player_id = gr.player_id AND pt.team_id = gr.team_id AND pt.end_date IS NULL
        WHERE gr.game_id = ${lastGameRows[0].game_id} AND gr.team_id = ${teamId}
        ORDER BY pt.jersey_number ASC NULLS LAST, p.last_name ASC
      `;
      inheritedRows.push(...rows);
    }

    return res.json([...current, ...inheritedRows]);
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
        p.first_name, p.last_name, COALESCE(pt.photo, p.photo) AS photo, p.position,
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
// GET /api/admin/games/:id/goals  – list all goals for a game (with player details)
// ---------------------------------------------------------------------------
router.get('/:id/goals', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`
      SELECT
        go.id,
        go.game_id,
        go.team_id,
        go.period,
        go.goal_type,
        go.empty_net,
        go.period_time,
        go.scorer_id,
        go.assist_1_id,
        go.assist_2_id,
        go.created_at,
        -- team identity
        ti.name             AS team_name,
        ti.code             AS team_code,
        ti.logo             AS team_logo,
        t.primary_color     AS team_primary_color,
        t.text_color        AS team_text_color,
        -- scorer
        sp.first_name                       AS scorer_first_name,
        sp.last_name                        AS scorer_last_name,
        COALESCE(spt.photo, sp.photo)       AS scorer_photo,
        spt.jersey_number                   AS scorer_jersey_number,
        -- assist 1
        a1p.first_name                      AS assist_1_first_name,
        a1p.last_name                       AS assist_1_last_name,
        COALESCE(a1pt.photo, a1p.photo)     AS assist_1_photo,
        a1pt.jersey_number                  AS assist_1_jersey_number,
        -- assist 2
        a2p.first_name                      AS assist_2_first_name,
        a2p.last_name                       AS assist_2_last_name,
        COALESCE(a2pt.photo, a2p.photo)     AS assist_2_photo,
        a2pt.jersey_number                  AS assist_2_jersey_number,
        -- prior-game cumulative stats (finalized games in same season before this game)
        (SELECT COUNT(*)::int
          FROM goals g2
          JOIN games gm2 ON gm2.id = g2.game_id
          WHERE g2.scorer_id = go.scorer_id
            AND gm2.season_id = g.season_id
            AND gm2.status = 'final'
            AND gm2.scheduled_at < g.scheduled_at
        ) AS scorer_prior_goals,
        (SELECT COUNT(*)::int
          FROM goals g2
          JOIN games gm2 ON gm2.id = g2.game_id
          WHERE go.assist_1_id IS NOT NULL
            AND (g2.assist_1_id = go.assist_1_id OR g2.assist_2_id = go.assist_1_id)
            AND gm2.season_id = g.season_id
            AND gm2.status = 'final'
            AND gm2.scheduled_at < g.scheduled_at
        ) AS assist_1_prior_assists,
        (SELECT COUNT(*)::int
          FROM goals g2
          JOIN games gm2 ON gm2.id = g2.game_id
          WHERE go.assist_2_id IS NOT NULL
            AND (g2.assist_1_id = go.assist_2_id OR g2.assist_2_id = go.assist_2_id)
            AND gm2.season_id = g.season_id
            AND gm2.status = 'final'
            AND gm2.scheduled_at < g.scheduled_at
        ) AS assist_2_prior_assists
      FROM goals go
      JOIN games g ON g.id = go.game_id
      JOIN players sp ON sp.id = go.scorer_id
      LEFT JOIN player_teams spt
        ON spt.player_id = go.scorer_id AND spt.team_id = go.team_id AND spt.end_date IS NULL
      LEFT JOIN players a1p ON a1p.id = go.assist_1_id
      LEFT JOIN player_teams a1pt
        ON a1pt.player_id = go.assist_1_id AND a1pt.team_id = go.team_id AND a1pt.end_date IS NULL
      LEFT JOIN players a2p ON a2p.id = go.assist_2_id
      LEFT JOIN player_teams a2pt
        ON a2pt.player_id = go.assist_2_id AND a2pt.team_id = go.team_id AND a2pt.end_date IS NULL
      JOIN teams t ON t.id = go.team_id
      LEFT JOIN LATERAL (
        SELECT name, code, logo FROM team_iterations
        WHERE team_id = go.team_id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) ti ON true
      WHERE go.game_id = ${id}
      ORDER BY go.period ASC, go.created_at ASC
    `;
    return res.json(rows);
  } catch (err) {
    console.error('goals get error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/games/:id/goals  – record a goal and increment period counter
// Body: { team_id, period, goal_type, period_time, scorer_id, assist_1_id?, assist_2_id? }
// ---------------------------------------------------------------------------
router.post('/:id/goals', async (req, res) => {
  const { id } = req.params;
  const {
    team_id,
    period,
    goal_type = 'even-strength',
    empty_net = false,
    period_time = null,
    scorer_id,
    assist_1_id = null,
    assist_2_id = null,
  } = req.body;

  if (!team_id || !period || !scorer_id) {
    return res.status(400).json({ error: 'team_id, period, and scorer_id are required' });
  }

  try {
    // Determine if this team is the home or away team.
    const gameRows = await sql`SELECT home_team_id, away_team_id FROM games WHERE id = ${id}`;
    if (gameRows.length === 0) return res.status(404).json({ error: 'Game not found' });
    const { home_team_id, away_team_id } = gameRows[0];
    const side = team_id === home_team_id ? 'home' : team_id === away_team_id ? 'away' : null;
    if (!side) return res.status(400).json({ error: 'team_id is not a participant in this game' });

    // Insert the goal record.
    const [goal] = await sql`
      INSERT INTO goals (game_id, team_id, period, goal_type, empty_net, period_time, scorer_id, assist_1_id, assist_2_id)
      VALUES (${id}, ${team_id}, ${period}, ${goal_type}, ${!!empty_net}, ${period_time}, ${scorer_id}, ${assist_1_id}, ${assist_2_id})
      RETURNING id
    `;

    // Return the full goal record with player/team details.
    const [full] = await sql`
      SELECT
        go.id, go.game_id, go.team_id, go.period, go.goal_type, go.period_time,
        go.scorer_id, go.assist_1_id, go.assist_2_id, go.created_at,
        ti.name AS team_name, ti.code AS team_code, ti.logo AS team_logo,
        t.primary_color AS team_primary_color, t.text_color AS team_text_color,
        sp.first_name AS scorer_first_name, sp.last_name AS scorer_last_name, COALESCE(spt.photo, sp.photo) AS scorer_photo,
        spt.jersey_number AS scorer_jersey_number,
        a1p.first_name AS assist_1_first_name, a1p.last_name AS assist_1_last_name, COALESCE(a1pt.photo, a1p.photo) AS assist_1_photo,
        a1pt.jersey_number AS assist_1_jersey_number,
        a2p.first_name AS assist_2_first_name, a2p.last_name AS assist_2_last_name, COALESCE(a2pt.photo, a2p.photo) AS assist_2_photo,
        a2pt.jersey_number AS assist_2_jersey_number
      FROM goals go
      JOIN players sp ON sp.id = go.scorer_id
      LEFT JOIN player_teams spt ON spt.player_id = go.scorer_id AND spt.team_id = go.team_id AND spt.end_date IS NULL
      LEFT JOIN players a1p ON a1p.id = go.assist_1_id
      LEFT JOIN player_teams a1pt ON a1pt.player_id = go.assist_1_id AND a1pt.team_id = go.team_id AND a1pt.end_date IS NULL
      LEFT JOIN players a2p ON a2p.id = go.assist_2_id
      LEFT JOIN player_teams a2pt ON a2pt.player_id = go.assist_2_id AND a2pt.team_id = go.team_id AND a2pt.end_date IS NULL
      JOIN teams t ON t.id = go.team_id
      LEFT JOIN LATERAL (
        SELECT name, code, logo FROM team_iterations
        WHERE team_id = go.team_id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) ti ON true
      WHERE go.id = ${goal.id}
    `;
    return res.status(201).json(full);
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'Invalid game_id, team_id, or player_id' });
    console.error('goals post error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/games/:id/goals/:goalId  – update an existing goal
// ---------------------------------------------------------------------------
router.put('/:id/goals/:goalId', async (req, res) => {
  const { id, goalId } = req.params;
  const {
    team_id,
    period,
    goal_type = 'even-strength',
    empty_net = false,
    period_time = null,
    scorer_id,
    assist_1_id = null,
    assist_2_id = null,
  } = req.body;

  if (!team_id || !period || !scorer_id) {
    return res.status(400).json({ error: 'team_id, period, and scorer_id are required' });
  }

  try {
    const rows = await sql`
      UPDATE goals
      SET team_id     = ${team_id},
          period      = ${period},
          goal_type   = ${goal_type},
          empty_net   = ${!!empty_net},
          period_time = ${period_time},
          scorer_id   = ${scorer_id},
          assist_1_id = ${assist_1_id},
          assist_2_id = ${assist_2_id}
      WHERE id = ${goalId} AND game_id = ${id}
      RETURNING id
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Goal not found' });
    return res.json({ id: rows[0].id });
  } catch (err) {
    console.error('goals update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/games/:id/goals/:goalId  – delete a goal
// ---------------------------------------------------------------------------
router.delete('/:id/goals/:goalId', async (req, res) => {
  const { id, goalId } = req.params;
  try {
    const rows = await sql`
      DELETE FROM goals WHERE id = ${goalId} AND game_id = ${id} RETURNING id
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Goal not found' });
    return res.status(204).send();
  } catch (err) {
    console.error('goals delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/games/:id/shots  – upsert shots on goal for one period
// Body: { period, home_shots, away_shots }
// ---------------------------------------------------------------------------
router.patch('/:id/shots', async (req, res) => {
  const { id } = req.params;
  const { period, home_shots, away_shots } = req.body;

  if (!period || home_shots == null || away_shots == null) {
    return res.status(400).json({ error: 'period, home_shots, and away_shots are required' });
  }

  try {
    // Upsert into the JSONB array: remove existing entry for this period (if
    // any), append the new entry, then re-sort by period order.
    const rows = await sql`
      UPDATE games
      SET period_shots = (
        SELECT COALESCE(
          jsonb_agg(
            entry
            ORDER BY CASE entry->>'period'
              WHEN '1' THEN 1 WHEN '2' THEN 2 WHEN '3' THEN 3
              WHEN 'OT' THEN 4 WHEN 'SO' THEN 5 ELSE 6 END
          ),
          '[]'::jsonb
        )
        FROM (
          SELECT jsonb_build_object(
            'period',     ${period}::text,
            'home_shots', ${home_shots}::int,
            'away_shots', ${away_shots}::int
          ) AS entry
          UNION ALL
          SELECT elem AS entry
          FROM jsonb_array_elements(period_shots) AS elem
          WHERE elem->>'period' != ${period}::text
        ) sub
      )
      WHERE id = ${id}
      RETURNING period_shots
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Game not found' });
    return res.json({ period_shots: rows[0].period_shots });
  } catch (err) {
    console.error('shots upsert error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/games/:id/goalie-stats  – list goalie stats for both teams
// ---------------------------------------------------------------------------
router.get('/:id/goalie-stats', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`
      SELECT
        gs.id,
        gs.game_id,
        gs.team_id,
        gs.goalie_id,
        gs.shots_against,
        gs.saves,
        gs.created_at,
        p.first_name AS goalie_first_name,
        p.last_name  AS goalie_last_name,
        COALESCE(pt.photo, p.photo) AS goalie_photo,
        pt.jersey_number AS goalie_jersey_number,
        ti.name  AS team_name,
        ti.code  AS team_code,
        ti.logo  AS team_logo,
        t.primary_color AS team_primary_color,
        t.text_color    AS team_text_color
      FROM game_goalie_stats gs
      JOIN players p ON p.id = gs.goalie_id
      JOIN teams t ON t.id = gs.team_id
      LEFT JOIN player_teams pt
        ON pt.player_id = gs.goalie_id
        AND pt.team_id  = gs.team_id
        AND pt.end_date IS NULL
      LEFT JOIN LATERAL (
        SELECT name, code, logo FROM team_iterations
        WHERE team_id = gs.team_id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) ti ON true
      WHERE gs.game_id = ${id}
      ORDER BY ti.code ASC, pt.jersey_number ASC NULLS LAST
    `;
    return res.json(rows);
  } catch (err) {
    console.error('goalie stats get error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/games/:id/goalie-stats  – upsert one goalie's stats
// Body: { goalie_id, team_id, shots_against, saves }
// ---------------------------------------------------------------------------
router.put('/:id/goalie-stats', async (req, res) => {
  const { id } = req.params;
  const { goalie_id, team_id, shots_against, saves } = req.body;

  if (!goalie_id || !team_id || shots_against == null || saves == null) {
    return res.status(400).json({ error: 'goalie_id, team_id, shots_against, and saves are required' });
  }

  try {
    await sql`
      INSERT INTO game_goalie_stats (game_id, team_id, goalie_id, shots_against, saves)
      VALUES (${id}, ${team_id}, ${goalie_id}, ${shots_against}, ${saves})
      ON CONFLICT (game_id, goalie_id)
      DO UPDATE SET team_id = EXCLUDED.team_id, shots_against = EXCLUDED.shots_against, saves = EXCLUDED.saves
    `;
    const [row] = await sql`
      SELECT
        gs.id, gs.game_id, gs.team_id, gs.goalie_id, gs.shots_against, gs.saves, gs.created_at,
        p.first_name AS goalie_first_name, p.last_name AS goalie_last_name,
        COALESCE(pt.photo, p.photo) AS goalie_photo, pt.jersey_number AS goalie_jersey_number,
        ti.name AS team_name, ti.code AS team_code, ti.logo AS team_logo,
        t.primary_color AS team_primary_color, t.text_color AS team_text_color
      FROM game_goalie_stats gs
      JOIN players p ON p.id = gs.goalie_id
      JOIN teams t ON t.id = gs.team_id
      LEFT JOIN player_teams pt
        ON pt.player_id = gs.goalie_id AND pt.team_id = gs.team_id AND pt.end_date IS NULL
      LEFT JOIN LATERAL (
        SELECT name, code, logo FROM team_iterations
        WHERE team_id = gs.team_id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) ti ON true
      WHERE gs.game_id = ${id} AND gs.goalie_id = ${goalie_id}
    `;
    return res.json(row);
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'Invalid game_id, team_id, or goalie_id' });
    console.error('goalie stats put error:', err);
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

// ---------------------------------------------------------------------------
// Shared query helper — returns full shootout attempt rows with player/team info
// ---------------------------------------------------------------------------
const fetchAttempts = (gameId) => sql`
  SELECT
    sa.id,
    sa.game_id,
    sa.team_id,
    sa.shooter_id,
    sa.scored,
    sa.attempt_order,
    sa.created_at,
    p.first_name   AS shooter_first_name,
    p.last_name    AS shooter_last_name,
    COALESCE(pt.photo, p.photo) AS shooter_photo,
    pt.jersey_number            AS shooter_jersey_number,
    ti.name  AS team_name,
    ti.code  AS team_code,
    ti.logo  AS team_logo,
    t.primary_color AS team_primary_color,
    t.text_color    AS team_text_color
  FROM shootout_attempts sa
  JOIN players p  ON p.id  = sa.shooter_id
  JOIN teams   t  ON t.id  = sa.team_id
  LEFT JOIN player_teams pt
    ON pt.player_id = sa.shooter_id
    AND pt.team_id  = sa.team_id
    AND pt.end_date IS NULL
  LEFT JOIN LATERAL (
    SELECT name, code, logo FROM team_iterations
    WHERE team_id = sa.team_id
    ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
    LIMIT 1
  ) ti ON true
  WHERE sa.game_id = ${gameId}
  ORDER BY sa.attempt_order ASC
`;

// ---------------------------------------------------------------------------
// GET /api/admin/games/:id/shootout-attempts
// ---------------------------------------------------------------------------
router.get('/:id/shootout-attempts', async (req, res) => {
  try {
    const rows = await fetchAttempts(req.params.id);
    return res.json(rows);
  } catch (err) {
    console.error('shootout attempts get error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/games/:id/shootout-attempts
// Body: { team_id, shooter_id, scored? }
// ---------------------------------------------------------------------------
router.post('/:id/shootout-attempts', async (req, res) => {
  const { id } = req.params;
  const { team_id, shooter_id, scored = false } = req.body;

  if (!team_id || !shooter_id) {
    return res.status(400).json({ error: 'team_id and shooter_id are required' });
  }

  try {
    // Determine next attempt_order for this game (global sequence across both teams)
    const [{ max_order }] = await sql`
      SELECT COALESCE(MAX(attempt_order), 0) AS max_order
      FROM shootout_attempts WHERE game_id = ${id}
    `;
    const attemptOrder = (max_order ?? 0) + 1;

    const [attempt] = await sql`
      INSERT INTO shootout_attempts (game_id, team_id, shooter_id, scored, attempt_order)
      VALUES (${id}, ${team_id}, ${shooter_id}, ${!!scored}, ${attemptOrder})
      RETURNING id
    `;

    const all = await fetchAttempts(id);
    const full = all.find((r) => r.id === attempt.id);
    return res.status(201).json(full);
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'Invalid game_id, team_id, or player_id' });
    console.error('shootout attempts post error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/games/:id/shootout-attempts/:attemptId
// Body: { team_id?, shooter_id?, scored? }
// ---------------------------------------------------------------------------
router.put('/:id/shootout-attempts/:attemptId', async (req, res) => {
  const { id, attemptId } = req.params;
  const { team_id, shooter_id, scored } = req.body;

  try {
    const rows = await sql`
      UPDATE shootout_attempts
      SET
        team_id    = COALESCE(${team_id    ?? null}, team_id),
        shooter_id = COALESCE(${shooter_id ?? null}, shooter_id),
        scored     = COALESCE(${scored     != null ? !!scored : null}, scored)
      WHERE id = ${attemptId} AND game_id = ${id}
      RETURNING id
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Attempt not found' });

    const all = await fetchAttempts(id);
    const updated = all.find((r) => r.id === attemptId);
    return res.json(updated);
  } catch (err) {
    console.error('shootout attempts put error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/games/:id/shootout-attempts/:attemptId
// ---------------------------------------------------------------------------
router.delete('/:id/shootout-attempts/:attemptId', async (req, res) => {
  const { id, attemptId } = req.params;
  try {
    const rows = await sql`
      DELETE FROM shootout_attempts
      WHERE id = ${attemptId} AND game_id = ${id}
      RETURNING id
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Attempt not found' });
    return res.status(204).send();
  } catch (err) {
    console.error('shootout attempts delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

