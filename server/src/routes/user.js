const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { sql } = require('../db');

// All user routes require authentication (any role)
router.use(requireAuth);

// ---------------------------------------------------------------------------
// GET /api/user/favorites  – list the authenticated user's favourite team IDs
// ---------------------------------------------------------------------------
router.get('/favorites', async (req, res) => {
  const userId = req.user.id;
  try {
    const rows = await sql`
      SELECT team_id FROM user_favorite_teams
      WHERE user_id = ${userId}
      ORDER BY created_at ASC
    `;
    return res.json(rows.map((r) => r.team_id));
  } catch (err) {
    console.error('user favorites list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/user/favorites/:teamId  – add a team to favourites (idempotent)
// ---------------------------------------------------------------------------
router.post('/favorites/:teamId', async (req, res) => {
  const userId = req.user.id;
  const { teamId } = req.params;
  try {
    // Verify team exists
    const team = await sql`SELECT id FROM teams WHERE id = ${teamId}`;
    if (team.length === 0) return res.status(404).json({ error: 'Team not found' });

    await sql`
      INSERT INTO user_favorite_teams (user_id, team_id)
      VALUES (${userId}, ${teamId})
      ON CONFLICT DO NOTHING
    `;
    return res.status(201).json({ user_id: userId, team_id: teamId });
  } catch (err) {
    console.error('user favorites add error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/user/favorites/:teamId  – remove a team from favourites
// ---------------------------------------------------------------------------
router.delete('/favorites/:teamId', async (req, res) => {
  const userId = req.user.id;
  const { teamId } = req.params;
  try {
    await sql`
      DELETE FROM user_favorite_teams
      WHERE user_id = ${userId} AND team_id = ${teamId}
    `;
    return res.json({ message: 'Removed from favorites' });
  } catch (err) {
    console.error('user favorites remove error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/user/watched-games/:gameId  – mark a game as watched (idempotent)
// ---------------------------------------------------------------------------
router.post('/watched-games/:gameId', async (req, res) => {
  const userId = req.user.id;
  const { gameId } = req.params;
  // Optional caller-supplied "watched on" date (YYYY-MM-DD). Lets the client
  // record the effective date it is operating on (e.g. an admin test date)
  // instead of always defaulting to the server's CURRENT_DATE.
  const watchedOn =
    typeof req.body?.watched_on === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.watched_on)
      ? req.body.watched_on
      : null;
  try {
    const game = await sql`SELECT id FROM games WHERE id = ${gameId}`;
    if (game.length === 0) return res.status(404).json({ error: 'Game not found' });

    const [saved] = await sql`
      INSERT INTO user_watched_games (user_id, game_id, watched_at, watched_on, scheduled_for)
      VALUES (${userId}, ${gameId}, NOW(), COALESCE(${watchedOn}::date, CURRENT_DATE), NULL)
      ON CONFLICT (user_id, game_id)
      DO UPDATE SET
        watched_at = NOW(),
        watched_on = COALESCE(user_watched_games.scheduled_for, ${watchedOn}::date, CURRENT_DATE),
        skipped_at = NULL
      RETURNING watched_on::text AS watched_on, scheduled_for::text AS scheduled_for
    `;

    return res.status(201).json({
      user_id: userId,
      game_id: gameId,
      watched_on: saved?.watched_on ?? new Date().toISOString().slice(0, 10),
      scheduled_for: saved?.scheduled_for ?? null,
    });
  } catch (err) {
    console.error('user watched-games add error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/user/watched-games/:gameId/schedule  – schedule/clear a watch date
// Body: { scheduled_for: 'YYYY-MM-DD' | null }
// ---------------------------------------------------------------------------
router.put('/watched-games/:gameId/schedule', async (req, res) => {
  const userId = req.user.id;
  const { gameId } = req.params;
  const scheduledFor = typeof req.body?.scheduled_for === 'string' ? req.body.scheduled_for : null;

  try {
    const game = await sql`SELECT id FROM games WHERE id = ${gameId}`;
    if (game.length === 0) return res.status(404).json({ error: 'Game not found' });

    await sql`
      INSERT INTO user_watched_games (user_id, game_id, scheduled_for)
      VALUES (${userId}, ${gameId}, ${scheduledFor}::date)
      ON CONFLICT (user_id, game_id)
      DO UPDATE SET
        scheduled_for = ${scheduledFor}::date,
        skipped_at = NULL
    `;

    return res.json({
      user_id: userId,
      game_id: gameId,
      scheduled_for: scheduledFor,
    });
  } catch (err) {
    console.error('user watched-games schedule error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/user/watched-games/:gameId  – clear watched state for a game
// Preserves scheduled_for if the user has a future watch date set.
// ---------------------------------------------------------------------------
router.delete('/watched-games/:gameId', async (req, res) => {
  const userId = req.user.id;
  const { gameId } = req.params;
  try {
    const existing = await sql`
      SELECT scheduled_for::text AS scheduled_for
      FROM user_watched_games
      WHERE user_id = ${userId} AND game_id = ${gameId}
      LIMIT 1
    `;

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Watched game record not found' });
    }

    const scheduledFor = existing[0].scheduled_for ?? null;

    if (scheduledFor) {
      await sql`
        UPDATE user_watched_games
        SET watched_at = NULL,
            watched_on = NULL,
            skipped_at = NULL
        WHERE user_id = ${userId} AND game_id = ${gameId}
      `;

      return res.json({
        user_id: userId,
        game_id: gameId,
        watched_on: null,
        scheduled_for: scheduledFor,
      });
    }

    await sql`
      DELETE FROM user_watched_games
      WHERE user_id = ${userId} AND game_id = ${gameId}
    `;

    return res.json({
      user_id: userId,
      game_id: gameId,
      watched_on: null,
      scheduled_for: null,
      deleted: true,
    });
  } catch (err) {
    console.error('user watched-games delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/user/watched-games/:gameId/skip  – hide a game from the user feed
// ---------------------------------------------------------------------------
router.post('/watched-games/:gameId/skip', async (req, res) => {
  const userId = req.user.id;
  const { gameId } = req.params;
  try {
    const game = await sql`SELECT id FROM games WHERE id = ${gameId}`;
    if (game.length === 0) return res.status(404).json({ error: 'Game not found' });

    await sql`
      INSERT INTO user_watched_games (user_id, game_id, watched_at, watched_on, skipped_at, scheduled_for)
      VALUES (${userId}, ${gameId}, NULL, NULL, NOW(), NULL)
      ON CONFLICT (user_id, game_id)
      DO UPDATE SET
        watched_at = NULL,
        watched_on = NULL,
        skipped_at = NOW(),
        scheduled_for = NULL
    `;

    return res.status(201).json({
      user_id: userId,
      game_id: gameId,
      skipped: true,
    });
  } catch (err) {
    console.error('user watched-games skip error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/user/games  – read-only game list for authenticated users
// Query params: season_id, league_id, team_id, game_type, status, include_skipped, date
// `date` (YYYY-MM-DD) filters to games whose effective user date matches — the
// user's personal scheduled_for if set, otherwise the game's Eastern-time date.
// Results are scoped to games involving the user's favourite teams.
// ---------------------------------------------------------------------------
router.get('/games', async (req, res) => {
  const userId = req.user.id;
  const { season_id, league_id, team_id, game_type, status } = req.query;
  const includeSkipped = req.query.include_skipped === 'true' || req.query.include_skipped === '1';
  const dateFilter =
    typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
      ? req.query.date
      : null;
  try {
    const games = await sql`
      SELECT
        g.id, g.season_id, g.game_type, g.status,
        g.scheduled_at, g.scheduled_time, g.venue,
        g.overtime_periods, g.shootout,
        score.winner_team_id,
        score.home_score,
        score.away_score,
        g.playoff_series_id, g.game_number_in_series, g.game_number,
        ps.home_team_id    AS series_home_team_id,
        ps.away_team_id    AS series_away_team_id,
        ps.home_wins       AS series_home_wins,
        ps.away_wins       AS series_away_wins,
        series_progress.series_home_wins_at_game,
        series_progress.series_away_wins_at_game,
        ps.games_to_win    AS series_games_to_win,
        g.notes, g.current_period, g.created_at,
        g.star_1_id, g.star_2_id, g.star_3_id,
        ps.round          AS playoff_round,
        brs.round_names   AS playoff_round_names,
        gs.period_scores,
        g.period_shots,
        -- Home team (same json_build_object shape as admin query)
        json_build_object(
          'id',              g.home_team_id,
          'name',            ht.name,
          'place_name',      ht.place_name,
          'team_name',       ht.team_name,
          'code',            ht.code,
          'logo',            ht.logo,
          'logo_dark',       ht.logo_dark,
          'logo_light',      ht.logo_light,
          'primary_color',   t_home.primary_color,
          'secondary_color', t_home.secondary_color,
          'text_color',      t_home.text_color
        ) AS home_team,
        -- Away team
        json_build_object(
          'id',              g.away_team_id,
          'name',            at.name,
          'place_name',      at.place_name,
          'team_name',       at.team_name,
          'code',            at.code,
          'logo',            at.logo,
          'logo_dark',       at.logo_dark,
          'logo_light',      at.logo_light,
          'primary_color',   t_away.primary_color,
          'secondary_color', t_away.secondary_color,
          'text_color',      t_away.text_color
        ) AS away_team,
        -- Season / league context
        s.name AS season_name,
        l.id   AS league_id,
        l.name AS league_name,
        l.primary_color AS league_primary_color,
        l.text_color AS league_text_color,
        COALESCE(uwg.watched_on, uwg.watched_at::date) AS watched_on,
        uwg.scheduled_for,
        (uwg.skipped_at IS NOT NULL) AS skipped_by_user,
        (uwg.game_id IS NOT NULL AND (uwg.watched_on IS NOT NULL OR uwg.watched_at IS NOT NULL)) AS watched_by_user
      FROM games g
      JOIN seasons          s      ON s.id      = g.season_id
      JOIN leagues          l      ON l.id      = s.league_id
      JOIN teams            t_home ON t_home.id = g.home_team_id
      JOIN teams            t_away ON t_away.id = g.away_team_id
      LEFT JOIN playoff_series    ps  ON ps.id  = g.playoff_series_id
      LEFT JOIN bracket_rule_sets brs ON brs.id = s.bracket_rule_set_id
      LEFT JOIN LATERAL (
        SELECT name, place_name, team_name, code, team_logo_default(logo_dark, logo_light) AS logo, team_logo_dark(logo_dark, logo_light) AS logo_dark, team_logo_light(logo_dark, logo_light) AS logo_light FROM team_iterations
        WHERE team_id = g.home_team_id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) ht ON true
      LEFT JOIN LATERAL (
        SELECT name, place_name, team_name, code, team_logo_default(logo_dark, logo_light) AS logo, team_logo_dark(logo_dark, logo_light) AS logo_dark, team_logo_light(logo_dark, logo_light) AS logo_light FROM team_iterations
        WHERE team_id = g.away_team_id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) at ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          json_agg(
            json_build_object('period', period, 'home_goals', home_cnt, 'away_goals', away_cnt)
            ORDER BY CASE period WHEN '1' THEN 1 WHEN '2' THEN 2 WHEN '3' THEN 3
                                 WHEN 'OT' THEN 4 WHEN 'SO' THEN 5 ELSE 6 END
          ), '[]'::json
        ) AS period_scores
        FROM (
          SELECT go.period,
            COUNT(*) FILTER (WHERE go.team_id = g.home_team_id) AS home_cnt,
            COUNT(*) FILTER (WHERE go.team_id = g.away_team_id) AS away_cnt
          FROM goals go WHERE go.game_id = g.id GROUP BY go.period
        ) ps
      ) gs ON true
      LEFT JOIN LATERAL (
        SELECT
          resolved.winner_team_id,
          totals.home_goals
            + CASE
                WHEN g.status = 'final'
                  AND (
                    g.shootout
                    OR COALESCE(g.overtime_periods, 0) > 0
                    OR totals.has_ot
                    OR totals.so_home_goals > 0
                    OR totals.so_away_goals > 0
                  )
                  AND totals.home_goals = totals.away_goals
                  AND resolved.winner_team_id = g.home_team_id
                THEN 1 ELSE 0
              END AS home_score,
          totals.away_goals
            + CASE
                WHEN g.status = 'final'
                  AND (
                    g.shootout
                    OR COALESCE(g.overtime_periods, 0) > 0
                    OR totals.has_ot
                    OR totals.so_home_goals > 0
                    OR totals.so_away_goals > 0
                  )
                  AND totals.home_goals = totals.away_goals
                  AND resolved.winner_team_id = g.away_team_id
                THEN 1 ELSE 0
              END AS away_score
        FROM (
          SELECT
            COUNT(*) FILTER (WHERE go.team_id = g.home_team_id AND go.period <> 'SO')::int AS home_goals,
            COUNT(*) FILTER (WHERE go.team_id = g.away_team_id AND go.period <> 'SO')::int AS away_goals,
            COUNT(*) FILTER (WHERE go.team_id = g.home_team_id AND go.period = 'SO')::int AS so_home_goals,
            COUNT(*) FILTER (WHERE go.team_id = g.away_team_id AND go.period = 'SO')::int AS so_away_goals,
            COALESCE(BOOL_OR(go.period = 'OT'), false) AS has_ot
          FROM goals go
          WHERE go.game_id = g.id
        ) totals
        LEFT JOIN LATERAL (
          SELECT
            CASE
              WHEN g.shootout OR totals.so_home_goals > 0 OR totals.so_away_goals > 0 THEN
                CASE
                  WHEN so.home_goals > so.away_goals THEN g.home_team_id
                  WHEN so.away_goals > so.home_goals THEN g.away_team_id
                  WHEN totals.so_home_goals > totals.so_away_goals THEN g.home_team_id
                  WHEN totals.so_away_goals > totals.so_home_goals THEN g.away_team_id
                  WHEN totals.home_goals > totals.away_goals THEN g.home_team_id
                  WHEN totals.away_goals > totals.home_goals THEN g.away_team_id
                  ELSE NULL
                END
              WHEN totals.home_goals > totals.away_goals THEN g.home_team_id
              WHEN totals.away_goals > totals.home_goals THEN g.away_team_id
              ELSE NULL
            END AS winner_team_id
          FROM (
            SELECT
              COUNT(*) FILTER (WHERE team_id = g.home_team_id AND scored)::int AS home_goals,
              COUNT(*) FILTER (WHERE team_id = g.away_team_id AND scored)::int AS away_goals
            FROM shootout_attempts
            WHERE game_id = g.id
          ) so
        ) resolved ON true
      ) score ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE sg_score.winner_team_id = ps.home_team_id)::int AS series_home_wins_at_game,
          COUNT(*) FILTER (WHERE sg_score.winner_team_id = ps.away_team_id)::int AS series_away_wins_at_game
        FROM games sg
        LEFT JOIN LATERAL (
          SELECT
            CASE
              WHEN sg.shootout OR sg_totals.so_home_goals > 0 OR sg_totals.so_away_goals > 0 THEN
                CASE
                  WHEN sg_so.home_goals > sg_so.away_goals THEN sg.home_team_id
                  WHEN sg_so.away_goals > sg_so.home_goals THEN sg.away_team_id
                  WHEN sg_totals.so_home_goals > sg_totals.so_away_goals THEN sg.home_team_id
                  WHEN sg_totals.so_away_goals > sg_totals.so_home_goals THEN sg.away_team_id
                  WHEN sg_totals.home_goals > sg_totals.away_goals THEN sg.home_team_id
                  WHEN sg_totals.away_goals > sg_totals.home_goals THEN sg.away_team_id
                  ELSE NULL
                END
              WHEN sg_totals.home_goals > sg_totals.away_goals THEN sg.home_team_id
              WHEN sg_totals.away_goals > sg_totals.home_goals THEN sg.away_team_id
              ELSE NULL
            END AS winner_team_id
          FROM (
            SELECT
              COUNT(*) FILTER (WHERE go.team_id = sg.home_team_id AND go.period <> 'SO')::int AS home_goals,
              COUNT(*) FILTER (WHERE go.team_id = sg.away_team_id AND go.period <> 'SO')::int AS away_goals,
              COUNT(*) FILTER (WHERE go.team_id = sg.home_team_id AND go.period = 'SO')::int AS so_home_goals,
              COUNT(*) FILTER (WHERE go.team_id = sg.away_team_id AND go.period = 'SO')::int AS so_away_goals
            FROM goals go
            WHERE go.game_id = sg.id
          ) sg_totals
          CROSS JOIN LATERAL (
            SELECT
              COUNT(*) FILTER (WHERE team_id = sg.home_team_id AND scored)::int AS home_goals,
              COUNT(*) FILTER (WHERE team_id = sg.away_team_id AND scored)::int AS away_goals
            FROM shootout_attempts
            WHERE game_id = sg.id
          ) sg_so
        ) sg_score ON true
        WHERE ps.id IS NOT NULL
          AND sg.playoff_series_id = ps.id
          AND sg.status = 'final'
          AND ROW(
            COALESCE(sg.game_number_in_series, sg.game_number, 2147483647),
            COALESCE(sg.scheduled_at, 'infinity'::timestamptz),
            sg.created_at,
            sg.id::text
          ) <= ROW(
            COALESCE(g.game_number_in_series, g.game_number, 2147483647),
            COALESCE(g.scheduled_at, 'infinity'::timestamptz),
            g.created_at,
            g.id::text
          )
      ) series_progress ON true
      LEFT JOIN user_watched_games uwg
        ON uwg.user_id = ${userId}
       AND uwg.game_id = g.id
      WHERE
        EXISTS (
          SELECT 1
          FROM user_favorite_teams uft
          WHERE uft.user_id = ${userId}
            AND (uft.team_id = g.home_team_id OR uft.team_id = g.away_team_id)
        )
        AND
        g.status <> 'cancelled'
        AND (${includeSkipped}::boolean OR uwg.skipped_at IS NULL)
        AND
        (${season_id ?? null}::uuid IS NULL OR g.season_id    = ${season_id ?? null}::uuid)
        AND (${league_id ?? null}::uuid IS NULL OR l.id        = ${league_id ?? null}::uuid)
        AND (${team_id   ?? null}::uuid IS NULL OR g.home_team_id = ${team_id ?? null}::uuid
                                                OR g.away_team_id = ${team_id ?? null}::uuid)
        AND (${game_type ?? null}::text IS NULL OR g.game_type = ${game_type ?? null})
        AND (${status    ?? null}::text IS NULL OR g.status    = ${status    ?? null})
        AND (
          ${dateFilter}::date IS NULL
          OR COALESCE(
               uwg.scheduled_for,
               (g.scheduled_at AT TIME ZONE 'America/New_York')::date
             ) = ${dateFilter}::date
        )
      ORDER BY
        CASE g.status WHEN 'in_progress' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END,
        CASE g.status WHEN 'scheduled'   THEN g.scheduled_at END ASC NULLS LAST,
        CASE g.status WHEN 'in_progress' THEN g.scheduled_at ELSE NULL END DESC NULLS LAST,
        g.scheduled_at DESC NULLS LAST,
        g.created_at DESC
    `;
    return res.json(games);
  } catch (err) {
    console.error('user games list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/user/games/:id  - read-only game detail for authenticated users
// Scoped to games involving the user's favourite teams and not skipped.
// ---------------------------------------------------------------------------
router.get('/games/:id', async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const rows = await sql`
      SELECT
        g.id, g.season_id, g.game_type, g.status,
        g.scheduled_at, g.scheduled_time, g.venue,
        g.time_start, g.time_end,
        g.overtime_periods, g.shootout, g.shootout_first_team_id,
        score.winner_team_id,
        score.home_score,
        score.away_score,
        g.playoff_series_id, g.game_number_in_series, g.game_number,
        ps.home_team_id AS series_home_team_id,
        ps.away_team_id AS series_away_team_id,
        ps.home_wins AS series_home_wins,
        ps.away_wins AS series_away_wins,
        NULL::int AS series_home_wins_at_game,
        NULL::int AS series_away_wins_at_game,
        ps.games_to_win AS series_games_to_win,
        g.notes, g.current_period, g.created_at,
        g.star_1_id, g.star_2_id, g.star_3_id,
        ps.round AS playoff_round,
        brs.round_names AS playoff_round_names,
        gs.period_scores,
        g.period_shots,
        json_build_object(
          'id', g.home_team_id,
          'name', ht.name, 'place_name', ht.place_name, 'team_name', ht.team_name, 'code', ht.code,
          'logo', ht.logo, 'logo_dark', ht.logo_dark, 'logo_light', ht.logo_light,
          'primary_color', t_home.primary_color,
          'secondary_color', t_home.secondary_color,
          'text_color', t_home.text_color
        ) AS home_team,
        json_build_object(
          'id', g.away_team_id,
          'name', at.name, 'place_name', at.place_name, 'team_name', at.team_name, 'code', at.code,
          'logo', at.logo, 'logo_dark', at.logo_dark, 'logo_light', at.logo_light,
          'primary_color', t_away.primary_color,
          'secondary_color', t_away.secondary_color,
          'text_color', t_away.text_color
        ) AS away_team,
        s.name AS season_name,
        l.id AS league_id,
        l.code AS league_code,
        l.name AS league_name,
        l.primary_color AS league_primary_color,
        l.text_color AS league_text_color,
        COALESCE(s.best_of_shootout, l.best_of_shootout) AS best_of_shootout,
        COALESCE(uwg.watched_on, uwg.watched_at::date) AS watched_on,
        uwg.scheduled_for,
        (uwg.game_id IS NOT NULL AND (uwg.watched_on IS NOT NULL OR uwg.watched_at IS NOT NULL)) AS watched_by_user,
        '[]'::json AS home_last_five,
        '[]'::json AS away_last_five,
        '[]'::json AS previous_meetings
      FROM games g
      JOIN seasons s ON s.id = g.season_id
      JOIN leagues l ON l.id = s.league_id
      JOIN teams t_home ON t_home.id = g.home_team_id
      JOIN teams t_away ON t_away.id = g.away_team_id
      LEFT JOIN playoff_series ps ON ps.id = g.playoff_series_id
      LEFT JOIN bracket_rule_sets brs ON brs.id = s.bracket_rule_set_id
      LEFT JOIN LATERAL (
        SELECT name, place_name, team_name, code, team_logo_default(logo_dark, logo_light) AS logo, team_logo_dark(logo_dark, logo_light) AS logo_dark, team_logo_light(logo_dark, logo_light) AS logo_light FROM team_iterations
        WHERE team_id = g.home_team_id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) ht ON true
      LEFT JOIN LATERAL (
        SELECT name, place_name, team_name, code, team_logo_default(logo_dark, logo_light) AS logo, team_logo_dark(logo_dark, logo_light) AS logo_dark, team_logo_light(logo_dark, logo_light) AS logo_light FROM team_iterations
        WHERE team_id = g.away_team_id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) at ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          json_agg(
            json_build_object('period', period, 'home_goals', home_cnt, 'away_goals', away_cnt)
            ORDER BY CASE period WHEN '1' THEN 1 WHEN '2' THEN 2 WHEN '3' THEN 3
                                 WHEN 'OT' THEN 4 WHEN 'SO' THEN 5 ELSE 6 END
          ), '[]'::json
        ) AS period_scores
        FROM (
          SELECT go.period,
            COUNT(*) FILTER (WHERE go.team_id = g.home_team_id) AS home_cnt,
            COUNT(*) FILTER (WHERE go.team_id = g.away_team_id) AS away_cnt
          FROM goals go WHERE go.game_id = g.id GROUP BY go.period
        ) ps
      ) gs ON true
      LEFT JOIN LATERAL (
        SELECT
          resolved.winner_team_id,
          totals.home_goals
            + CASE
                WHEN g.status = 'final'
                  AND (g.shootout OR COALESCE(g.overtime_periods, 0) > 0 OR totals.has_ot OR totals.so_home_goals > 0 OR totals.so_away_goals > 0)
                  AND totals.home_goals = totals.away_goals
                  AND resolved.winner_team_id = g.home_team_id
                THEN 1 ELSE 0
              END AS home_score,
          totals.away_goals
            + CASE
                WHEN g.status = 'final'
                  AND (g.shootout OR COALESCE(g.overtime_periods, 0) > 0 OR totals.has_ot OR totals.so_home_goals > 0 OR totals.so_away_goals > 0)
                  AND totals.home_goals = totals.away_goals
                  AND resolved.winner_team_id = g.away_team_id
                THEN 1 ELSE 0
              END AS away_score
        FROM (
          SELECT
            COUNT(*) FILTER (WHERE go.team_id = g.home_team_id AND go.period <> 'SO')::int AS home_goals,
            COUNT(*) FILTER (WHERE go.team_id = g.away_team_id AND go.period <> 'SO')::int AS away_goals,
            COUNT(*) FILTER (WHERE go.team_id = g.home_team_id AND go.period = 'SO')::int AS so_home_goals,
            COUNT(*) FILTER (WHERE go.team_id = g.away_team_id AND go.period = 'SO')::int AS so_away_goals,
            COALESCE(BOOL_OR(go.period = 'OT'), false) AS has_ot
          FROM goals go
          WHERE go.game_id = g.id
        ) totals
        LEFT JOIN LATERAL (
          SELECT
            CASE
              WHEN g.shootout OR totals.so_home_goals > 0 OR totals.so_away_goals > 0 THEN
                CASE
                  WHEN so.home_goals > so.away_goals THEN g.home_team_id
                  WHEN so.away_goals > so.home_goals THEN g.away_team_id
                  WHEN totals.so_home_goals > totals.so_away_goals THEN g.home_team_id
                  WHEN totals.so_away_goals > totals.so_home_goals THEN g.away_team_id
                  WHEN totals.home_goals > totals.away_goals THEN g.home_team_id
                  WHEN totals.away_goals > totals.home_goals THEN g.away_team_id
                  ELSE NULL
                END
              WHEN totals.home_goals > totals.away_goals THEN g.home_team_id
              WHEN totals.away_goals > totals.home_goals THEN g.away_team_id
              ELSE NULL
            END AS winner_team_id
          FROM (
            SELECT
              COUNT(*) FILTER (WHERE team_id = g.home_team_id AND scored)::int AS home_goals,
              COUNT(*) FILTER (WHERE team_id = g.away_team_id AND scored)::int AS away_goals
            FROM shootout_attempts
            WHERE game_id = g.id
          ) so
        ) resolved ON true
      ) score ON true
      LEFT JOIN user_watched_games uwg
        ON uwg.user_id = ${userId}
       AND uwg.game_id = g.id
      WHERE g.id = ${id}
        AND EXISTS (
          SELECT 1
          FROM user_favorite_teams uft
          WHERE uft.user_id = ${userId}
            AND (uft.team_id = g.home_team_id OR uft.team_id = g.away_team_id)
        )
        AND g.status <> 'cancelled'
        AND uwg.skipped_at IS NULL
      LIMIT 1
    `;

    if (rows.length === 0) return res.status(404).json({ error: 'Game not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('user game detail error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/user/leagues  – list all leagues (for filter picker)
// ---------------------------------------------------------------------------
router.get('/leagues', async (req, res) => {
  try {
    const leagues = await sql`SELECT id, name, code, logo FROM leagues ORDER BY name ASC`;
    return res.json(leagues);
  } catch (err) {
    console.error('user leagues list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/user/seasons  – list seasons, optionally filtered by league_id
// ---------------------------------------------------------------------------
router.get('/seasons', async (req, res) => {
  const { league_id } = req.query;
  try {
    const seasons = await sql`
      SELECT
        s.id,
        s.name,
        s.start_date::text AS start_date,
        s.created_at,
        (l.current_season_id = s.id) AS is_current,
        s.best_of_playoff,
        l.best_of_playoff AS league_best_of_playoff
      FROM seasons s
      JOIN leagues l ON l.id = s.league_id
      WHERE (${league_id ?? null}::uuid IS NULL OR s.league_id = ${league_id ?? null}::uuid)
      ORDER BY s.start_date DESC NULLS LAST, s.name DESC
    `;
    return res.json(seasons);
  } catch (err) {
    console.error('user seasons list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
