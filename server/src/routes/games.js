'use strict';

const router = require('express').Router();
const { requireAdmin } = require('../middleware/auth');
const { sql, db, schema } = require('../db');
const { and, eq, or, sql: ormSql } = require('drizzle-orm');
const { alias } = require('drizzle-orm/pg-core');
const { normalizeSeasonBracketSlotKeys } = require('../lib/playoffBracketSlots');
const { rebuildGameStats } = require('../lib/gameStatsSnapshots');

router.use(requireAdmin);

const {
  games: gamesTable,
  seasons,
  teams,
  playoffSeries,
  bracketRuleSets,
} = schema;
const homeTeam = alias(teams, 't_home');
const awayTeam = alias(teams, 't_away');

const resultRows = (result) => (Array.isArray(result) ? result : result?.rows ?? []);
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const refreshGameStatSnapshots = (gameId) => rebuildGameStats(sql, gameId);

const normalizeAdminScheduledAt = (value) => {
  if (typeof value !== 'string') return value ?? null;
  const trimmed = value.trim();
  if (!DATE_ONLY_RE.test(trimmed)) return trimmed || null;

  // Admin-entered game dates are ET calendar dates. Store a stable midday
  // timestamp so ET formatting always lands on the selected date.
  return `${trimmed}T12:00:00Z`;
};

// Regular-season standings order (best team first) for a season, derived from
// final regular-season games. Used to award playoff home-ice to the higher
// seed. Mirrors the ordering in GET /seasons/:id/standings.
const seasonStandingsOrder = async (seasonId) => {
  const [info] = await sql`
    SELECT COALESCE(s.scoring_system, l.scoring_system) AS scoring_system
    FROM seasons s JOIN leagues l ON l.id = s.league_id WHERE s.id = ${seasonId}
  `;
  const scoringSystem = info?.scoring_system ?? '2-1-0';
  const rows = await sql`
    WITH aggregated AS (
      SELECT
        gts.team_id,
        COUNT(*)::int AS gp,
        SUM(CASE WHEN gts.won THEN 1 ELSE 0 END)::int AS wins,
        SUM(CASE WHEN gts.reg_win THEN 1 ELSE 0 END)::int AS reg_wins,
        SUM(CASE WHEN gts.ot_win THEN 1 ELSE 0 END)::int AS ot_wins,
        SUM(CASE WHEN gts.otl THEN 1 ELSE 0 END)::int AS otl,
        SUM(gts.goals_for)::int AS goals_for,
        SUM(gts.goals_against)::int AS goals_against
      FROM game_team_stats gts
      WHERE gts.season_id = ${seasonId}
        AND gts.game_type = 'regular'
        AND (gts.won OR gts.lost)
      GROUP BY gts.team_id
    )
    SELECT team_id,
      CASE ${scoringSystem}
        WHEN '3-2-1-0' THEN (reg_wins*3 + ot_wins*2 + otl)
        ELSE (wins*2 + otl)
      END AS points,
      reg_wins, wins, (goals_for - goals_against) AS goal_diff, goals_for, gp
    FROM aggregated
    ORDER BY points DESC, reg_wins DESC, wins DESC, goal_diff DESC, goals_for DESC, gp ASC
  `;
  return rows.map((r) => r.team_id);
};

// Returns { home, away } for a playoff series so the higher-seeded team (better
// regular-season standing) gets home-ice. Falls back to the given order.
const homeAwayBySeed = async (seasonId, teamA, teamB) => {
  const order = await seasonStandingsOrder(seasonId);
  const rankA = order.indexOf(teamA);
  const rankB = order.indexOf(teamB);
  const a = rankA === -1 ? Infinity : rankA;
  const b = rankB === -1 ? Infinity : rankB;
  return a <= b ? { home: teamA, away: teamB } : { home: teamB, away: teamA };
};

const teamIdentityJson = (teamIdColumn, teamTable) => ormSql`
  json_build_object(
    'id', ${teamIdColumn},
    'name', (
      SELECT name FROM team_iterations
      WHERE team_id = ${teamIdColumn}
      ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
      LIMIT 1
    ),
    'team_name', (
      SELECT team_name FROM team_iterations
      WHERE team_id = ${teamIdColumn}
      ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
      LIMIT 1
    ),
    'place_name', (
      SELECT place_name FROM team_iterations
      WHERE team_id = ${teamIdColumn}
      ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
      LIMIT 1
    ),
    'code', (
      SELECT code FROM team_iterations
      WHERE team_id = ${teamIdColumn}
      ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
      LIMIT 1
    ),
    'logo', (
      SELECT team_logo_default(logo_dark, logo_light) FROM team_iterations
      WHERE team_id = ${teamIdColumn}
      ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
      LIMIT 1
    ),
    'logo_dark', (
      SELECT team_logo_dark(logo_dark, logo_light) FROM team_iterations
      WHERE team_id = ${teamIdColumn}
      ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
      LIMIT 1
    ),
    'logo_light', (
      SELECT team_logo_light(logo_dark, logo_light) FROM team_iterations
      WHERE team_id = ${teamIdColumn}
      ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
      LIMIT 1
    ),
    'primary_color', ${teamTable.primaryColor},
    'secondary_color', ${teamTable.secondaryColor},
    'text_color', ${teamTable.textColor}
  )
`;

const periodScoresJson = (gameIdColumn, homeTeamIdColumn, awayTeamIdColumn) => ormSql`
  COALESCE(
    (
      SELECT json_agg(
        json_build_object('period', period, 'home_goals', home_cnt, 'away_goals', away_cnt)
        ORDER BY CASE period WHEN '1' THEN 1 WHEN '2' THEN 2 WHEN '3' THEN 3 WHEN 'OT' THEN 4 WHEN 'SO' THEN 5 ELSE 6 END
      )
      FROM (
        SELECT
          go.period,
          COUNT(*) FILTER (WHERE go.team_id = ${homeTeamIdColumn}) AS home_cnt,
          COUNT(*) FILTER (WHERE go.team_id = ${awayTeamIdColumn}) AS away_cnt
        FROM goals go
        WHERE go.game_id = ${gameIdColumn}
        GROUP BY go.period
      ) ps
    ),
    '[]'::json
  )
`;

const scoreColumn = (columnName) => ormSql`
  (
    SELECT ${ormSql.raw(columnName)}
    FROM (
      SELECT
        resolved.winner_team_id,
        totals.home_goals
          + CASE
              WHEN ${gamesTable.status} = 'final'
                AND (
                  ${gamesTable.shootout}
                  OR COALESCE(${gamesTable.overtimePeriods}, 0) > 0
                  OR totals.has_ot
                  OR totals.so_home_goals > 0
                  OR totals.so_away_goals > 0
                )
                AND totals.home_goals = totals.away_goals
                AND resolved.winner_team_id = ${gamesTable.homeTeamId}
              THEN 1 ELSE 0
            END AS home_score,
        totals.away_goals
          + CASE
              WHEN ${gamesTable.status} = 'final'
                AND (
                  ${gamesTable.shootout}
                  OR COALESCE(${gamesTable.overtimePeriods}, 0) > 0
                  OR totals.has_ot
                  OR totals.so_home_goals > 0
                  OR totals.so_away_goals > 0
                )
                AND totals.home_goals = totals.away_goals
                AND resolved.winner_team_id = ${gamesTable.awayTeamId}
              THEN 1 ELSE 0
            END AS away_score
      FROM (
        SELECT
          COUNT(*) FILTER (WHERE go.team_id = ${gamesTable.homeTeamId} AND go.period <> 'SO')::int AS home_goals,
          COUNT(*) FILTER (WHERE go.team_id = ${gamesTable.awayTeamId} AND go.period <> 'SO')::int AS away_goals,
          COUNT(*) FILTER (WHERE go.team_id = ${gamesTable.homeTeamId} AND go.period = 'SO')::int AS so_home_goals,
          COUNT(*) FILTER (WHERE go.team_id = ${gamesTable.awayTeamId} AND go.period = 'SO')::int AS so_away_goals,
          COALESCE(BOOL_OR(go.period = 'OT'), false) AS has_ot
        FROM goals go
        WHERE go.game_id = ${gamesTable.id}
      ) totals
      LEFT JOIN LATERAL (
        SELECT
          CASE
            WHEN ${gamesTable.shootout} OR totals.so_home_goals > 0 OR totals.so_away_goals > 0 THEN
              CASE
                WHEN so.home_goals > so.away_goals THEN ${gamesTable.homeTeamId}
                WHEN so.away_goals > so.home_goals THEN ${gamesTable.awayTeamId}
                WHEN totals.so_home_goals > totals.so_away_goals THEN ${gamesTable.homeTeamId}
                WHEN totals.so_away_goals > totals.so_home_goals THEN ${gamesTable.awayTeamId}
                WHEN totals.home_goals > totals.away_goals THEN ${gamesTable.homeTeamId}
                WHEN totals.away_goals > totals.home_goals THEN ${gamesTable.awayTeamId}
                ELSE NULL
              END
            WHEN totals.home_goals > totals.away_goals THEN ${gamesTable.homeTeamId}
            WHEN totals.away_goals > totals.home_goals THEN ${gamesTable.awayTeamId}
            ELSE NULL
          END AS winner_team_id
        FROM (
          SELECT
            COUNT(*) FILTER (WHERE team_id = ${gamesTable.homeTeamId} AND scored)::int AS home_goals,
            COUNT(*) FILTER (WHERE team_id = ${gamesTable.awayTeamId} AND scored)::int AS away_goals
          FROM shootout_attempts
          WHERE game_id = ${gamesTable.id}
        ) so
      ) resolved ON true
    ) score
  )
`;

// Resolves current team identity (name, code, logo variants) from team_iterations.
// Prefers the base iteration (season_id IS NULL) over season-specific ones.
const TEAM_IDENTITY = (alias, teamCol) => `
  LEFT JOIN LATERAL (
    SELECT name, code, team_logo_default(logo_dark, logo_light) AS logo, team_logo_dark(logo_dark, logo_light) AS logo_dark, team_logo_light(logo_dark, logo_light) AS logo_light FROM team_iterations
    WHERE team_id = ${teamCol}
    ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
    LIMIT 1
  ) ${alias} ON true
`;

const hasPlayerTeamsAcquisitionType = async () => {
  if (process.env.JEST_WORKER_ID) return false;
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

const acquisitionTypeSelect = (hasAcquisitionType, alias) => {
  if (process.env.JEST_WORKER_ID) return 'NULL::text';
  if (!hasAcquisitionType) return sql`NULL::text`;
  if (alias === 'spt') return sql`spt.acquisition_type`;
  return sql`pt.acquisition_type`;
};

const validateGoalParticipants = (scorerId, assist1Id, assist2Id) => {
  if (assist2Id && !assist1Id) return 'assist_1_id is required when assist_2_id is provided';
  if (assist1Id && scorerId === assist1Id) return 'scorer_id and assist_1_id must be different';
  if (assist2Id && scorerId === assist2Id) return 'scorer_id and assist_2_id must be different';
  if (assist1Id && assist2Id && assist1Id === assist2Id) {
    return 'assist_1_id and assist_2_id must be different';
  }
  return null;
};

const syncFinalStartingGoalieStint = async (gameId, teamId, goalieId) => {
  if (!goalieId) return;
  await sql`
    UPDATE game_goalie_stints st
    SET goalie_id = ${goalieId}
    FROM games g
    WHERE g.id = st.game_id
      AND g.id = ${gameId}
      AND g.status = 'final'
      AND st.team_id = ${teamId}
      AND st.stint_ord = 1
      AND st.entered_period = '1'
      AND (st.entered_time IS NULL OR st.entered_time = '00:00')
      AND st.goalie_id <> ${goalieId}
  `;
};

const extractStartingGoalieId = (slots) => {
  let goalieId = null;
  let seenGoalieSlot = false;

  for (const { position_slot, player_id } of slots) {
    if (position_slot !== 'G') {
      return { error: 'Only the G starting goalie slot is supported' };
    }
    if (seenGoalieSlot) {
      return { error: 'Only one G starting goalie slot is allowed' };
    }
    seenGoalieSlot = true;
    goalieId = player_id || null;
  }

  if (!seenGoalieSlot) {
    return { error: 'A G starting goalie slot is required' };
  }

  return { goalieId };
};

const selectStartingGoalieRows = (gameId, hasAcquisitionType, teamId = null) => sql`
  WITH target_game AS (
    SELECT *
    FROM games
    WHERE id = ${gameId}
  ),
  goalie_slots AS (
    SELECT
      g.id AS game_id,
      g.season_id,
      g.home_team_id AS team_id,
      g.home_starting_goalie_id AS player_id,
      'G'::text AS position_slot,
      1 AS sort_order
    FROM target_game g
    UNION ALL
    SELECT
      g.id AS game_id,
      g.season_id,
      g.away_team_id AS team_id,
      g.away_starting_goalie_id AS player_id,
      'G'::text AS position_slot,
      2 AS sort_order
    FROM target_game g
  )
  SELECT
    slot.game_id::text || '-' || slot.team_id::text || '-G' AS id,
    slot.game_id,
    slot.team_id,
    slot.player_id,
    slot.position_slot,
    p.first_name AS player_first_name,
    p.last_name AS player_last_name,
    p.date_of_birth,
    COALESCE(pts.start_date, pt.start_date) AS start_date,
    COALESCE(pts.acquisition_type, ${acquisitionTypeSelect(hasAcquisitionType, 'pt')}) AS acquisition_type,
    COALESCE(NULLIF(pt.photo, ''), best_player_photo(p.id, slot.season_id, slot.team_id), NULLIF(p.photo, '')) AS player_photo,
    COALESCE(pt_jnh.jersey_number, pt.jersey_number) AS jersey_number,
    false AS inherited
  FROM goalie_slots slot
  JOIN games g ON g.id = slot.game_id
  JOIN players p ON p.id = slot.player_id
  LEFT JOIN player_teams pt
    ON pt.player_id = slot.player_id
    AND pt.team_id = slot.team_id
    AND pt.season_id = slot.season_id
    AND (pt.start_date IS NULL OR pt.start_date <= COALESCE(g.scheduled_at::date, CURRENT_DATE))
    AND (pt.end_date IS NULL OR pt.end_date >= COALESCE(g.scheduled_at::date, CURRENT_DATE))
  LEFT JOIN LATERAL (
    SELECT start_date, acquisition_type
    FROM player_team_stints pts
    WHERE pts.player_id = slot.player_id
      AND pts.team_id = slot.team_id
      AND (pts.start_date IS NULL OR pts.start_date <= COALESCE(g.scheduled_at::date, CURRENT_DATE))
      AND (pts.end_date IS NULL OR pts.end_date >= COALESCE(g.scheduled_at::date, CURRENT_DATE))
    ORDER BY CASE WHEN pts.end_date IS NULL THEN 0 ELSE 1 END,
      pts.start_date DESC NULLS LAST,
      pts.created_at DESC
    LIMIT 1
  ) pts ON true
  LEFT JOIN LATERAL (
    SELECT jersey_number FROM jersey_number_history
    WHERE player_teams_id = pt.id
      AND effective_from <= COALESCE(g.scheduled_at::date, CURRENT_DATE)
    ORDER BY effective_from DESC LIMIT 1
  ) pt_jnh ON true
  WHERE slot.player_id IS NOT NULL
    AND (${teamId}::uuid IS NULL OR slot.team_id = ${teamId})
  ORDER BY slot.team_id, slot.sort_order
`;

// ---------------------------------------------------------------------------
// GET /api/admin/games
// Query params: season_id, team_id (home OR away), game_type, status, week (YYYY-MM-DD week start), month (YYYY-MM)
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const { season_id, team_id, game_type, status } = req.query;
  const week = req.query.week ?? req.query.week_start ?? null;
  const month = req.query.month ?? null;
  if (week && !/^\d{4}-\d{2}-\d{2}$/.test(String(week))) {
    return res.status(400).json({ error: 'week must be a YYYY-MM-DD date' });
  }
  if (month && !/^\d{4}-\d{2}$/.test(String(month))) {
    return res.status(400).json({ error: 'month must be a YYYY-MM value' });
  }

  try {
    const where = [];
    if (season_id) where.push(eq(gamesTable.seasonId, season_id));
    if (team_id) {
      where.push(or(eq(gamesTable.homeTeamId, team_id), eq(gamesTable.awayTeamId, team_id)));
    }
    if (game_type) where.push(eq(gamesTable.gameType, game_type));
    if (status) where.push(eq(gamesTable.status, status));
    if (week) {
      where.push(ormSql`
        ${gamesTable.scheduledAt} >= ${week}::date
        AND ${gamesTable.scheduledAt} < (${week}::date + INTERVAL '7 days')
      `);
    }
    if (month) {
      where.push(ormSql`
        ${gamesTable.scheduledAt} >= (${month} || '-01')::date
        AND ${gamesTable.scheduledAt} < ((${month} || '-01')::date + INTERVAL '1 month')
      `);
    }

    let query = db
      .select({
        id: gamesTable.id,
        season_id: gamesTable.seasonId,
        game_type: gamesTable.gameType,
        status: gamesTable.status,
        scheduled_at: gamesTable.scheduledAt,
        scheduled_time: gamesTable.scheduledTime,
        venue: gamesTable.venue,
        time_start: gamesTable.timeStart,
        time_end: gamesTable.timeEnd,
        overtime_periods: gamesTable.overtimePeriods,
        shootout: gamesTable.shootout,
        winner_team_id: scoreColumn('winner_team_id'),
        home_score: scoreColumn('home_score'),
        away_score: scoreColumn('away_score'),
        playoff_series_id: gamesTable.playoffSeriesId,
        game_number_in_series: gamesTable.gameNumberInSeries,
        game_number: gamesTable.gameNumber,
        notes: gamesTable.notes,
        current_period: gamesTable.currentPeriod,
        created_at: gamesTable.createdAt,
        star_1_id: gamesTable.star1Id,
        star_2_id: gamesTable.star2Id,
        star_3_id: gamesTable.star3Id,
        playoff_round: playoffSeries.round,
        bracket_slot_key: playoffSeries.bracketSlotKey,
        playoff_round_names: bracketRuleSets.roundNames,
        playoff_matchup_names: bracketRuleSets.matchupNames,
        period_scores: periodScoresJson(
          gamesTable.id,
          gamesTable.homeTeamId,
          gamesTable.awayTeamId,
        ),
        period_shots: gamesTable.periodShots,
        home_team: teamIdentityJson(gamesTable.homeTeamId, homeTeam),
        away_team: teamIdentityJson(gamesTable.awayTeamId, awayTeam),
      })
      .from(gamesTable)
      .innerJoin(seasons, eq(seasons.id, gamesTable.seasonId))
      .innerJoin(homeTeam, eq(homeTeam.id, gamesTable.homeTeamId))
      .innerJoin(awayTeam, eq(awayTeam.id, gamesTable.awayTeamId))
      .leftJoin(playoffSeries, eq(playoffSeries.id, gamesTable.playoffSeriesId))
      .leftJoin(bracketRuleSets, eq(bracketRuleSets.id, seasons.bracketRuleSetId));

    if (where.length > 0) query = query.where(and(...where));

    const rows = await query.orderBy(
      ormSql`${playoffSeries.round} ASC NULLS LAST`,
      ormSql`${gamesTable.gameNumberInSeries} ASC NULLS LAST`,
      ormSql`${gamesTable.gameNumber} ASC NULLS LAST`,
      ormSql`${gamesTable.scheduledAt} ASC NULLS LAST`,
      ormSql`${gamesTable.scheduledTime} ASC NULLS LAST`,
      gamesTable.createdAt,
    );

    return res.json(rows);
  } catch (err) {
    console.error('games list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});



router.get("/nhl-api", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing NHL API URL." });
    }

    const parsedUrl = new URL(url);

    if (!["api-web.nhle.com", "api.nhle.com", "www.nhl.com"].includes(parsedUrl.hostname)) {
      return res.status(400).json({ error: "Invalid NHL API host." });
    }

    const response = await fetch(parsedUrl.toString());


    const text = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({
        error: `NHL API returned ${response.status}.`,
        body: text.slice(0, 500),
      });
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html") || parsedUrl.pathname.includes("/htmlreports/")) {
      res.type("html");
      return res.send(text);
    }

    return res.json(JSON.parse(text));
  } catch (error) {
    console.error("NHL proxy error:", error);

    return res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
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
        ps.status, ps.winner_team_id, ps.bracket_slot_key, ps.created_at,
        brs.round_names AS playoff_round_names,
        brs.matchup_names AS playoff_matchup_names,
        ht.name AS home_team_name, ht.code AS home_team_code,
        ht.logo AS home_team_logo, ht.logo_dark AS home_team_logo_dark, ht.logo_light AS home_team_logo_light,
        th.primary_color AS home_team_primary_color,
        th.secondary_color AS home_team_secondary_color,
        th.text_color AS home_team_text_color,
        at.name AS away_team_name, at.code AS away_team_code,
        at.logo AS away_team_logo, at.logo_dark AS away_team_logo_dark, at.logo_light AS away_team_logo_light,
        ta.primary_color AS away_team_primary_color,
        ta.secondary_color AS away_team_secondary_color,
        ta.text_color AS away_team_text_color,
        sg.games
      FROM playoff_series ps
      JOIN seasons s ON s.id = ps.season_id
      LEFT JOIN bracket_rule_sets brs ON brs.id = s.bracket_rule_set_id
      LEFT JOIN teams th ON th.id = ps.home_team_id
      LEFT JOIN teams ta ON ta.id = ps.away_team_id
      LEFT JOIN LATERAL (
        (SELECT
            ti.name,
            ti.code,
            team_logo_default(ti.logo_dark, ti.logo_light) AS logo,
            team_logo_dark(ti.logo_dark, ti.logo_light) AS logo_dark,
            team_logo_light(ti.logo_dark, ti.logo_light) AS logo_light
          FROM team_iterations ti
          LEFT JOIN seasons ss ON ss.id = ti.start_season_id
          LEFT JOIN seasons ls ON ls.id = ti.latest_season_id
          WHERE ti.team_id = ps.home_team_id
            AND (ti.start_season_id IS NULL OR ss.start_date <= s.start_date)
            AND (ti.latest_season_id IS NULL OR ls.start_date >= s.start_date)
          ORDER BY ss.start_date DESC NULLS LAST, ti.recorded_at DESC
          LIMIT 1)
        UNION ALL
        (SELECT
            ti.name,
            ti.code,
            team_logo_default(ti.logo_dark, ti.logo_light) AS logo,
            team_logo_dark(ti.logo_dark, ti.logo_light) AS logo_dark,
            team_logo_light(ti.logo_dark, ti.logo_light) AS logo_light
          FROM team_iterations ti
          WHERE ti.team_id = ps.home_team_id
          ORDER BY ti.recorded_at ASC
          LIMIT 1)
        LIMIT 1
      ) ht ON true
      LEFT JOIN LATERAL (
        (SELECT
            ti.name,
            ti.code,
            team_logo_default(ti.logo_dark, ti.logo_light) AS logo,
            team_logo_dark(ti.logo_dark, ti.logo_light) AS logo_dark,
            team_logo_light(ti.logo_dark, ti.logo_light) AS logo_light
          FROM team_iterations ti
          LEFT JOIN seasons ss ON ss.id = ti.start_season_id
          LEFT JOIN seasons ls ON ls.id = ti.latest_season_id
          WHERE ti.team_id = ps.away_team_id
            AND (ti.start_season_id IS NULL OR ss.start_date <= s.start_date)
            AND (ti.latest_season_id IS NULL OR ls.start_date >= s.start_date)
          ORDER BY ss.start_date DESC NULLS LAST, ti.recorded_at DESC
          LIMIT 1)
        UNION ALL
        (SELECT
            ti.name,
            ti.code,
            team_logo_default(ti.logo_dark, ti.logo_light) AS logo,
            team_logo_dark(ti.logo_dark, ti.logo_light) AS logo_dark,
            team_logo_light(ti.logo_dark, ti.logo_light) AS logo_light
          FROM team_iterations ti
          WHERE ti.team_id = ps.away_team_id
          ORDER BY ti.recorded_at ASC
          LIMIT 1)
        LIMIT 1
      ) at ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          json_agg(
            json_build_object(
              'id',                   g.id,
              'game_number_in_series', g.game_number_in_series,
              'status',               g.status,
              'scheduled_at',         g.scheduled_at,
              'scheduled_time',       g.scheduled_time,
              'venue',                g.venue,
              'home_team_id',         g.home_team_id,
              'away_team_id',         g.away_team_id,
              'overtime_periods',     g.overtime_periods,
              'shootout',             g.shootout,
              'home_goals', (SELECT COUNT(*) FROM goals go WHERE go.game_id = g.id AND go.team_id = g.home_team_id),
              'away_goals', (SELECT COUNT(*) FROM goals go WHERE go.game_id = g.id AND go.team_id = g.away_team_id)
            )
            ORDER BY g.game_number_in_series ASC NULLS LAST
          ),
          '[]'::json
        ) AS games
        FROM games g
        WHERE g.playoff_series_id = ps.id
      ) sg ON true
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
// Auto-generates all possible games using the 2-2-1-1-1 home/away pattern.
// ---------------------------------------------------------------------------
router.post('/playoff-series', async (req, res) => {
  const {
    season_id, round, series_letter = null,
    home_team_id, away_team_id,
    status = 'upcoming',
    bracket_slot_key = null,
  } = req.body;

  if (!season_id || !home_team_id || !away_team_id || !round) {
    return res.status(400).json({ error: 'season_id, home_team_id, away_team_id, and round are required' });
  }
  if (home_team_id === away_team_id) {
    return res.status(400).json({ error: 'home_team_id and away_team_id must be different' });
  }

  try {
    // Derive games_to_win from the explicit body value, or look up the season's
    // best_of_playoff setting (falling back to the league default).
    let games_to_win = req.body.games_to_win ? Number(req.body.games_to_win) : null;
    if (!games_to_win) {
      const seasonRows = await sql`
        SELECT COALESCE(s.best_of_playoff, l.best_of_playoff) AS best_of
        FROM seasons s
        JOIN leagues l ON l.id = s.league_id
        WHERE s.id = ${season_id}
      `;
      const bestOf = seasonRows[0]?.best_of ?? 7;
      games_to_win = Math.ceil(bestOf / 2);
    }

    const rows = await sql`
      INSERT INTO playoff_series (season_id, round, series_letter, home_team_id, away_team_id, games_to_win, status, bracket_slot_key)
      VALUES (${season_id}, ${round}, ${series_letter}, ${home_team_id}, ${away_team_id}, ${games_to_win}, ${status}, ${bracket_slot_key})
      RETURNING id, season_id, round, series_letter, home_team_id, away_team_id,
                games_to_win, home_wins, away_wins, status, winner_team_id, bracket_slot_key, created_at
    `;
    const series = rows[0];

    // Auto-generate every possible game for this series.
    // 2-2-1-1-1 home/away rotation: games 1-2 at home_team, 3-4 at away_team,
    // then alternating one game at a time (home, away, home…).
    const maxGames = series.games_to_win * 2 - 1;
    for (let i = 0; i < maxGames; i++) {
      const team1IsHome = i < 2 ? true : i < 4 ? false : i % 2 === 0;
      await sql`
        INSERT INTO games (season_id, home_team_id, away_team_id, game_type, status, playoff_series_id, game_number_in_series)
        VALUES (
          ${series.season_id},
          ${team1IsHome ? series.home_team_id : series.away_team_id},
          ${team1IsHome ? series.away_team_id : series.home_team_id},
          'playoff',
          'scheduled',
          ${series.id},
          ${i + 1}
        )
      `;
    }

    return res.status(201).json(series);
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
                games_to_win, home_wins, away_wins, status, winner_team_id, bracket_slot_key, created_at
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Playoff series not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('playoff series update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/games/playoff-series/:seriesId/start  – generate games
// Creates all possible games for an existing series that has no games yet.
// Used when a series was auto-advanced (shell only, no games) and the admin
// is ready to officially start it.
// ---------------------------------------------------------------------------
router.post('/playoff-series/:seriesId/start', async (req, res) => {
  const { seriesId } = req.params;
  try {
    const seriesRows = await sql`SELECT * FROM playoff_series WHERE id = ${seriesId}`;
    const series = seriesRows[0];
    if (!series) return res.status(404).json({ error: 'Playoff series not found' });

    if (!series.home_team_id || !series.away_team_id) {
      return res.status(400).json({ error: 'Both teams must be set before starting a series' });
    }

    const existing = await sql`
      SELECT id FROM games WHERE playoff_series_id = ${seriesId} LIMIT 1
    `;
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Games already exist for this series' });
    }

    const maxGames = series.games_to_win * 2 - 1;
    for (let i = 0; i < maxGames; i++) {
      const team1IsHome = i < 2 ? true : i < 4 ? false : i % 2 === 0;
      await sql`
        INSERT INTO games (season_id, home_team_id, away_team_id, game_type, status, playoff_series_id, game_number_in_series)
        VALUES (
          ${series.season_id},
          ${team1IsHome ? series.home_team_id : series.away_team_id},
          ${team1IsHome ? series.away_team_id : series.home_team_id},
          'playoff', 'scheduled', ${seriesId}, ${i + 1}
        )
      `;
    }

    return res.json({ message: 'Series games generated' });
  } catch (err) {
    console.error('playoff series start error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/games/playoff-series/:seriesId/force-advance
// Manually advances the winner of a completed series to the next-round bracket
// slot without waiting for the opposing feeder series to finish.
// • If no next-round series exists yet:  creates a partial shell (one team set,
//   the other NULL) using the bracket rule set to determine home/away position.
// • If a partial next-round series already exists:  fills in the missing team.
// • If a full next-round series already exists:  no-op (returns 200).
// ---------------------------------------------------------------------------
router.post('/playoff-series/:seriesId/force-advance', async (req, res) => {
  const { seriesId } = req.params;
  try {
    const [series] = await sql`SELECT * FROM playoff_series WHERE id = ${seriesId}`;
    if (!series) return res.status(404).json({ error: 'Playoff series not found' });
    if (series.status !== 'complete') return res.status(400).json({ error: 'Series is not complete' });
    if (!series.winner_team_id) return res.status(400).json({ error: 'Series has no winner' });

    const [seasonRow] = await sql`SELECT bracket_rule_set_id FROM seasons WHERE id = ${series.season_id}`;
    const bracketRuleSetId = seasonRow?.bracket_rule_set_id;
    if (!bracketRuleSetId) return res.status(400).json({ error: 'No bracket rule set configured for this season' });

    await normalizeSeasonBracketSlotKeys(sql, series.season_id, bracketRuleSetId);

    const [normalizedSeries] = await sql`
      SELECT bracket_slot_key FROM playoff_series WHERE id = ${seriesId}
    `;
    const slotKey = normalizedSeries?.bracket_slot_key;
    if (!slotKey) {
      return res.status(400).json({ error: 'This series is not assigned to a valid bracket slot' });
    }

    // Find the next-round slot rule that references this matchup as a winner
    const ruleRows = await sql`
      SELECT slot_key FROM bracket_slot_rules
      WHERE rule_set_id = ${bracketRuleSetId}
        AND rule_type   = 'winner'
        AND matchup_ref = ${slotKey}
    `;
    if (ruleRows.length === 0) return res.status(400).json({ error: 'No next-round slot defined for this series in the bracket rules' });

    const ruleSlotKey  = ruleRows[0].slot_key;           // e.g. 'r2m0team2'
    const nextMatchupKey = ruleSlotKey.replace(/team[12]$/, ''); // e.g. 'r2m0'
    const isHomeSlot   = ruleSlotKey.endsWith('team1');  // team1 = home ice

    const roundMatch = nextMatchupKey.match(/^r(\d+)/);
    const nextRound  = roundMatch ? Number(roundMatch[1]) : null;
    if (!nextRound) return res.status(500).json({ error: 'Invalid next matchup key' });

    const [gtwRow] = await sql`
      SELECT COALESCE(s.best_of_playoff, l.best_of_playoff) AS best_of
      FROM seasons s JOIN leagues l ON l.id = s.league_id WHERE s.id = ${series.season_id}
    `;
    const gamesToWin = Math.ceil((gtwRow?.best_of ?? 7) / 2);
    const winnerId   = series.winner_team_id;

    const [existing] = await sql`
      SELECT id, home_team_id, away_team_id FROM playoff_series
      WHERE season_id = ${series.season_id} AND bracket_slot_key = ${nextMatchupKey}
    `;

    // Opponent already sitting in the next series' other slot, if any.
    const existingOther = existing
      ? (isHomeSlot ? existing.away_team_id : existing.home_team_id)
      : null;
    const opponent = existingOther && existingOther !== winnerId ? existingOther : null;

    if (opponent) {
      // Both teams known → the higher seed (better regular-season record) hosts.
      const { home, away } = await homeAwayBySeed(series.season_id, winnerId, opponent);
      await sql`
        UPDATE playoff_series
        SET home_team_id = ${home}, away_team_id = ${away}
        WHERE id = ${existing.id}
      `;
    } else if (!existing) {
      // Create partial series shell — opponent is TBD (NULL). Home-ice is
      // re-seeded when the opponent arrives.
      const homeId = isHomeSlot ? winnerId : null;
      const awayId = isHomeSlot ? null : winnerId;
      await sql`
        INSERT INTO playoff_series
          (season_id, round, home_team_id, away_team_id, games_to_win, status, bracket_slot_key)
        VALUES
          (${series.season_id}, ${nextRound}, ${homeId}, ${awayId}, ${gamesToWin}, 'upcoming', ${nextMatchupKey})
      `;
    } else {
      // Fill in the missing team on an existing partial series.
      const alreadySet = isHomeSlot ? existing.home_team_id : existing.away_team_id;
      if (!alreadySet) {
        if (isHomeSlot) {
          await sql`UPDATE playoff_series SET home_team_id = ${winnerId} WHERE id = ${existing.id}`;
        } else {
          await sql`UPDATE playoff_series SET away_team_id = ${winnerId} WHERE id = ${existing.id}`;
        }
      }
      // If already set (same team), no-op
    }

    return res.json({ bracket_slot_key: nextMatchupKey });
  } catch (err) {
    console.error('force-advance error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/games/playoff-series/:seriesId  – delete a playoff series
// ---------------------------------------------------------------------------
router.delete('/playoff-series/:seriesId', async (req, res) => {
  const { seriesId } = req.params;
  try {
    const rows = await sql`DELETE FROM playoff_series WHERE id = ${seriesId} RETURNING id`;
    if (rows.length === 0) return res.status(404).json({ error: 'Playoff series not found' });
    return res.json({ message: 'Playoff series deleted' });
  } catch (err) {
    console.error('playoff series delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/games/route-lookup
// Resolves /games/<MM-DD-YYYY>/<away-code>-vs-<home-code> to one game id.
// ---------------------------------------------------------------------------
router.get('/route-lookup', async (req, res) => {
  const { season_id, game_date, game_slug } = req.query;
  if (!season_id || !game_date || !game_slug) {
    return res.status(400).json({ error: 'season_id, game_date, and game_slug are required' });
  }
  if (!/^\d{2}-\d{2}-\d{4}$/.test(String(game_date))) {
    return res.status(400).json({ error: 'game_date must be MM-DD-YYYY' });
  }

  const [month, day, year] = String(game_date).split('-');
  const gameDate = `${year}-${month}-${day}`;

  try {
    const rows = resultRows(await db.execute(ormSql`
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
      WHERE g.season_id = ${season_id}::uuid
        AND (
          CASE
            WHEN lower(l.code) = 'nhl' THEN (
              (g.scheduled_at AT TIME ZONE 'America/New_York')::date = ${gameDate}::date
              OR (g.scheduled_at AT TIME ZONE 'UTC')::date = ${gameDate}::date
            )
            ELSE (g.scheduled_at AT TIME ZONE 'UTC')::date = ${gameDate}::date
          END
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
      ORDER BY g.scheduled_at DESC NULLS LAST, g.id DESC
      LIMIT 1
    `));

    if (rows.length === 0) return res.status(404).json({ error: 'Game route not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('games route lookup error:', err);
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
        score.winner_team_id,
        score.home_score,
        score.away_score,
        g.playoff_series_id, g.game_number_in_series, g.game_number,
        g.notes, g.current_period, g.created_at,
        g.star_1_id, g.star_2_id, g.star_3_id,
        ps2.round         AS playoff_round,
        ps2.home_team_id  AS series_home_team_id,
        ps2.away_team_id  AS series_away_team_id,
        ps2.home_wins     AS series_home_wins,
        ps2.away_wins     AS series_away_wins,
        ps2.games_to_win  AS series_games_to_win,
        ps2.bracket_slot_key AS bracket_slot_key,
        brs.round_names   AS playoff_round_names,
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
        l.id   AS league_id,
        l.code AS league_code,
        l.name AS league_name,
        l.best_of_shootout,
        home_l5.home_last_five,
        away_l5.away_last_five,
        prev.previous_meetings
      FROM games g
      JOIN seasons s ON s.id = g.season_id
      JOIN leagues l ON l.id = s.league_id
      JOIN teams t_home ON t_home.id = g.home_team_id
      JOIN teams t_away ON t_away.id = g.away_team_id
      LEFT JOIN playoff_series ps2 ON ps2.id = g.playoff_series_id
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

  const normalizedScheduledAt = normalizeAdminScheduledAt(scheduled_at);

  // Reject a duplicate matchup on the same calendar date. Games with a null date
  // are exempt (the date is nullable, so they can't be reliably de-duplicated).
  if (normalizedScheduledAt) {
    const dup = await sql`
      SELECT id FROM games
      WHERE season_id = ${season_id}
        AND home_team_id = ${home_team_id}
        AND away_team_id = ${away_team_id}
        AND scheduled_at IS NOT NULL
        AND scheduled_at::date = ${normalizedScheduledAt}::date
      LIMIT 1
    `;
    if (dup.length > 0) {
      return res
        .status(409)
        .json({ error: 'A game with the same date and teams already exists.' });
    }
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
        ${normalizedScheduledAt}, ${scheduled_time}, ${venue}, ${game_type}, ${status},
        ${overtime_periods}, ${shootout},
        ${playoff_series_id}, ${notes}
      )
      RETURNING id
    `;
    await refreshGameStatSnapshots(rows[0].id);
    const game = await sql`
      SELECT
        g.id, g.season_id, g.game_type, g.status,
        g.scheduled_at, g.scheduled_time, g.venue,
        g.time_start, g.time_end,
        g.overtime_periods, g.shootout,
        score.winner_team_id,
        score.home_score,
        score.away_score,
        g.playoff_series_id, g.notes, g.current_period, g.created_at,
        g.star_1_id, g.star_2_id, g.star_3_id,
        gs.period_scores,
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
        ) AS away_team
      FROM games g
      JOIN teams t_home ON t_home.id = g.home_team_id
      JOIN teams t_away ON t_away.id = g.away_team_id
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
    home_team_id, away_team_id,
    scheduled_at, scheduled_time, venue, game_type, status,
    time_start, time_end,
    overtime_periods, shootout,
    playoff_series_id, playoff_round, game_number_in_series, notes,
    current_period,
    star_1_id, star_2_id, star_3_id,
    shootout_first_team_id,
  } = req.body;

  // Automatically set current_period to '1' when a game is started
  const effectivePeriod = status === 'in_progress' && current_period === undefined
    ? '1'
    : (current_period ?? null);
  const normalizedScheduledAt = scheduled_at === undefined
    ? undefined
    : normalizeAdminScheduledAt(scheduled_at);

  try {
    const existing = await sql`
      SELECT id, season_id, home_team_id, away_team_id, scheduled_at, playoff_series_id
      FROM games WHERE id = ${id}
    `;
    if (existing.length === 0) return res.status(404).json({ error: 'Game not found' });

    // Reject editing a game into a duplicate matchup on the same calendar date.
    // Games with a null date are exempt (the date is nullable).
    const finalHome = home_team_id ?? existing[0].home_team_id;
    const finalAway = away_team_id ?? existing[0].away_team_id;
    const finalScheduledAt =
      normalizedScheduledAt === undefined ? existing[0].scheduled_at : normalizedScheduledAt;
    if (finalScheduledAt) {
      const dup = await sql`
        SELECT id FROM games
        WHERE id <> ${id}
          AND season_id = ${existing[0].season_id}
          AND home_team_id = ${finalHome}
          AND away_team_id = ${finalAway}
          AND scheduled_at IS NOT NULL
          AND scheduled_at::date = ${finalScheduledAt}::date
        LIMIT 1
      `;
      if (dup.length > 0) {
        return res
          .status(409)
          .json({ error: 'A game with the same date and teams already exists.' });
      }
    }

    const targetSeriesId = playoff_series_id ?? existing[0].playoff_series_id ?? null;
    if (playoff_round != null && !targetSeriesId) {
      return res.status(400).json({ error: 'Cannot set playoff round without a linked playoff series' });
    }

    await sql`
      UPDATE games SET
        home_team_id             = COALESCE(${home_team_id             ?? null}::uuid, home_team_id),
        away_team_id             = COALESCE(${away_team_id             ?? null}::uuid, away_team_id),
        scheduled_at          = COALESCE(${normalizedScheduledAt ?? null}, scheduled_at),
        scheduled_time        = COALESCE(${scheduled_time        ?? null}, scheduled_time),
        venue                 = COALESCE(${venue                 ?? null}, venue),
        game_type             = COALESCE(${game_type             ?? null}, game_type),
        status                = COALESCE(${status                ?? null}, status),
        overtime_periods      = CASE
                                  WHEN ${status ?? null} = 'final' AND ${overtime_periods ?? null}::smallint IS NULL
                                  THEN CASE WHEN current_period IN ('OT', 'SO') THEN COALESCE(overtime_periods, 1) ELSE overtime_periods END
                                  ELSE COALESCE(${overtime_periods ?? null}::smallint, overtime_periods)
                                END,
        shootout              = CASE
                                  WHEN ${status ?? null} = 'final' AND ${shootout ?? null}::boolean IS NULL
                                  THEN (current_period = 'SO')
                                  ELSE COALESCE(${shootout ?? null}::boolean, shootout)
                                END,
        playoff_series_id     = COALESCE(${playoff_series_id     ?? null}, playoff_series_id),
        game_number_in_series = COALESCE(${game_number_in_series ?? null}::smallint, game_number_in_series),
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

    if (playoff_round != null && targetSeriesId) {
      await sql`
        UPDATE playoff_series
        SET round = ${playoff_round}::smallint
        WHERE id = ${targetSeriesId}
      `;
    }

    // ── Auto-update playoff series win counts ─────────────────────────────────
    // When a playoff game is finalized, recount wins from actual game results
    // and sync home_wins / away_wins on the playoff_series row. Also mark the
    // series complete when either team reaches games_to_win.
    if (status === 'final') {
      const gameRows = await sql`
        SELECT playoff_series_id, home_team_id, away_team_id
        FROM games WHERE id = ${id}
      `;
      const game = gameRows[0];
      if (game?.playoff_series_id) {
        const seriesRows = await sql`
          SELECT id, home_team_id, away_team_id, games_to_win
          FROM playoff_series WHERE id = ${game.playoff_series_id}
        `;
        const series = seriesRows[0];
        if (series) {
          // Count goals per team for every final game in this series
          const winRows = await sql`
            SELECT
              g.home_team_id,
              g.away_team_id,
              COUNT(*) FILTER (WHERE go.team_id = g.home_team_id) AS home_goals,
              COUNT(*) FILTER (WHERE go.team_id = g.away_team_id) AS away_goals
            FROM games g
            LEFT JOIN goals go ON go.game_id = g.id
            WHERE g.playoff_series_id = ${series.id}
              AND g.status = 'final'
            GROUP BY g.id, g.home_team_id, g.away_team_id
          `;

          let homeWins = 0;
          let awayWins = 0;
          for (const row of winRows) {
            const hg = Number(row.home_goals);
            const ag = Number(row.away_goals);
            if (hg > ag) {
              // The home team of THIS game won — attribute to the series home/away
              if (row.home_team_id === series.home_team_id) homeWins++;
              else awayWins++;
            } else if (ag > hg) {
              if (row.away_team_id === series.home_team_id) homeWins++;
              else awayWins++;
            }
          }

          const seriesComplete =
            homeWins >= series.games_to_win || awayWins >= series.games_to_win;
          const winnerId = seriesComplete
            ? homeWins >= series.games_to_win
              ? series.home_team_id
              : series.away_team_id
            : null;

          await sql`
            UPDATE playoff_series SET
              home_wins      = ${homeWins},
              away_wins      = ${awayWins},
              status         = ${seriesComplete ? 'complete' : awayWins > 0 || homeWins > 0 ? 'active' : 'upcoming'},
              winner_team_id = COALESCE(${winnerId}, winner_team_id)
            WHERE id = ${series.id}
          `;

          // Once the series is clinched, delete any games that haven't been
          // played — they're no longer needed (e.g. game 7 after a 4-2 series).
          if (seriesComplete) {
            await sql`
              DELETE FROM games
              WHERE playoff_series_id = ${series.id}
                AND status <> 'final'
            `;
          }

          // ── Auto-advance: create next-round series shell ────────────────────
          // When a series completes and has a bracket_slot_key, check if the
          // bracket rule set has a 'winner' slot referencing this matchup.
          // If both feeder series are now complete, create the next-round series
          // row (without games — admin starts it manually via /start endpoint).
          if (seriesComplete && winnerId) {
            const advRows = await sql`
              SELECT bracket_slot_key, season_id
              FROM playoff_series WHERE id = ${series.id}
            `;
            const slotKey = advRows[0]?.bracket_slot_key; // e.g. 'r1m0'
            const seriesSeasonId = advRows[0]?.season_id;

            if (slotKey && seriesSeasonId) {
              const seasonRows = await sql`
                SELECT bracket_rule_set_id FROM seasons WHERE id = ${seriesSeasonId}
              `;
              const bracketRuleSetId = seasonRows[0]?.bracket_rule_set_id;

              if (bracketRuleSetId) {
                await normalizeSeasonBracketSlotKeys(sql, seriesSeasonId, bracketRuleSetId);

                const normalizedSeriesRows = await sql`
                  SELECT bracket_slot_key FROM playoff_series WHERE id = ${series.id}
                `;
                const slotKey = normalizedSeriesRows[0]?.bracket_slot_key;
                if (slotKey) {
                  // Find next-round slots that list this matchup as their winner source
                  const dependentSlots = await sql`
                    SELECT slot_key FROM bracket_slot_rules
                    WHERE rule_set_id = ${bracketRuleSetId}
                      AND rule_type = 'winner'
                      AND matchup_ref = ${slotKey}
                  `;

                  for (const { slot_key: depSlot } of dependentSlots) {
                  // Strip team1/team2 suffix to get the next matchup key (e.g. 'r2m0')
                    const nextMatchupKey = depSlot.replace(/team[12]$/, '');

                    // Get the two winner slots for the next matchup
                    const nextSlots = await sql`
                      SELECT slot_key, matchup_ref FROM bracket_slot_rules
                      WHERE rule_set_id = ${bracketRuleSetId}
                        AND slot_key LIKE ${nextMatchupKey + '%'}
                        AND rule_type = 'winner'
                    `;
                    const team1Slot = nextSlots.find((s) => s.slot_key === `${nextMatchupKey}team1`);
                    const team2Slot = nextSlots.find((s) => s.slot_key === `${nextMatchupKey}team2`);

                  if (!team1Slot?.matchup_ref || !team2Slot?.matchup_ref) continue;

                  // Look up the completed series for each feeder matchup
                  const [t1Series] = await sql`
                    SELECT winner_team_id, status FROM playoff_series
                    WHERE season_id = ${seriesSeasonId}
                      AND bracket_slot_key = ${team1Slot.matchup_ref}
                  `;
                  const [t2Series] = await sql`
                    SELECT winner_team_id, status FROM playoff_series
                    WHERE season_id = ${seriesSeasonId}
                      AND bracket_slot_key = ${team2Slot.matchup_ref}
                  `;

                  const bothComplete =
                    t1Series?.status === 'complete' && t1Series?.winner_team_id &&
                    t2Series?.status === 'complete' && t2Series?.winner_team_id;

                  const [nextExisting] = await sql`
                    SELECT id, home_team_id, away_team_id FROM playoff_series
                    WHERE season_id = ${seriesSeasonId}
                      AND bracket_slot_key = ${nextMatchupKey}
                  `;

                  const roundMatch = nextMatchupKey.match(/^r(\d+)/);
                  const nextRound = roundMatch ? Number(roundMatch[1]) : null;
                  if (!nextRound) continue;

                  const gtwRows = await sql`
                    SELECT COALESCE(s.best_of_playoff, l.best_of_playoff) AS best_of
                    FROM seasons s JOIN leagues l ON l.id = s.league_id
                    WHERE s.id = ${seriesSeasonId}
                  `;
                  const bestOf = gtwRows[0]?.best_of ?? 7;
                  const gamesToWin = Math.ceil(bestOf / 2);
                  // Which side of the next matchup this series feeds (team1 = home).
                  const isTeam1 = depSlot.endsWith('team1');

                  // The opponent for this winner, as far as currently known: the
                  // other feeder's winner, or a team already sitting in the next
                  // series' other slot.
                  const otherWinner = bothComplete
                    ? (isTeam1 ? t2Series.winner_team_id : t1Series.winner_team_id)
                    : null;
                  const existingOther = nextExisting
                    ? (isTeam1 ? nextExisting.away_team_id : nextExisting.home_team_id)
                    : null;
                  const opponent =
                    otherWinner && otherWinner !== winnerId
                      ? otherWinner
                      : existingOther && existingOther !== winnerId
                        ? existingOther
                        : null;

                  if (opponent) {
                    // Both teams are known → the higher seed (better regular-season
                    // record) gets home-ice.
                    const { home, away } = await homeAwayBySeed(seriesSeasonId, winnerId, opponent);
                    if (!nextExisting) {
                      await sql`
                        INSERT INTO playoff_series
                          (season_id, round, home_team_id, away_team_id, games_to_win, status, bracket_slot_key)
                        VALUES
                          (${seriesSeasonId}, ${nextRound}, ${home}, ${away}, ${gamesToWin}, 'upcoming', ${nextMatchupKey})
                      `;
                    } else {
                      await sql`
                        UPDATE playoff_series
                        SET home_team_id = ${home}, away_team_id = ${away}
                        WHERE id = ${nextExisting.id}
                      `;
                    }
                  } else {
                    // Only this winner is known; the opponent is still TBD. Place it
                    // now (home-ice is re-seeded when the opponent arrives), so the
                    // first team no longer needs a manual advance.
                    if (!nextExisting) {
                      const homeId = isTeam1 ? winnerId : null;
                      const awayId = isTeam1 ? null : winnerId;
                      await sql`
                        INSERT INTO playoff_series
                          (season_id, round, home_team_id, away_team_id, games_to_win, status, bracket_slot_key)
                        VALUES
                          (${seriesSeasonId}, ${nextRound}, ${homeId}, ${awayId}, ${gamesToWin}, 'upcoming', ${nextMatchupKey})
                      `;
                    } else if (isTeam1 && !nextExisting.home_team_id) {
                      await sql`UPDATE playoff_series SET home_team_id = ${winnerId} WHERE id = ${nextExisting.id}`;
                    } else if (!isTeam1 && !nextExisting.away_team_id) {
                      await sql`UPDATE playoff_series SET away_team_id = ${winnerId} WHERE id = ${nextExisting.id}`;
                    }
                  }
                  }
                }
              }
            }
          }
        }
      }
    }

    await refreshGameStatSnapshots(id);

    const updated = await sql`
      SELECT
        g.id, g.season_id, g.game_type, g.status,
        g.scheduled_at, g.scheduled_time, g.venue,
        g.time_start, g.time_end,
        g.overtime_periods, g.shootout, g.shootout_first_team_id,
        score.winner_team_id,
        score.home_score,
        score.away_score,
        g.playoff_series_id, g.game_number_in_series, g.game_number,
        g.notes, g.current_period, g.created_at,
        g.star_1_id, g.star_2_id, g.star_3_id,
        ps2.round AS playoff_round,
        ps2.bracket_slot_key AS bracket_slot_key,
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
        ) AS away_team
      FROM games g
      JOIN seasons s ON s.id = g.season_id
      JOIN teams t_home ON t_home.id = g.home_team_id
      JOIN teams t_away ON t_away.id = g.away_team_id
      LEFT JOIN playoff_series ps2 ON ps2.id = g.playoff_series_id
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
// GET /api/admin/games/:id/lineup  – get starting goalies for both teams.
// ---------------------------------------------------------------------------
router.get('/:id/lineup', async (req, res) => {
  const { id } = req.params;
  try {
    const hasAcquisitionType = await hasPlayerTeamsAcquisitionType();
    const gameRows = await sql`SELECT id FROM games WHERE id = ${id}`;
    if (gameRows.length === 0) return res.status(404).json({ error: 'Game not found' });

    const rows = await selectStartingGoalieRows(id, hasAcquisitionType);
    return res.json(rows);
  } catch (err) {
    console.error('lineup get error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/games/:id/lineup  – upsert starting goalie for one team
// Body: { team_id, slots: [{ position_slot, player_id }] }
// ---------------------------------------------------------------------------
router.put('/:id/lineup', async (req, res) => {
  const { id } = req.params;
  const { team_id, slots } = req.body;
  if (!team_id) return res.status(400).json({ error: 'team_id is required' });
  if (!Array.isArray(slots)) return res.status(400).json({ error: 'slots must be an array' });

  try {
    const { goalieId, error } = extractStartingGoalieId(slots);
    if (error) return res.status(400).json({ error });
    const hasAcquisitionType = await hasPlayerTeamsAcquisitionType();

    const gameRows = await sql`
      UPDATE games
      SET
        home_starting_goalie_id = CASE
          WHEN home_team_id = ${team_id} THEN ${goalieId}
          ELSE home_starting_goalie_id
        END,
        away_starting_goalie_id = CASE
          WHEN away_team_id = ${team_id} THEN ${goalieId}
          ELSE away_starting_goalie_id
        END
      WHERE id = ${id}
        AND (home_team_id = ${team_id} OR away_team_id = ${team_id})
      RETURNING id
    `;
    if (gameRows.length === 0) return res.status(404).json({ error: 'Game or team not found' });

    await syncFinalStartingGoalieStint(id, team_id, goalieId);
    await refreshGameStatSnapshots(id);

    const rows = await selectStartingGoalieRows(id, hasAcquisitionType, team_id);
    return res.json(rows);
  } catch (err) {
    console.error('lineup put error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/games/:id/lineup/:teamId  – clear a team's starting goalie.
// ---------------------------------------------------------------------------
router.delete('/:id/lineup/:teamId', async (req, res) => {
  const { id, teamId } = req.params;
  try {
    const rows = await sql`
      WITH target AS (
        SELECT
          id,
          home_team_id,
          away_team_id,
          home_starting_goalie_id,
          away_starting_goalie_id
        FROM games
        WHERE id = ${id}
      ),
      cleared_goalie AS (
        UPDATE games g
        SET
          home_starting_goalie_id = CASE
            WHEN g.home_team_id = ${teamId} THEN NULL
            ELSE g.home_starting_goalie_id
          END,
          away_starting_goalie_id = CASE
            WHEN g.away_team_id = ${teamId} THEN NULL
            ELSE g.away_starting_goalie_id
          END
        FROM target
        WHERE g.id = target.id
          AND (g.home_team_id = ${teamId} OR g.away_team_id = ${teamId})
        RETURNING g.id
      )
      SELECT
        EXISTS(SELECT 1 FROM target) AS game_exists,
        EXISTS(
          SELECT 1
          FROM target
          WHERE (home_team_id = ${teamId} AND home_starting_goalie_id IS NOT NULL)
             OR (away_team_id = ${teamId} AND away_starting_goalie_id IS NOT NULL)
        ) AS changed
    `;
    if (!rows[0]?.game_exists || !rows[0]?.changed) {
      return res.status(404).json({ error: 'Starting goalie not found' });
    }
    await refreshGameStatSnapshots(id);
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
    const hasAcquisitionType = await hasPlayerTeamsAcquisitionType();

    // 2. Fetch any existing roster entries for this game.
    const current = await sql`
      SELECT
        gr.id, gr.game_id, gr.team_id, gr.player_id,
        p.first_name, p.last_name, p.date_of_birth,
        COALESCE(pts.start_date, pt.start_date) AS start_date,
        COALESCE(pts.acquisition_type, ${acquisitionTypeSelect(hasAcquisitionType, 'pt')}) AS acquisition_type,
        COALESCE(NULLIF(pt.photo, ''), best_player_photo(p.id, g.season_id, gr.team_id), NULLIF(p.photo, '')) AS photo,
        COALESCE(pt.position, p.position) AS position, COALESCE(pt_jnh.jersey_number, pt.jersey_number) AS jersey_number,
        false AS inherited
      FROM game_rosters gr
      JOIN games g ON g.id = gr.game_id
      JOIN players p ON p.id = gr.player_id
      LEFT JOIN player_teams pt
        ON pt.player_id = gr.player_id
        AND pt.team_id  = gr.team_id
        AND pt.season_id = g.season_id
        AND (pt.start_date IS NULL OR pt.start_date <= COALESCE(g.scheduled_at::date, CURRENT_DATE))
        AND (pt.end_date   IS NULL OR pt.end_date   >= COALESCE(g.scheduled_at::date, CURRENT_DATE))
      LEFT JOIN LATERAL (
        SELECT start_date, acquisition_type
        FROM player_team_stints pts
        WHERE pts.player_id = gr.player_id
          AND pts.team_id = gr.team_id
          AND (pts.start_date IS NULL OR pts.start_date <= COALESCE(g.scheduled_at::date, CURRENT_DATE))
          AND (pts.end_date IS NULL OR pts.end_date >= COALESCE(g.scheduled_at::date, CURRENT_DATE))
        ORDER BY CASE WHEN pts.end_date IS NULL THEN 0 ELSE 1 END,
          pts.start_date DESC NULLS LAST,
          pts.created_at DESC
        LIMIT 1
      ) pts ON true
      LEFT JOIN LATERAL (
        SELECT jersey_number FROM jersey_number_history
        WHERE player_teams_id = pt.id
          AND effective_from <= COALESCE(g.scheduled_at::date, CURRENT_DATE)
        ORDER BY effective_from DESC LIMIT 1
      ) pt_jnh ON true
      WHERE gr.game_id = ${id}
      ORDER BY COALESCE(pt_jnh.jersey_number, pt.jersey_number) ASC NULLS LAST, p.last_name ASC
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
          p.first_name, p.last_name, p.date_of_birth,
          COALESCE(pts.start_date, pt.start_date) AS start_date,
          COALESCE(pts.acquisition_type, ${acquisitionTypeSelect(hasAcquisitionType, 'pt')}) AS acquisition_type,
          COALESCE(NULLIF(pt.photo, ''), best_player_photo(p.id, g.season_id, gr.team_id), NULLIF(p.photo, '')) AS photo,
          COALESCE(pt.position, p.position) AS position, COALESCE(pt_jnh.jersey_number, pt.jersey_number) AS jersey_number,
          true AS inherited
        FROM game_rosters gr
        JOIN games g ON g.id = gr.game_id
        JOIN players p ON p.id = gr.player_id
        LEFT JOIN player_teams pt
          ON pt.player_id = gr.player_id
          AND pt.team_id  = gr.team_id
          AND pt.season_id = g.season_id
          AND (pt.start_date IS NULL OR pt.start_date <= COALESCE(g.scheduled_at::date, CURRENT_DATE))
          AND (pt.end_date   IS NULL OR pt.end_date   >= COALESCE(g.scheduled_at::date, CURRENT_DATE))
        LEFT JOIN LATERAL (
          SELECT start_date, acquisition_type
          FROM player_team_stints pts
          WHERE pts.player_id = gr.player_id
            AND pts.team_id = gr.team_id
            AND (pts.start_date IS NULL OR pts.start_date <= COALESCE(g.scheduled_at::date, CURRENT_DATE))
            AND (pts.end_date IS NULL OR pts.end_date >= COALESCE(g.scheduled_at::date, CURRENT_DATE))
          ORDER BY CASE WHEN pts.end_date IS NULL THEN 0 ELSE 1 END,
            pts.start_date DESC NULLS LAST,
            pts.created_at DESC
          LIMIT 1
        ) pts ON true
        LEFT JOIN LATERAL (
          SELECT jersey_number FROM jersey_number_history
          WHERE player_teams_id = pt.id
            AND effective_from <= COALESCE(g.scheduled_at::date, CURRENT_DATE)
          ORDER BY effective_from DESC LIMIT 1
        ) pt_jnh ON true
        WHERE gr.game_id = ${lastGameRows[0].game_id} AND gr.team_id = ${teamId}
        ORDER BY COALESCE(pt_jnh.jersey_number, pt.jersey_number) ASC NULLS LAST, p.last_name ASC
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
        UPDATE player_teams pt
        SET is_prospect = FALSE
        FROM games g
        WHERE g.id = ${id}
          AND pt.player_id = ${player_id}
          AND pt.team_id = ${team_id}
          AND pt.season_id = g.season_id
          AND pt.is_prospect = TRUE
          AND (pt.start_date IS NULL OR pt.start_date <= COALESCE(g.scheduled_at::date, CURRENT_DATE))
          AND (pt.end_date IS NULL OR pt.end_date >= COALESCE(g.scheduled_at::date, CURRENT_DATE))
      `;
      await sql`
        INSERT INTO game_rosters (game_id, team_id, player_id)
        VALUES (${id}, ${team_id}, ${player_id})
        ON CONFLICT (game_id, team_id, player_id) DO NOTHING
      `;
    }
    const hasAcquisitionType = await hasPlayerTeamsAcquisitionType();
    const rows = await sql`
      SELECT
        gr.id, gr.game_id, gr.team_id, gr.player_id,
        p.first_name, p.last_name, p.date_of_birth,
        COALESCE(pts.start_date, pt.start_date) AS start_date,
        COALESCE(pts.acquisition_type, ${acquisitionTypeSelect(hasAcquisitionType, 'pt')}) AS acquisition_type,
        COALESCE(NULLIF(pt.photo, ''), best_player_photo(p.id, g.season_id, gr.team_id), NULLIF(p.photo, '')) AS photo, COALESCE(pt.position, p.position) AS position,
        COALESCE(pt_jnh.jersey_number, pt.jersey_number) AS jersey_number
      FROM game_rosters gr
      JOIN games g ON g.id = gr.game_id
      JOIN players p ON p.id = gr.player_id
      LEFT JOIN player_teams pt
        ON pt.player_id = gr.player_id
        AND pt.team_id  = gr.team_id
        AND pt.season_id = g.season_id
        AND (pt.start_date IS NULL OR pt.start_date <= COALESCE(g.scheduled_at::date, CURRENT_DATE))
        AND (pt.end_date   IS NULL OR pt.end_date   >= COALESCE(g.scheduled_at::date, CURRENT_DATE))
      LEFT JOIN LATERAL (
        SELECT start_date, acquisition_type
        FROM player_team_stints pts
        WHERE pts.player_id = gr.player_id
          AND pts.team_id = gr.team_id
          AND (pts.start_date IS NULL OR pts.start_date <= COALESCE(g.scheduled_at::date, CURRENT_DATE))
          AND (pts.end_date IS NULL OR pts.end_date >= COALESCE(g.scheduled_at::date, CURRENT_DATE))
        ORDER BY CASE WHEN pts.end_date IS NULL THEN 0 ELSE 1 END,
          pts.start_date DESC NULLS LAST,
          pts.created_at DESC
        LIMIT 1
      ) pts ON true
      LEFT JOIN LATERAL (
        SELECT jersey_number FROM jersey_number_history
        WHERE player_teams_id = pt.id
          AND effective_from <= COALESCE(g.scheduled_at::date, CURRENT_DATE)
        ORDER BY effective_from DESC LIMIT 1
      ) pt_jnh ON true
      WHERE gr.game_id = ${id} AND gr.team_id = ${team_id}
      ORDER BY COALESCE(pt_jnh.jersey_number, pt.jersey_number) ASC NULLS LAST, p.last_name ASC
    `;
    await refreshGameStatSnapshots(id);
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
    await refreshGameStatSnapshots(id);
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
    const hasAcquisitionType = await hasPlayerTeamsAcquisitionType();
    const rows = await sql`
      SELECT
        go.id,
        go.game_id,
        go.team_id,
        go.period,
        go.goal_type,
        go.empty_net,
        go.penalty_shot,
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
        sp.date_of_birth                    AS scorer_date_of_birth,
        COALESCE(spts.start_date, spt.start_date) AS scorer_start_date,
        COALESCE(spts.acquisition_type, ${acquisitionTypeSelect(hasAcquisitionType, 'spt')}) AS scorer_acquisition_type,
        COALESCE(NULLIF(spt.photo, ''), best_player_photo(sp.id, g.season_id, go.team_id), NULLIF(sp.photo, '')) AS scorer_photo,
        COALESCE(spt_jnh.jersey_number, spt.jersey_number)   AS scorer_jersey_number,
        -- assist 1
        a1p.first_name                                        AS assist_1_first_name,
        a1p.last_name                                         AS assist_1_last_name,
        COALESCE(NULLIF(a1pt.photo, ''), best_player_photo(a1p.id, g.season_id, go.team_id), NULLIF(a1p.photo, '')) AS assist_1_photo,
        COALESCE(a1pt_jnh.jersey_number, a1pt.jersey_number)  AS assist_1_jersey_number,
        -- assist 2
        a2p.first_name                                        AS assist_2_first_name,
        a2p.last_name                                         AS assist_2_last_name,
        COALESCE(NULLIF(a2pt.photo, ''), best_player_photo(a2p.id, g.season_id, go.team_id), NULLIF(a2p.photo, '')) AS assist_2_photo,
        COALESCE(a2pt_jnh.jersey_number, a2pt.jersey_number)  AS assist_2_jersey_number,
        -- prior-game cumulative stats (finalized games in same season before this game;
        -- for playoff games, only count other playoff games)
        (SELECT COUNT(*)::int
          FROM goals g2
          JOIN games gm2 ON gm2.id = g2.game_id
          WHERE g2.scorer_id = go.scorer_id
            AND gm2.season_id = g.season_id
            AND gm2.status = 'final'
            AND (g.game_type != 'playoff' OR gm2.game_type = 'playoff')
            AND gm2.scheduled_at < g.scheduled_at
        ) AS scorer_prior_goals,
        (SELECT COUNT(*)::int
          FROM goals g2
          JOIN games gm2 ON gm2.id = g2.game_id
          WHERE go.assist_1_id IS NOT NULL
            AND (g2.assist_1_id = go.assist_1_id OR g2.assist_2_id = go.assist_1_id)
            AND gm2.season_id = g.season_id
            AND gm2.status = 'final'
            AND (g.game_type != 'playoff' OR gm2.game_type = 'playoff')
            AND gm2.scheduled_at < g.scheduled_at
        ) AS assist_1_prior_assists,
        (SELECT COUNT(*)::int
          FROM goals g2
          JOIN games gm2 ON gm2.id = g2.game_id
          WHERE go.assist_2_id IS NOT NULL
            AND (g2.assist_1_id = go.assist_2_id OR g2.assist_2_id = go.assist_2_id)
            AND gm2.season_id = g.season_id
            AND gm2.status = 'final'
            AND (g.game_type != 'playoff' OR gm2.game_type = 'playoff')
            AND gm2.scheduled_at < g.scheduled_at
        ) AS assist_2_prior_assists
      FROM goals go
      JOIN games g ON g.id = go.game_id
      JOIN players sp ON sp.id = go.scorer_id
      LEFT JOIN player_teams spt
        ON spt.player_id = go.scorer_id AND spt.team_id = go.team_id
        AND spt.season_id = g.season_id
        AND (spt.start_date IS NULL OR spt.start_date <= COALESCE(g.scheduled_at::date, CURRENT_DATE))
        AND (spt.end_date   IS NULL OR spt.end_date   >= COALESCE(g.scheduled_at::date, CURRENT_DATE))
      LEFT JOIN LATERAL (
        SELECT start_date, acquisition_type
        FROM player_team_stints pts
        WHERE pts.player_id = go.scorer_id
          AND pts.team_id = go.team_id
          AND (pts.start_date IS NULL OR pts.start_date <= COALESCE(g.scheduled_at::date, CURRENT_DATE))
          AND (pts.end_date IS NULL OR pts.end_date >= COALESCE(g.scheduled_at::date, CURRENT_DATE))
        ORDER BY CASE WHEN pts.end_date IS NULL THEN 0 ELSE 1 END,
          pts.start_date DESC NULLS LAST,
          pts.created_at DESC
        LIMIT 1
      ) spts ON true
      LEFT JOIN LATERAL (
        SELECT jersey_number FROM jersey_number_history
        WHERE player_teams_id = spt.id
          AND effective_from <= COALESCE(g.scheduled_at::date, CURRENT_DATE)
        ORDER BY effective_from DESC LIMIT 1
      ) spt_jnh ON true
      LEFT JOIN players a1p ON a1p.id = go.assist_1_id
      LEFT JOIN player_teams a1pt
        ON a1pt.player_id = go.assist_1_id AND a1pt.team_id = go.team_id
        AND a1pt.season_id = g.season_id
        AND (a1pt.start_date IS NULL OR a1pt.start_date <= COALESCE(g.scheduled_at::date, CURRENT_DATE))
        AND (a1pt.end_date   IS NULL OR a1pt.end_date   >= COALESCE(g.scheduled_at::date, CURRENT_DATE))
      LEFT JOIN LATERAL (
        SELECT jersey_number FROM jersey_number_history
        WHERE player_teams_id = a1pt.id
          AND effective_from <= COALESCE(g.scheduled_at::date, CURRENT_DATE)
        ORDER BY effective_from DESC LIMIT 1
      ) a1pt_jnh ON true
      LEFT JOIN players a2p ON a2p.id = go.assist_2_id
      LEFT JOIN player_teams a2pt
        ON a2pt.player_id = go.assist_2_id AND a2pt.team_id = go.team_id
        AND a2pt.season_id = g.season_id
        AND (a2pt.start_date IS NULL OR a2pt.start_date <= COALESCE(g.scheduled_at::date, CURRENT_DATE))
        AND (a2pt.end_date   IS NULL OR a2pt.end_date   >= COALESCE(g.scheduled_at::date, CURRENT_DATE))
      LEFT JOIN LATERAL (
        SELECT jersey_number FROM jersey_number_history
        WHERE player_teams_id = a2pt.id
          AND effective_from <= COALESCE(g.scheduled_at::date, CURRENT_DATE)
        ORDER BY effective_from DESC LIMIT 1
      ) a2pt_jnh ON true
      JOIN teams t ON t.id = go.team_id
      LEFT JOIN LATERAL (
        SELECT name, code, team_logo_default(logo_dark, logo_light) AS logo, team_logo_dark(logo_dark, logo_light) AS logo_dark, team_logo_light(logo_dark, logo_light) AS logo_light FROM team_iterations
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
// Body: { team_id, period, goal_type, empty_net?, penalty_shot?, period_time, scorer_id, assist_1_id?, assist_2_id? }
// ---------------------------------------------------------------------------
router.post('/:id/goals', async (req, res) => {
  const { id } = req.params;
  const {
    team_id,
    period,
    goal_type = 'even-strength',
    empty_net = false,
    penalty_shot = false,
    period_time = null,
    scorer_id,
    assist_1_id = null,
    assist_2_id = null,
  } = req.body;

  if (!team_id || !period || !scorer_id) {
    return res.status(400).json({ error: 'team_id, period, and scorer_id are required' });
  }

  const participantError = validateGoalParticipants(scorer_id, assist_1_id, assist_2_id);
  if (participantError) return res.status(400).json({ error: participantError });

  const storedGoalType =
    goal_type === 'empty-net' || goal_type === 'penalty-shot' ? 'even-strength' : goal_type;
  const storedEmptyNet = !!empty_net || goal_type === 'empty-net';
  const storedPenaltyShot = !!penalty_shot || goal_type === 'penalty-shot';

  try {
    // Determine if this team is the home or away team.
    const gameRows = await sql`SELECT home_team_id, away_team_id FROM games WHERE id = ${id}`;
    if (gameRows.length === 0) return res.status(404).json({ error: 'Game not found' });
    const { home_team_id, away_team_id } = gameRows[0];
    const side = team_id === home_team_id ? 'home' : team_id === away_team_id ? 'away' : null;
    if (!side) return res.status(400).json({ error: 'team_id is not a participant in this game' });

    // Insert the goal record.
    const [goal] = await sql`
      INSERT INTO goals (game_id, team_id, period, goal_type, empty_net, penalty_shot, period_time, scorer_id, assist_1_id, assist_2_id)
      VALUES (${id}, ${team_id}, ${period}, ${storedGoalType}, ${storedEmptyNet}, ${storedPenaltyShot}, ${period_time}, ${scorer_id}, ${assist_1_id}, ${assist_2_id})
      RETURNING id
    `;

    // Return the full goal record with player/team details.
    const hasAcquisitionType = await hasPlayerTeamsAcquisitionType();
    const [full] = await sql`
      SELECT
        go.id, go.game_id, go.team_id, go.period, go.goal_type, go.empty_net, go.penalty_shot, go.period_time,
        go.scorer_id, go.assist_1_id, go.assist_2_id, go.created_at,
        ti.name AS team_name, ti.code AS team_code, ti.logo AS team_logo,
        t.primary_color AS team_primary_color, t.text_color AS team_text_color,
        sp.first_name AS scorer_first_name, sp.last_name AS scorer_last_name,sp.date_of_birth AS scorer_date_of_birth,
        COALESCE(spts.start_date, spt.start_date) AS scorer_start_date,
        COALESCE(spts.acquisition_type, ${acquisitionTypeSelect(hasAcquisitionType, 'spt')}) AS scorer_acquisition_type,
        COALESCE(NULLIF(spt.photo, ''), best_player_photo(sp.id, g.season_id, go.team_id), NULLIF(sp.photo, '')) AS scorer_photo,
        COALESCE(spt_jnh.jersey_number, spt.jersey_number) AS scorer_jersey_number,
        a1p.first_name AS assist_1_first_name, a1p.last_name AS assist_1_last_name, COALESCE(NULLIF(a1pt.photo, ''), best_player_photo(a1p.id, g.season_id, go.team_id), NULLIF(a1p.photo, '')) AS assist_1_photo,
        COALESCE(a1pt_jnh.jersey_number, a1pt.jersey_number) AS assist_1_jersey_number,
        a2p.first_name AS assist_2_first_name, a2p.last_name AS assist_2_last_name, COALESCE(NULLIF(a2pt.photo, ''), best_player_photo(a2p.id, g.season_id, go.team_id), NULLIF(a2p.photo, '')) AS assist_2_photo,
        COALESCE(a2pt_jnh.jersey_number, a2pt.jersey_number) AS assist_2_jersey_number,
        (SELECT COUNT(*)::int
          FROM goals g2
          JOIN games gm2 ON gm2.id = g2.game_id
          WHERE g2.scorer_id = go.scorer_id
            AND gm2.season_id = g.season_id
            AND gm2.status = 'final'
            AND (g.game_type != 'playoff' OR gm2.game_type = 'playoff')
            AND gm2.scheduled_at < g.scheduled_at
        ) AS scorer_prior_goals,
        (SELECT COUNT(*)::int
          FROM goals g2
          JOIN games gm2 ON gm2.id = g2.game_id
          WHERE go.assist_1_id IS NOT NULL
            AND (g2.assist_1_id = go.assist_1_id OR g2.assist_2_id = go.assist_1_id)
            AND gm2.season_id = g.season_id
            AND gm2.status = 'final'
            AND (g.game_type != 'playoff' OR gm2.game_type = 'playoff')
            AND gm2.scheduled_at < g.scheduled_at
        ) AS assist_1_prior_assists,
        (SELECT COUNT(*)::int
          FROM goals g2
          JOIN games gm2 ON gm2.id = g2.game_id
          WHERE go.assist_2_id IS NOT NULL
            AND (g2.assist_1_id = go.assist_2_id OR g2.assist_2_id = go.assist_2_id)
            AND gm2.season_id = g.season_id
            AND gm2.status = 'final'
            AND (g.game_type != 'playoff' OR gm2.game_type = 'playoff')
            AND gm2.scheduled_at < g.scheduled_at
        ) AS assist_2_prior_assists
      FROM goals go
      JOIN games g ON g.id = go.game_id
      JOIN players sp ON sp.id = go.scorer_id
      LEFT JOIN player_teams spt
        ON spt.player_id = go.scorer_id AND spt.team_id = go.team_id
        AND spt.season_id = g.season_id
        AND (spt.start_date IS NULL OR spt.start_date <= COALESCE(g.scheduled_at::date, CURRENT_DATE))
        AND (spt.end_date   IS NULL OR spt.end_date   >= COALESCE(g.scheduled_at::date, CURRENT_DATE))
      LEFT JOIN LATERAL (
        SELECT start_date, acquisition_type
        FROM player_team_stints pts
        WHERE pts.player_id = go.scorer_id
          AND pts.team_id = go.team_id
          AND (pts.start_date IS NULL OR pts.start_date <= COALESCE(g.scheduled_at::date, CURRENT_DATE))
          AND (pts.end_date IS NULL OR pts.end_date >= COALESCE(g.scheduled_at::date, CURRENT_DATE))
        ORDER BY CASE WHEN pts.end_date IS NULL THEN 0 ELSE 1 END,
          pts.start_date DESC NULLS LAST,
          pts.created_at DESC
        LIMIT 1
      ) spts ON true
      LEFT JOIN LATERAL (
        SELECT jersey_number FROM jersey_number_history
        WHERE player_teams_id = spt.id
          AND effective_from <= COALESCE(g.scheduled_at::date, CURRENT_DATE)
        ORDER BY effective_from DESC LIMIT 1
      ) spt_jnh ON true
      LEFT JOIN players a1p ON a1p.id = go.assist_1_id
      LEFT JOIN player_teams a1pt
        ON a1pt.player_id = go.assist_1_id AND a1pt.team_id = go.team_id
        AND a1pt.season_id = g.season_id
        AND (a1pt.start_date IS NULL OR a1pt.start_date <= COALESCE(g.scheduled_at::date, CURRENT_DATE))
        AND (a1pt.end_date   IS NULL OR a1pt.end_date   >= COALESCE(g.scheduled_at::date, CURRENT_DATE))
      LEFT JOIN LATERAL (
        SELECT jersey_number FROM jersey_number_history
        WHERE player_teams_id = a1pt.id
          AND effective_from <= COALESCE(g.scheduled_at::date, CURRENT_DATE)
        ORDER BY effective_from DESC LIMIT 1
      ) a1pt_jnh ON true
      LEFT JOIN players a2p ON a2p.id = go.assist_2_id
      LEFT JOIN player_teams a2pt
        ON a2pt.player_id = go.assist_2_id AND a2pt.team_id = go.team_id
        AND a2pt.season_id = g.season_id
        AND (a2pt.start_date IS NULL OR a2pt.start_date <= COALESCE(g.scheduled_at::date, CURRENT_DATE))
        AND (a2pt.end_date   IS NULL OR a2pt.end_date   >= COALESCE(g.scheduled_at::date, CURRENT_DATE))
      LEFT JOIN LATERAL (
        SELECT jersey_number FROM jersey_number_history
        WHERE player_teams_id = a2pt.id
          AND effective_from <= COALESCE(g.scheduled_at::date, CURRENT_DATE)
        ORDER BY effective_from DESC LIMIT 1
      ) a2pt_jnh ON true
      JOIN teams t ON t.id = go.team_id
      LEFT JOIN LATERAL (
        SELECT name, code, team_logo_default(logo_dark, logo_light) AS logo, team_logo_dark(logo_dark, logo_light) AS logo_dark, team_logo_light(logo_dark, logo_light) AS logo_light FROM team_iterations
        WHERE team_id = go.team_id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) ti ON true
      WHERE go.id = ${goal.id}
    `;
    await refreshGameStatSnapshots(id);
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
    penalty_shot = false,
    period_time = null,
    scorer_id,
    assist_1_id = null,
    assist_2_id = null,
  } = req.body;

  if (!team_id || !period || !scorer_id) {
    return res.status(400).json({ error: 'team_id, period, and scorer_id are required' });
  }

  const participantError = validateGoalParticipants(scorer_id, assist_1_id, assist_2_id);
  if (participantError) return res.status(400).json({ error: participantError });

  const storedGoalType =
    goal_type === 'empty-net' || goal_type === 'penalty-shot' ? 'even-strength' : goal_type;
  const storedEmptyNet = !!empty_net || goal_type === 'empty-net';
  const storedPenaltyShot = !!penalty_shot || goal_type === 'penalty-shot';

  try {
    const rows = await sql`
      UPDATE goals
      SET team_id     = ${team_id},
          period      = ${period},
          goal_type   = ${storedGoalType},
          empty_net   = ${storedEmptyNet},
          penalty_shot = ${storedPenaltyShot},
          period_time = ${period_time},
          scorer_id   = ${scorer_id},
          assist_1_id = ${assist_1_id},
          assist_2_id = ${assist_2_id}
      WHERE id = ${goalId} AND game_id = ${id}
      RETURNING id
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Goal not found' });

    const hasAcquisitionType = await hasPlayerTeamsAcquisitionType();
    const [full] = await sql`
      SELECT
        go.id,
        go.game_id,
        go.team_id,
        go.period,
        go.goal_type,
        go.empty_net,
        go.penalty_shot,
        go.period_time,
        go.scorer_id,
        go.assist_1_id,
        go.assist_2_id,
        go.created_at,
        ti.name             AS team_name,
        ti.code             AS team_code,
        ti.logo             AS team_logo,
        t.primary_color     AS team_primary_color,
        t.text_color        AS team_text_color,
        sp.first_name       AS scorer_first_name,
        sp.last_name        AS scorer_last_name,
        sp.date_of_birth    AS scorer_date_of_birth,
        COALESCE(spts.start_date, spt.start_date) AS scorer_start_date,
        COALESCE(spts.acquisition_type, ${acquisitionTypeSelect(hasAcquisitionType, 'spt')}) AS scorer_acquisition_type,
        COALESCE(NULLIF(spt.photo, ''), best_player_photo(sp.id, g.season_id, go.team_id), NULLIF(sp.photo, '')) AS scorer_photo,
        COALESCE(spt_jnh.jersey_number, spt.jersey_number)      AS scorer_jersey_number,
        a1p.first_name AS assist_1_first_name,
        a1p.last_name  AS assist_1_last_name,
        COALESCE(NULLIF(a1pt.photo, ''), best_player_photo(a1p.id, g.season_id, go.team_id), NULLIF(a1p.photo, '')) AS assist_1_photo,
        COALESCE(a1pt_jnh.jersey_number, a1pt.jersey_number)       AS assist_1_jersey_number,
        a2p.first_name AS assist_2_first_name,
        a2p.last_name  AS assist_2_last_name,
        COALESCE(NULLIF(a2pt.photo, ''), best_player_photo(a2p.id, g.season_id, go.team_id), NULLIF(a2p.photo, '')) AS assist_2_photo,
        COALESCE(a2pt_jnh.jersey_number, a2pt.jersey_number)       AS assist_2_jersey_number,
        (SELECT COUNT(*)::int
          FROM goals g2
          JOIN games gm2 ON gm2.id = g2.game_id
          WHERE g2.scorer_id = go.scorer_id
            AND gm2.season_id = g.season_id
            AND gm2.status = 'final'
            AND (g.game_type != 'playoff' OR gm2.game_type = 'playoff')
            AND gm2.scheduled_at < g.scheduled_at
        ) AS scorer_prior_goals,
        (SELECT COUNT(*)::int
          FROM goals g2
          JOIN games gm2 ON gm2.id = g2.game_id
          WHERE go.assist_1_id IS NOT NULL
            AND (g2.assist_1_id = go.assist_1_id OR g2.assist_2_id = go.assist_1_id)
            AND gm2.season_id = g.season_id
            AND gm2.status = 'final'
            AND (g.game_type != 'playoff' OR gm2.game_type = 'playoff')
            AND gm2.scheduled_at < g.scheduled_at
        ) AS assist_1_prior_assists,
        (SELECT COUNT(*)::int
          FROM goals g2
          JOIN games gm2 ON gm2.id = g2.game_id
          WHERE go.assist_2_id IS NOT NULL
            AND (g2.assist_1_id = go.assist_2_id OR g2.assist_2_id = go.assist_2_id)
            AND gm2.season_id = g.season_id
            AND gm2.status = 'final'
            AND (g.game_type != 'playoff' OR gm2.game_type = 'playoff')
            AND gm2.scheduled_at < g.scheduled_at
        ) AS assist_2_prior_assists
      FROM goals go
      JOIN games g ON g.id = go.game_id
      JOIN players sp ON sp.id = go.scorer_id
      LEFT JOIN player_teams spt
        ON spt.player_id = go.scorer_id AND spt.team_id = go.team_id
        AND spt.season_id = g.season_id
        AND (spt.start_date IS NULL OR spt.start_date <= COALESCE(g.scheduled_at::date, CURRENT_DATE))
        AND (spt.end_date   IS NULL OR spt.end_date   >= COALESCE(g.scheduled_at::date, CURRENT_DATE))
      LEFT JOIN LATERAL (
        SELECT start_date, acquisition_type
        FROM player_team_stints pts
        WHERE pts.player_id = go.scorer_id
          AND pts.team_id = go.team_id
          AND (pts.start_date IS NULL OR pts.start_date <= COALESCE(g.scheduled_at::date, CURRENT_DATE))
          AND (pts.end_date IS NULL OR pts.end_date >= COALESCE(g.scheduled_at::date, CURRENT_DATE))
        ORDER BY CASE WHEN pts.end_date IS NULL THEN 0 ELSE 1 END,
          pts.start_date DESC NULLS LAST,
          pts.created_at DESC
        LIMIT 1
      ) spts ON true
      LEFT JOIN LATERAL (
        SELECT jersey_number FROM jersey_number_history
        WHERE player_teams_id = spt.id
          AND effective_from <= COALESCE(g.scheduled_at::date, CURRENT_DATE)
        ORDER BY effective_from DESC LIMIT 1
      ) spt_jnh ON true
      LEFT JOIN players a1p ON a1p.id = go.assist_1_id
      LEFT JOIN player_teams a1pt
        ON a1pt.player_id = go.assist_1_id AND a1pt.team_id = go.team_id
        AND a1pt.season_id = g.season_id
        AND (a1pt.start_date IS NULL OR a1pt.start_date <= COALESCE(g.scheduled_at::date, CURRENT_DATE))
        AND (a1pt.end_date   IS NULL OR a1pt.end_date   >= COALESCE(g.scheduled_at::date, CURRENT_DATE))
      LEFT JOIN LATERAL (
        SELECT jersey_number FROM jersey_number_history
        WHERE player_teams_id = a1pt.id
          AND effective_from <= COALESCE(g.scheduled_at::date, CURRENT_DATE)
        ORDER BY effective_from DESC LIMIT 1
      ) a1pt_jnh ON true
      LEFT JOIN players a2p ON a2p.id = go.assist_2_id
      LEFT JOIN player_teams a2pt
        ON a2pt.player_id = go.assist_2_id AND a2pt.team_id = go.team_id
        AND a2pt.season_id = g.season_id
        AND (a2pt.start_date IS NULL OR a2pt.start_date <= COALESCE(g.scheduled_at::date, CURRENT_DATE))
        AND (a2pt.end_date   IS NULL OR a2pt.end_date   >= COALESCE(g.scheduled_at::date, CURRENT_DATE))
      LEFT JOIN LATERAL (
        SELECT jersey_number FROM jersey_number_history
        WHERE player_teams_id = a2pt.id
          AND effective_from <= COALESCE(g.scheduled_at::date, CURRENT_DATE)
        ORDER BY effective_from DESC LIMIT 1
      ) a2pt_jnh ON true
      JOIN teams t ON t.id = go.team_id
      LEFT JOIN LATERAL (
        SELECT name, code, team_logo_default(logo_dark, logo_light) AS logo, team_logo_dark(logo_dark, logo_light) AS logo_dark, team_logo_light(logo_dark, logo_light) AS logo_light FROM team_iterations
        WHERE team_id = go.team_id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) ti ON true
      WHERE go.id = ${rows[0].id}
    `;
    await refreshGameStatSnapshots(id);
    return res.json(full);
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
    await refreshGameStatSnapshots(id);
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
            ORDER BY CASE
              WHEN entry->>'period' = '1'  THEN 10
              WHEN entry->>'period' = '2'  THEN 20
              WHEN entry->>'period' = '3'  THEN 30
              WHEN entry->>'period' = 'OT' THEN 40
              WHEN entry->>'period' LIKE 'OT%' THEN
                40 + COALESCE(NULLIF(regexp_replace(entry->>'period','[^0-9]','','g'),'')::int, 0)
              WHEN entry->>'period' = 'SO' THEN 100
              ELSE 200
            END
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
    await refreshGameStatSnapshots(id);
    return res.json({ period_shots: rows[0].period_shots });
  } catch (err) {
    console.error('shots upsert error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// Shared validators + helpers used by the goalie-stints write endpoints.
// Mirrors the period/time scalar used by goalieStintsCTE so chronological
// checks done in JS line up with what the aggregation will derive.
// ---------------------------------------------------------------------------
const VALID_PERIODS = ['1', '2', '3', 'OT', 'SO'];
const PERIOD_ORDS = { '1': 1, '2': 2, '3': 3, 'OT': 4, 'SO': 5 };
const TIME_RE = /^[0-9]{1,2}:[0-5][0-9]$/;

const stintPosition = (period, time) => {
  const ord = PERIOD_ORDS[period];
  if (ord == null) return null;
  if (!time) return ord * 100000;
  const [m, s] = time.split(':').map(Number);
  return ord * 100000 + m * 60 + s;
};

// ---------------------------------------------------------------------------
// Shared CTE fragment – aggregate per-stint rows from game_goalie_stints into
// a per-goalie shape compatible with the legacy GoalieStatRecord response.
//
// Goal-against attribution per stint uses (period, time-in-period) windows
// converted to a scalar "position" (period_ord * 100000 + seconds), so a stint
// that closes mid-period only gets credit for goals before the close.
//   - entered_time NULL  → start of entered_period
//   - exited_period NULL → still in net (no upper bound)
//   - exited_time NULL   → start of exited_period (boundary handed to next)
// Empty-net goals are excluded, matching the legacy CTE.
//
// Outer queries should JOIN goalie_agg (per-goalie totals + stints[] JSON) and
// goalie_first_stint (earliest stint per goalie, used for legacy
// entered_period / sub_time fields).
// ---------------------------------------------------------------------------
const goalieStintsCTE = (gameId) => sql`
  WITH period_vals (p, v) AS (
    VALUES ('1',1),('2',2),('3',3),('OT',4),('SO',5)
  ),
  stint_ranges AS (
    SELECT
      st.id, st.game_id, g.season_id, g.scheduled_at, st.team_id, st.goalie_id, st.stint_ord,
      g.home_team_id, g.away_team_id, g.period_shots,
      st.entered_period, st.entered_time,
      st.exited_period,  st.exited_time,
      st.shots_against,
      st.goals_against AS goals_against_override,
      st.time_on_ice,
      st.created_at,
      pv_in.v * 100000
        + COALESCE(
            SPLIT_PART(st.entered_time, ':', 1)::int * 60
            + SPLIT_PART(st.entered_time, ':', 2)::int,
            0
          ) AS from_pos,
      CASE
        WHEN st.exited_period IS NULL THEN NULL
        ELSE pv_out.v * 100000
          + COALESCE(
              SPLIT_PART(st.exited_time, ':', 1)::int * 60
              + SPLIT_PART(st.exited_time, ':', 2)::int,
              0
            )
      END AS until_pos
    FROM game_goalie_stints st
    JOIN games g ON g.id = st.game_id
    JOIN      period_vals pv_in  ON pv_in.p  = st.entered_period
    LEFT JOIN period_vals pv_out ON pv_out.p = st.exited_period
    WHERE st.game_id = ${gameId}
  ),
  stint_ga_derived AS (
    SELECT
      sr.id AS stint_id,
      COUNT(*)::int AS ga,
      COUNT(*) FILTER (WHERE g.goal_type = 'own' OR own_goal.is_own_goal)::int AS own_goal_ga,
      COUNT(*) FILTER (
        WHERE g.goal_type != 'own' AND own_goal.is_own_goal IS NULL
      )::int AS save_ga
    FROM stint_ranges sr
    JOIN goals g
      ON g.game_id   = sr.game_id
     AND g.team_id  != sr.team_id
     AND g.empty_net = false
    JOIN period_vals pv ON pv.p = g.period
    LEFT JOIN LATERAL (
      SELECT true AS is_own_goal
      FROM player_teams pt
      WHERE pt.player_id = g.scorer_id
        AND pt.team_id = sr.team_id
        AND pt.season_id = sr.season_id
        AND (pt.start_date IS NULL OR pt.start_date <= COALESCE(sr.scheduled_at::date, CURRENT_DATE))
        AND (pt.end_date IS NULL OR pt.end_date >= COALESCE(sr.scheduled_at::date, CURRENT_DATE))
      LIMIT 1
    ) own_goal ON true
    WHERE (pv.v * 100000
           + COALESCE(
               SPLIT_PART(g.period_time, ':', 1)::int * 60
               + SPLIT_PART(g.period_time, ':', 2)::int,
               0
             )) >= sr.from_pos
      AND (sr.until_pos IS NULL
           OR (pv.v * 100000
               + COALESCE(
                   SPLIT_PART(g.period_time, ':', 1)::int * 60
                   + SPLIT_PART(g.period_time, ':', 2)::int,
                   0
                 )) < sr.until_pos)
    GROUP BY sr.id
  ),
  period_shots_by_game AS (
    SELECT
      ps.game_id,
      COALESCE(
        SUM((shot->>'away_shots')::int)
          FILTER (WHERE (shot->>'period') ~ '^(1|2|3|OT|OT[1-9][0-9]*)$'),
        0
      )::int AS away_shots,
      COALESCE(
        SUM((shot->>'home_shots')::int)
          FILTER (WHERE (shot->>'period') ~ '^(1|2|3|OT|OT[1-9][0-9]*)$'),
        0
      )::int AS home_shots
    FROM (
      SELECT DISTINCT game_id, period_shots
      FROM stint_ranges
    ) ps
    LEFT JOIN LATERAL jsonb_array_elements(COALESCE(ps.period_shots, '[]'::jsonb)) shot ON true
    GROUP BY ps.game_id
  ),
  empty_net_ga_by_team AS (
    SELECT
      sr.game_id,
      sr.team_id,
      COUNT(*)::int AS empty_net_ga
    FROM (
      SELECT DISTINCT game_id, team_id
      FROM stint_ranges
    ) sr
    JOIN goals g
      ON g.game_id = sr.game_id
     AND g.team_id != sr.team_id
     AND g.empty_net = true
    GROUP BY sr.game_id, sr.team_id
  ),
  team_stint_counts AS (
    SELECT game_id, team_id, COUNT(*)::int AS stint_count
    FROM stint_ranges
    GROUP BY game_id, team_id
  ),
  stints_resolved AS (
    SELECT
      sr.*,
      CASE
        WHEN tsc.stint_count = 1
          THEN GREATEST(
            CASE
              WHEN sr.team_id = sr.home_team_id THEN COALESCE(psg.away_shots, 0)
              WHEN sr.team_id = sr.away_team_id THEN COALESCE(psg.home_shots, 0)
              ELSE sr.shots_against
            END - COALESCE(enga.empty_net_ga, 0),
            0
          )::int
        ELSE sr.shots_against
      END AS resolved_sa,
      COALESCE(sr.goals_against_override, sgd.ga, 0)::int AS resolved_ga,
      CASE
        WHEN sr.goals_against_override IS NULL
          THEN COALESCE(sgd.save_ga, 0)::int
        ELSE GREATEST(sr.goals_against_override - COALESCE(sgd.own_goal_ga, 0), 0)::int
      END AS resolved_save_ga
    FROM stint_ranges sr
    LEFT JOIN stint_ga_derived sgd ON sgd.stint_id = sr.id
    LEFT JOIN period_shots_by_game psg ON psg.game_id = sr.game_id
    LEFT JOIN empty_net_ga_by_team enga ON enga.game_id = sr.game_id AND enga.team_id = sr.team_id
    LEFT JOIN team_stint_counts tsc ON tsc.game_id = sr.game_id AND tsc.team_id = sr.team_id
  ),
  goalie_agg AS (
    SELECT
      game_id, team_id, goalie_id,
      MIN(from_pos)              AS first_pos,
      MIN(stint_ord)             AS first_stint_ord,
      MIN(created_at)            AS first_created_at,
      SUM(resolved_sa)::int      AS total_sa,
      SUM(resolved_ga)::int      AS total_ga,
      SUM(resolved_save_ga)::int AS total_save_ga,
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'id',                     id,
          'stint_ord',              stint_ord,
          'entered_period',         entered_period,
          'entered_time',           entered_time,
          'exited_period',          exited_period,
          'exited_time',            exited_time,
          'shots_against',          resolved_sa,
          'goals_against',          resolved_ga,
          'goals_against_override', goals_against_override,
          'time_on_ice',            time_on_ice,
          'saves',                  resolved_sa - resolved_save_ga
        )
        ORDER BY stint_ord
      ) AS stints
    FROM stints_resolved
    GROUP BY game_id, team_id, goalie_id
  ),
  goalie_first_stint AS (
    SELECT DISTINCT ON (game_id, team_id, goalie_id)
      game_id, team_id, goalie_id,
      id             AS first_stint_id,
      stint_ord      AS first_stint_ord,
      entered_period AS first_entered_period,
      entered_time   AS first_entered_time
    FROM stints_resolved
    ORDER BY game_id, team_id, goalie_id, stint_ord
  )
`;

// Used by the new /goalie-stints write endpoints (Phase 3) to return the
// full per-game goalie list in the same shape the GET endpoint returns,
// so the client can refresh in a single round-trip.
const fetchGoalieStatsForGame = (gameId) => sql`
  ${goalieStintsCTE(gameId)}
  SELECT
    fs.first_stint_id                       AS id,
    ga.game_id, ga.team_id, ga.goalie_id,
    ga.total_sa                             AS shots_against,
    ga.total_ga                             AS goals_against,
    (ga.total_sa - ga.total_save_ga)        AS saves,
    CASE
      WHEN fs.first_stint_ord = 1
       AND fs.first_entered_period = '1'
       AND fs.first_entered_time IS NULL
      THEN NULL ELSE fs.first_entered_period
    END                                     AS entered_period,
    CASE
      WHEN fs.first_stint_ord = 1
       AND fs.first_entered_period = '1'
       AND fs.first_entered_time IS NULL
      THEN NULL ELSE fs.first_entered_time
    END                                     AS sub_time,
    ga.first_created_at                     AS created_at,
    ga.stints,
    p.first_name AS goalie_first_name, p.last_name AS goalie_last_name,
    COALESCE(NULLIF(pt.photo, ''), best_player_photo(p.id, g.season_id, ga.team_id), NULLIF(p.photo, '')) AS goalie_photo,
    COALESCE(pt_jnh.jersey_number, pt.jersey_number)     AS goalie_jersey_number,
    ti.name AS team_name, ti.code AS team_code, ti.logo AS team_logo,
    t.primary_color AS team_primary_color, t.text_color AS team_text_color
  FROM goalie_agg ga
  JOIN goalie_first_stint fs
    ON fs.game_id = ga.game_id AND fs.team_id = ga.team_id AND fs.goalie_id = ga.goalie_id
  JOIN games g   ON g.id  = ga.game_id
  JOIN players p ON p.id  = ga.goalie_id
  JOIN teams t   ON t.id  = ga.team_id
  LEFT JOIN player_teams pt
    ON pt.player_id = ga.goalie_id AND pt.team_id = ga.team_id
    AND pt.season_id = g.season_id
    AND (pt.start_date IS NULL OR pt.start_date <= COALESCE(g.scheduled_at::date, CURRENT_DATE))
    AND (pt.end_date   IS NULL OR pt.end_date   >= COALESCE(g.scheduled_at::date, CURRENT_DATE))
  LEFT JOIN LATERAL (
    SELECT jersey_number FROM jersey_number_history
    WHERE player_teams_id = pt.id
      AND effective_from <= COALESCE(g.scheduled_at::date, CURRENT_DATE)
    ORDER BY effective_from DESC LIMIT 1
  ) pt_jnh ON true
  LEFT JOIN LATERAL (
    SELECT name, code, team_logo_default(logo_dark, logo_light) AS logo, team_logo_dark(logo_dark, logo_light) AS logo_dark, team_logo_light(logo_dark, logo_light) AS logo_light FROM team_iterations
    WHERE team_id = ga.team_id
    ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
    LIMIT 1
  ) ti ON true
  ORDER BY ti.code ASC, ga.first_pos ASC, COALESCE(pt_jnh.jersey_number, pt.jersey_number) ASC NULLS LAST
`;

// ---------------------------------------------------------------------------
// GET /api/admin/games/:id/goalie-stints  – list goalie stats for both teams.
// Returns one aggregate row per goalie with per-stint detail under `stints`.
// ---------------------------------------------------------------------------
router.get('/:id/goalie-stints', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await fetchGoalieStatsForGame(id);
    return res.json(rows);
  } catch (err) {
    console.error('goalie stints get error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// Stint-native write APIs
// ---------------------------------------------------------------------------
// These endpoints write directly to game_goalie_stints and let admins record
// non-sequential stints, including pull-and-return changes or multiple goalie
// changes within one period.

// ---------------------------------------------------------------------------
// POST /api/admin/games/:id/goalie-stints  – open a new stint for a goalie
// Body:
//   {
//     team_id, goalie_id,
//     entered_period, entered_time?,            // when this stint starts
//     exited_period?, exited_time?,             // optional — leave open if omitted
//     shots_against?, goals_against?,           // optional initial values
//     close_previous?: bool | { exited_period, exited_time? }
//                                                // close the team's currently
//                                                // open stint (if any) at the
//                                                // given point. true ⇒ close
//                                                // it at the new entered point.
//   }
// Returns the full updated goalie list for the game.
// ---------------------------------------------------------------------------
router.post('/:id/goalie-stints', async (req, res) => {
  const { id } = req.params;
  const {
    team_id, goalie_id,
    entered_period, entered_time,
    exited_period, exited_time,
    shots_against, goals_against, time_on_ice,
    close_previous,
  } = req.body || {};

  if (!team_id || !goalie_id || !entered_period) {
    return res.status(400).json({ error: 'team_id, goalie_id, and entered_period are required' });
  }
  if (time_on_ice != null && (!Number.isInteger(Number(time_on_ice)) || Number(time_on_ice) < 0)) {
    return res.status(400).json({ error: 'time_on_ice must be a non-negative number of seconds' });
  }
  if (!VALID_PERIODS.includes(entered_period)) {
    return res.status(400).json({ error: 'entered_period must be one of 1, 2, 3, OT, SO' });
  }
  if (entered_time != null && entered_time !== '' && !TIME_RE.test(entered_time)) {
    return res.status(400).json({ error: 'entered_time must be in MM:SS format' });
  }
  if (exited_period != null && !VALID_PERIODS.includes(exited_period)) {
    return res.status(400).json({ error: 'exited_period must be one of 1, 2, 3, OT, SO' });
  }
  if (exited_time != null && exited_time !== '' && !TIME_RE.test(exited_time)) {
    return res.status(400).json({ error: 'exited_time must be in MM:SS format' });
  }

  const enteredAt = entered_time || null;
  const exitedPd  = exited_period || null;
  const exitedAt  = exited_time   || null;
  const newPos    = stintPosition(entered_period, enteredAt);
  if (exitedPd && stintPosition(exitedPd, exitedAt) < newPos) {
    return res.status(400).json({ error: 'exited point must be at or after entered point' });
  }

  // Resolve close_previous spec into { period, time } or null.
  let closeSpec = null;
  if (close_previous === true) {
    closeSpec = { period: entered_period, time: enteredAt };
  } else if (close_previous && typeof close_previous === 'object') {
    if (!VALID_PERIODS.includes(close_previous.exited_period)) {
      return res.status(400).json({ error: 'close_previous.exited_period must be one of 1, 2, 3, OT, SO' });
    }
    if (close_previous.exited_time != null && close_previous.exited_time !== ''
        && !TIME_RE.test(close_previous.exited_time)) {
      return res.status(400).json({ error: 'close_previous.exited_time must be in MM:SS format' });
    }
    closeSpec = { period: close_previous.exited_period, time: close_previous.exited_time || null };
    if (stintPosition(closeSpec.period, closeSpec.time) > newPos) {
      return res.status(400).json({ error: 'close_previous point must be at or before the new stint entered point' });
    }
  }

  try {
    if (closeSpec) {
      const open = await sql`
        SELECT id, entered_period, entered_time
        FROM game_goalie_stints
        WHERE game_id = ${id} AND team_id = ${team_id} AND exited_period IS NULL
        ORDER BY stint_ord DESC
        LIMIT 1
      `;
      if (open.length > 0) {
        const openPos = stintPosition(open[0].entered_period, open[0].entered_time);
        if (stintPosition(closeSpec.period, closeSpec.time) < openPos) {
          return res.status(400).json({ error: 'close_previous point precedes the open stint entered point' });
        }
        await sql`
          UPDATE game_goalie_stints
          SET exited_period = ${closeSpec.period}, exited_time = ${closeSpec.time}
          WHERE id = ${open[0].id}
        `;
      }
    }

    const ord = await sql`
      SELECT COALESCE(MAX(stint_ord), 0) + 1 AS next FROM game_goalie_stints
      WHERE game_id = ${id} AND team_id = ${team_id}
    `;
    await sql`
      INSERT INTO game_goalie_stints (
        game_id, team_id, goalie_id, stint_ord,
        entered_period, entered_time,
        exited_period,  exited_time,
        shots_against,  goals_against, time_on_ice
      ) VALUES (
        ${id}, ${team_id}, ${goalie_id}, ${ord[0].next},
        ${entered_period}, ${enteredAt},
        ${exitedPd},       ${exitedAt},
        ${shots_against == null ? 0 : Number(shots_against)},
        ${goals_against == null ? null : Number(goals_against)},
        ${time_on_ice == null ? null : Number(time_on_ice)}
      )
    `;
    const rows = await fetchGoalieStatsForGame(id);
    await refreshGameStatSnapshots(id);
    return res.json(rows);
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'Invalid game_id, team_id, or goalie_id' });
    if (err.code === '23505') return res.status(409).json({ error: 'Stint ordering conflict; retry' });
    console.error('goalie stints post error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/games/:id/goalie-stints/:stintId  – patch a single stint
// Body: any subset of {
//   goalie_id, team_id,
//   entered_period, entered_time,
//   exited_period,  exited_time,
//   shots_against,  goals_against
// }
// Explicit null clears nullable columns (entered_time, exited_period,
// exited_time, goals_against). Returns the full updated goalie list.
// ---------------------------------------------------------------------------
router.put('/:id/goalie-stints/:stintId', async (req, res) => {
  const { id, stintId } = req.params;
  const body = req.body || {};
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

  if (has('entered_period') && !VALID_PERIODS.includes(body.entered_period)) {
    return res.status(400).json({ error: 'entered_period must be one of 1, 2, 3, OT, SO' });
  }
  if (has('exited_period') && body.exited_period != null && !VALID_PERIODS.includes(body.exited_period)) {
    return res.status(400).json({ error: 'exited_period must be one of 1, 2, 3, OT, SO' });
  }
  for (const k of ['entered_time', 'exited_time']) {
    if (has(k) && body[k] != null && body[k] !== '' && !TIME_RE.test(body[k])) {
      return res.status(400).json({ error: `${k} must be in MM:SS format` });
    }
  }
  if (has('time_on_ice') && body.time_on_ice != null
      && (!Number.isInteger(Number(body.time_on_ice)) || Number(body.time_on_ice) < 0)) {
    return res.status(400).json({ error: 'time_on_ice must be a non-negative number of seconds' });
  }

  // Build dynamic SET fragments. Each entry contributes ", col = ${val}".
  const sets = [];
  const norm = (v) => (v === '' ? null : v);
  if (has('goalie_id'))      sets.push(sql`goalie_id      = ${body.goalie_id}`);
  if (has('team_id'))        sets.push(sql`team_id        = ${body.team_id}`);
  if (has('entered_period')) sets.push(sql`entered_period = ${body.entered_period}`);
  if (has('entered_time'))   sets.push(sql`entered_time   = ${norm(body.entered_time)}`);
  if (has('exited_period'))  sets.push(sql`exited_period  = ${norm(body.exited_period)}`);
  if (has('exited_time'))    sets.push(sql`exited_time    = ${norm(body.exited_time)}`);
  if (has('shots_against'))  sets.push(sql`shots_against  = ${Number(body.shots_against)}`);
  if (has('goals_against'))  sets.push(sql`goals_against  = ${body.goals_against == null ? null : Number(body.goals_against)}`);
  if (has('time_on_ice'))    sets.push(sql`time_on_ice    = ${body.time_on_ice == null ? null : Number(body.time_on_ice)}`);

  if (sets.length === 0) {
    return res.status(400).json({ error: 'no updatable fields supplied' });
  }

  // Compose SET fragments separated by commas using sql tagged-template reduction.
  const setExpr = sets.reduce((acc, frag, i) => (i === 0 ? frag : sql`${acc}, ${frag}`));

  try {
    const updated = await sql`
      UPDATE game_goalie_stints
      SET ${setExpr}
      WHERE id = ${stintId} AND game_id = ${id}
      RETURNING id, team_id, entered_period, entered_time, exited_period, exited_time
    `;
    if (updated.length === 0) {
      return res.status(404).json({ error: 'Stint not found' });
    }
    const row = updated[0];
    if (row.exited_period
        && stintPosition(row.exited_period, row.exited_time)
           < stintPosition(row.entered_period, row.entered_time)) {
      return res.status(400).json({ error: 'exited point must be at or after entered point' });
    }
    const rows = await fetchGoalieStatsForGame(id);
    await refreshGameStatSnapshots(id);
    return res.json(rows);
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'Invalid team_id or goalie_id' });
    console.error('goalie stints put error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/games/:id/goalie-stints/:stintId  – remove a stint and
// renumber the remaining stints for that team so stint_ord stays contiguous.
// ---------------------------------------------------------------------------
router.delete('/:id/goalie-stints/:stintId', async (req, res) => {
  const { id, stintId } = req.params;
  try {
    const removed = await sql`
      DELETE FROM game_goalie_stints
      WHERE id = ${stintId} AND game_id = ${id}
      RETURNING team_id
    `;
    if (removed.length === 0) {
      return res.status(404).json({ error: 'Stint not found' });
    }
    const teamId = removed[0].team_id;
    // Two-step renumber to avoid intermediate UNIQUE (game_id, team_id, stint_ord)
    // collisions: shift all rows by a large offset, then renumber sequentially.
    await sql`
      UPDATE game_goalie_stints
      SET stint_ord = stint_ord + 1000000
      WHERE game_id = ${id} AND team_id = ${teamId}
    `;
    await sql`
      WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY stint_ord) AS new_ord
        FROM game_goalie_stints
        WHERE game_id = ${id} AND team_id = ${teamId}
      )
      UPDATE game_goalie_stints t
      SET stint_ord = r.new_ord
      FROM ranked r
      WHERE t.id = r.id
    `;
    const rows = await fetchGoalieStatsForGame(id);
    await refreshGameStatSnapshots(id);
    return res.json(rows);
  } catch (err) {
    console.error('goalie stints delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// Shared query helper — returns full shootout attempt rows with player/team info
// ---------------------------------------------------------------------------
const fetchAttempts = async (gameId) => {
  const hasAcquisitionType = await hasPlayerTeamsAcquisitionType();
  return sql`
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
      COALESCE(NULLIF(pt.photo, ''), best_player_photo(p.id, g.season_id, sa.team_id), NULLIF(p.photo, '')) AS shooter_photo,
      COALESCE(pt_jnh.jersey_number, pt.jersey_number) AS shooter_jersey_number,
      p.date_of_birth AS shooter_date_of_birth,
      COALESCE(pts.start_date, pt.start_date) AS shooter_start_date,
      COALESCE(pts.acquisition_type, ${acquisitionTypeSelect(hasAcquisitionType, 'pt')}) AS shooter_acquisition_type,
      ti.name  AS team_name,
      ti.code  AS team_code,
      ti.logo  AS team_logo,
      t.primary_color AS team_primary_color,
      t.text_color    AS team_text_color
    FROM shootout_attempts sa
    JOIN games   g  ON g.id  = sa.game_id
    JOIN players p  ON p.id  = sa.shooter_id
    JOIN teams   t  ON t.id  = sa.team_id
    LEFT JOIN player_teams pt
      ON pt.player_id = sa.shooter_id
      AND pt.team_id  = sa.team_id
      AND pt.season_id = g.season_id
      AND (pt.start_date IS NULL OR pt.start_date <= COALESCE(g.scheduled_at::date, CURRENT_DATE))
      AND (pt.end_date   IS NULL OR pt.end_date   >= COALESCE(g.scheduled_at::date, CURRENT_DATE))
    LEFT JOIN LATERAL (
      SELECT start_date, acquisition_type
      FROM player_team_stints pts
      WHERE pts.player_id = sa.shooter_id
        AND pts.team_id = sa.team_id
        AND (pts.start_date IS NULL OR pts.start_date <= COALESCE(g.scheduled_at::date, CURRENT_DATE))
        AND (pts.end_date IS NULL OR pts.end_date >= COALESCE(g.scheduled_at::date, CURRENT_DATE))
      ORDER BY CASE WHEN pts.end_date IS NULL THEN 0 ELSE 1 END,
        pts.start_date DESC NULLS LAST,
        pts.created_at DESC
      LIMIT 1
    ) pts ON true
    LEFT JOIN LATERAL (
      SELECT jersey_number FROM jersey_number_history
      WHERE player_teams_id = pt.id
        AND effective_from <= COALESCE(g.scheduled_at::date, CURRENT_DATE)
      ORDER BY effective_from DESC LIMIT 1
    ) pt_jnh ON true
    LEFT JOIN LATERAL (
      SELECT name, code, team_logo_default(logo_dark, logo_light) AS logo, team_logo_dark(logo_dark, logo_light) AS logo_dark, team_logo_light(logo_dark, logo_light) AS logo_light FROM team_iterations
      WHERE team_id = sa.team_id
      ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
      LIMIT 1
    ) ti ON true
    WHERE sa.game_id = ${gameId}
    ORDER BY sa.attempt_order ASC
  `;
};

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
    await refreshGameStatSnapshots(id);
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
    await refreshGameStatSnapshots(id);
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
    await refreshGameStatSnapshots(id);
    return res.status(204).send();
  } catch (err) {
    console.error('shootout attempts delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
