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
    const game = await sql`SELECT id, status FROM games WHERE id = ${gameId}`;
    if (game.length === 0) return res.status(404).json({ error: 'Game not found' });
    if (game[0].status !== 'final') {
      return res.status(400).json({ error: 'Only final games can be marked as watched' });
    }

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
// Query params: season_id, league_id, team_id/team_ids, game_type, status, include_skipped,
// watched, all_teams, date, week (YYYY-MM-DD week start), month (YYYY-MM)
// `date` (YYYY-MM-DD) filters to games whose effective user date matches — the
// user's personal scheduled_for if set, otherwise the game's Eastern-time date.
// Results default to the user's favourite teams; selected team filters override that scope.
// all_teams=true removes the favourite-team default when no selected team filter is present.
// ---------------------------------------------------------------------------
router.get('/games', async (req, res) => {
  const userId = req.user.id;
  const { season_id, league_id, team_id, game_type, status } = req.query;
  const rawTeamIds = [
    ...(Array.isArray(req.query.team_id) ? req.query.team_id : [req.query.team_id]),
    ...(Array.isArray(req.query.team_ids) ? req.query.team_ids : [req.query.team_ids]),
  ];
  const teamIds = [
    ...new Set(
      rawTeamIds
        .filter((value) => typeof value === 'string')
        .flatMap((value) => value.split(','))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
  const teamIdsParam = teamIds.length > 0 ? `{${teamIds.join(',')}}` : null;
  const includeSkipped = req.query.include_skipped === 'true' || req.query.include_skipped === '1';
  const watchedOnly = req.query.watched === 'true' || req.query.watched === '1';
  const allTeams = req.query.all_teams === 'true' || req.query.all_teams === '1';
  const week = req.query.week ?? req.query.week_start ?? null;
  const month = req.query.month ?? null;
  if (week && !/^\d{4}-\d{2}-\d{2}$/.test(String(week))) {
    return res.status(400).json({ error: 'week must be a YYYY-MM-DD date' });
  }
  if (month && !/^\d{4}-\d{2}$/.test(String(month))) {
    return res.status(400).json({ error: 'month must be a YYYY-MM value' });
  }
  const weekFilter = week ? String(week) : null;
  const monthFilter = month ? String(month) : null;
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
        g.playoff_series_id, g.game_number_in_series, g.game_number, g.league_game_number,
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
        ps.bracket_slot_key AS bracket_slot_key,
        brs.round_names   AS playoff_round_names,
        brs.matchup_names AS playoff_matchup_names,
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
        l.code AS league_code,
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
        (
          (
            ${teamIdsParam}::uuid[] IS NOT NULL
            AND (
              g.home_team_id = ANY(${teamIdsParam}::uuid[])
              OR g.away_team_id = ANY(${teamIdsParam}::uuid[])
            )
          )
          OR (
            ${teamIdsParam}::uuid[] IS NULL
            AND (
              ${allTeams}::boolean IS TRUE
              OR EXISTS (
                SELECT 1
                FROM user_favorite_teams uft
                WHERE uft.user_id = ${userId}
                  AND (uft.team_id = g.home_team_id OR uft.team_id = g.away_team_id)
              )
            )
          )
        )
        AND (${includeSkipped}::boolean OR uwg.skipped_at IS NULL)
        AND (
          ${watchedOnly}::boolean IS FALSE
          OR (uwg.watched_on IS NOT NULL OR uwg.watched_at IS NOT NULL)
        )
        AND
        (${season_id ?? null}::uuid IS NULL OR g.season_id    = ${season_id ?? null}::uuid)
        AND (${league_id ?? null}::uuid IS NULL OR l.id        = ${league_id ?? null}::uuid)
        AND (${game_type ?? null}::text IS NULL OR g.game_type = ${game_type ?? null})
        AND (${status ?? null}::text IS NULL OR g.status    = ${status ?? null})
        AND (
          ${dateFilter}::date IS NULL
          OR COALESCE(
               uwg.scheduled_for,
               (g.scheduled_at AT TIME ZONE 'America/New_York')::date
             ) = ${dateFilter}::date
        )
        AND (
          ${weekFilter}::date IS NULL
          OR COALESCE(
               uwg.scheduled_for,
               (g.scheduled_at AT TIME ZONE 'America/New_York')::date
             ) >= (${weekFilter}::date - INTERVAL '1 day')
        )
        AND (
          ${weekFilter}::date IS NULL
          OR COALESCE(
               uwg.scheduled_for,
               (g.scheduled_at AT TIME ZONE 'America/New_York')::date
             ) < (${weekFilter}::date + INTERVAL '8 days')
        )
        AND (
          ${monthFilter}::text IS NULL
          OR COALESCE(
               uwg.scheduled_for,
               (g.scheduled_at AT TIME ZONE 'America/New_York')::date
             ) >= ((${monthFilter} || '-01')::date - INTERVAL '1 day')
        )
        AND (
          ${monthFilter}::text IS NULL
          OR COALESCE(
               uwg.scheduled_for,
               (g.scheduled_at AT TIME ZONE 'America/New_York')::date
             ) < ((${monthFilter} || '-01')::date + INTERVAL '1 month' + INTERVAL '1 day')
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
// GET /api/user/games/route-lookup
// Resolves /games/<MM-DD-YYYY>/<away-code>-vs-<home-code> to one favorite-team game id.
// The route date is the Eastern game date, independent of the user's UI timezone.
// ---------------------------------------------------------------------------
router.get('/games/route-lookup', async (req, res) => {
  const userId = req.user.id;
  const { game_date, game_slug } = req.query;
  if (!game_date || !game_slug) {
    return res.status(400).json({ error: 'game_date and game_slug are required' });
  }
  if (!/^\d{2}-\d{2}-\d{4}$/.test(String(game_date))) {
    return res.status(400).json({ error: 'game_date must be MM-DD-YYYY' });
  }

  const [month, day, year] = String(game_date).split('-');
  const gameDate = `${year}-${month}-${day}`;

  try {
    const rows = await sql`
      SELECT g.id AS game_id
      FROM games g
      JOIN seasons s ON s.id = g.season_id
      JOIN leagues l ON l.id = s.league_id
      LEFT JOIN LATERAL (
        SELECT code
        FROM team_iterations
        WHERE team_id = g.away_team_id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) away_identity ON true
      LEFT JOIN LATERAL (
        SELECT code
        FROM team_iterations
        WHERE team_id = g.home_team_id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) home_identity ON true
      WHERE (
          (g.scheduled_at AT TIME ZONE 'America/New_York')::date = ${gameDate}::date
          OR (g.scheduled_at AT TIME ZONE 'UTC')::date = ${gameDate}::date
        )
        AND CONCAT(
          regexp_replace(
            regexp_replace(lower(COALESCE(away_identity.code, '')), '[^a-z0-9]+', '-', 'g'),
            '(^-+|-+$)',
            '',
            'g'
          ),
          '-vs-',
          regexp_replace(
            regexp_replace(lower(COALESCE(home_identity.code, '')), '[^a-z0-9]+', '-', 'g'),
            '(^-+|-+$)',
            '',
            'g'
          )
        ) = ${game_slug}
        AND EXISTS (
          SELECT 1
          FROM user_favorite_teams uft
          WHERE uft.user_id = ${userId}
            AND (uft.team_id = g.home_team_id OR uft.team_id = g.away_team_id)
        )
      ORDER BY g.scheduled_at DESC NULLS LAST, g.created_at DESC, g.id DESC
      LIMIT 1
    `;

    if (rows.length === 0) return res.status(404).json({ error: 'Game route not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('user games route lookup error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/user/games/:id  - read-only game detail for authenticated users
// Scoped to games involving the user's favourite teams.
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
        g.playoff_series_id, g.game_number_in_series, g.game_number, g.league_game_number,
        ps.home_team_id AS series_home_team_id,
        ps.away_team_id AS series_away_team_id,
        ps.home_wins AS series_home_wins,
        ps.away_wins AS series_away_wins,
        series_progress.series_home_wins_at_game,
        series_progress.series_away_wins_at_game,
        ps.games_to_win AS series_games_to_win,
        g.notes, g.current_period, g.created_at,
        g.star_1_id, g.star_2_id, g.star_3_id,
        ps.round AS playoff_round,
        ps.bracket_slot_key AS bracket_slot_key,
        brs.round_names AS playoff_round_names,
        brs.matchup_names AS playoff_matchup_names,
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
        (uwg.skipped_at IS NOT NULL) AS skipped_by_user,
        (uwg.game_id IS NOT NULL AND (uwg.watched_on IS NOT NULL OR uwg.watched_at IS NOT NULL)) AS watched_by_user,
        home_l5.home_last_five,
        away_l5.away_last_five,
        prev.previous_meetings
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
      -- Last 5 final games for the home team within this season
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          json_agg(
            json_build_object(
              'game_id',          lg.id,
              'scheduled_at',     lg.scheduled_at,
              'home_score',       lg.home_goals + CASE WHEN lg.so_winner_team_id = lg.home_team_id THEN 1 ELSE 0 END,
              'away_score',       lg.away_goals + CASE WHEN lg.so_winner_team_id = lg.away_team_id THEN 1 ELSE 0 END,
              'overtime_periods', lg.overtime_periods,
              'shootout',         lg.shootout,
              'result', CASE
                WHEN lg.shootout THEN
                  CASE WHEN lg.so_winner_team_id = g.home_team_id THEN 'W' ELSE 'L' END
                WHEN (lg.home_team_id = g.home_team_id AND lg.home_goals > lg.away_goals)
                  OR (lg.away_team_id = g.home_team_id AND lg.away_goals > lg.home_goals) THEN 'W'
                WHEN (lg.home_team_id = g.home_team_id AND lg.home_goals < lg.away_goals)
                  OR (lg.away_team_id = g.home_team_id AND lg.away_goals < lg.home_goals) THEN 'L'
                ELSE 'T'
              END,
              'opponent_team_id', CASE WHEN lg.home_team_id = g.home_team_id THEN lg.away_team_id ELSE lg.home_team_id END,
              'opponent_name',    opp_ti.name,
              'opponent_code',    opp_ti.code,
              'opponent_logo',    opp_ti.logo,
              'opponent_logo_dark', opp_ti.logo_dark,
              'opponent_logo_light', opp_ti.logo_light,
              'is_home',          (lg.home_team_id = g.home_team_id)
            ) ORDER BY lg.scheduled_at DESC NULLS LAST, lg.created_at DESC
          ),
          '[]'::json
        ) AS home_last_five
        FROM (
          SELECT
            g2.id, g2.scheduled_at, g2.created_at, g2.overtime_periods, g2.shootout,
            g2.home_team_id, g2.away_team_id,
            (SELECT COUNT(*) FROM goals WHERE game_id = g2.id AND team_id = g2.home_team_id)::int AS home_goals,
            (SELECT COUNT(*) FROM goals WHERE game_id = g2.id AND team_id = g2.away_team_id)::int AS away_goals,
            CASE WHEN g2.shootout THEN (
              SELECT CASE
                WHEN COUNT(*) FILTER (WHERE team_id = g2.home_team_id AND scored) >
                     COUNT(*) FILTER (WHERE team_id = g2.away_team_id AND scored)
                THEN g2.home_team_id
                WHEN COUNT(*) FILTER (WHERE team_id = g2.away_team_id AND scored) >
                     COUNT(*) FILTER (WHERE team_id = g2.home_team_id AND scored)
                THEN g2.away_team_id
                ELSE NULL
              END
              FROM shootout_attempts WHERE game_id = g2.id
            ) END AS so_winner_team_id
          FROM games g2
          WHERE g2.season_id = g.season_id
            AND g2.id != g.id
            AND g2.status = 'final'
            AND (g.game_type != 'playoff' OR g2.game_type = 'playoff')
            AND (g2.home_team_id = g.home_team_id OR g2.away_team_id = g.home_team_id)
            AND g2.scheduled_at < g.scheduled_at
          ORDER BY g2.scheduled_at DESC NULLS LAST, g2.created_at DESC
          LIMIT 5
        ) lg
        LEFT JOIN LATERAL (
          SELECT name, code, team_logo_default(logo_dark, logo_light) AS logo, team_logo_dark(logo_dark, logo_light) AS logo_dark, team_logo_light(logo_dark, logo_light) AS logo_light FROM team_iterations
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
              'home_score',       lg.home_goals + CASE WHEN lg.so_winner_team_id = lg.home_team_id THEN 1 ELSE 0 END,
              'away_score',       lg.away_goals + CASE WHEN lg.so_winner_team_id = lg.away_team_id THEN 1 ELSE 0 END,
              'overtime_periods', lg.overtime_periods,
              'shootout',         lg.shootout,
              'result', CASE
                WHEN lg.shootout THEN
                  CASE WHEN lg.so_winner_team_id = g.away_team_id THEN 'W' ELSE 'L' END
                WHEN (lg.home_team_id = g.away_team_id AND lg.home_goals > lg.away_goals)
                  OR (lg.away_team_id = g.away_team_id AND lg.away_goals > lg.home_goals) THEN 'W'
                WHEN (lg.home_team_id = g.away_team_id AND lg.home_goals < lg.away_goals)
                  OR (lg.away_team_id = g.away_team_id AND lg.away_goals < lg.home_goals) THEN 'L'
                ELSE 'T'
              END,
              'opponent_team_id', CASE WHEN lg.home_team_id = g.away_team_id THEN lg.away_team_id ELSE lg.home_team_id END,
              'opponent_name',    opp_ti.name,
              'opponent_code',    opp_ti.code,
              'opponent_logo',    opp_ti.logo,
              'opponent_logo_dark', opp_ti.logo_dark,
              'opponent_logo_light', opp_ti.logo_light,
              'is_home',          (lg.home_team_id = g.away_team_id)
            ) ORDER BY lg.scheduled_at DESC NULLS LAST, lg.created_at DESC
          ),
          '[]'::json
        ) AS away_last_five
        FROM (
          SELECT
            g2.id, g2.scheduled_at, g2.created_at, g2.overtime_periods, g2.shootout,
            g2.home_team_id, g2.away_team_id,
            (SELECT COUNT(*) FROM goals WHERE game_id = g2.id AND team_id = g2.home_team_id)::int AS home_goals,
            (SELECT COUNT(*) FROM goals WHERE game_id = g2.id AND team_id = g2.away_team_id)::int AS away_goals,
            CASE WHEN g2.shootout THEN (
              SELECT CASE
                WHEN COUNT(*) FILTER (WHERE team_id = g2.home_team_id AND scored) >
                     COUNT(*) FILTER (WHERE team_id = g2.away_team_id AND scored)
                THEN g2.home_team_id
                WHEN COUNT(*) FILTER (WHERE team_id = g2.away_team_id AND scored) >
                     COUNT(*) FILTER (WHERE team_id = g2.home_team_id AND scored)
                THEN g2.away_team_id
                ELSE NULL
              END
              FROM shootout_attempts WHERE game_id = g2.id
            ) END AS so_winner_team_id
          FROM games g2
          WHERE g2.season_id = g.season_id
            AND g2.id != g.id
            AND g2.status = 'final'
            AND (g.game_type != 'playoff' OR g2.game_type = 'playoff')
            AND (g2.home_team_id = g.away_team_id OR g2.away_team_id = g.away_team_id)
            AND g2.scheduled_at < g.scheduled_at
          ORDER BY g2.scheduled_at DESC NULLS LAST, g2.created_at DESC
          LIMIT 5
        ) lg
        LEFT JOIN LATERAL (
          SELECT name, code, team_logo_default(logo_dark, logo_light) AS logo, team_logo_dark(logo_dark, logo_light) AS logo_dark, team_logo_light(logo_dark, logo_light) AS logo_light FROM team_iterations
          WHERE team_id = CASE WHEN lg.home_team_id = g.away_team_id THEN lg.away_team_id ELSE lg.home_team_id END
          ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
          LIMIT 1
        ) opp_ti ON true
      ) away_l5 ON true
      -- All other meetings between home and away teams in the same season
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          json_agg(
            json_build_object(
              'game_id',               lg.id,
              'scheduled_at',          lg.scheduled_at,
              'created_at',            lg.created_at,
              'status',                lg.status,
              'current_home_was_home', (lg.home_team_id = g.home_team_id),
              'home_team', json_build_object(
                'id', lg.home_team_id,
                'name', lg_home_ti.name, 'place_name', lg_home_ti.place_name, 'team_name', lg_home_ti.team_name, 'code', lg_home_ti.code,
                'logo', lg_home_ti.logo, 'logo_dark', lg_home_ti.logo_dark, 'logo_light', lg_home_ti.logo_light,
                'primary_color', lg_home_team.primary_color,
                'secondary_color', lg_home_team.secondary_color,
                'text_color', lg_home_team.text_color
              ),
              'away_team', json_build_object(
                'id', lg.away_team_id,
                'name', lg_away_ti.name, 'place_name', lg_away_ti.place_name, 'team_name', lg_away_ti.team_name, 'code', lg_away_ti.code,
                'logo', lg_away_ti.logo, 'logo_dark', lg_away_ti.logo_dark, 'logo_light', lg_away_ti.logo_light,
                'primary_color', lg_away_team.primary_color,
                'secondary_color', lg_away_team.secondary_color,
                'text_color', lg_away_team.text_color
              ),
              'home_score',            lg.home_goals + CASE WHEN lg.so_winner_team_id = lg.home_team_id THEN 1 ELSE 0 END,
              'away_score',            lg.away_goals + CASE WHEN lg.so_winner_team_id = lg.away_team_id THEN 1 ELSE 0 END,
              'overtime_periods',      lg.overtime_periods,
              'shootout',              lg.shootout
            ) ORDER BY lg.scheduled_at ASC NULLS LAST, lg.created_at ASC
          ),
          '[]'::json
        ) AS previous_meetings
        FROM (
          SELECT
            g2.id, g2.scheduled_at, g2.created_at, g2.status, g2.overtime_periods, g2.shootout,
            g2.home_team_id, g2.away_team_id,
            (SELECT COUNT(*) FROM goals WHERE game_id = g2.id AND team_id = g2.home_team_id)::int AS home_goals,
            (SELECT COUNT(*) FROM goals WHERE game_id = g2.id AND team_id = g2.away_team_id)::int AS away_goals,
            CASE WHEN g2.shootout THEN (
              SELECT CASE
                WHEN COUNT(*) FILTER (WHERE team_id = g2.home_team_id AND scored) >
                     COUNT(*) FILTER (WHERE team_id = g2.away_team_id AND scored)
                THEN g2.home_team_id
                WHEN COUNT(*) FILTER (WHERE team_id = g2.away_team_id AND scored) >
                     COUNT(*) FILTER (WHERE team_id = g2.home_team_id AND scored)
                THEN g2.away_team_id
                ELSE NULL
              END
              FROM shootout_attempts WHERE game_id = g2.id
            ) END AS so_winner_team_id
          FROM games g2
          WHERE g2.season_id = g.season_id
            AND g2.id != g.id
            AND (g.game_type != 'playoff' OR g2.game_type = 'playoff')
            AND (
              (g2.home_team_id = g.home_team_id AND g2.away_team_id = g.away_team_id)
              OR
              (g2.home_team_id = g.away_team_id AND g2.away_team_id = g.home_team_id)
            )
          ORDER BY g2.scheduled_at ASC NULLS LAST, g2.created_at ASC
        ) lg
        JOIN teams lg_home_team ON lg_home_team.id = lg.home_team_id
        JOIN teams lg_away_team ON lg_away_team.id = lg.away_team_id
        LEFT JOIN LATERAL (
          SELECT name, place_name, team_name, code, team_logo_default(logo_dark, logo_light) AS logo, team_logo_dark(logo_dark, logo_light) AS logo_dark, team_logo_light(logo_dark, logo_light) AS logo_light FROM team_iterations
          WHERE team_id = lg.home_team_id
          ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
          LIMIT 1
        ) lg_home_ti ON true
        LEFT JOIN LATERAL (
          SELECT name, place_name, team_name, code, team_logo_default(logo_dark, logo_light) AS logo, team_logo_dark(logo_dark, logo_light) AS logo_dark, team_logo_light(logo_dark, logo_light) AS logo_light FROM team_iterations
          WHERE team_id = lg.away_team_id
          ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
          LIMIT 1
        ) lg_away_ti ON true
      ) prev ON true
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
// GET /api/user/players - read-only roster list for team detail pages
router.get('/players', async (req, res) => {
  const { team_id, season_id, game_date } = req.query;
  const prospectsOnly = req.query.prospects_only === 'true';
  const includeProspects =
    prospectsOnly || req.query.include_prospects === 'true';

  if (!team_id) return res.status(400).json({ error: 'team_id is required' });

  try {
    const players = season_id
      ? await sql`
          SELECT
            id, first_name, last_name, photo,
            date_of_birth::text AS date_of_birth,
            birth_city, birth_country,
            height_cm, weight_lbs, position, shoots,
            rookie_season_id, rookie_season_name,
            status, is_active, created_at,
            jersey_number, player_team_id, team_id, team_name, primary_color, text_color, is_prospect
          FROM (
            SELECT DISTINCT ON (p.id)
              p.id, p.first_name, p.last_name,
              COALESCE(best_player_photo(p.id, pt.season_id, pt.team_id), p.photo) AS photo,
              p.date_of_birth,
              p.birth_city, p.birth_country,
              p.height_cm, p.weight_lbs, COALESCE(pt.position, p.position) AS position, p.shoots,
              p.rookie_season_id,
              (SELECT rs.name FROM seasons rs WHERE rs.id = p.rookie_season_id) AS rookie_season_name,
              p.status, p.is_active, p.created_at,
              pt.jersey_number,
              pt.id AS player_team_id,
              pt.team_id,
              pt.is_prospect,
              ti.name AS team_name,
              t.primary_color,
              t.text_color
            FROM players p
            JOIN player_teams pt ON pt.player_id = p.id
                                AND pt.team_id = ${team_id}
                                AND pt.season_id = ${season_id}
                                AND (${includeProspects} OR pt.is_prospect = FALSE)
                                AND (${!prospectsOnly} OR pt.is_prospect = TRUE)
                                AND (pt.start_date IS NULL OR pt.start_date <= COALESCE(${game_date ?? null}::date, CURRENT_DATE))
                                AND (pt.end_date IS NULL OR pt.end_date >= COALESCE(${game_date ?? null}::date, CURRENT_DATE))
            JOIN teams t ON t.id = pt.team_id
            LEFT JOIN LATERAL (
              SELECT name FROM team_iterations
              WHERE team_id = t.id
              ORDER BY CASE WHEN end_date IS NULL THEN 0 ELSE 1 END, start_date DESC NULLS LAST, recorded_at DESC
              LIMIT 1
            ) ti ON TRUE
            ORDER BY p.id
          ) sub
          ORDER BY last_name, first_name
        `
      : await sql`
          SELECT
            id, first_name, last_name, photo,
            date_of_birth::text AS date_of_birth,
            birth_city, birth_country,
            height_cm, weight_lbs, position, shoots,
            rookie_season_id, rookie_season_name,
            status, is_active, created_at,
            jersey_number, player_team_id, team_id, team_name, primary_color, text_color, is_prospect
          FROM (
            SELECT DISTINCT ON (p.id)
              p.id, p.first_name, p.last_name,
              COALESCE(best_player_photo(p.id, pt.season_id, pt.team_id), p.photo) AS photo,
              p.date_of_birth,
              p.birth_city, p.birth_country,
              p.height_cm, p.weight_lbs, COALESCE(pt.position, p.position) AS position, p.shoots,
              p.rookie_season_id,
              (SELECT rs.name FROM seasons rs WHERE rs.id = p.rookie_season_id) AS rookie_season_name,
              p.status, p.is_active, p.created_at,
              pt.jersey_number,
              pt.id AS player_team_id,
              pt.team_id,
              pt.is_prospect,
              ti.name AS team_name,
              t.primary_color,
              t.text_color
            FROM players p
            JOIN player_teams pt ON pt.player_id = p.id
                                AND pt.team_id = ${team_id}
                                AND (${includeProspects} OR pt.is_prospect = FALSE)
                                AND (${!prospectsOnly} OR pt.is_prospect = TRUE)
            JOIN teams t ON t.id = pt.team_id
            LEFT JOIN LATERAL (
              SELECT name FROM team_iterations
              WHERE team_id = t.id
              ORDER BY CASE WHEN end_date IS NULL THEN 0 ELSE 1 END, start_date DESC NULLS LAST, recorded_at DESC
              LIMIT 1
            ) ti ON TRUE
            ORDER BY p.id, pt.season_id DESC
          ) sub
          ORDER BY last_name, first_name
        `;

    return res.json(players);
  } catch (err) {
    console.error('user players list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/user/players/route-lookup - resolve pretty player detail URLs
// ---------------------------------------------------------------------------
router.get('/players/route-lookup', async (req, res) => {
  const leagueCode = String(req.query.league_code || '').trim();
  const teamCode = String(req.query.team_code || '').trim();
  const playerSlug = String(req.query.player_slug || '')
    .trim()
    .toLowerCase();

  if (!leagueCode || !playerSlug) {
    return res.status(400).json({ error: 'league_code and player_slug are required' });
  }

  try {
    const rows = await sql`
      WITH candidate_routes AS (
        SELECT
          p.id AS player_id,
          p.league_player_number,
          t.id AS roster_team_id,
          l.id AS league_id,
          l.code AS league_code,
          ti.code AS roster_team_code,
          COALESCE(latest_jnh.jersey_number, pt.jersey_number) AS jersey_number,
          pt.jersey_number AS roster_jersey_number,
          pt.start_date,
          pt.end_date,
          pt.created_at,
          trim(both '-' from regexp_replace(
            lower(trim(concat_ws(' ', p.first_name, p.last_name))),
            '[^a-z0-9]+',
            '-',
            'g'
          )) AS name_slug,
          trim(both '-' from regexp_replace(
            lower(trim(COALESCE(p.league_player_number, ''))),
            '[^a-z0-9]+',
            '-',
            'g'
          )) AS league_player_slug
        FROM players p
        JOIN player_teams pt ON pt.player_id = p.id
        JOIN teams t ON t.id = pt.team_id
        JOIN leagues l ON l.id = t.league_id
        LEFT JOIN LATERAL (
          SELECT code
          FROM team_iterations
          WHERE team_id = t.id
          ORDER BY
            CASE WHEN end_date IS NULL THEN 0 ELSE 1 END,
            start_date DESC NULLS LAST,
            recorded_at DESC NULLS LAST
          LIMIT 1
        ) ti ON true
        LEFT JOIN LATERAL (
          SELECT jersey_number
          FROM jersey_number_history
          WHERE player_teams_id = pt.id
          ORDER BY effective_from DESC, id DESC
          LIMIT 1
        ) latest_jnh ON true
        WHERE lower(l.code) = lower(${leagueCode})
          AND (${teamCode || null}::text IS NULL OR lower(ti.code) = lower(${teamCode}))
      ),
      matched_routes AS (
        SELECT
          *,
          CASE
            WHEN ${teamCode || null}::text IS NOT NULL
              AND jersey_number IS NOT NULL
              AND name_slug <> ''
            THEN jersey_number::text || '-' || name_slug
            WHEN ${teamCode || null}::text IS NULL
              AND league_player_slug <> ''
            THEN league_player_slug
            ELSE name_slug
          END AS player_slug,
          CASE
            WHEN ${teamCode || null}::text IS NOT NULL
              AND jersey_number IS NOT NULL
              AND (jersey_number::text || '-' || name_slug) = ${playerSlug}
            THEN 0
            WHEN ${teamCode || null}::text IS NULL
              AND league_player_slug = ${playerSlug}
            THEN 0
            WHEN name_slug = ${playerSlug}
            THEN 1
            WHEN league_player_slug = ${playerSlug}
            THEN 2
            WHEN roster_jersey_number IS NOT NULL
              AND (roster_jersey_number::text || '-' || name_slug) = ${playerSlug}
            THEN 3
            ELSE 4
          END AS match_rank
        FROM candidate_routes
        WHERE name_slug = ${playerSlug}
          OR league_player_slug = ${playerSlug}
          OR (
            jersey_number IS NOT NULL
            AND (jersey_number::text || '-' || name_slug) = ${playerSlug}
          )
          OR (
            roster_jersey_number IS NOT NULL
            AND (roster_jersey_number::text || '-' || name_slug) = ${playerSlug}
          )
      )
      SELECT
        player_id,
        CASE WHEN ${teamCode || null}::text IS NULL THEN NULL ELSE roster_team_id END AS team_id,
        league_id,
        league_code,
        CASE WHEN ${teamCode || null}::text IS NULL THEN NULL ELSE roster_team_code END AS team_code,
        player_slug
      FROM matched_routes
      ORDER BY
        match_rank,
        CASE WHEN end_date IS NULL THEN 0 ELSE 1 END,
        end_date DESC NULLS LAST,
        start_date DESC NULLS LAST,
        created_at DESC NULLS LAST
      LIMIT 1
    `;

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Player route not found' });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error('user player route-lookup error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/user/players/:id/stats - career stats for one player
// ---------------------------------------------------------------------------
router.get('/players/:id/stats', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`
      WITH stat_rows AS (
        SELECT
          gps.season_id,
          gps.team_id,
          COUNT(*)::int AS gp,
          SUM(gps.goals)::int AS goals,
          SUM(gps.assists)::int AS assists,
          SUM(gps.points)::int AS points
        FROM game_player_stats gps
        WHERE gps.player_id = ${id}
        GROUP BY gps.season_id, gps.team_id
      )
      SELECT
        s.id AS season_id,
        s.name AS season_name,
        ptr.jersey_number,
        COALESCE(sr.gp, 0) AS gp,
        COALESCE(sr.goals, 0) AS goals,
        COALESCE(sr.assists, 0) AS assists,
        COALESCE(sr.points, 0) AS points,
        sr.team_id,
        ti.name AS team_name,
        ti.logo AS team_logo,
        ti.logo_dark AS team_logo_dark,
        ti.logo_light AS team_logo_light,
        t.primary_color,
        t.text_color
      FROM stat_rows sr
      JOIN seasons s ON s.id = sr.season_id
      LEFT JOIN LATERAL (
        SELECT
          pt.jersey_number,
          pt.start_date,
          pt.end_date,
          pt.created_at
        FROM player_teams pt
        WHERE pt.player_id = ${id}
          AND pt.season_id = sr.season_id
          AND pt.team_id = sr.team_id
        ORDER BY pt.end_date DESC NULLS FIRST, pt.created_at DESC
        LIMIT 1
      ) ptr ON TRUE
      LEFT JOIN teams t ON t.id = sr.team_id
      LEFT JOIN LATERAL (
        SELECT
          name,
          team_logo_default(logo_dark, logo_light) AS logo,
          team_logo_dark(logo_dark, logo_light) AS logo_dark,
          team_logo_light(logo_dark, logo_light) AS logo_light
        FROM team_iterations
        WHERE team_id = sr.team_id
        ORDER BY
          CASE
            WHEN (start_date IS NULL OR start_date <= COALESCE(ptr.end_date, s.end_date, CURRENT_DATE))
             AND (end_date IS NULL OR end_date >= COALESCE(ptr.start_date, s.start_date, ptr.created_at::date))
            THEN 0
            WHEN end_date IS NULL THEN 1
            ELSE 2
          END,
          start_date DESC NULLS LAST,
          recorded_at DESC
        LIMIT 1
      ) ti ON sr.team_id IS NOT NULL
      ORDER BY s.created_at DESC, ti.name NULLS LAST
    `;
    return res.json(rows);
  } catch (err) {
    console.error('user player stats error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/user/players/:id/awards - winner awards for one player
// ---------------------------------------------------------------------------
router.get('/players/:id/awards', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`
      WITH winning_awards AS (
        SELECT
          sar.id,
          la.id AS award_id,
          sa.id AS season_award_id,
          la.name AS award_name,
          la.competition_scope,
          la.stat_key,
          'player' AS recipient_type,
          s.id AS season_id,
          s.name AS season_name,
          sa.awarded_at::text AS awarded_at,
          COALESCE(NULLIF(ptr.photo, ''), best_player_photo(sar.player_id, s.id, ptr.team_id), NULLIF(p.photo, '')) AS player_photo,
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
          t.text_color AS team_text_color,
          s.start_date AS season_start_date,
          s.created_at AS season_created_at,
          sa.awarded_at AS awarded_date,
          la.sort_order,
          0 AS source_order
        FROM season_award_recipients sar
        JOIN season_awards sa ON sa.id = sar.season_award_id
        JOIN league_awards la ON la.id = sa.award_id
        JOIN seasons s ON s.id = sa.season_id
        JOIN players p ON p.id = sar.player_id
        LEFT JOIN LATERAL (
          SELECT team_id, photo, start_date, end_date, created_at
          FROM player_teams pt
          WHERE pt.player_id = sar.player_id
            AND pt.season_id = s.id
          ORDER BY
            CASE
              WHEN sa.awarded_at IS NOT NULL
               AND (pt.start_date IS NULL OR pt.start_date <= sa.awarded_at)
               AND (pt.end_date IS NULL OR pt.end_date >= sa.awarded_at)
              THEN 0
              WHEN pt.end_date IS NULL THEN 1
              ELSE 2
            END,
            COALESCE(pt.end_date, pt.start_date, pt.created_at::date) DESC NULLS LAST,
            pt.created_at DESC,
            pt.id DESC
          LIMIT 1
        ) ptr ON TRUE
        LEFT JOIN teams t ON t.id = COALESCE(sar.team_id, ptr.team_id)
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
        WHERE sar.recipient_type = 'player'
          AND sar.role = 'winner'
          AND sar.player_id = ${id}

        UNION ALL

        SELECT
          sar.id,
          la.id AS award_id,
          sa.id AS season_award_id,
          la.name AS award_name,
          la.competition_scope,
          la.stat_key,
          'team' AS recipient_type,
          s.id AS season_id,
          s.name AS season_name,
          sa.awarded_at::text AS awarded_at,
          NULL::text AS player_photo,
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
          t.text_color AS team_text_color,
          s.start_date AS season_start_date,
          s.created_at AS season_created_at,
          sa.awarded_at AS awarded_date,
          la.sort_order,
          1 AS source_order
        FROM season_award_recipients sar
        JOIN season_awards sa ON sa.id = sar.season_award_id
        JOIN league_awards la ON la.id = sa.award_id
        JOIN seasons s ON s.id = sa.season_id
        JOIN LATERAL (
          SELECT team_id
          FROM player_teams pt
          WHERE pt.player_id = ${id}
            AND pt.season_id = s.id
          ORDER BY
            CASE WHEN pt.end_date IS NULL THEN 0 ELSE 1 END,
            COALESCE(pt.end_date, pt.start_date, pt.created_at::date, s.start_date) DESC NULLS LAST,
            pt.created_at DESC,
            pt.id DESC
          LIMIT 1
        ) latest_pt ON latest_pt.team_id = sar.team_id
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
      )
      SELECT
        id,
        award_id,
        season_award_id,
        award_name,
        competition_scope,
        stat_key,
        recipient_type,
        season_id,
        season_name,
        awarded_at,
        player_photo,
        team_id,
        team_name,
        team_place_name,
        team_team_name,
        team_code,
        team_logo,
        team_logo_dark,
        team_logo_light,
        team_primary_color,
        team_secondary_color,
        team_text_color
      FROM winning_awards
      ORDER BY
        season_start_date DESC NULLS LAST,
        season_created_at DESC,
        sort_order ASC,
        award_name ASC,
        source_order ASC,
        id ASC
    `;
    return res.json(rows);
  } catch (err) {
    console.error('user player awards error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/user/players/:id/latest-season-stats
// ---------------------------------------------------------------------------
router.get(['/players/:id/current-season-stats', '/players/:id/latest-season-stats'], async (req, res) => {
  const { id } = req.params;
  const requestedSeasonId =
    typeof req.query.season_id === 'string' && req.query.season_id.trim()
      ? req.query.season_id.trim()
      : null;
  try {
    const seasonRows = requestedSeasonId
      ? await sql`
          WITH player_info AS (
            SELECT position FROM players WHERE id = ${id}
          )
          SELECT
            s.id AS season_id,
            s.name AS season_name,
            (SELECT position FROM player_info) AS player_position
          FROM seasons s
          WHERE s.id = ${requestedSeasonId}
          LIMIT 1
        `
      : await sql`
          WITH player_info AS (
            SELECT position FROM players WHERE id = ${id}
          ),
          played_seasons AS (
            SELECT DISTINCT gps.season_id
            FROM game_player_stats gps
            JOIN games g ON g.id = gps.game_id
            WHERE gps.player_id = ${id}
              AND g.status = 'final'
          )
          SELECT
            s.id AS season_id,
            s.name AS season_name,
            (SELECT position FROM player_info) AS player_position
          FROM played_seasons ps
          JOIN seasons s ON s.id = ps.season_id
          ORDER BY s.start_date DESC NULLS LAST, s.created_at DESC, s.name DESC
          LIMIT 1
        `;

    if (seasonRows.length === 0) return res.json(null);
    const { season_id, season_name, player_position } = seasonRows[0];

    const statRows = await sql`
      SELECT
        gps.game_type,
        COUNT(*) FILTER (WHERE gps.is_goalie = false)::int AS skater_gp,
        COALESCE(SUM(gps.goals) FILTER (WHERE gps.is_goalie = false), 0)::int AS goals,
        COALESCE(SUM(gps.assists) FILTER (WHERE gps.is_goalie = false), 0)::int AS assists,
        COALESCE(SUM(gps.points) FILTER (WHERE gps.is_goalie = false), 0)::int AS points,
        COUNT(*) FILTER (WHERE gps.is_goalie = true)::int AS goalie_gp,
        COALESCE(SUM(gps.shots_against) FILTER (WHERE gps.is_goalie = true), 0)::int AS shots_against,
        COALESCE(SUM(gps.goals_against) FILTER (WHERE gps.is_goalie = true), 0)::int AS goals_against,
        COALESCE(SUM(gps.saves) FILTER (WHERE gps.is_goalie = true), 0)::int AS saves,
        COALESCE(SUM(gps.time_on_ice) FILTER (WHERE gps.is_goalie = true), 0)::int AS time_on_ice,
        COUNT(*) FILTER (WHERE gps.is_goalie = true AND gps.goalie_win)::int AS wins,
        COUNT(*) FILTER (WHERE gps.is_goalie = true AND gps.shootout_win)::int AS shootout_wins
      FROM game_player_stats gps
      WHERE gps.player_id = ${id}
        AND gps.season_id = ${season_id}
      GROUP BY gps.game_type
    `;

    const byType = Object.fromEntries(statRows.map((row) => [row.game_type, row]));
    const makeStats = (gameType) => {
      const row = byType[gameType];
      if (!row) return null;

      const isGoalie = player_position === 'G';
      const goalieGp = Number(row.goalie_gp ?? 0);
      const skaterGp = Number(row.skater_gp ?? 0);
      if (isGoalie && goalieGp === 0) return null;
      if (!isGoalie && skaterGp === 0 && goalieGp === 0) return null;

      const shotsAgainst = Number(row.shots_against ?? 0);
      const goalsAgainst = Number(row.goals_against ?? 0);
      const saves = Number(row.saves ?? Math.max(shotsAgainst - goalsAgainst, 0));

      return {
        gp: isGoalie ? goalieGp : skaterGp,
        goals: isGoalie ? 0 : Number(row.goals ?? 0),
        assists: isGoalie ? 0 : Number(row.assists ?? 0),
        points: isGoalie ? 0 : Number(row.points ?? 0),
        wins: Number(row.wins ?? 0),
        shootout_wins: Number(row.shootout_wins ?? 0),
        goals_against: goalsAgainst,
        shots_against: shotsAgainst,
        save_pct: shotsAgainst > 0 ? Math.round((saves / shotsAgainst) * 1000) / 1000 : null,
        time_on_ice: Number(row.time_on_ice ?? 0),
      };
    };

    return res.json({
      season_id,
      season_name,
      regular: makeStats('regular'),
      playoffs: makeStats('playoff'),
    });
  } catch (err) {
    console.error('user player latest-season-stats error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/user/players/:id/last-five-games
// ---------------------------------------------------------------------------
router.get('/players/:id/last-five-games', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`
      WITH recent_games AS (
        SELECT
          gps.game_id,
          gps.season_id,
          s.name AS season_name,
          g.scheduled_at,
          gps.game_type,
          gps.team_id,
          gps.opponent_team_id,
          gps.is_home,
          gps.goals,
          gps.assists,
          gps.points,
          CASE WHEN gps.is_goalie THEN gps.goalie_started ELSE NULL::boolean END AS goalie_started,
          CASE WHEN gps.is_goalie THEN gps.shots_against ELSE NULL::int END AS shots_against,
          CASE WHEN gps.is_goalie THEN gps.goals_against ELSE NULL::int END AS goals_against,
          CASE
            WHEN gps.is_goalie AND gps.shots_against > 0
              THEN ROUND(gps.saves::numeric / gps.shots_against, 3)::float
            ELSE NULL::float
          END AS save_pct,
          CASE WHEN gps.is_goalie THEN gps.time_on_ice ELSE NULL::int END AS time_on_ice
        FROM game_player_stats gps
        JOIN games g ON g.id = gps.game_id
          AND g.status = 'final'
        JOIN seasons s ON s.id = gps.season_id
        WHERE gps.player_id = ${id}
        ORDER BY g.scheduled_at DESC NULLS LAST, gps.game_id DESC
        LIMIT 5
      )
      SELECT
        rg.game_id,
        rg.season_id,
        rg.season_name,
        rg.scheduled_at,
        rg.game_type,
        rg.team_id,
        ti.name AS team_name,
        ti.code AS team_code,
        ti.logo AS team_logo,
        t.primary_color AS team_primary_color,
        t.text_color AS team_text_color,
        rg.opponent_team_id,
        oti.name AS opponent_name,
        oti.code AS opponent_code,
        oti.logo AS opponent_logo,
        ot.primary_color AS opponent_primary_color,
        ot.text_color AS opponent_text_color,
        rg.is_home,
        rg.goals,
        rg.assists,
        rg.points,
        rg.goalie_started,
        rg.shots_against,
        rg.goals_against,
        rg.save_pct,
        rg.time_on_ice
      FROM recent_games rg
      LEFT JOIN teams t ON t.id = rg.team_id
      LEFT JOIN LATERAL (
        SELECT name, code, team_logo_default(logo_dark, logo_light) AS logo
        FROM team_iterations
        WHERE team_id = rg.team_id
        ORDER BY
          CASE
            WHEN (start_date IS NULL OR start_date <= COALESCE(rg.scheduled_at::date, CURRENT_DATE))
             AND (end_date IS NULL OR end_date >= COALESCE(rg.scheduled_at::date, CURRENT_DATE))
            THEN 0
            WHEN end_date IS NULL THEN 1
            ELSE 2
          END,
          start_date DESC NULLS LAST,
          recorded_at DESC
        LIMIT 1
      ) ti ON TRUE
      LEFT JOIN teams ot ON ot.id = rg.opponent_team_id
      LEFT JOIN LATERAL (
        SELECT name, code, team_logo_default(logo_dark, logo_light) AS logo
        FROM team_iterations
        WHERE team_id = rg.opponent_team_id
        ORDER BY
          CASE
            WHEN (start_date IS NULL OR start_date <= COALESCE(rg.scheduled_at::date, CURRENT_DATE))
             AND (end_date IS NULL OR end_date >= COALESCE(rg.scheduled_at::date, CURRENT_DATE))
            THEN 0
            WHEN end_date IS NULL THEN 1
            ELSE 2
          END,
          start_date DESC NULLS LAST,
          recorded_at DESC
        LIMIT 1
      ) oti ON TRUE
      ORDER BY rg.scheduled_at DESC NULLS LAST, rg.game_id DESC
    `;
    return res.json(rows);
  } catch (err) {
    console.error('user player last-five-games error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/user/players/:id/game-logs
// ---------------------------------------------------------------------------
router.get('/players/:id/game-logs', async (req, res) => {
  const { id } = req.params;
  const seasonId = typeof req.query.season_id === 'string' ? req.query.season_id : null;
  const gameType = typeof req.query.game_type === 'string' ? req.query.game_type : null;
  const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit ?? '20'), 10) || 20, 1), 100);
  const offset = Math.max(Number.parseInt(String(req.query.offset ?? '0'), 10) || 0, 0);

  try {
    const rows = await sql`
      WITH counted_games AS (
        SELECT
          COUNT(*) OVER ()::int AS total_count,
          gps.game_id,
          gps.season_id,
          s.name AS season_name,
          g.scheduled_at,
          gps.game_type,
          gps.team_id,
          gps.opponent_team_id,
          gps.is_home,
          gps.goals,
          gps.assists,
          gps.points,
          CASE WHEN gps.is_goalie THEN gps.goalie_started ELSE NULL::boolean END AS goalie_started,
          CASE WHEN gps.is_goalie THEN gps.shots_against ELSE NULL::int END AS shots_against,
          CASE WHEN gps.is_goalie THEN gps.goals_against ELSE NULL::int END AS goals_against,
          CASE
            WHEN gps.is_goalie AND gps.shots_against > 0
              THEN ROUND(gps.saves::numeric / gps.shots_against, 3)::float
            ELSE NULL::float
          END AS save_pct,
          CASE WHEN gps.is_goalie THEN gps.time_on_ice ELSE NULL::int END AS time_on_ice
        FROM game_player_stats gps
        JOIN games g ON g.id = gps.game_id
          AND g.status = 'final'
          AND (${seasonId}::uuid IS NULL OR g.season_id = ${seasonId}::uuid)
          AND (${gameType}::text IS NULL OR g.game_type = ${gameType}::text)
        JOIN seasons s ON s.id = gps.season_id
        WHERE gps.player_id = ${id}
      ),
      page_games AS (
        SELECT *
        FROM counted_games
        ORDER BY scheduled_at DESC NULLS LAST, game_id DESC
        LIMIT ${limit}
        OFFSET ${offset}
      )
      SELECT
        pg.total_count,
        pg.game_id,
        pg.season_id,
        pg.season_name,
        pg.scheduled_at,
        pg.game_type,
        pg.team_id,
        ti.name AS team_name,
        ti.code AS team_code,
        ti.logo AS team_logo,
        t.primary_color AS team_primary_color,
        t.text_color AS team_text_color,
        pg.opponent_team_id,
        oti.name AS opponent_name,
        oti.code AS opponent_code,
        oti.logo AS opponent_logo,
        ot.primary_color AS opponent_primary_color,
        ot.text_color AS opponent_text_color,
        pg.is_home,
        pg.goals,
        pg.assists,
        pg.points,
        pg.goalie_started,
        pg.shots_against,
        pg.goals_against,
        pg.save_pct,
        pg.time_on_ice
      FROM page_games pg
      LEFT JOIN teams t ON t.id = pg.team_id
      LEFT JOIN LATERAL (
        SELECT name, code, team_logo_default(logo_dark, logo_light) AS logo
        FROM team_iterations
        WHERE team_id = pg.team_id
        ORDER BY
          CASE
            WHEN (start_date IS NULL OR start_date <= COALESCE(pg.scheduled_at::date, CURRENT_DATE))
             AND (end_date IS NULL OR end_date >= COALESCE(pg.scheduled_at::date, CURRENT_DATE))
            THEN 0
            WHEN end_date IS NULL THEN 1
            ELSE 2
          END,
          start_date DESC NULLS LAST,
          recorded_at DESC
        LIMIT 1
      ) ti ON TRUE
      LEFT JOIN teams ot ON ot.id = pg.opponent_team_id
      LEFT JOIN LATERAL (
        SELECT name, code, team_logo_default(logo_dark, logo_light) AS logo
        FROM team_iterations
        WHERE team_id = pg.opponent_team_id
        ORDER BY
          CASE
            WHEN (start_date IS NULL OR start_date <= COALESCE(pg.scheduled_at::date, CURRENT_DATE))
             AND (end_date IS NULL OR end_date >= COALESCE(pg.scheduled_at::date, CURRENT_DATE))
            THEN 0
            WHEN end_date IS NULL THEN 1
            ELSE 2
          END,
          start_date DESC NULLS LAST,
          recorded_at DESC
        LIMIT 1
      ) oti ON TRUE
      ORDER BY pg.scheduled_at DESC NULLS LAST, pg.game_id DESC
    `;

    const total = Number(rows[0]?.total_count ?? 0);
    return res.json({
      total,
      games: rows.map(({ total_count, ...row }) => row),
    });
  } catch (err) {
    console.error('user player game-logs error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/user/players/:id - read-only player detail
// ---------------------------------------------------------------------------
router.get('/players/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`
      SELECT
        p.id,
        p.first_name,
        p.last_name,
        COALESCE(best_player_photo(p.id, latest_pt.season_id, latest_pt.team_id), p.photo) AS photo,
        p.date_of_birth::text AS date_of_birth,
        p.birth_city,
        p.birth_country,
        p.height_cm,
        p.weight_lbs,
        COALESCE(latest_pt.position, p.position) AS position,
        p.shoots,
        p.rookie_season_id,
        (SELECT rs.name FROM seasons rs WHERE rs.id = p.rookie_season_id) AS rookie_season_name,
        p.status, p.is_active,
        p.created_at,
        latest_pt.id AS player_team_id,
        latest_pt.team_id,
        COALESCE(latest_jnh.jersey_number, latest_pt.jersey_number) AS jersey_number,
        latest_pt.is_prospect,
        latest_ti.name AS team_name,
        latest_ti.code AS team_code,
        latest_ti.logo AS team_logo,
        latest_ti.logo_dark AS team_logo_dark,
        latest_ti.logo_light AS team_logo_light,
        latest_t.primary_color,
        latest_t.text_color
      FROM players p
      LEFT JOIN LATERAL (
        SELECT pt.*
        FROM player_teams pt
        WHERE pt.player_id = p.id
        ORDER BY
          CASE WHEN pt.end_date IS NULL THEN 0 ELSE 1 END,
          COALESCE(pt.end_date, pt.start_date, pt.created_at::date) DESC NULLS LAST,
          pt.created_at DESC,
          pt.id DESC
        LIMIT 1
      ) latest_pt ON TRUE
      LEFT JOIN teams latest_t ON latest_t.id = latest_pt.team_id
      LEFT JOIN LATERAL (
        SELECT
          name,
          code,
          team_logo_default(logo_dark, logo_light) AS logo,
          team_logo_dark(logo_dark, logo_light) AS logo_dark,
          team_logo_light(logo_dark, logo_light) AS logo_light
        FROM team_iterations
        WHERE team_id = latest_pt.team_id
        ORDER BY CASE WHEN end_date IS NULL THEN 0 ELSE 1 END, start_date DESC NULLS LAST, recorded_at DESC
        LIMIT 1
      ) latest_ti ON TRUE
      LEFT JOIN LATERAL (
        SELECT jersey_number
        FROM jersey_number_history
        WHERE player_teams_id = latest_pt.id
        ORDER BY effective_from DESC, id DESC
        LIMIT 1
      ) latest_jnh ON TRUE
      WHERE p.id = ${id}
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Player not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('user player detail error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/user/leagues - list all leagues (for filter picker and team routes)
// ---------------------------------------------------------------------------
router.get('/leagues', async (req, res) => {
  try {
    const leagues = await sql`
      SELECT
        l.id, l.name, l.code, l.logo, l.icon, l.primary_color, l.text_color,
        l.best_of_playoff, l.best_of_shootout, l.scoring_system,
        l.goalie_min_regular_minutes, l.playoff_format,
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
    console.error('user leagues list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/user/leagues/:id - league + associated teams + seasons
// ---------------------------------------------------------------------------
router.get('/leagues/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`
      SELECT
        l.id, l.name, l.code, l.description, l.logo, l.icon, l.primary_color, l.text_color,
        l.best_of_playoff, l.best_of_shootout, l.scoring_system,
        l.goalie_min_regular_minutes, l.playoff_format,
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
    if (rows.length === 0)
      return res.status(404).json({ error: 'League not found' });

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
    console.error('user league details error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/user/teams  - list teams for user-facing filters or a selected season
// ---------------------------------------------------------------------------
router.get('/teams', async (req, res) => {
  const seasonId =
    typeof req.query.season_id === 'string' && req.query.season_id.trim()
      ? req.query.season_id.trim()
      : null;

  try {
    if (seasonId) {
      const teams = await sql`
        WITH season_info AS (
          SELECT id, league_id, start_date, group_alignment_set_id
          FROM seasons
          WHERE id = ${seasonId}
        ),
        alignment_info AS (
          SELECT gas.id, gas.structure_type
          FROM group_alignment_sets gas
          WHERE gas.id = (SELECT group_alignment_set_id FROM season_info)
        ),
        alignment_group_overrides AS (
          SELECT DISTINCT alignment_group_id
          FROM season_alignment_group_teams
          WHERE season_id = (SELECT id FROM season_info)
        ),
        participant_teams AS (
          SELECT team_id
          FROM group_alignment_set_teams
          WHERE alignment_set_id = (SELECT id FROM alignment_info)
            AND (SELECT structure_type FROM alignment_info) = 'league'

          UNION

          SELECT sagt.team_id
          FROM season_alignment_group_teams sagt
          JOIN group_alignment_groups ag ON ag.id = sagt.alignment_group_id
          WHERE sagt.season_id = (SELECT id FROM season_info)
            AND ag.alignment_set_id = (SELECT id FROM alignment_info)
            AND (SELECT structure_type FROM alignment_info) = 'groups'

          UNION

          SELECT gat.team_id
          FROM group_alignment_teams gat
          JOIN group_alignment_groups ag ON ag.id = gat.alignment_group_id
          WHERE ag.alignment_set_id = (SELECT id FROM alignment_info)
            AND (SELECT structure_type FROM alignment_info) = 'groups'
            AND gat.alignment_group_id NOT IN (
              SELECT alignment_group_id FROM alignment_group_overrides
            )

          UNION

          SELECT team_id
          FROM season_teams
          WHERE season_id = (SELECT id FROM season_info)
            AND (SELECT group_alignment_set_id FROM season_info) IS NULL

          UNION

          SELECT team_id
          FROM season_group_teams
          WHERE season_id = (SELECT id FROM season_info)
            AND (SELECT group_alignment_set_id FROM season_info) IS NULL

          UNION

          SELECT gt.team_id
          FROM group_teams gt
          JOIN groups gr ON gr.id = gt.group_id
          WHERE (SELECT group_alignment_set_id FROM season_info) IS NULL
            AND (
              gr.season_id = (SELECT id FROM season_info)
              OR (
                gr.league_id = (SELECT league_id FROM season_info)
                AND gr.season_id IS NULL
                AND COALESCE(gr.is_auto, false) = false
              )
            )
        )
        SELECT DISTINCT
          t.id,
          t.league_id,
          iter.name,
          iter.place_name,
          iter.team_name,
          iter.code,
          iter.logo,
          iter.logo_dark,
          iter.logo_light,
          t.primary_color,
          t.secondary_color,
          t.text_color,
          t.home_arena
        FROM participant_teams pt
        JOIN teams t ON t.id = pt.team_id
        LEFT JOIN LATERAL (
          (
            SELECT
              ti.name,
              ti.place_name,
              ti.team_name,
              ti.code,
              team_logo_default(ti.logo_dark, ti.logo_light) AS logo,
              team_logo_dark(ti.logo_dark, ti.logo_light) AS logo_dark,
              team_logo_light(ti.logo_dark, ti.logo_light) AS logo_light
            FROM team_iterations ti
            LEFT JOIN seasons ss ON ss.id = ti.start_season_id
            LEFT JOIN seasons ls ON ls.id = ti.latest_season_id
            WHERE ti.team_id = t.id
              AND (
                ti.start_season_id IS NULL
                OR ss.start_date <= (SELECT start_date FROM season_info)
              )
              AND (
                ti.latest_season_id IS NULL
                OR ls.start_date >= (SELECT start_date FROM season_info)
              )
            ORDER BY ss.start_date DESC NULLS LAST, ti.recorded_at DESC
            LIMIT 1
          )
          UNION ALL
          (
            SELECT
              ti.name,
              ti.place_name,
              ti.team_name,
              ti.code,
              team_logo_default(ti.logo_dark, ti.logo_light) AS logo,
              team_logo_dark(ti.logo_dark, ti.logo_light) AS logo_dark,
              team_logo_light(ti.logo_dark, ti.logo_light) AS logo_light
            FROM team_iterations ti
            WHERE ti.team_id = t.id
            ORDER BY ti.recorded_at ASC
            LIMIT 1
          )
          LIMIT 1
        ) iter ON true
        ORDER BY iter.name ASC NULLS LAST
      `;
      return res.json(teams);
    }

    const teams = await sql`
      SELECT
        t.id,
        t.league_id,
        ti.name,
        ti.place_name,
        ti.team_name,
        ti.code,
        team_logo_default(ti.logo_dark, ti.logo_light) AS logo,
        team_logo_dark(ti.logo_dark, ti.logo_light) AS logo_dark,
        team_logo_light(ti.logo_dark, ti.logo_light) AS logo_light,
        t.primary_color,
        t.secondary_color,
        t.text_color,
        t.home_arena
      FROM teams t
      LEFT JOIN LATERAL (
        SELECT name, place_name, team_name, code, logo_dark, logo_light
        FROM team_iterations
        WHERE team_id = t.id
        ORDER BY CASE WHEN end_date IS NULL THEN 0 ELSE 1 END, start_date DESC NULLS LAST, recorded_at DESC
        LIMIT 1
      ) ti ON true
      ORDER BY ti.name ASC NULLS LAST
    `;
    return res.json(teams);
  } catch (err) {
    console.error('user teams list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/user/teams/:id - read-only team detail
// ---------------------------------------------------------------------------
router.get('/teams/:id', async (req, res) => {
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
        ls.end_date::text AS latest_season_end_date
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
    if (rows.length === 0)
      return res.status(404).json({ error: 'Team not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('user team detail error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/user/seasons  - list seasons, optionally filtered by league_id
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// GET /api/user/teams/:id/awards - read-only winner awards for one team
// ---------------------------------------------------------------------------
router.get('/teams/:id/awards', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`
      SELECT
        sar.id,
        la.id AS award_id,
        sa.id AS season_award_id,
        la.name AS award_name,
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
    console.error('user team awards error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/seasons', async (req, res) => {
  const { league_id } = req.query;
  try {
    const seasons = await sql`
      SELECT
        s.id,
        s.name,
        s.league_id,
        l.name AS league_name,
        l.code AS league_code,
        l.logo AS league_logo,
        s.start_date::text AS start_date,
        s.end_date::text AS end_date,
        s.goalie_min_regular_minutes,
        l.goalie_min_regular_minutes AS league_goalie_min_regular_minutes,
        s.created_at,
        (l.current_season_id = s.id) AS is_current,
        s.best_of_playoff,
        l.best_of_playoff AS league_best_of_playoff,
        s.bracket_rule_set_id,
        brs.round_names AS playoff_round_names,
        brs.matchup_names AS playoff_matchup_names
      FROM seasons s
      JOIN leagues l ON l.id = s.league_id
      LEFT JOIN bracket_rule_sets brs ON brs.id = s.bracket_rule_set_id
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
