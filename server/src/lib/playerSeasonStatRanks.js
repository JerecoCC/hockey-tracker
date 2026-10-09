'use strict';

// Where a player ranks in each of their season stats, for the rank tags on player details.
// A stat is tagged with the league-wide rank when it's in the top 10, otherwise with the
// rank among teammates when that's in the top 10, otherwise not at all.

const { sql } = require('../db');

const TOP_N = 10;

// Counting stats aren't ranked at zero; a 0.00 GAA is the best there is, so rates always are.
const COUNTING_STATS = new Set(['gp', 'goals', 'assists', 'points', 'wins', 'shootout_wins']);

/**
 * Ranks every player of the same kind (skaters or goalies) by season totals. A player's team
 * is the one they last played for. Goalie GAA and SV% use the season's minimum regular-season
 * minutes, like the season stats page: goalies under it aren't ranked unless no goalie has
 * reached it yet. Ties share a rank (1, 1, 3) and rates are compared at their shown precision.
 */
const fetchPlayerSeasonStatRanks = async ({ playerId, seasonId, isGoalie }) => {
  const rows = await sql`
    WITH season_info AS (
      SELECT
        l.code AS league_code,
        l.primary_color AS league_primary_color,
        l.text_color AS league_text_color,
        COALESCE(s.goalie_min_regular_minutes, l.goalie_min_regular_minutes, 0) * 60
          AS goalie_min_seconds
      FROM seasons s
      JOIN leagues l ON l.id = s.league_id
      WHERE s.id = ${seasonId}
    ),
    player_totals AS (
      SELECT
        gps.player_id,
        gps.game_type,
        COUNT(*)::int AS gp,
        COALESCE(SUM(gps.goals), 0)::int AS goals,
        COALESCE(SUM(gps.assists), 0)::int AS assists,
        COALESCE(SUM(gps.points), 0)::int AS points,
        COUNT(*) FILTER (WHERE gps.goalie_win)::int AS wins,
        COUNT(*) FILTER (WHERE gps.shootout_win)::int AS shootout_wins,
        COALESCE(SUM(gps.shots_against), 0)::int AS shots_against,
        COALESCE(SUM(gps.goals_against), 0)::int AS goals_against,
        COALESCE(SUM(gps.saves), 0)::int AS saves,
        COALESCE(SUM(gps.time_on_ice), 0)::int AS time_on_ice
      FROM game_player_stats gps
      WHERE gps.season_id = ${seasonId}
        AND gps.is_goalie = ${isGoalie}
      GROUP BY gps.player_id, gps.game_type
    ),
    latest_team AS (
      SELECT DISTINCT ON (gps.player_id, gps.game_type)
        gps.player_id, gps.game_type, gps.team_id
      FROM game_player_stats gps
      JOIN games g ON g.id = gps.game_id
      WHERE gps.season_id = ${seasonId}
        AND gps.is_goalie = ${isGoalie}
      ORDER BY gps.player_id, gps.game_type, g.scheduled_at DESC, g.scheduled_time DESC NULLS LAST
    ),
    -- Whether any goalie has reached the minimum, per game type.
    goalie_min_reached AS (
      SELECT pt.game_type, BOOL_OR(pt.time_on_ice >= si.goalie_min_seconds) AS reached
      FROM player_totals pt
      CROSS JOIN season_info si
      GROUP BY pt.game_type
    ),
    stat_values AS (
      SELECT
        pt.player_id,
        pt.game_type,
        lt.team_id,
        v.stat,
        v.value,
        v.higher_is_better
      FROM player_totals pt
      JOIN latest_team lt ON lt.player_id = pt.player_id AND lt.game_type = pt.game_type
      JOIN goalie_min_reached gmr ON gmr.game_type = pt.game_type
      CROSS JOIN season_info si
      CROSS JOIN LATERAL (
        SELECT
          pt.game_type != 'regular'
            OR si.goalie_min_seconds <= 0
            OR pt.time_on_ice >= si.goalie_min_seconds
            OR NOT gmr.reached AS rate_qualified
      ) q
      CROSS JOIN LATERAL (
        VALUES
          ('gp', pt.gp::numeric, true),
          ('goals', pt.goals::numeric, true),
          ('assists', pt.assists::numeric, true),
          ('points', pt.points::numeric, true),
          ('wins', pt.wins::numeric, true),
          ('shootout_wins', pt.shootout_wins::numeric, true),
          (
            'gaa',
            CASE WHEN q.rate_qualified AND pt.time_on_ice > 0
              THEN ROUND(pt.goals_against::numeric * 3600 / pt.time_on_ice, 2) END,
            false
          ),
          (
            'save_pct',
            CASE WHEN q.rate_qualified AND pt.shots_against > 0
              THEN ROUND(pt.saves::numeric / pt.shots_against, 3) END,
            true
          )
      ) AS v(stat, value, higher_is_better)
    ),
    ranked AS (
      SELECT
        sv.*,
        RANK() OVER (
          PARTITION BY sv.game_type, sv.stat
          ORDER BY CASE WHEN sv.higher_is_better THEN -sv.value ELSE sv.value END
        )::int AS league_rank,
        COUNT(*) OVER (PARTITION BY sv.game_type, sv.stat, sv.value)::int AS league_count,
        RANK() OVER (
          PARTITION BY sv.game_type, sv.stat, sv.team_id
          ORDER BY CASE WHEN sv.higher_is_better THEN -sv.value ELSE sv.value END
        )::int AS team_rank,
        COUNT(*) OVER (PARTITION BY sv.game_type, sv.stat, sv.team_id, sv.value)::int AS team_count
      FROM stat_values sv
      WHERE sv.value IS NOT NULL
    )
    SELECT
      r.game_type,
      r.stat,
      r.value,
      r.league_rank,
      r.league_count,
      r.team_rank,
      r.team_count,
      si.league_code,
      si.league_primary_color,
      si.league_text_color,
      ti.code AS team_code,
      t.primary_color AS team_primary_color,
      t.text_color AS team_text_color
    FROM ranked r
    CROSS JOIN season_info si
    LEFT JOIN teams t ON t.id = r.team_id
    LEFT JOIN LATERAL (
      SELECT code FROM team_iterations
      WHERE team_id = r.team_id
      ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
      LIMIT 1
    ) ti ON true
    WHERE r.player_id = ${playerId}
  `;

  const ranks = { regular: {}, playoff: {} };
  for (const row of rows) {
    if (!ranks[row.game_type]) continue;
    if (COUNTING_STATS.has(row.stat) && Number(row.value) <= 0) continue;
    if (row.league_rank <= TOP_N) {
      ranks[row.game_type][row.stat] = {
        scope: 'league',
        rank: row.league_rank,
        tied: row.league_count > 1,
        label: row.league_code,
        primary_color: row.league_primary_color,
        text_color: row.league_text_color,
      };
    } else if (row.team_rank <= TOP_N && row.team_code) {
      ranks[row.game_type][row.stat] = {
        scope: 'team',
        rank: row.team_rank,
        tied: row.team_count > 1,
        label: row.team_code,
        primary_color: row.team_primary_color,
        text_color: row.team_text_color,
      };
    }
  }
  return ranks;
};

module.exports = { fetchPlayerSeasonStatRanks };
