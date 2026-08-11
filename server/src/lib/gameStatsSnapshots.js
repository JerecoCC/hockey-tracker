'use strict';

const STATS_SNAPSHOT_BACKFILL_MIGRATION = 'backfill_game_stat_snapshots_v1';

async function insertGameTeamStats(sql, gameId) {
  await sql`
    INSERT INTO game_team_stats (
      game_id,
      season_id,
      game_type,
      team_id,
      opponent_team_id,
      is_home,
      goals_for,
      goals_against,
      shootout_goals_for,
      shootout_goals_against,
      shots_for,
      shots_against,
      is_extra_time,
      is_shootout,
      won,
      lost,
      reg_win,
      ot_win,
      otl,
      reg_loss,
      updated_at
    )
    WITH game_row AS (
      SELECT
        id,
        season_id,
        game_type,
        home_team_id,
        away_team_id,
        overtime_periods,
        shootout,
        period_shots
      FROM games
      WHERE id = ${gameId}
        AND status = 'final'
    ),
    goal_totals AS (
      SELECT
        gl.team_id,
        COUNT(*) FILTER (WHERE gl.period <> 'SO')::int AS goals,
        COUNT(*) FILTER (WHERE gl.period ~ '^OT')::int AS ot_goals,
        COUNT(*) FILTER (WHERE gl.period = 'SO')::int AS so_goals
      FROM goals gl
      JOIN game_row g ON g.id = gl.game_id
      GROUP BY gl.team_id
    ),
    shootout_totals AS (
      SELECT
        sa.team_id,
        COUNT(*) FILTER (WHERE sa.scored)::int AS shootout_goals
      FROM shootout_attempts sa
      JOIN game_row g ON g.id = sa.game_id
      GROUP BY sa.team_id
    ),
    shot_totals AS (
      SELECT
        g.id AS game_id,
        COALESCE(
          SUM((shot->>'home_shots')::int)
            FILTER (WHERE (shot->>'period') ~ '^(1|2|3|OT|OT[1-9][0-9]*)$'),
          0
        )::int AS home_shots,
        COALESCE(
          SUM((shot->>'away_shots')::int)
            FILTER (WHERE (shot->>'period') ~ '^(1|2|3|OT|OT[1-9][0-9]*)$'),
          0
        )::int AS away_shots
      FROM game_row g
      LEFT JOIN LATERAL jsonb_array_elements(COALESCE(g.period_shots, '[]'::jsonb)) shot ON true
      GROUP BY g.id
    ),
    game_result AS (
      SELECT
        g.id AS game_id,
        COALESCE(hg.goals, 0)::int AS home_goals,
        COALESCE(ag.goals, 0)::int AS away_goals,
        COALESCE(hg.so_goals, 0)::int AS home_so_goals,
        COALESCE(ag.so_goals, 0)::int AS away_so_goals,
        COALESCE(hs.shootout_goals, 0)::int AS home_so_attempt_goals,
        COALESCE(asg.shootout_goals, 0)::int AS away_so_attempt_goals,
        (
          COALESCE(g.overtime_periods, 0) > 0
          OR g.shootout
          OR COALESCE(hg.ot_goals, 0) > 0
          OR COALESCE(ag.ot_goals, 0) > 0
          OR COALESCE(hg.so_goals, 0) > 0
          OR COALESCE(ag.so_goals, 0) > 0
          OR COALESCE(hs.shootout_goals, 0) > 0
          OR COALESCE(asg.shootout_goals, 0) > 0
        ) AS is_extra_time,
        (
          g.shootout
          OR COALESCE(hs.shootout_goals, 0) > 0
          OR COALESCE(asg.shootout_goals, 0) > 0
          OR COALESCE(hg.so_goals, 0) > 0
          OR COALESCE(ag.so_goals, 0) > 0
        ) AS is_shootout,
        CASE
          WHEN g.shootout OR COALESCE(hs.shootout_goals, 0) > 0 OR COALESCE(asg.shootout_goals, 0) > 0
            OR COALESCE(hg.so_goals, 0) > 0 OR COALESCE(ag.so_goals, 0) > 0 THEN
            CASE
              WHEN COALESCE(hs.shootout_goals, 0) > COALESCE(asg.shootout_goals, 0) THEN g.home_team_id
              WHEN COALESCE(asg.shootout_goals, 0) > COALESCE(hs.shootout_goals, 0) THEN g.away_team_id
              WHEN COALESCE(hg.so_goals, 0) > COALESCE(ag.so_goals, 0) THEN g.home_team_id
              WHEN COALESCE(ag.so_goals, 0) > COALESCE(hg.so_goals, 0) THEN g.away_team_id
              WHEN COALESCE(hg.goals, 0) > COALESCE(ag.goals, 0) THEN g.home_team_id
              WHEN COALESCE(ag.goals, 0) > COALESCE(hg.goals, 0) THEN g.away_team_id
              ELSE NULL
            END
          WHEN COALESCE(hg.goals, 0) > COALESCE(ag.goals, 0) THEN g.home_team_id
          WHEN COALESCE(ag.goals, 0) > COALESCE(hg.goals, 0) THEN g.away_team_id
          ELSE NULL
        END AS winner_team_id
      FROM game_row g
      LEFT JOIN goal_totals hg ON hg.team_id = g.home_team_id
      LEFT JOIN goal_totals ag ON ag.team_id = g.away_team_id
      LEFT JOIN shootout_totals hs ON hs.team_id = g.home_team_id
      LEFT JOIN shootout_totals asg ON asg.team_id = g.away_team_id
    ),
    team_rows AS (
      SELECT
        g.id AS game_id,
        g.season_id,
        g.game_type,
        g.home_team_id AS team_id,
        g.away_team_id AS opponent_team_id,
        true AS is_home,
        gr.home_goals AS goals_for,
        gr.away_goals AS goals_against,
        gr.home_so_attempt_goals + gr.home_so_goals AS shootout_goals_for,
        gr.away_so_attempt_goals + gr.away_so_goals AS shootout_goals_against,
        COALESCE(st.home_shots, 0)::int AS shots_for,
        COALESCE(st.away_shots, 0)::int AS shots_against,
        gr.is_extra_time,
        gr.is_shootout,
        gr.winner_team_id
      FROM game_row g
      JOIN game_result gr ON gr.game_id = g.id
      LEFT JOIN shot_totals st ON st.game_id = g.id

      UNION ALL

      SELECT
        g.id AS game_id,
        g.season_id,
        g.game_type,
        g.away_team_id AS team_id,
        g.home_team_id AS opponent_team_id,
        false AS is_home,
        gr.away_goals AS goals_for,
        gr.home_goals AS goals_against,
        gr.away_so_attempt_goals + gr.away_so_goals AS shootout_goals_for,
        gr.home_so_attempt_goals + gr.home_so_goals AS shootout_goals_against,
        COALESCE(st.away_shots, 0)::int AS shots_for,
        COALESCE(st.home_shots, 0)::int AS shots_against,
        gr.is_extra_time,
        gr.is_shootout,
        gr.winner_team_id
      FROM game_row g
      JOIN game_result gr ON gr.game_id = g.id
      LEFT JOIN shot_totals st ON st.game_id = g.id
    )
    SELECT
      game_id,
      season_id,
      game_type,
      team_id,
      opponent_team_id,
      is_home,
      goals_for,
      goals_against,
      shootout_goals_for,
      shootout_goals_against,
      shots_for,
      shots_against,
      is_extra_time,
      is_shootout,
      winner_team_id = team_id AS won,
      winner_team_id IS NOT NULL AND winner_team_id <> team_id AS lost,
      winner_team_id = team_id AND NOT is_extra_time AS reg_win,
      winner_team_id = team_id AND is_extra_time AS ot_win,
      winner_team_id IS NOT NULL AND winner_team_id <> team_id AND is_extra_time AS otl,
      winner_team_id IS NOT NULL AND winner_team_id <> team_id AND NOT is_extra_time AS reg_loss,
      NOW()
    FROM team_rows
    ON CONFLICT (game_id, team_id) DO UPDATE SET
      season_id = EXCLUDED.season_id,
      game_type = EXCLUDED.game_type,
      opponent_team_id = EXCLUDED.opponent_team_id,
      is_home = EXCLUDED.is_home,
      goals_for = EXCLUDED.goals_for,
      goals_against = EXCLUDED.goals_against,
      shootout_goals_for = EXCLUDED.shootout_goals_for,
      shootout_goals_against = EXCLUDED.shootout_goals_against,
      shots_for = EXCLUDED.shots_for,
      shots_against = EXCLUDED.shots_against,
      is_extra_time = EXCLUDED.is_extra_time,
      is_shootout = EXCLUDED.is_shootout,
      won = EXCLUDED.won,
      lost = EXCLUDED.lost,
      reg_win = EXCLUDED.reg_win,
      ot_win = EXCLUDED.ot_win,
      otl = EXCLUDED.otl,
      reg_loss = EXCLUDED.reg_loss,
      updated_at = NOW()
  `;
}

async function insertGamePlayerStats(sql, gameId) {
  await sql`
    INSERT INTO game_player_stats (
      game_id,
      season_id,
      game_type,
      team_id,
      opponent_team_id,
      player_id,
      position,
      is_goalie,
      is_home,
      goals,
      assists,
      points,
      shots_against,
      goals_against,
      saves,
      time_on_ice,
      goalie_started,
      goalie_win,
      shootout_win,
      shutout,
      updated_at
    )
    WITH game_row AS (
      SELECT
        id,
        season_id,
        game_type,
        home_team_id,
        away_team_id,
        scheduled_at,
        shootout,
        period_shots
      FROM games
      WHERE id = ${gameId}
        AND status = 'final'
    ),
    skater_stats AS (
      SELECT
        gr.game_id,
        g.season_id,
        g.game_type,
        gr.team_id,
        CASE WHEN gr.team_id = g.home_team_id THEN g.away_team_id ELSE g.home_team_id END AS opponent_team_id,
        gr.player_id,
        COALESCE(pts.position, pt.position, p.position) AS position,
        false AS is_goalie,
        gr.team_id = g.home_team_id AS is_home,
        COUNT(gl.id) FILTER (WHERE gl.scorer_id = gr.player_id AND gl.goal_type != 'own')::int AS goals,
        COUNT(gl.id) FILTER (WHERE gl.assist_1_id = gr.player_id OR gl.assist_2_id = gr.player_id)::int AS assists,
        0::int AS shots_against,
        0::int AS goals_against,
        0::int AS saves,
        0::int AS time_on_ice,
        false AS goalie_started,
        false AS goalie_win,
        false AS shootout_win,
        false AS shutout
      FROM game_rosters gr
      JOIN game_row g ON g.id = gr.game_id
      JOIN players p ON p.id = gr.player_id
      LEFT JOIN LATERAL (
        SELECT position
        FROM player_season_rosters pt
        WHERE pt.player_id = gr.player_id
          AND pt.team_id = gr.team_id
          AND pt.season_id = g.season_id
          AND (pt.start_date IS NULL OR pt.start_date <= COALESCE(g.scheduled_at::date, CURRENT_DATE))
          AND (pt.end_date IS NULL OR pt.end_date >= COALESCE(g.scheduled_at::date, CURRENT_DATE))
        ORDER BY CASE WHEN pt.end_date IS NULL THEN 0 ELSE 1 END,
          pt.start_date DESC NULLS LAST,
          pt.created_at DESC
        LIMIT 1
      ) pt ON true
      LEFT JOIN LATERAL (
        SELECT position
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
      LEFT JOIN goals gl
        ON gl.game_id = gr.game_id
       AND gl.team_id = gr.team_id
      WHERE COALESCE(pts.position, pt.position, p.position, '') <> 'G'
      GROUP BY
        gr.game_id,
        g.season_id,
        g.game_type,
        gr.team_id,
        g.home_team_id,
        g.away_team_id,
        gr.player_id,
        COALESCE(pts.position, pt.position, p.position)
    ),
    period_vals (p, v) AS (
      VALUES ('1',1),('2',2),('3',3),('OT',4),('SO',5)
    ),
    stint_ranges AS (
      SELECT
        st.id,
        st.game_id,
        g.season_id,
        g.game_type,
        g.scheduled_at,
        st.team_id,
        st.goalie_id,
        st.stint_ord,
        g.home_team_id,
        g.away_team_id,
        g.shootout,
        g.period_shots,
        st.entered_period,
        st.entered_time,
        st.exited_period,
        st.exited_time,
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
        END AS until_pos,
        CASE st.entered_period WHEN '1' THEN 0 WHEN '2' THEN 1200 WHEN '3' THEN 2400 WHEN 'OT' THEN 3600 ELSE 6000 END
          + COALESCE(SPLIT_PART(st.entered_time, ':', 1)::int * 60 + SPLIT_PART(st.entered_time, ':', 2)::int, 0) AS start_abs,
        CASE
          WHEN st.exited_period IS NULL THEN NULL
          ELSE CASE st.exited_period WHEN '1' THEN 0 WHEN '2' THEN 1200 WHEN '3' THEN 2400 WHEN 'OT' THEN 3600 ELSE 6000 END
            + COALESCE(SPLIT_PART(st.exited_time, ':', 1)::int * 60 + SPLIT_PART(st.exited_time, ':', 2)::int, 0)
        END AS exited_abs,
        CASE
          WHEN g.shootout THEN 3900
          WHEN EXISTS (SELECT 1 FROM goals og WHERE og.game_id = g.id AND og.period ~ '^OT')
            THEN 3600 + COALESCE((
              SELECT MAX(SPLIT_PART(og.period_time, ':', 1)::int * 60 + SPLIT_PART(og.period_time, ':', 2)::int)
              FROM goals og
              WHERE og.game_id = g.id
                AND og.period ~ '^OT'
            ), 0)
          ELSE 3600
        END AS game_end_abs
      FROM game_goalie_stints st
      JOIN game_row g ON g.id = st.game_id
      JOIN period_vals pv_in ON pv_in.p = st.entered_period
      LEFT JOIN period_vals pv_out ON pv_out.p = st.exited_period
    ),
    goals_with_pos AS (
      SELECT
        gl.*,
        (
          CASE
            WHEN gl.period = '1' THEN 1
            WHEN gl.period = '2' THEN 2
            WHEN gl.period = '3' THEN 3
            WHEN gl.period = 'OT' THEN 4
            WHEN gl.period ~ '^OT[1-9][0-9]*$' THEN 3 + SUBSTRING(gl.period FROM 3)::int
            WHEN gl.period = 'SO' THEN 5
            ELSE 99
          END * 100000
          + COALESCE(
              SPLIT_PART(gl.period_time, ':', 1)::int * 60
              + SPLIT_PART(gl.period_time, ':', 2)::int,
              0
            )
        ) AS goal_pos
      FROM goals gl
      JOIN game_row g ON g.id = gl.game_id
    ),
    stint_ga_derived AS (
      SELECT
        sr.id AS stint_id,
        COUNT(*)::int AS ga,
        COUNT(*) FILTER (WHERE gl.goal_type = 'own' OR own_goal.is_own_goal)::int AS own_goal_ga,
        COUNT(*) FILTER (
          WHERE gl.goal_type != 'own' AND own_goal.is_own_goal IS NULL
        )::int AS save_ga
      FROM stint_ranges sr
      JOIN goals_with_pos gl
        ON gl.game_id = sr.game_id
       AND gl.team_id != sr.team_id
       AND gl.empty_net = false
       AND gl.period <> 'SO'
      LEFT JOIN LATERAL (
        SELECT true AS is_own_goal
        FROM player_season_rosters pt
        WHERE pt.player_id = gl.scorer_id
          AND pt.team_id = sr.team_id
          AND pt.season_id = sr.season_id
          AND (pt.start_date IS NULL OR pt.start_date <= COALESCE(sr.scheduled_at::date, CURRENT_DATE))
          AND (pt.end_date IS NULL OR pt.end_date >= COALESCE(sr.scheduled_at::date, CURRENT_DATE))
        LIMIT 1
      ) own_goal ON true
      WHERE gl.goal_pos >= sr.from_pos
        AND (sr.until_pos IS NULL OR gl.goal_pos < sr.until_pos)
      GROUP BY sr.id
    ),
    period_shots_by_game AS (
      SELECT
        g.id AS game_id,
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
      FROM game_row g
      LEFT JOIN LATERAL jsonb_array_elements(COALESCE(g.period_shots, '[]'::jsonb)) shot ON true
      GROUP BY g.id
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
      JOIN goals gl
        ON gl.game_id = sr.game_id
       AND gl.team_id != sr.team_id
       AND gl.empty_net = true
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
        END AS resolved_save_ga,
        COALESCE(sr.time_on_ice, GREATEST(COALESCE(sr.exited_abs, sr.game_end_abs) - sr.start_abs, 0))::int AS resolved_toi
      FROM stint_ranges sr
      LEFT JOIN stint_ga_derived sgd ON sgd.stint_id = sr.id
      LEFT JOIN period_shots_by_game psg ON psg.game_id = sr.game_id
      LEFT JOIN empty_net_ga_by_team enga ON enga.game_id = sr.game_id AND enga.team_id = sr.team_id
      LEFT JOIN team_stint_counts tsc ON tsc.game_id = sr.game_id AND tsc.team_id = sr.team_id
    ),
    goalie_game AS (
      SELECT
        game_id,
        season_id,
        game_type,
        team_id,
        CASE WHEN team_id = home_team_id THEN away_team_id ELSE home_team_id END AS opponent_team_id,
        goalie_id,
        team_id = home_team_id AS is_home,
        MIN(from_pos) AS first_from_pos,
        MIN(stint_ord) AS first_stint_ord,
        MAX(stint_ord) AS last_stint_ord,
        SUM(resolved_sa)::int AS shots_against,
        SUM(resolved_ga)::int AS goals_against,
        SUM(resolved_save_ga)::int AS save_goals_against,
        SUM(resolved_toi)::int AS time_on_ice
      FROM stints_resolved
      GROUP BY
        game_id,
        season_id,
        game_type,
        team_id,
        home_team_id,
        away_team_id,
        goalie_id
    ),
    team_game_last_goalie AS (
      SELECT DISTINCT ON (game_id, team_id)
        game_id,
        team_id,
        goalie_id
      FROM stints_resolved
      ORDER BY game_id, team_id, stint_ord DESC
    ),
    goalie_scoring_stats AS (
      SELECT
        gg.game_id,
        gg.team_id,
        gg.goalie_id,
        COUNT(gl.id) FILTER (WHERE gl.scorer_id = gg.goalie_id AND gl.goal_type != 'own')::int AS goals,
        COUNT(gl.id) FILTER (WHERE gl.assist_1_id = gg.goalie_id OR gl.assist_2_id = gg.goalie_id)::int AS assists
      FROM goalie_game gg
      LEFT JOIN goals gl
        ON gl.game_id = gg.game_id
       AND gl.team_id = gg.team_id
      GROUP BY gg.game_id, gg.team_id, gg.goalie_id
    ),
    goalie_stats AS (
      SELECT
        gg.game_id,
        gg.season_id,
        gg.game_type,
        gg.team_id,
        gg.opponent_team_id,
        gg.goalie_id AS player_id,
        'G'::text AS position,
        true AS is_goalie,
        gg.is_home,
        COALESCE(gss.goals, 0)::int AS goals,
        COALESCE(gss.assists, 0)::int AS assists,
        gg.shots_against,
        gg.goals_against,
        (gg.shots_against - gg.save_goals_against)::int AS saves,
        gg.time_on_ice,
        gg.first_stint_ord = 1 AND gg.first_from_pos = 100000 AS goalie_started,
        COALESCE(gts.won, false) AND tgl.goalie_id = gg.goalie_id AS goalie_win,
        COALESCE(gts.won, false) AND tgl.goalie_id = gg.goalie_id AND COALESCE(gts.is_shootout, false) AS shootout_win,
        gg.shots_against > 0
          AND gg.goals_against = 0
          AND gg.first_from_pos = 100000
          AND tgl.goalie_id = gg.goalie_id AS shutout
      FROM goalie_game gg
      JOIN team_game_last_goalie tgl
        ON tgl.game_id = gg.game_id
       AND tgl.team_id = gg.team_id
      LEFT JOIN game_team_stats gts
        ON gts.game_id = gg.game_id
       AND gts.team_id = gg.team_id
      LEFT JOIN goalie_scoring_stats gss
        ON gss.game_id = gg.game_id
       AND gss.team_id = gg.team_id
       AND gss.goalie_id = gg.goalie_id
    ),
    combined_stats AS (
      SELECT
        game_id,
        season_id,
        game_type,
        team_id,
        opponent_team_id,
        player_id,
        position,
        is_goalie,
        is_home,
        goals,
        assists,
        goals + assists AS points,
        shots_against,
        goals_against,
        saves,
        time_on_ice,
        goalie_started,
        goalie_win,
        shootout_win,
        shutout
      FROM skater_stats

      UNION ALL

      SELECT
        game_id,
        season_id,
        game_type,
        team_id,
        opponent_team_id,
        player_id,
        position,
        is_goalie,
        is_home,
        goals,
        assists,
        goals + assists AS points,
        shots_against,
        goals_against,
        saves,
        time_on_ice,
        goalie_started,
        goalie_win,
        shootout_win,
        shutout
      FROM goalie_stats
    )
    SELECT
      game_id,
      season_id,
      game_type,
      team_id,
      opponent_team_id,
      player_id,
      position,
      is_goalie,
      is_home,
      goals,
      assists,
      points,
      shots_against,
      goals_against,
      saves,
      time_on_ice,
      goalie_started,
      goalie_win,
      shootout_win,
      shutout,
      NOW()
    FROM combined_stats
    ON CONFLICT (game_id, team_id, player_id) DO UPDATE SET
      season_id = EXCLUDED.season_id,
      game_type = EXCLUDED.game_type,
      opponent_team_id = EXCLUDED.opponent_team_id,
      position = EXCLUDED.position,
      is_goalie = EXCLUDED.is_goalie,
      is_home = EXCLUDED.is_home,
      goals = EXCLUDED.goals,
      assists = EXCLUDED.assists,
      points = EXCLUDED.points,
      shots_against = EXCLUDED.shots_against,
      goals_against = EXCLUDED.goals_against,
      saves = EXCLUDED.saves,
      time_on_ice = EXCLUDED.time_on_ice,
      goalie_started = EXCLUDED.goalie_started,
      goalie_win = EXCLUDED.goalie_win,
      shootout_win = EXCLUDED.shootout_win,
      shutout = EXCLUDED.shutout,
      updated_at = NOW()
  `;
}

async function rebuildGameStats(sql, gameId) {
  await sql`DELETE FROM game_player_stats WHERE game_id = ${gameId}`;
  await sql`DELETE FROM game_team_stats WHERE game_id = ${gameId}`;

  const [game] = await sql`SELECT id, status FROM games WHERE id = ${gameId}`;
  if (!game || game.status !== 'final') {
    return { game_id: gameId, rebuilt: false };
  }

  await insertGameTeamStats(sql, gameId);
  await insertGamePlayerStats(sql, gameId);
  return { game_id: gameId, rebuilt: true };
}

async function rebuildSeasonStatsSnapshots(sql, seasonId) {
  await sql`DELETE FROM game_player_stats WHERE season_id = ${seasonId}`;
  await sql`DELETE FROM game_team_stats WHERE season_id = ${seasonId}`;

  const games = await sql`
    SELECT id
    FROM games
    WHERE season_id = ${seasonId}
      AND status = 'final'
    ORDER BY scheduled_at NULLS LAST, created_at, id
  `;

  for (const game of games) {
    await insertGameTeamStats(sql, game.id);
    await insertGamePlayerStats(sql, game.id);
  }

  return { season_id: seasonId, games: games.length };
}

async function backfillAllSeasonStatsSnapshots(sql) {
  const existing = await sql`
    SELECT 1
    FROM _migrations
    WHERE name = ${STATS_SNAPSHOT_BACKFILL_MIGRATION}
    LIMIT 1
  `;
  if (existing.length > 0) return { skipped: true, seasons: 0, games: 0 };

  const seasons = await sql`
    SELECT s.id
    FROM seasons s
    WHERE EXISTS (
      SELECT 1
      FROM games g
      WHERE g.season_id = s.id
        AND g.status = 'final'
    )
    ORDER BY s.start_date NULLS LAST, s.created_at, s.id
  `;

  let gameCount = 0;
  for (const season of seasons) {
    const result = await rebuildSeasonStatsSnapshots(sql, season.id);
    gameCount += result.games;
  }

  await sql`
    INSERT INTO _migrations (name)
    VALUES (${STATS_SNAPSHOT_BACKFILL_MIGRATION})
    ON CONFLICT (name) DO NOTHING
  `;

  return { skipped: false, seasons: seasons.length, games: gameCount };
}

module.exports = {
  STATS_SNAPSHOT_BACKFILL_MIGRATION,
  rebuildGameStats,
  rebuildSeasonStatsSnapshots,
  backfillAllSeasonStatsSnapshots,
};
