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
// GET /api/user/games  – read-only game list for authenticated users
// Query params: season_id, team_id, game_type, status
// ---------------------------------------------------------------------------
router.get('/games', async (req, res) => {
  const { season_id, league_id, team_id, game_type, status } = req.query;
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
        t_away.text_color    AS away_team_text_color,
        -- Season / league context
        s.name       AS season_name,
        l.id         AS league_id,
        l.name       AS league_name
      FROM games g
      JOIN teams   t_home ON t_home.id = g.home_team_id
      JOIN teams   t_away ON t_away.id = g.away_team_id
      JOIN seasons s      ON s.id      = g.season_id
      JOIN leagues l      ON l.id      = s.league_id
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
      WHERE
        (${season_id  ?? null}::uuid IS NULL OR g.season_id    = ${season_id  ?? null}::uuid)
        AND (${league_id  ?? null}::uuid IS NULL OR l.id           = ${league_id  ?? null}::uuid)
        AND (${team_id    ?? null}::uuid IS NULL OR g.home_team_id = ${team_id    ?? null}::uuid
                                                 OR g.away_team_id = ${team_id    ?? null}::uuid)
        AND (${game_type  ?? null}::text IS NULL OR g.game_type = ${game_type ?? null})
        AND (${status     ?? null}::text IS NULL OR g.status    = ${status    ?? null})
      ORDER BY
        CASE g.status WHEN 'in_progress' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END,
        CASE g.status WHEN 'scheduled' THEN g.scheduled_at END ASC NULLS LAST,
        CASE g.status WHEN 'in_progress' THEN g.scheduled_at
                      ELSE NULL END DESC NULLS LAST,
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
      SELECT id, name FROM seasons
      WHERE (${league_id ?? null}::uuid IS NULL OR league_id = ${league_id ?? null}::uuid)
      ORDER BY start_date DESC NULLS LAST, name DESC
    `;
    return res.json(seasons);
  } catch (err) {
    console.error('user seasons list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
