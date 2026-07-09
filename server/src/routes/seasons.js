const router = require('express').Router();
const { requireAdmin } = require('../middleware/auth');
const { sql } = require('../db');
const { normalizeSeasonBracketSlotKeys } = require('../lib/playoffBracketSlots');
const {
  playerMatchesAwardEligibility,
  teamMatchesAwardEligibility,
} = require('../lib/awardEligibility');

// All season routes require the admin role
router.use(requireAdmin);

const fetchAwardPlayerEligibilityRow = async (seasonId, playerId) => {
  const rows = await sql`
    SELECT
      p.id,
      COALESCE(ptr.position, p.position) AS position,
      p.rookie_season_id::text AS rookie_season_id
    FROM players p
    LEFT JOIN LATERAL (
      SELECT position
      FROM player_teams
      WHERE player_id = p.id AND season_id = ${seasonId}
      ORDER BY end_date DESC NULLS FIRST, start_date DESC NULLS LAST, created_at DESC
      LIMIT 1
    ) ptr ON true
    WHERE p.id = ${playerId}
  `;
  return rows[0] ?? null;
};

const validateAwardPlayerEligibility = async (seasonId, playerId, playerEligibility) => {
  const player = await fetchAwardPlayerEligibilityRow(seasonId, playerId);
  if (!player) return { ok: false, error: 'Invalid player, team, or award' };
  return playerMatchesAwardEligibility(player, playerEligibility, seasonId)
    ? { ok: true }
    : { ok: false, error: 'Player is not eligible for this award' };
};

const fetchAwardTeamEligibilityRow = async (seasonId, teamId) => {
  const rows = await sql`
    WITH RECURSIVE season_info AS (
      SELECT id, league_id, group_alignment_set_id
      FROM seasons
      WHERE id = ${seasonId}
    ),
    prev_season AS (
      SELECT id
      FROM seasons
      WHERE league_id = (SELECT league_id FROM season_info)
        AND id <> ${seasonId}
      ORDER BY start_date DESC NULLS LAST, created_at DESC
      LIMIT 1
    ),
    alignment_group_overrides AS (
      SELECT DISTINCT alignment_group_id
      FROM season_alignment_group_teams
      WHERE season_id = ${seasonId}
    ),
    legacy_auto_group AS (
      SELECT id
      FROM groups
      WHERE season_id = ${seasonId} AND is_auto = true
      LIMIT 1
    ),
    legacy_prev_auto_group AS (
      SELECT id
      FROM groups
      WHERE season_id = (SELECT id FROM prev_season) AND is_auto = true
      LIMIT 1
    ),
    legacy_group_overrides AS (
      SELECT DISTINCT group_id
      FROM season_group_teams
      WHERE season_id = ${seasonId}
    ),
    legacy_prev_group_overrides AS (
      SELECT DISTINCT group_id
      FROM season_group_teams
      WHERE season_id = (SELECT id FROM prev_season)
        AND group_id NOT IN (SELECT group_id FROM legacy_group_overrides)
    ),
    all_groups AS (
      SELECT
        ag.id,
        ag.parent_id,
        ag.name,
        ag.stable_key,
        ag.role
      FROM group_alignment_groups ag
      WHERE ag.alignment_set_id = (SELECT group_alignment_set_id FROM season_info)
        AND (SELECT group_alignment_set_id FROM season_info) IS NOT NULL

      UNION ALL

      SELECT
        g.id,
        g.parent_id,
        g.name,
        NULL::text AS stable_key,
        g.role
      FROM groups g
      WHERE (SELECT group_alignment_set_id FROM season_info) IS NULL
        AND (
          (
            g.league_id = (SELECT league_id FROM season_info)
            AND g.season_id IS NULL
          )
          OR g.id IN (SELECT id FROM legacy_auto_group)
          OR (
            g.id IN (SELECT id FROM legacy_prev_auto_group)
            AND NOT EXISTS (SELECT 1 FROM legacy_auto_group)
          )
        )
    ),
    memberships AS (
      SELECT sagt.alignment_group_id AS group_id, sagt.team_id
      FROM season_alignment_group_teams sagt
      JOIN group_alignment_groups ag ON ag.id = sagt.alignment_group_id
      WHERE sagt.season_id = ${seasonId}
        AND ag.alignment_set_id = (SELECT group_alignment_set_id FROM season_info)
        AND (SELECT group_alignment_set_id FROM season_info) IS NOT NULL

      UNION ALL

      SELECT gat.alignment_group_id AS group_id, gat.team_id
      FROM group_alignment_teams gat
      JOIN group_alignment_groups ag ON ag.id = gat.alignment_group_id
      WHERE ag.alignment_set_id = (SELECT group_alignment_set_id FROM season_info)
        AND (SELECT group_alignment_set_id FROM season_info) IS NOT NULL
        AND gat.alignment_group_id NOT IN (
          SELECT alignment_group_id FROM alignment_group_overrides
        )

      UNION ALL

      SELECT sgt.group_id, sgt.team_id
      FROM season_group_teams sgt
      WHERE sgt.season_id = ${seasonId}
        AND (SELECT group_alignment_set_id FROM season_info) IS NULL

      UNION ALL

      SELECT sgt.group_id, sgt.team_id
      FROM season_group_teams sgt
      WHERE sgt.season_id = (SELECT id FROM prev_season)
        AND (SELECT group_alignment_set_id FROM season_info) IS NULL
        AND sgt.group_id NOT IN (
          SELECT group_id FROM legacy_group_overrides
        )

      UNION ALL

      SELECT gt.group_id, gt.team_id
      FROM group_teams gt
      WHERE (SELECT group_alignment_set_id FROM season_info) IS NULL
        AND gt.group_id NOT IN (
          SELECT group_id FROM legacy_group_overrides
        )
        AND gt.group_id NOT IN (
          SELECT group_id FROM legacy_prev_group_overrides
        )
        AND gt.group_id NOT IN (SELECT id FROM legacy_auto_group)
        AND gt.group_id NOT IN (SELECT id FROM legacy_prev_auto_group)

      UNION ALL

      SELECT gt.group_id, gt.team_id
      FROM group_teams gt
      WHERE (SELECT group_alignment_set_id FROM season_info) IS NULL
        AND gt.group_id IN (SELECT id FROM legacy_auto_group)

      UNION ALL

      SELECT gt.group_id, gt.team_id
      FROM group_teams gt
      WHERE (SELECT group_alignment_set_id FROM season_info) IS NULL
        AND gt.group_id IN (SELECT id FROM legacy_prev_auto_group)
        AND NOT EXISTS (SELECT 1 FROM legacy_auto_group)
    ),
    group_ancestors AS (
      SELECT
        m.team_id,
        g.id,
        g.parent_id,
        g.name,
        g.stable_key,
        g.role
      FROM memberships m
      JOIN all_groups g ON g.id = m.group_id

      UNION ALL

      SELECT
        ga.team_id,
        parent.id,
        parent.parent_id,
        parent.name,
        parent.stable_key,
        parent.role
      FROM group_ancestors ga
      JOIN all_groups parent ON parent.id = ga.parent_id
    ),
    conference_memberships AS (
      SELECT DISTINCT
        team_id,
        name,
        stable_key
      FROM group_ancestors
      WHERE role = 'conference'
    )
    SELECT
      t.id,
      COALESCE(
        json_agg(DISTINCT cm.name) FILTER (WHERE cm.name IS NOT NULL),
        '[]'::json
      ) AS conference_names,
      COALESCE(
        json_agg(DISTINCT cm.stable_key) FILTER (WHERE cm.stable_key IS NOT NULL),
        '[]'::json
      ) AS conference_keys
    FROM teams t
    LEFT JOIN conference_memberships cm ON cm.team_id = t.id
    WHERE t.id = ${teamId}
    GROUP BY t.id
  `;
  return rows[0] ?? null;
};

const validateAwardTeamEligibility = async (seasonId, teamId, teamEligibility) => {
  const team = await fetchAwardTeamEligibilityRow(seasonId, teamId);
  if (!team) return { ok: false, error: 'Invalid player, team, or award' };
  return teamMatchesAwardEligibility(team, teamEligibility)
    ? { ok: true }
    : { ok: false, error: 'Team is not eligible for this award' };
};

const fetchRegularSeasonTeamCompletion = async (seasonId) => {
  const rows = await sql`
    WITH season_info AS (
      SELECT
        s.id,
        s.league_id,
        s.games_per_season,
        s.group_alignment_set_id,
        gas.structure_type AS alignment_structure_type
      FROM seasons s
      LEFT JOIN group_alignment_sets gas ON gas.id = s.group_alignment_set_id
      WHERE s.id = ${seasonId}
    ),
    alignment_group_overrides AS (
      SELECT DISTINCT alignment_group_id
      FROM season_alignment_group_teams
      WHERE season_id = ${seasonId}
    ),
    participant_teams AS (
      SELECT team_id
      FROM group_alignment_set_teams
      WHERE alignment_set_id = (SELECT group_alignment_set_id FROM season_info)
        AND (SELECT alignment_structure_type FROM season_info) = 'league'

      UNION

      SELECT sagt.team_id
      FROM season_alignment_group_teams sagt
      JOIN group_alignment_groups ag ON ag.id = sagt.alignment_group_id
      WHERE sagt.season_id = ${seasonId}
        AND ag.alignment_set_id = (SELECT group_alignment_set_id FROM season_info)
        AND (SELECT alignment_structure_type FROM season_info) = 'groups'

      UNION

      SELECT gat.team_id
      FROM group_alignment_teams gat
      JOIN group_alignment_groups ag ON ag.id = gat.alignment_group_id
      WHERE ag.alignment_set_id = (SELECT group_alignment_set_id FROM season_info)
        AND (SELECT alignment_structure_type FROM season_info) = 'groups'
        AND gat.alignment_group_id NOT IN (
          SELECT alignment_group_id FROM alignment_group_overrides
        )

      UNION

      SELECT team_id
      FROM season_teams
      WHERE season_id = ${seasonId}
        AND (SELECT group_alignment_set_id FROM season_info) IS NULL

      UNION

      SELECT team_id
      FROM season_group_teams
      WHERE season_id = ${seasonId}
        AND (SELECT group_alignment_set_id FROM season_info) IS NULL

      UNION

      SELECT gt.team_id
      FROM group_teams gt
      JOIN groups gr ON gr.id = gt.group_id
      WHERE (SELECT group_alignment_set_id FROM season_info) IS NULL
        AND (
          gr.season_id = ${seasonId}
          OR (
              gr.league_id = (SELECT league_id FROM season_info)
          AND gr.season_id IS NULL
          AND COALESCE(gr.is_auto, false) = false
          )
         )

      UNION

      SELECT home_team_id
      FROM games
      WHERE season_id = ${seasonId}
        AND (SELECT group_alignment_set_id FROM season_info) IS NULL

      UNION

      SELECT away_team_id
      FROM games
      WHERE season_id = ${seasonId}
        AND (SELECT group_alignment_set_id FROM season_info) IS NULL
    ),
    aggregated AS (
      SELECT
        gts.team_id,
        COUNT(*)::int AS gp
      FROM game_team_stats gts
      WHERE gts.season_id = ${seasonId}
        AND gts.game_type = 'regular'
        AND gts.team_id IN (SELECT team_id FROM participant_teams)
        AND gts.opponent_team_id IN (SELECT team_id FROM participant_teams)
        AND (gts.won OR gts.lost)
      GROUP BY gts.team_id
    )
    SELECT EXISTS (
      SELECT 1
      FROM participant_teams pt
      CROSS JOIN season_info si
      LEFT JOIN aggregated a ON a.team_id = pt.team_id
      WHERE COALESCE(si.games_per_season, 0) > 0
        AND COALESCE(a.gp, 0) < si.games_per_season
    ) AS has_incomplete_regular_team_games
  `;

  return {
    has_incomplete_regular_team_games: Boolean(rows[0]?.has_incomplete_regular_team_games),
  };
};

// ---------------------------------------------------------------------------
// GET /api/admin/seasons  – list all seasons (with league info)
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const { league_id } = req.query;
  try {
    const seasons = league_id
      ? await sql`
          SELECT s.id, s.name, s.league_id,
                 (l.current_season_id = s.id) AS is_current,
                 s.is_ended, s.playoffs_started,
                 s.start_date::text AS start_date, s.end_date::text AS end_date,
                 s.games_per_season,
                 s.goalie_min_regular_minutes,
                 COALESCE(brs.qualification_format_id, s.playoff_qualification_format_id) AS playoff_qualification_format_id,
                 s.group_alignment_set_id,
                 EXISTS (SELECT 1 FROM games g WHERE g.season_id = s.id) AS has_scheduled_games,
                 EXISTS (
                   SELECT 1 FROM games g
                   WHERE g.season_id = s.id
                     AND g.game_type = 'regular'
                     AND g.status IN ('scheduled', 'in_progress')
                 ) AS has_unfinished_regular_games,
                 s.created_at,
                 l.name AS league_name, l.code AS league_code, l.logo AS league_logo,
                 l.goalie_min_regular_minutes AS league_goalie_min_regular_minutes
          FROM seasons s
          JOIN leagues l ON l.id = s.league_id
          LEFT JOIN bracket_rule_sets brs ON brs.id = s.bracket_rule_set_id
          WHERE s.league_id = ${league_id}
          ORDER BY (l.current_season_id = s.id) DESC, s.start_date DESC NULLS LAST, s.name ASC
        `
      : await sql`
          SELECT s.id, s.name, s.league_id,
                 (l.current_season_id = s.id) AS is_current,
                 s.is_ended, s.playoffs_started,
                 s.start_date::text AS start_date, s.end_date::text AS end_date,
                 s.games_per_season,
                 s.goalie_min_regular_minutes,
                 COALESCE(brs.qualification_format_id, s.playoff_qualification_format_id) AS playoff_qualification_format_id,
                 s.group_alignment_set_id,
                 EXISTS (SELECT 1 FROM games g WHERE g.season_id = s.id) AS has_scheduled_games,
                 EXISTS (
                   SELECT 1 FROM games g
                   WHERE g.season_id = s.id
                     AND g.game_type = 'regular'
                     AND g.status IN ('scheduled', 'in_progress')
                 ) AS has_unfinished_regular_games,
                 s.created_at,
                 l.name AS league_name, l.code AS league_code, l.logo AS league_logo,
                 l.goalie_min_regular_minutes AS league_goalie_min_regular_minutes
          FROM seasons s
          JOIN leagues l ON l.id = s.league_id
          LEFT JOIN bracket_rule_sets brs ON brs.id = s.bracket_rule_set_id
          ORDER BY (l.current_season_id = s.id) DESC, s.start_date DESC NULLS LAST, s.name ASC
        `;
    return res.json(seasons);
  } catch (err) {
    console.error('seasons list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/seasons/:id  – get a single season
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`
      SELECT s.id, s.name, s.league_id,
             (l.current_season_id = s.id) AS is_current,
             s.is_ended, s.playoffs_started,
             s.start_date::text AS start_date, s.end_date::text AS end_date,
             s.games_per_season,
             COALESCE(pqf.rules, s.playoff_format, l.playoff_format) AS playoff_format,
             COALESCE(brs.qualification_format_id, s.playoff_qualification_format_id) AS playoff_qualification_format_id,
             pqf.name AS playoff_qualification_format_name,
             s.best_of_playoff,
             s.best_of_shootout,
             s.scoring_system,
             s.goalie_min_regular_minutes,
             s.bracket_rule_set_id,
             s.group_alignment_set_id,
             EXISTS (SELECT 1 FROM games g WHERE g.season_id = s.id) AS has_scheduled_games,
             EXISTS (
               SELECT 1 FROM games g
               WHERE g.season_id = s.id
                 AND g.game_type = 'regular'
                 AND g.status IN ('scheduled', 'in_progress')
             ) AS has_unfinished_regular_games,
             s.created_at,
             l.name AS league_name, l.code AS league_code, l.logo AS league_logo,
             l.scoring_system    AS league_scoring_system,
             l.best_of_playoff   AS league_best_of_playoff,
             l.best_of_shootout  AS league_best_of_shootout,
             l.goalie_min_regular_minutes AS league_goalie_min_regular_minutes
      FROM seasons s
      JOIN leagues l ON l.id = s.league_id
      LEFT JOIN bracket_rule_sets brs ON brs.id = s.bracket_rule_set_id
      LEFT JOIN playoff_qualification_formats pqf
        ON pqf.id = COALESCE(brs.qualification_format_id, s.playoff_qualification_format_id)
      WHERE s.id = ${id}
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Season not found' });
    const completion = await fetchRegularSeasonTeamCompletion(id);
    return res.json({ ...rows[0], ...completion });
  } catch (err) {
    console.error('seasons get error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/seasons  – create a season
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const {
    league_id,
    name,
    start_date,
    end_date,
    games_per_season,
    goalie_min_regular_minutes,
    playoff_qualification_format_id,
    group_alignment_set_id,
  } = req.body;

  if (!league_id) return res.status(400).json({ error: 'league_id is required' });
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  if (
    goalie_min_regular_minutes !== undefined &&
    goalie_min_regular_minutes !== null &&
    (!Number.isInteger(Number(goalie_min_regular_minutes)) ||
      Number(goalie_min_regular_minutes) < 0)
  ) {
    return res
      .status(400)
      .json({ error: 'goalie_min_regular_minutes must be a non-negative integer' });
  }

  try {
    const leagueRows = await sql`SELECT id FROM leagues WHERE id = ${league_id}`;
    if (leagueRows.length === 0) return res.status(400).json({ error: 'League not found' });

    if (group_alignment_set_id) {
      const alignmentRows = await sql`
        SELECT id FROM group_alignment_sets
        WHERE id = ${group_alignment_set_id} AND league_id = ${league_id}
      `;
      if (alignmentRows.length === 0) {
        return res
          .status(400)
          .json({ error: 'group_alignment_set_id does not belong to this league' });
      }
    }

    if (playoff_qualification_format_id) {
      const formatRows = await sql`
        SELECT id FROM playoff_qualification_formats
        WHERE id = ${playoff_qualification_format_id} AND league_id = ${league_id}
      `;
      if (formatRows.length === 0) {
        return res
          .status(400)
          .json({ error: 'playoff_qualification_format_id does not belong to this league' });
      }
    }

    const rows = await sql`
      INSERT INTO seasons (
        name, league_id, start_date, end_date, games_per_season,
        goalie_min_regular_minutes,
        playoff_qualification_format_id, group_alignment_set_id
      )
      VALUES (
        ${name.trim()},
        ${league_id},
        ${start_date ?? null},
        ${end_date ?? null},
        ${games_per_season ?? null},
        ${goalie_min_regular_minutes ?? null},
        ${playoff_qualification_format_id || null},
        ${group_alignment_set_id || null}
      )
      RETURNING id, name, league_id, FALSE AS is_current,
                start_date::text AS start_date, end_date::text AS end_date,
                games_per_season, goalie_min_regular_minutes,
                playoff_qualification_format_id, group_alignment_set_id,
                FALSE AS has_scheduled_games,
                FALSE AS has_unfinished_regular_games,
                FALSE AS has_incomplete_regular_team_games,
                created_at
    `;
    return res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json({ error: 'League not found' });
    }
    console.error('seasons create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/seasons/:id  – update a season
// ---------------------------------------------------------------------------
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    league_id,
    name,
    start_date,
    end_date,
    games_per_season,
    playoff_format,
    playoff_qualification_format_id,
    best_of_playoff,
    best_of_shootout,
    scoring_system,
    goalie_min_regular_minutes,
    bracket_rule_set_id,
    group_alignment_set_id,
  } = req.body;

  try {
    // Fetch current row so we can merge partial updates
    const existing = await sql`
      SELECT id, name, league_id,
             start_date::text AS start_date, end_date::text AS end_date, is_ended,
             playoffs_started,
             games_per_season, playoff_format,
             playoff_qualification_format_id,
             best_of_playoff, best_of_shootout, scoring_system, goalie_min_regular_minutes,
             bracket_rule_set_id, group_alignment_set_id,
             EXISTS (SELECT 1 FROM games g WHERE g.season_id = seasons.id) AS has_scheduled_games
      FROM seasons WHERE id = ${id}
    `;
    if (existing.length === 0) return res.status(404).json({ error: 'Season not found' });
    const cur = existing[0];

    const mergedName = name !== undefined ? name.trim() : cur.name;
    const mergedLeagueId = league_id !== undefined ? league_id : cur.league_id;
    const mergedStartDate = start_date !== undefined ? start_date || null : cur.start_date;
    const mergedEndDate = end_date !== undefined ? end_date || null : cur.end_date;
    const mergedGamesPerSeason =
      games_per_season !== undefined ? games_per_season || null : cur.games_per_season;
    const mergedPlayoffFormat =
      playoff_format !== undefined
        ? playoff_format
          ? JSON.stringify(playoff_format)
          : null
        : cur.playoff_format
          ? JSON.stringify(cur.playoff_format)
          : null;
    const mergedPlayoffQualificationFormatId =
      playoff_qualification_format_id !== undefined
        ? playoff_qualification_format_id || null
        : cur.playoff_qualification_format_id;
    const effectiveMergedPlayoffFormat =
      playoff_qualification_format_id !== undefined &&
      mergedPlayoffQualificationFormatId &&
      playoff_format === undefined
        ? null
        : mergedPlayoffFormat;
    const mergedBestOfPlayoff =
      best_of_playoff !== undefined ? best_of_playoff || null : cur.best_of_playoff;
    const mergedBestOfShootout =
      best_of_shootout !== undefined ? best_of_shootout || null : cur.best_of_shootout;
    const mergedScoringSystem =
      scoring_system !== undefined ? scoring_system || null : cur.scoring_system;
    const mergedGoalieMinRegularMinutes =
      goalie_min_regular_minutes !== undefined
        ? goalie_min_regular_minutes === null || goalie_min_regular_minutes === ''
          ? null
          : Number(goalie_min_regular_minutes)
        : (cur.goalie_min_regular_minutes ?? null);
    const mergedBracketRuleSetId =
      bracket_rule_set_id !== undefined ? bracket_rule_set_id || null : cur.bracket_rule_set_id;
    const mergedGroupAlignmentSetId =
      group_alignment_set_id !== undefined
        ? group_alignment_set_id || null
        : cur.group_alignment_set_id;
    // Auto-set is_ended when an end_date is provided; never auto-clear it.
    const mergedIsEnded = mergedEndDate ? true : cur.is_ended;

    if (!mergedName) return res.status(400).json({ error: 'name is required' });
    if (
      mergedGoalieMinRegularMinutes != null &&
      (!Number.isInteger(Number(mergedGoalieMinRegularMinutes)) ||
        Number(mergedGoalieMinRegularMinutes) < 0)
    ) {
      return res
        .status(400)
        .json({ error: 'goalie_min_regular_minutes must be a non-negative integer' });
    }

    if (mergedLeagueId !== cur.league_id) {
      const leagueRows = await sql`SELECT id FROM leagues WHERE id = ${mergedLeagueId}`;
      if (leagueRows.length === 0) return res.status(400).json({ error: 'League not found' });
    }

    if (
      group_alignment_set_id !== undefined &&
      (mergedGroupAlignmentSetId ?? null) !== (cur.group_alignment_set_id ?? null)
    ) {
      if (cur.has_scheduled_games) {
        return res.status(409).json({
          error: 'Team alignment cannot be changed after games have been scheduled for this season',
        });
      }
    }

    if (mergedGroupAlignmentSetId) {
      const alignmentRows = await sql`
        SELECT id FROM group_alignment_sets
        WHERE id = ${mergedGroupAlignmentSetId} AND league_id = ${mergedLeagueId}
      `;
      if (alignmentRows.length === 0) {
        return res
          .status(400)
          .json({ error: 'group_alignment_set_id does not belong to this league' });
      }
    }

    if (mergedPlayoffQualificationFormatId) {
      const formatRows = await sql`
        SELECT id FROM playoff_qualification_formats
        WHERE id = ${mergedPlayoffQualificationFormatId} AND league_id = ${mergedLeagueId}
      `;
      if (formatRows.length === 0) {
        return res
          .status(400)
          .json({ error: 'playoff_qualification_format_id does not belong to this league' });
      }
    }

    if (mergedBracketRuleSetId) {
      const ruleSetRows = await sql`
        SELECT id FROM bracket_rule_sets
        WHERE id = ${mergedBracketRuleSetId} AND league_id = ${mergedLeagueId}
      `;
      if (ruleSetRows.length === 0) {
        return res
          .status(400)
          .json({ error: 'bracket_rule_set_id does not belong to this league' });
      }
    }

    await sql`
      UPDATE seasons
      SET
        name                 = ${mergedName},
        league_id            = ${mergedLeagueId},
        start_date           = ${mergedStartDate},
        end_date             = ${mergedEndDate},
        is_ended             = ${mergedIsEnded},
        games_per_season     = ${mergedGamesPerSeason},
        playoff_format       = ${effectiveMergedPlayoffFormat}::jsonb,
        playoff_qualification_format_id = ${mergedPlayoffQualificationFormatId},
        best_of_playoff      = ${mergedBestOfPlayoff},
        best_of_shootout     = ${mergedBestOfShootout},
        scoring_system       = ${mergedScoringSystem},
        goalie_min_regular_minutes = ${mergedGoalieMinRegularMinutes},
        bracket_rule_set_id  = ${mergedBracketRuleSetId},
        group_alignment_set_id = ${mergedGroupAlignmentSetId}
      WHERE id = ${id}
    `;

    // If an end date is being set (or season is now marked ended), unset it as current.
    if (mergedEndDate || mergedIsEnded) {
      await sql`
        UPDATE leagues
        SET current_season_id = NULL
        WHERE id = ${mergedLeagueId} AND current_season_id = ${id}
      `;
    }

    const rows = await sql`
      SELECT s.id, s.name, s.league_id,
             (l.current_season_id = s.id) AS is_current,
             s.is_ended, s.playoffs_started,
             s.start_date::text AS start_date, s.end_date::text AS end_date,
             s.games_per_season,
             s.goalie_min_regular_minutes,
             COALESCE(pqf.rules, s.playoff_format, l.playoff_format) AS playoff_format,
             COALESCE(brs.qualification_format_id, s.playoff_qualification_format_id) AS playoff_qualification_format_id,
             pqf.name AS playoff_qualification_format_name,
             s.bracket_rule_set_id,
             s.group_alignment_set_id,
             EXISTS (SELECT 1 FROM games g WHERE g.season_id = s.id) AS has_scheduled_games,
             EXISTS (
               SELECT 1 FROM games g
               WHERE g.season_id = s.id
                 AND g.game_type = 'regular'
                 AND g.status IN ('scheduled', 'in_progress')
             ) AS has_unfinished_regular_games,
             s.created_at,
             l.name AS league_name, l.code AS league_code, l.logo AS league_logo,
             l.goalie_min_regular_minutes AS league_goalie_min_regular_minutes
      FROM seasons s
      JOIN leagues l ON l.id = s.league_id
      LEFT JOIN bracket_rule_sets brs ON brs.id = s.bracket_rule_set_id
      LEFT JOIN playoff_qualification_formats pqf
        ON pqf.id = COALESCE(brs.qualification_format_id, s.playoff_qualification_format_id)
      WHERE s.id = ${id}
    `;
    return res.json(rows[0]);
  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json({ error: 'League not found' });
    }
    console.error('seasons update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/seasons/:id/current  – set or unset the current-season flag
// Body: { is_current: boolean }
// Uniqueness is enforced at the DB level: leagues.current_season_id is a FK
// that can only hold one season id per league at a time.
// ---------------------------------------------------------------------------
router.patch('/:id/current', async (req, res) => {
  const { id } = req.params;
  const { is_current } = req.body;

  if (typeof is_current !== 'boolean') {
    return res.status(400).json({ error: 'is_current must be a boolean' });
  }

  try {
    // Verify the season exists and fetch its league_id
    const existing = await sql`
      SELECT id, league_id FROM seasons WHERE id = ${id}
    `;
    if (existing.length === 0) return res.status(404).json({ error: 'Season not found' });

    const { league_id } = existing[0];

    if (is_current) {
      // Point the league's current_season_id at this season.
      // Any previous current season is implicitly unset — the FK column holds only one value.
      await sql`
        UPDATE leagues SET current_season_id = ${id} WHERE id = ${league_id}
      `;
    } else {
      // Only clear the FK if it currently points to this season.
      await sql`
        UPDATE leagues
        SET current_season_id = NULL
        WHERE id = ${league_id} AND current_season_id = ${id}
      `;
    }

    const rows = await sql`
      SELECT s.id, s.name, s.league_id,
             (l.current_season_id = s.id) AS is_current,
             s.is_ended,
             s.start_date::text AS start_date, s.end_date::text AS end_date,
             s.goalie_min_regular_minutes,
             EXISTS (SELECT 1 FROM games g WHERE g.season_id = s.id) AS has_scheduled_games,
             EXISTS (
               SELECT 1 FROM games g
               WHERE g.season_id = s.id
                 AND g.game_type = 'regular'
                 AND g.status IN ('scheduled', 'in_progress')
             ) AS has_unfinished_regular_games,
             s.created_at,
             l.name AS league_name, l.code AS league_code, l.logo AS league_logo,
             l.goalie_min_regular_minutes AS league_goalie_min_regular_minutes
      FROM seasons s
      JOIN leagues l ON l.id = s.league_id
      WHERE s.id = ${id}
    `;
    return res.json(rows[0]);
  } catch (err) {
    console.error('seasons set-current error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/seasons/:id/playoffs  – mark regular season as ended,
// setting playoffs_started = true.  Does NOT set is_ended (the whole season
// is not over — only the regular-season portion is complete).
// ---------------------------------------------------------------------------
router.patch('/:id/playoffs', async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await sql`
      SELECT
        id,
        EXISTS (
          SELECT 1 FROM games g
          WHERE g.season_id = seasons.id
            AND g.game_type = 'regular'
            AND g.status IN ('scheduled', 'in_progress')
        ) AS has_unfinished_regular_games
      FROM seasons
      WHERE id = ${id}
    `;
    if (existing.length === 0) return res.status(404).json({ error: 'Season not found' });
    if (existing[0].has_unfinished_regular_games) {
      return res.status(409).json({
        error: 'Regular season cannot end while regular-season games are scheduled or in progress',
      });
    }

    const completion = await fetchRegularSeasonTeamCompletion(id);
    if (completion.has_incomplete_regular_team_games) {
      return res.status(409).json({
        error: 'Regular season cannot end until every team has reached games_per_season',
      });
    }

    await sql`
      UPDATE seasons SET playoffs_started = TRUE WHERE id = ${id}
    `;

    const rows = await sql`
      SELECT s.id, s.name, s.league_id,
             (l.current_season_id = s.id) AS is_current,
             s.is_ended, s.playoffs_started,
             s.start_date::text AS start_date, s.end_date::text AS end_date,
             s.games_per_season,
             s.goalie_min_regular_minutes,
             COALESCE(pqf.rules, s.playoff_format, l.playoff_format) AS playoff_format,
             COALESCE(brs.qualification_format_id, s.playoff_qualification_format_id) AS playoff_qualification_format_id,
             pqf.name AS playoff_qualification_format_name,
             s.bracket_rule_set_id,
             s.group_alignment_set_id,
             s.best_of_playoff, s.best_of_shootout, s.scoring_system,
             EXISTS (SELECT 1 FROM games g WHERE g.season_id = s.id) AS has_scheduled_games,
             EXISTS (
               SELECT 1 FROM games g
               WHERE g.season_id = s.id
                 AND g.game_type = 'regular'
                 AND g.status IN ('scheduled', 'in_progress')
             ) AS has_unfinished_regular_games,
             s.created_at,
             l.name AS league_name, l.code AS league_code, l.logo AS league_logo,
             l.scoring_system   AS league_scoring_system,
             l.best_of_playoff  AS league_best_of_playoff,
             l.best_of_shootout AS league_best_of_shootout,
             l.goalie_min_regular_minutes AS league_goalie_min_regular_minutes
      FROM seasons s
      JOIN leagues l ON l.id = s.league_id
      LEFT JOIN bracket_rule_sets brs ON brs.id = s.bracket_rule_set_id
      LEFT JOIN playoff_qualification_formats pqf
        ON pqf.id = COALESCE(brs.qualification_format_id, s.playoff_qualification_format_id)
      WHERE s.id = ${id}
    `;
    return res.json({ ...rows[0], ...completion });
  } catch (err) {
    console.error('seasons start-playoffs error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/seasons/:id/advance-bracket
// Replays the auto-advance logic for every completed series in the season.
// Creates next-round series shells for any matchups where both feeder series
// are complete but no next-round series exists yet.  Idempotent — safe to
// call multiple times.  Returns { created: N } where N is the count of new
// series rows inserted.
// ---------------------------------------------------------------------------
router.post('/:id/advance-bracket', async (req, res) => {
  const { id: seasonId } = req.params;
  try {
    // Resolve the bracket rule set for this season
    const seasonRows = await sql`
      SELECT bracket_rule_set_id FROM seasons WHERE id = ${seasonId}
    `;
    if (seasonRows.length === 0) return res.status(404).json({ error: 'Season not found' });
    const bracketRuleSetId = seasonRows[0]?.bracket_rule_set_id;
    if (!bracketRuleSetId) {
      return res.status(400).json({ error: 'No bracket rule set configured for this season' });
    }

    await normalizeSeasonBracketSlotKeys(sql, seasonId, bracketRuleSetId);

    // All completed series that occupy a known bracket slot
    const completedSeries = await sql`
      SELECT id, bracket_slot_key, winner_team_id, season_id
      FROM playoff_series
      WHERE season_id  = ${seasonId}
        AND status     = 'complete'
        AND winner_team_id IS NOT NULL
        AND bracket_slot_key IS NOT NULL
    `;

    let created = 0;

    for (const series of completedSeries) {
      const slotKey = series.bracket_slot_key; // e.g. 'r1m0'

      // Find next-round slots that reference this matchup as a winner source
      const dependentSlots = await sql`
        SELECT slot_key FROM bracket_slot_rules
        WHERE rule_set_id = ${bracketRuleSetId}
          AND rule_type   = 'winner'
          AND matchup_ref = ${slotKey}
      `;

      for (const { slot_key: depSlot } of dependentSlots) {
        const nextMatchupKey = depSlot.replace(/team[12]$/, ''); // e.g. 'r2m0'

        // Get both winner slots for the next matchup
        const nextSlots = await sql`
          SELECT slot_key, matchup_ref FROM bracket_slot_rules
          WHERE rule_set_id = ${bracketRuleSetId}
            AND slot_key LIKE ${nextMatchupKey + '%'}
            AND rule_type = 'winner'
        `;
        const team1Slot = nextSlots.find((s) => s.slot_key === `${nextMatchupKey}team1`);
        const team2Slot = nextSlots.find((s) => s.slot_key === `${nextMatchupKey}team2`);
        if (!team1Slot?.matchup_ref || !team2Slot?.matchup_ref) continue;

        // Resolve winner from each feeder matchup
        const [t1Series] = await sql`
          SELECT winner_team_id, status FROM playoff_series
          WHERE season_id = ${seasonId} AND bracket_slot_key = ${team1Slot.matchup_ref}
        `;
        const [t2Series] = await sql`
          SELECT winner_team_id, status FROM playoff_series
          WHERE season_id = ${seasonId} AND bracket_slot_key = ${team2Slot.matchup_ref}
        `;

        if (
          t1Series?.status !== 'complete' ||
          !t1Series?.winner_team_id ||
          t2Series?.status !== 'complete' ||
          !t2Series?.winner_team_id
        )
          continue;

        // Skip if next-round series already exists
        const [existing] = await sql`
          SELECT id FROM playoff_series
          WHERE season_id = ${seasonId} AND bracket_slot_key = ${nextMatchupKey}
        `;
        if (existing) continue;

        const roundMatch = nextMatchupKey.match(/^r(\d+)/);
        const nextRound = roundMatch ? Number(roundMatch[1]) : null;
        if (!nextRound) continue;

        const gtwRows = await sql`
          SELECT COALESCE(s.best_of_playoff, l.best_of_playoff) AS best_of
          FROM seasons s JOIN leagues l ON l.id = s.league_id
          WHERE s.id = ${seasonId}
        `;
        const bestOf = gtwRows[0]?.best_of ?? 7;
        const gamesToWin = Math.ceil(bestOf / 2);

        await sql`
          INSERT INTO playoff_series
            (season_id, round, home_team_id, away_team_id, games_to_win, status, bracket_slot_key)
          VALUES
            (${seasonId}, ${nextRound}, ${t1Series.winner_team_id},
             ${t2Series.winner_team_id}, ${gamesToWin}, 'upcoming', ${nextMatchupKey})
        `;
        created++;
      }
    }

    return res.json({ created });
  } catch (err) {
    console.error('advance-bracket error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/seasons/:id  – delete a season
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`
      DELETE FROM seasons WHERE id = ${id} RETURNING id
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Season not found' });
    return res.json({ message: 'Season deleted' });
  } catch (err) {
    console.error('seasons delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/seasons/:seasonId/teams
// Returns the teams participating in this season.
// Falls back to the most-recent prior season's roster when none is set,
// tagging each row with inherited:true so the UI can distinguish.
// ---------------------------------------------------------------------------
router.get('/:seasonId/teams', async (req, res) => {
  const { seasonId } = req.params;
  try {
    const seasonRows = await sql`
      SELECT id, league_id, start_date::text, group_alignment_set_id
      FROM seasons
      WHERE id = ${seasonId}
    `;
    if (seasonRows.length === 0) return res.status(404).json({ error: 'Season not found' });
    const {
      league_id,
      start_date: seasonStartDate,
      group_alignment_set_id: groupAlignmentSetId,
    } = seasonRows[0];

    if (groupAlignmentSetId) {
      const alignmentRows = await sql`
        SELECT id, structure_type
        FROM group_alignment_sets
        WHERE id = ${groupAlignmentSetId} AND league_id = ${league_id}
      `;
      if (alignmentRows.length === 0) {
        return res
          .status(400)
          .json({ error: 'Season alignment set does not belong to this league' });
      }

      if (alignmentRows[0].structure_type !== 'league') {
        const alignmentTeams = await sql`
          WITH
            cur_overrides AS (
              SELECT DISTINCT alignment_group_id
              FROM season_alignment_group_teams
              WHERE season_id = ${seasonId}
            ),
            resolved AS (
              SELECT sagt.team_id
              FROM season_alignment_group_teams sagt
              WHERE sagt.season_id = ${seasonId}

              UNION

              SELECT gat.team_id
              FROM group_alignment_teams gat
              JOIN group_alignment_groups ag ON ag.id = gat.alignment_group_id
              WHERE ag.alignment_set_id = ${groupAlignmentSetId}
                AND gat.alignment_group_id NOT IN (
                  SELECT alignment_group_id FROM cur_overrides
                )
            )
          SELECT DISTINCT
            t.id, iter.name, iter.place_name, iter.team_name, iter.code, iter.logo,
            t.primary_color, t.text_color, t.secondary_color, t.home_arena,
            false AS inherited
          FROM resolved r
          JOIN teams t ON t.id = r.team_id
          LEFT JOIN LATERAL (
            (SELECT ti.name, ti.place_name, ti.team_name, ti.code, team_logo_default(ti.logo_dark, ti.logo_light) AS logo FROM team_iterations ti
              LEFT JOIN seasons ss ON ss.id = ti.start_season_id
              LEFT JOIN seasons ls ON ls.id = ti.latest_season_id
              WHERE ti.team_id = t.id
                AND (ti.start_season_id  IS NULL OR ss.start_date <= ${seasonStartDate}::date)
                AND (ti.latest_season_id IS NULL OR ls.start_date >= ${seasonStartDate}::date)
              ORDER BY ss.start_date DESC NULLS LAST, ti.recorded_at DESC
              LIMIT 1)
            UNION ALL
            (SELECT ti.name, ti.place_name, ti.team_name, ti.code, team_logo_default(ti.logo_dark, ti.logo_light) AS logo FROM team_iterations ti
              WHERE ti.team_id = t.id ORDER BY ti.recorded_at ASC LIMIT 1)
            LIMIT 1
          ) iter ON true
          ORDER BY iter.name
        `;
        return res.json(alignmentTeams);
      }

      const alignmentTeams = await sql`
        SELECT
          t.id, iter.name, iter.place_name, iter.team_name, iter.code, iter.logo,
          t.primary_color, t.text_color, t.secondary_color, t.home_arena,
          false AS inherited
        FROM group_alignment_set_teams ast
        JOIN teams t ON t.id = ast.team_id
        LEFT JOIN LATERAL (
          (SELECT ti.name, ti.place_name, ti.team_name, ti.code, team_logo_default(ti.logo_dark, ti.logo_light) AS logo FROM team_iterations ti
            LEFT JOIN seasons ss ON ss.id = ti.start_season_id
            LEFT JOIN seasons ls ON ls.id = ti.latest_season_id
            WHERE ti.team_id = t.id
              AND (ti.start_season_id  IS NULL OR ss.start_date <= ${seasonStartDate}::date)
              AND (ti.latest_season_id IS NULL OR ls.start_date >= ${seasonStartDate}::date)
            ORDER BY ss.start_date DESC NULLS LAST, ti.recorded_at DESC
            LIMIT 1)
          UNION ALL
          (SELECT ti.name, ti.place_name, ti.team_name, ti.code, team_logo_default(ti.logo_dark, ti.logo_light) AS logo FROM team_iterations ti
            WHERE ti.team_id = t.id ORDER BY ti.recorded_at ASC LIMIT 1)
          LIMIT 1
        ) iter ON true
        WHERE ast.alignment_set_id = ${groupAlignmentSetId}
        ORDER BY iter.name
      `;
      return res.json(alignmentTeams);
    }

    // 1. Try the current season's explicit roster.
    //    Resolve each team's identity using season FKs on team_iterations:
    //    - start_season_id marks when this version first applied
    //    - latest_season_id marks when it last applied (NULL = still active/current)
    //    The matching iteration is the one whose range covers this season's start_date.
    const current = await sql`
      SELECT
        t.id, iter.name, iter.place_name, iter.team_name, iter.code, iter.logo,
        t.primary_color, t.text_color, t.secondary_color, t.home_arena,
        false AS inherited
      FROM season_teams st
      JOIN teams t ON t.id = st.team_id
      LEFT JOIN LATERAL (
        (SELECT ti.name, ti.place_name, ti.team_name, ti.code, team_logo_default(ti.logo_dark, ti.logo_light) AS logo FROM team_iterations ti
          LEFT JOIN seasons ss ON ss.id = ti.start_season_id
          LEFT JOIN seasons ls ON ls.id = ti.latest_season_id
          WHERE ti.team_id = t.id
            AND (ti.start_season_id  IS NULL OR ss.start_date <= ${seasonStartDate}::date)
            AND (ti.latest_season_id IS NULL OR ls.start_date >= ${seasonStartDate}::date)
          ORDER BY ss.start_date DESC NULLS LAST, ti.recorded_at DESC
          LIMIT 1)
        UNION ALL
        (SELECT ti.name, ti.place_name, ti.team_name, ti.code, team_logo_default(ti.logo_dark, ti.logo_light) AS logo FROM team_iterations ti
          WHERE ti.team_id = t.id ORDER BY ti.recorded_at ASC LIMIT 1)
        LIMIT 1
      ) iter ON true
      WHERE st.season_id = ${seasonId}
      ORDER BY iter.name
    `;
    if (current.length > 0) return res.json(current);

    // 2. Fall back to the most-recent prior season's roster, versioned to that season.
    const prevRows = await sql`
      SELECT id, start_date::text AS prev_start_date FROM seasons
      WHERE league_id = ${league_id}
        AND id <> ${seasonId}
      ORDER BY start_date DESC NULLS LAST, created_at DESC
      LIMIT 1
    `;
    if (prevRows.length === 0) return res.json([]);

    const prevSeasonId = prevRows[0].id;
    const prevSeasonStartDate = prevRows[0].prev_start_date;
    const inherited = await sql`
      SELECT
        t.id, iter.name, iter.place_name, iter.team_name, iter.code, iter.logo,
        t.primary_color, t.text_color, t.secondary_color, t.home_arena,
        true AS inherited
      FROM season_teams st
      JOIN teams t ON t.id = st.team_id
      LEFT JOIN LATERAL (
        (SELECT ti.name, ti.place_name, ti.team_name, ti.code, team_logo_default(ti.logo_dark, ti.logo_light) AS logo FROM team_iterations ti
          LEFT JOIN seasons ss ON ss.id = ti.start_season_id
          LEFT JOIN seasons ls ON ls.id = ti.latest_season_id
          WHERE ti.team_id = t.id
            AND (ti.start_season_id  IS NULL OR ss.start_date <= ${prevSeasonStartDate}::date)
            AND (ti.latest_season_id IS NULL OR ls.start_date >= ${prevSeasonStartDate}::date)
          ORDER BY ss.start_date DESC NULLS LAST, ti.recorded_at DESC
          LIMIT 1)
        UNION ALL
        (SELECT ti.name, ti.place_name, ti.team_name, ti.code, team_logo_default(ti.logo_dark, ti.logo_light) AS logo FROM team_iterations ti
          WHERE ti.team_id = t.id ORDER BY ti.recorded_at ASC LIMIT 1)
        LIMIT 1
      ) iter ON true
      WHERE st.season_id = ${prevSeasonId}
      ORDER BY iter.name
    `;
    return res.json(inherited);
  } catch (err) {
    console.error('season teams list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/seasons/:seasonId/teams
// Replace the flat team roster for this season.  Body: { team_ids: string[] }
// Also creates/updates an auto group named after the season to represent the
// roster as a group (is_auto = true, season_id = seasonId).
// ---------------------------------------------------------------------------

/** Derive a human-readable name from season dates, e.g. "2024-25". */
function deriveSeasonGroupName(startDate, endDate) {
  if (!startDate) return 'Season Roster';
  const sy = parseInt(startDate.slice(0, 4), 10);
  if (!endDate) return String(sy);
  const ey = parseInt(endDate.slice(0, 4), 10);
  if (sy === ey) return String(sy);
  return `${sy}-${String(ey).slice(2)}`; // "2024-25"
}

router.put('/:seasonId/teams', async (req, res) => {
  const { seasonId } = req.params;
  const { team_ids } = req.body;

  if (!Array.isArray(team_ids)) {
    return res.status(400).json({ error: 'team_ids must be an array' });
  }

  try {
    const seasonRows = await sql`
      SELECT id, league_id, start_date::text, end_date::text
      FROM seasons WHERE id = ${seasonId}
    `;
    if (seasonRows.length === 0) return res.status(404).json({ error: 'Season not found' });
    const { league_id, start_date, end_date } = seasonRows[0];

    // ── 1. Find or create the auto group for this season ────────────────────
    const groupName = deriveSeasonGroupName(start_date, end_date);

    let autoGroupRows = await sql`
      SELECT id FROM groups
      WHERE season_id = ${seasonId} AND is_auto = true
      LIMIT 1
    `;
    let autoGroupId;
    if (autoGroupRows.length === 0) {
      const created = await sql`
        INSERT INTO groups (league_id, season_id, name, is_auto, sort_order)
        VALUES (${league_id}, ${seasonId}, ${groupName}, true, 0)
        RETURNING id
      `;
      autoGroupId = created[0].id;
    } else {
      autoGroupId = autoGroupRows[0].id;
    }

    // ── 2. Sync group_teams for the auto group ───────────────────────────────
    await sql`DELETE FROM group_teams WHERE group_id = ${autoGroupId}`;
    for (const team_id of team_ids) {
      await sql`
        INSERT INTO group_teams (group_id, team_id)
        VALUES (${autoGroupId}, ${team_id})
        ON CONFLICT DO NOTHING
      `;
    }

    // ── 3. Keep season_teams in sync (used for inheritance fallback) ─────────
    await sql`DELETE FROM season_teams WHERE season_id = ${seasonId}`;
    for (const team_id of team_ids) {
      await sql`
        INSERT INTO season_teams (season_id, team_id)
        VALUES (${seasonId}, ${team_id})
        ON CONFLICT DO NOTHING
      `;
      // Track the first and most-recent season each team has been added to.
      await sql`
        UPDATE teams SET
          start_season_id = CASE
            WHEN start_season_id IS NULL THEN ${seasonId}::uuid
            WHEN ${start_date ?? null}::date < (
              SELECT start_date FROM seasons WHERE id = start_season_id
            ) THEN ${seasonId}::uuid
            ELSE start_season_id
          END,
          latest_season_id = CASE
            -- First time ever added: latest must match start
            WHEN start_season_id IS NULL THEN ${seasonId}::uuid
            WHEN latest_season_id IS NULL THEN ${seasonId}::uuid
            WHEN ${start_date ?? null}::date > (
              SELECT start_date FROM seasons WHERE id = latest_season_id
            ) THEN ${seasonId}::uuid
            ELSE latest_season_id
          END
        WHERE id = ${team_id}::uuid
      `;
    }

    const teams = await sql`
      SELECT
        t.id, ti.name, ti.place_name, ti.team_name, ti.code, ti.logo,
        t.primary_color, t.text_color, t.secondary_color
      FROM group_teams gt
      JOIN teams t ON t.id = gt.team_id
      LEFT JOIN LATERAL (
        (SELECT ti2.name, ti2.place_name, ti2.team_name, ti2.code, team_logo_default(ti2.logo_dark, ti2.logo_light) AS logo FROM team_iterations ti2
          LEFT JOIN seasons ss ON ss.id = ti2.start_season_id
          LEFT JOIN seasons ls ON ls.id = ti2.latest_season_id
          WHERE ti2.team_id = t.id
            AND (ti2.start_season_id  IS NULL OR ss.start_date <= ${start_date}::date)
            AND (ti2.latest_season_id IS NULL OR ls.start_date >= ${start_date}::date)
          ORDER BY ss.start_date DESC NULLS LAST, ti2.recorded_at DESC
          LIMIT 1)
        UNION ALL
        (SELECT ti2.name, ti2.place_name, ti2.team_name, ti2.code, team_logo_default(ti2.logo_dark, ti2.logo_light) AS logo FROM team_iterations ti2
          WHERE ti2.team_id = t.id ORDER BY ti2.recorded_at ASC LIMIT 1)
        LIMIT 1
      ) ti ON true
      WHERE gt.group_id = ${autoGroupId}
      ORDER BY ti.name
    `;
    return res.json({ season_id: seasonId, auto_group_id: autoGroupId, teams });
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'One or more teams not found' });
    console.error('season teams update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/seasons/:seasonId/groups
// Returns:
//   - All non-auto league groups (season_id IS NULL) with a 3-level fallback
//     for their teams: current season override → prev season override → default
//   - The auto group for this season (is_auto = true, season_id = seasonId),
//     with its teams sourced directly from group_teams (src = 'auto').
//   - The auto group from the previous season if this season has none yet,
//     tagged src = 'inherited'.
// Emits has_season_override, is_inherited, and is_auto per group.
// ---------------------------------------------------------------------------
router.get('/:seasonId/groups', async (req, res) => {
  const { seasonId } = req.params;
  try {
    const seasonRows = await sql`
        SELECT id, league_id, start_date::text, group_alignment_set_id
        FROM seasons
        WHERE id = ${seasonId}
      `;
    if (seasonRows.length === 0) return res.status(404).json({ error: 'Season not found' });
    const {
      league_id,
      start_date: seasonStartDate,
      group_alignment_set_id: groupAlignmentSetId,
    } = seasonRows[0];

    if (groupAlignmentSetId) {
      const alignmentRows = await sql`
        SELECT id, structure_type
        FROM group_alignment_sets
        WHERE id = ${groupAlignmentSetId} AND league_id = ${league_id}
      `;
      if (alignmentRows.length === 0) {
        return res
          .status(400)
          .json({ error: 'Season alignment set does not belong to this league' });
      }

      if (alignmentRows[0].structure_type === 'league') {
        return res.json([]);
      }

      const groups = await sql`
        WITH
          cur_overrides AS (
            SELECT DISTINCT alignment_group_id
            FROM season_alignment_group_teams
            WHERE season_id = ${seasonId}
          ),
          resolved AS (
            SELECT sagt.alignment_group_id, sagt.team_id, 'season' AS src
            FROM season_alignment_group_teams sagt
            WHERE sagt.season_id = ${seasonId}

            UNION ALL

            SELECT gat.alignment_group_id, gat.team_id, 'default' AS src
            FROM group_alignment_teams gat
            WHERE gat.alignment_group_id NOT IN (
              SELECT alignment_group_id FROM cur_overrides
            )
          ),
          versioned AS (
            SELECT
              r.alignment_group_id,
              r.team_id,
              r.src,
              iter.name,
              iter.place_name,
              iter.team_name,
              iter.code,
              iter.logo,
              iter.logo_dark,
              iter.logo_light,
              t.primary_color,
              t.text_color,
              t.home_arena
            FROM resolved r
            JOIN group_alignment_groups ag ON ag.id = r.alignment_group_id
            JOIN teams t ON t.id = r.team_id
            LEFT JOIN LATERAL (
              (SELECT
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
                  AND (ti.start_season_id IS NULL OR ss.start_date <= ${seasonStartDate}::date)
                  AND (ti.latest_season_id IS NULL OR ls.start_date >= ${seasonStartDate}::date)
                ORDER BY ss.start_date DESC NULLS LAST, ti.recorded_at DESC
                LIMIT 1)
              UNION ALL
              (SELECT
                  ti.name,
                  ti.place_name,
                  ti.team_name,
                  ti.code,
                  team_logo_default(ti.logo_dark, ti.logo_light) AS logo,
                  team_logo_dark(ti.logo_dark, ti.logo_light) AS logo_dark,
                  team_logo_light(ti.logo_dark, ti.logo_light) AS logo_light
                FROM team_iterations ti
                WHERE ti.team_id = t.id ORDER BY ti.recorded_at ASC LIMIT 1)
              LIMIT 1
            ) iter ON true
            WHERE ag.alignment_set_id = ${groupAlignmentSetId}
          )
        SELECT
          ag.id,
          gas.league_id,
          ag.alignment_set_id,
          ag.parent_id,
          ag.stable_key,
          ag.name,
          ag.sort_order,
          ag.created_at,
          ag.role,
          false AS is_auto,
          COALESCE(
            json_agg(
              json_build_object(
                'id', v.team_id,
                'name', v.name,
                'place_name', v.place_name,
                'team_name', v.team_name,
                'code', v.code,
                'logo', v.logo,
                'logo_dark', v.logo_dark,
                'logo_light', v.logo_light,
                'primary_color', v.primary_color,
                'text_color', v.text_color,
                'home_arena', v.home_arena
              )
              ORDER BY v.name
            ) FILTER (WHERE v.team_id IS NOT NULL),
            '[]'::json
          ) AS teams,
          BOOL_OR(v.src = 'season') AS has_season_override,
          false AS is_inherited
        FROM group_alignment_groups ag
        JOIN group_alignment_sets gas ON gas.id = ag.alignment_set_id
        LEFT JOIN versioned v ON v.alignment_group_id = ag.id
        WHERE ag.alignment_set_id = ${groupAlignmentSetId}
        GROUP BY ag.id, gas.league_id
        ORDER BY ag.parent_id NULLS FIRST, ag.sort_order, ag.name
      `;
      return res.json(groups);
    }

    const groups = await sql`
      WITH
        -- Most-recent other season in this league (the "previous" season)
        prev AS (
          SELECT id FROM seasons
          WHERE league_id = ${league_id}
            AND id <> ${seasonId}
          ORDER BY start_date DESC NULLS LAST, created_at DESC
          LIMIT 1
        ),
        -- Auto group for this season (if any)
        auto_group AS (
          SELECT id FROM groups
          WHERE season_id = ${seasonId} AND is_auto = true
          LIMIT 1
        ),
        -- Auto group from the previous season (used for inheritance when this season has none)
        prev_auto_group AS (
          SELECT id FROM groups
          WHERE season_id = (SELECT id FROM prev) AND is_auto = true
          LIMIT 1
        ),
        -- Groups that already have an explicit override for the current season (user groups only)
        cur_overrides AS (
          SELECT DISTINCT group_id FROM season_group_teams WHERE season_id = ${seasonId}
        ),
        -- Groups the previous season overrode that the current season has not touched
        prev_overrides AS (
          SELECT DISTINCT group_id FROM season_group_teams
          WHERE season_id = (SELECT id FROM prev)
            AND group_id NOT IN (SELECT group_id FROM cur_overrides)
        ),
        -- resolved: membership + source only (name/logo resolved later via versioned CTE)
        resolved AS (
          -- 1. Current season explicit override (user groups)
          SELECT sgt.group_id, sgt.team_id, 'season' AS src
          FROM season_group_teams sgt
          WHERE sgt.season_id = ${seasonId}

          UNION ALL

          -- 2. Inherited from the previous season (user groups not overridden this season)
          SELECT sgt.group_id, sgt.team_id, 'inherited' AS src
          FROM season_group_teams sgt
          WHERE sgt.season_id = (SELECT id FROM prev)
            AND sgt.group_id NOT IN (SELECT group_id FROM cur_overrides)

          UNION ALL

          -- 3. League default (user groups untouched by either season, not auto groups)
          SELECT gt.group_id, gt.team_id, 'default' AS src
          FROM group_teams gt
          WHERE gt.group_id NOT IN (SELECT group_id FROM cur_overrides)
            AND gt.group_id NOT IN (SELECT group_id FROM prev_overrides)
            AND gt.group_id NOT IN (SELECT id FROM auto_group)
            AND gt.group_id NOT IN (SELECT id FROM prev_auto_group)

          UNION ALL

          -- 4a. Auto group for this season — teams from group_teams directly
          SELECT gt.group_id, gt.team_id, 'auto' AS src
          FROM group_teams gt
          WHERE gt.group_id = (SELECT id FROM auto_group)

          UNION ALL

          -- 4b. Previous season's auto group — shown when this season has no auto group yet
          SELECT gt.group_id, gt.team_id, 'inherited' AS src
          FROM group_teams gt
          WHERE gt.group_id = (SELECT id FROM prev_auto_group)
            AND NOT EXISTS (SELECT 1 FROM auto_group)
        ),
        -- versioned: resolve each team's name/code/logo to the version active at this season.
        -- Uses the iteration explicitly linked to this season, or falls back to the most
        -- recent iteration recorded on or before the season's end date (so renames after the
        -- season ended never bleed back into the historical view).
        versioned AS (
          SELECT
            r.group_id,
            r.team_id,
            r.src,
            iter.name,
            iter.place_name,
            iter.team_name,
            iter.code,
            iter.logo,
            iter.logo_dark,
            iter.logo_light,
            t.primary_color,
            t.text_color,
            t.home_arena
          FROM resolved r
          JOIN teams t ON t.id = r.team_id
          LEFT JOIN LATERAL (
            (SELECT
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
                AND (ti.start_season_id  IS NULL OR ss.start_date <= ${seasonStartDate}::date)
                AND (ti.latest_season_id IS NULL OR ls.start_date >= ${seasonStartDate}::date)
              ORDER BY ss.start_date DESC NULLS LAST, ti.recorded_at DESC
              LIMIT 1)
            UNION ALL
            (SELECT
                ti.name,
                ti.place_name,
                ti.team_name,
                ti.code,
                team_logo_default(ti.logo_dark, ti.logo_light) AS logo,
                team_logo_dark(ti.logo_dark, ti.logo_light) AS logo_dark,
                team_logo_light(ti.logo_dark, ti.logo_light) AS logo_light
              FROM team_iterations ti
              WHERE ti.team_id = t.id ORDER BY ti.recorded_at ASC LIMIT 1)
            LIMIT 1
          ) iter ON true
        )
      SELECT
        g.id, g.league_id, g.parent_id, g.name, g.sort_order, g.created_at,
        g.is_auto, g.role,
        COALESCE(
          json_agg(
            json_build_object('id', v.team_id, 'name', v.name, 'place_name', v.place_name,
                              'team_name', v.team_name, 'code', v.code,
                              'logo', v.logo, 'logo_dark', v.logo_dark, 'logo_light', v.logo_light,
                              'primary_color', v.primary_color, 'text_color', v.text_color,
                              'home_arena', v.home_arena)
            ORDER BY v.name
          ) FILTER (WHERE v.team_id IS NOT NULL),
          '[]'::json
        ) AS teams,
        BOOL_OR(v.src = 'season')    AS has_season_override,
        BOOL_OR(v.src = 'inherited') AS is_inherited
      FROM groups g
      LEFT JOIN versioned v ON v.group_id = g.id
      WHERE
        -- User groups (league-scoped, no season_id)
        (g.league_id = ${league_id} AND g.season_id IS NULL)
        -- Auto group for this season
        OR g.season_id = ${seasonId}
        -- Previous season's auto group when this season has no auto group yet
        OR (
          g.id = (SELECT id FROM prev_auto_group)
          AND NOT EXISTS (SELECT 1 FROM auto_group)
        )
      GROUP BY g.id
      ORDER BY g.is_auto DESC, g.parent_id NULLS FIRST, g.sort_order, g.name
    `;
    return res.json(groups);
  } catch (err) {
    console.error('season groups list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/seasons/:seasonId/groups/:groupId/teams
// Set season-specific team list for one group.  Body: { team_ids: string[] }
// ---------------------------------------------------------------------------
router.put('/:seasonId/groups/:groupId/teams', async (req, res) => {
  const { seasonId, groupId } = req.params;
  const { team_ids } = req.body;

  if (!Array.isArray(team_ids)) {
    return res.status(400).json({ error: 'team_ids must be an array' });
  }

  try {
    const seasonRows = await sql`
      SELECT id, league_id, start_date::text, group_alignment_set_id
      FROM seasons
      WHERE id = ${seasonId}
    `;
    if (seasonRows.length === 0) return res.status(404).json({ error: 'Season not found' });
    const {
      league_id: seasonLeagueId,
      start_date: seasonStartDate,
      group_alignment_set_id: groupAlignmentSetId,
    } = seasonRows[0];

    if (groupAlignmentSetId) {
      const groupRows = await sql`
        SELECT ag.id, gas.league_id
        FROM group_alignment_groups ag
        JOIN group_alignment_sets gas ON gas.id = ag.alignment_set_id
        WHERE ag.id = ${groupId}
          AND ag.alignment_set_id = ${groupAlignmentSetId}
      `;
      if (groupRows.length === 0) return res.status(404).json({ error: 'Group not found' });
      if (groupRows[0].league_id !== seasonLeagueId) {
        return res.status(400).json({ error: 'Season and group must belong to the same league' });
      }

      await sql`
        DELETE FROM season_alignment_group_teams
        WHERE season_id = ${seasonId} AND alignment_group_id = ${groupId}
      `;
      for (const team_id of team_ids) {
        await sql`
          INSERT INTO season_alignment_group_teams (season_id, alignment_group_id, team_id)
          VALUES (${seasonId}, ${groupId}, ${team_id})
          ON CONFLICT DO NOTHING
        `;
      }

      const teams = await sql`
        SELECT t.id, ti.name, ti.place_name, ti.team_name, ti.code, ti.logo, t.primary_color, t.text_color
        FROM season_alignment_group_teams sagt
        JOIN teams t ON t.id = sagt.team_id
        LEFT JOIN LATERAL (
          (SELECT ti2.name, ti2.place_name, ti2.team_name, ti2.code, team_logo_default(ti2.logo_dark, ti2.logo_light) AS logo FROM team_iterations ti2
            LEFT JOIN seasons ss ON ss.id = ti2.start_season_id
            LEFT JOIN seasons ls ON ls.id = ti2.latest_season_id
            WHERE ti2.team_id = t.id
              AND (ti2.start_season_id  IS NULL OR ss.start_date <= ${seasonStartDate}::date)
              AND (ti2.latest_season_id IS NULL OR ls.start_date >= ${seasonStartDate}::date)
            ORDER BY ss.start_date DESC NULLS LAST, ti2.recorded_at DESC
            LIMIT 1)
          UNION ALL
          (SELECT ti2.name, ti2.place_name, ti2.team_name, ti2.code, team_logo_default(ti2.logo_dark, ti2.logo_light) AS logo FROM team_iterations ti2
            WHERE ti2.team_id = t.id ORDER BY ti2.recorded_at ASC LIMIT 1)
          LIMIT 1
        ) ti ON true
        WHERE sagt.season_id = ${seasonId} AND sagt.alignment_group_id = ${groupId}
        ORDER BY ti.name
      `;
      return res.json({ season_id: seasonId, group_id: groupId, teams });
    }

    const groupRows = await sql`SELECT id, league_id FROM groups WHERE id = ${groupId}`;
    if (groupRows.length === 0) return res.status(404).json({ error: 'Group not found' });
    if (seasonLeagueId !== groupRows[0].league_id) {
      return res.status(400).json({ error: 'Season and group must belong to the same league' });
    }

    await sql`DELETE FROM season_group_teams WHERE season_id = ${seasonId} AND group_id = ${groupId}`;
    for (const team_id of team_ids) {
      await sql`
        INSERT INTO season_group_teams (season_id, group_id, team_id)
        VALUES (${seasonId}, ${groupId}, ${team_id})
        ON CONFLICT DO NOTHING
      `;
    }

    const teams = await sql`
      SELECT t.id, ti.name, ti.place_name, ti.team_name, ti.code, ti.logo, t.primary_color, t.text_color
      FROM season_group_teams sgt
      JOIN teams t ON t.id = sgt.team_id
      LEFT JOIN LATERAL (
        (SELECT ti2.name, ti2.place_name, ti2.team_name, ti2.code, team_logo_default(ti2.logo_dark, ti2.logo_light) AS logo FROM team_iterations ti2
          LEFT JOIN seasons ss ON ss.id = ti2.start_season_id
          LEFT JOIN seasons ls ON ls.id = ti2.latest_season_id
          WHERE ti2.team_id = t.id
            AND (ti2.start_season_id  IS NULL OR ss.start_date <= ${seasonStartDate}::date)
            AND (ti2.latest_season_id IS NULL OR ls.start_date >= ${seasonStartDate}::date)
          ORDER BY ss.start_date DESC NULLS LAST, ti2.recorded_at DESC
          LIMIT 1)
        UNION ALL
        (SELECT ti2.name, ti2.place_name, ti2.team_name, ti2.code, team_logo_default(ti2.logo_dark, ti2.logo_light) AS logo FROM team_iterations ti2
          WHERE ti2.team_id = t.id ORDER BY ti2.recorded_at ASC LIMIT 1)
        LIMIT 1
      ) ti ON true
      WHERE sgt.season_id = ${seasonId} AND sgt.group_id = ${groupId}
      ORDER BY ti.name
    `;
    return res.json({ season_id: seasonId, group_id: groupId, teams });
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'One or more teams not found' });
    console.error('season group teams update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/seasons/:seasonId/groups/:groupId/teams
// Remove the season override — group reverts to its default team list.
// ---------------------------------------------------------------------------
router.delete('/:seasonId/groups/:groupId/teams', async (req, res) => {
  const { seasonId, groupId } = req.params;
  try {
    const seasonRows = await sql`
      SELECT group_alignment_set_id FROM seasons WHERE id = ${seasonId}
    `;
    if (seasonRows.length === 0) return res.status(404).json({ error: 'Season not found' });

    if (seasonRows[0].group_alignment_set_id) {
      await sql`
        DELETE FROM season_alignment_group_teams
        WHERE season_id = ${seasonId} AND alignment_group_id = ${groupId}
      `;
      return res.json({
        message: 'Season override removed; group reverts to alignment defaults',
      });
    }

    await sql`
      DELETE FROM season_group_teams WHERE season_id = ${seasonId} AND group_id = ${groupId}
    `;
    return res.json({
      message: 'Season override removed; group reverts to defaults',
    });
  } catch (err) {
    console.error('season group teams reset error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/seasons/:id/stats  – aggregate player stats for a season
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// GET /api/admin/seasons/:id/standings
// Returns per-team standings (GP, W, L, OTL, PTS) for regular-season games.
// Points are awarded according to the league's scoring_system:
//   '2-1-0'   → Win=2, OTL=1, Loss=0
//   '3-2-1-0' → Reg Win=3, OT/SO Win=2, OT/SO Loss=1, Reg Loss=0
// ---------------------------------------------------------------------------
router.get('/:id/standings', async (req, res) => {
  const { id } = req.params;
  try {
    const standings = await sql`
      WITH season_info AS (
        SELECT
          l.id AS league_id,
          COALESCE(s.scoring_system, l.scoring_system) AS scoring_system,
          s.games_per_season,
          s.group_alignment_set_id
        FROM seasons s
        JOIN leagues l ON l.id = s.league_id
        WHERE s.id = ${id}
      ),
      alignment_info AS (
        SELECT gas.id, gas.structure_type
        FROM group_alignment_sets gas
        WHERE gas.id = (SELECT group_alignment_set_id FROM season_info)
      ),
      alignment_group_overrides AS (
        SELECT DISTINCT alignment_group_id
        FROM season_alignment_group_teams
        WHERE season_id = ${id}
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
        WHERE sagt.season_id = ${id}
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
        WHERE season_id = ${id}
          AND (SELECT group_alignment_set_id FROM season_info) IS NULL

        UNION

        SELECT team_id
        FROM season_group_teams
        WHERE season_id = ${id}
          AND (SELECT group_alignment_set_id FROM season_info) IS NULL

        UNION

        SELECT gt.team_id
        FROM group_teams gt
        JOIN groups gr ON gr.id = gt.group_id
        WHERE (SELECT group_alignment_set_id FROM season_info) IS NULL
          AND (
            gr.season_id = ${id}
            OR (
                gr.league_id = (SELECT league_id FROM season_info)
            AND gr.season_id IS NULL
            AND COALESCE(gr.is_auto, false) = false
            )
           )

        UNION

        SELECT home_team_id
        FROM games
        WHERE season_id = ${id}
          AND (SELECT group_alignment_set_id FROM season_info) IS NULL

        UNION

        SELECT away_team_id
        FROM games
        WHERE season_id = ${id}
          AND (SELECT group_alignment_set_id FROM season_info) IS NULL
      ),
      aggregated AS (
        SELECT
          gts.team_id,
          COUNT(*)::int AS gp,
          SUM(CASE WHEN gts.won THEN 1 ELSE 0 END)::int AS wins,
          SUM(CASE WHEN gts.reg_win THEN 1 ELSE 0 END)::int AS reg_wins,
          SUM(CASE WHEN gts.ot_win THEN 1 ELSE 0 END)::int AS ot_wins,
          SUM(CASE WHEN gts.otl THEN 1 ELSE 0 END)::int AS otl,
          SUM(CASE WHEN gts.reg_loss THEN 1 ELSE 0 END)::int AS losses,
          SUM(gts.goals_for)::int AS goals_for,
          SUM(gts.goals_against)::int AS goals_against
        FROM game_team_stats gts
        WHERE gts.season_id = ${id}
          AND gts.game_type = 'regular'
          AND gts.team_id IN (SELECT team_id FROM participant_teams)
          AND gts.opponent_team_id IN (SELECT team_id FROM participant_teams)
          AND (gts.won OR gts.lost)
        GROUP BY gts.team_id
      )
      SELECT
        t.id                               AS team_id,
        ti.name                            AS team_name,
        ti.code                            AS team_code,
        ti.logo                            AS team_logo,
        ti.logo_dark                       AS team_logo_dark,
        ti.logo_light                      AS team_logo_light,
        t.primary_color                    AS team_primary_color,
        t.text_color                       AS team_text_color,
        COALESCE(a.gp, 0)::int             AS gp,
        COALESCE(a.wins, 0)::int           AS wins,
        COALESCE(a.reg_wins, 0)::int       AS reg_wins,
        COALESCE(a.ot_wins, 0)::int        AS ot_wins,
        COALESCE(a.losses, 0)::int         AS losses,
        COALESCE(a.otl, 0)::int            AS otl,
        CASE (SELECT scoring_system FROM season_info)
          WHEN '3-2-1-0' THEN (COALESCE(a.reg_wins, 0) * 3 + COALESCE(a.ot_wins, 0) * 2 + COALESCE(a.otl, 0))
          ELSE                 (COALESCE(a.wins, 0) * 2 + COALESCE(a.otl, 0))
        END::int                           AS points,
        CASE WHEN (SELECT games_per_season FROM season_info) IS NOT NULL
          THEN GREATEST(0, (SELECT games_per_season FROM season_info) - COALESCE(a.gp, 0))
          ELSE NULL
        END::int                           AS games_remaining,
        COALESCE(a.goals_for, 0)::int      AS goals_for,
        COALESCE(a.goals_against, 0)::int  AS goals_against,
        (COALESCE(a.goals_for, 0) - COALESCE(a.goals_against, 0))::int AS goal_diff
      FROM participant_teams pt
      JOIN teams t ON t.id = pt.team_id
      LEFT JOIN aggregated a ON a.team_id = pt.team_id
      LEFT JOIN LATERAL (
        SELECT name, code, team_logo_default(logo_dark, logo_light) AS logo, team_logo_dark(logo_dark, logo_light) AS logo_dark, team_logo_light(logo_dark, logo_light) AS logo_light FROM team_iterations
        WHERE team_id = pt.team_id
        ORDER BY CASE WHEN season_id = ${id} THEN 0 ELSE 1 END,
                 CASE WHEN season_id IS NULL  THEN 0 ELSE 1 END,
                 recorded_at DESC
        LIMIT 1
      ) ti ON true
      ORDER BY points DESC, reg_wins DESC, wins DESC, goal_diff DESC, goals_for DESC, gp ASC, ti.name ASC
    `;
    return res.json(standings);
  } catch (err) {
    console.error('season standings error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/stats', async (req, res) => {
  const { id } = req.params;
  const group = req.query.group;
  const page = Math.max(1, Number.parseInt(req.query.page ?? '1', 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(req.query.page_size ?? '10', 10) || 10),
  );
  const offset = (page - 1) * pageSize;
  const sortKey = String(req.query.sort_key ?? (group === 'goalies' ? 'save_pct' : 'points'));
  const sortDir = String(req.query.sort_dir ?? 'desc') === 'asc' ? 'asc' : 'desc';
  // Which competition the stats are based on. Defaults to the regular season.
  const gameType = req.query.competition === 'playoff' ? 'playoff' : 'regular';

  try {
    if (group === 'forwards' || group === 'defense') {
      const positions = group === 'forwards' ? ['C', 'LW', 'RW'] : ['D', 'LD', 'RD'];
      const rows = await sql`
        WITH stat_agg AS (
          SELECT
            gps.player_id,
            COUNT(*)::int AS gp,
            SUM(gps.goals)::int AS goals,
            SUM(gps.assists)::int AS assists,
            SUM(gps.points)::int AS points
          FROM game_player_stats gps
          WHERE gps.season_id = ${id}
            AND gps.game_type = ${gameType}
            AND gps.is_goalie = false
          GROUP BY gps.player_id
        ),
        player_team AS (
          SELECT DISTINCT ON (pt.player_id)
            pt.player_id, pt.team_id, pt.jersey_number, pt.photo
          FROM player_teams pt
          WHERE pt.season_id = ${id}
          ORDER BY pt.player_id, pt.end_date DESC NULLS FIRST
        ),
        stats AS (
          SELECT
            p.id                                          AS player_id,
            p.first_name,
            p.last_name,
            COALESCE(
              NULLIF(ptr.photo, ''),
              best_player_photo(p.id, ${id}, ptr.team_id),
              NULLIF(p.photo, '')
            )                                             AS photo,
            p.position,
            ptr.jersey_number,
            ptr.team_id,
            ti.code                                       AS team_code,
            ti.name                                       AS team_name,
            ti.logo                                       AS team_logo,
            ti.logo_dark                                  AS team_logo_dark,
            ti.logo_light                                 AS team_logo_light,
            t.primary_color                               AS team_primary_color,
            t.text_color                                  AS team_text_color,
            agg.gp,
            agg.goals,
            agg.assists,
            agg.points
          FROM stat_agg agg
          JOIN players  p   ON p.id   = agg.player_id
          LEFT JOIN player_team        ptr ON ptr.player_id = p.id
          LEFT JOIN teams              t   ON t.id          = ptr.team_id
          LEFT JOIN LATERAL (
            SELECT name, code, team_logo_default(logo_dark, logo_light) AS logo, team_logo_dark(logo_dark, logo_light) AS logo_dark, team_logo_light(logo_dark, logo_light) AS logo_light FROM team_iterations
            WHERE team_id = ptr.team_id
            ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
            LIMIT 1
          ) ti ON true
          WHERE p.position = ANY(${positions})
        )
        SELECT stats.*, COUNT(*) OVER()::int AS total
        FROM stats
        ORDER BY
          CASE WHEN ${sortKey} = 'last_name' AND ${sortDir} = 'asc' THEN last_name END ASC NULLS LAST,
          CASE WHEN ${sortKey} = 'last_name' AND ${sortDir} = 'desc' THEN last_name END DESC NULLS LAST,
          CASE WHEN ${sortKey} = 'gp' AND ${sortDir} = 'asc' THEN gp END ASC NULLS LAST,
          CASE WHEN ${sortKey} = 'gp' AND ${sortDir} = 'desc' THEN gp END DESC NULLS LAST,
          CASE WHEN ${sortKey} = 'goals' AND ${sortDir} = 'asc' THEN goals END ASC NULLS LAST,
          CASE WHEN ${sortKey} = 'goals' AND ${sortDir} = 'desc' THEN goals END DESC NULLS LAST,
          CASE WHEN ${sortKey} = 'assists' AND ${sortDir} = 'asc' THEN assists END ASC NULLS LAST,
          CASE WHEN ${sortKey} = 'assists' AND ${sortDir} = 'desc' THEN assists END DESC NULLS LAST,
          CASE WHEN ${sortKey} = 'points' AND ${sortDir} = 'asc' THEN points END ASC NULLS LAST,
          CASE WHEN ${sortKey} = 'points' AND ${sortDir} = 'desc' THEN points END DESC NULLS LAST,
          points DESC, goals DESC, assists DESC, gp DESC, last_name ASC, first_name ASC
        LIMIT ${pageSize} OFFSET ${offset}
      `;
      const total = rows[0]?.total ?? 0;
      const items = rows.map(({ total: _total, ...row }) => row);
      return res.json({ items, total, page, page_size: pageSize });
    }

    if (group === 'goalies') {
      const rows = await sql`
        WITH season_info AS (
          SELECT
            s.goalie_min_regular_minutes,
            l.goalie_min_regular_minutes AS league_goalie_min_regular_minutes
          FROM seasons s
          JOIN leagues l ON l.id = s.league_id
          WHERE s.id = ${id}
        ),
        player_team AS (
          SELECT DISTINCT ON (pt.player_id)
            pt.player_id, pt.team_id, pt.jersey_number, pt.photo
          FROM player_teams pt
          WHERE pt.season_id = ${id}
          ORDER BY pt.player_id, pt.end_date DESC NULLS FIRST
        ),
        goalie_game_agg AS (
          SELECT
            gps.player_id AS goalie_id,
            gps.team_id,
            COUNT(*)::int AS gp,
            SUM(gps.shots_against)::int AS shots_against,
            SUM(gps.goals_against)::int AS goals_against,
            SUM(gps.saves)::int AS saves,
            SUM(gps.time_on_ice)::int AS toi,
            SUM(CASE WHEN gps.shutout THEN 1 ELSE 0 END)::int AS shutouts
          FROM game_player_stats gps
          WHERE gps.season_id = ${id}
            AND gps.game_type = ${gameType}
            AND gps.is_goalie = true
          GROUP BY gps.player_id, gps.team_id
        ),
        stats AS (
          SELECT
            p.id                                                   AS player_id,
            p.first_name,
            p.last_name,
            COALESCE(
              NULLIF(ptr.photo, ''),
              best_player_photo(p.id, ${id}, agg.team_id),
              NULLIF(p.photo, '')
            )                                                      AS photo,
            ptr.jersey_number,
            agg.team_id                                            AS team_id,
            ti.code                                                AS team_code,
            ti.name                                                AS team_name,
            ti.logo                                                AS team_logo,
            ti.logo_dark                                           AS team_logo_dark,
            ti.logo_light                                          AS team_logo_light,
            t.primary_color                                        AS team_primary_color,
            t.text_color                                           AS team_text_color,
            agg.gp,
            agg.shots_against,
            agg.saves,
            agg.goals_against,
            agg.toi                                                AS time_on_ice,
            CASE WHEN agg.shots_against > 0
              THEN ROUND(agg.saves::numeric / agg.shots_against, 3)
              ELSE NULL END                                        AS save_pct,
            agg.shutouts,
            CASE WHEN agg.toi > 0
              THEN ROUND(agg.goals_against::numeric * 3600 / agg.toi, 2)
              ELSE NULL END                                        AS gaa
          FROM goalie_game_agg agg
          JOIN players p    ON p.id  = agg.goalie_id
          LEFT JOIN player_team ptr ON ptr.player_id = agg.goalie_id
          LEFT JOIN teams       t   ON t.id          = agg.team_id
          LEFT JOIN LATERAL (
            SELECT name, code, team_logo_default(logo_dark, logo_light) AS logo, team_logo_dark(logo_dark, logo_light) AS logo_dark, team_logo_light(logo_dark, logo_light) AS logo_light FROM team_iterations
            WHERE team_id = agg.team_id
            ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
            LIMIT 1
          ) ti ON true
        )
        SELECT stats.*, COUNT(*) OVER()::int AS total
        FROM stats
        WHERE ${gameType} != 'regular'
           OR COALESCE(
                (SELECT goalie_min_regular_minutes FROM season_info),
                (SELECT league_goalie_min_regular_minutes FROM season_info)
              ) <= 0
           OR time_on_ice >= COALESCE(
                (SELECT goalie_min_regular_minutes FROM season_info),
                (SELECT league_goalie_min_regular_minutes FROM season_info)
              ) * 60
        ORDER BY
          CASE WHEN ${sortKey} = 'last_name' AND ${sortDir} = 'asc' THEN last_name END ASC NULLS LAST,
          CASE WHEN ${sortKey} = 'last_name' AND ${sortDir} = 'desc' THEN last_name END DESC NULLS LAST,
          CASE WHEN ${sortKey} = 'gp' AND ${sortDir} = 'asc' THEN gp END ASC NULLS LAST,
          CASE WHEN ${sortKey} = 'gp' AND ${sortDir} = 'desc' THEN gp END DESC NULLS LAST,
          CASE WHEN ${sortKey} = 'shots_against' AND ${sortDir} = 'asc' THEN shots_against END ASC NULLS LAST,
          CASE WHEN ${sortKey} = 'shots_against' AND ${sortDir} = 'desc' THEN shots_against END DESC NULLS LAST,
          CASE WHEN ${sortKey} = 'saves' AND ${sortDir} = 'asc' THEN saves END ASC NULLS LAST,
          CASE WHEN ${sortKey} = 'saves' AND ${sortDir} = 'desc' THEN saves END DESC NULLS LAST,
          CASE WHEN ${sortKey} = 'goals_against' AND ${sortDir} = 'asc' THEN goals_against END ASC NULLS LAST,
          CASE WHEN ${sortKey} = 'goals_against' AND ${sortDir} = 'desc' THEN goals_against END DESC NULLS LAST,
          CASE WHEN ${sortKey} = 'time_on_ice' AND ${sortDir} = 'asc' THEN time_on_ice END ASC NULLS LAST,
          CASE WHEN ${sortKey} = 'time_on_ice' AND ${sortDir} = 'desc' THEN time_on_ice END DESC NULLS LAST,
          CASE WHEN ${sortKey} = 'save_pct' AND ${sortDir} = 'asc' THEN save_pct END ASC NULLS LAST,
          CASE WHEN ${sortKey} = 'save_pct' AND ${sortDir} = 'desc' THEN save_pct END DESC NULLS LAST,
          CASE WHEN ${sortKey} = 'gaa' AND ${sortDir} = 'asc' THEN gaa END ASC NULLS LAST,
          CASE WHEN ${sortKey} = 'gaa' AND ${sortDir} = 'desc' THEN gaa END DESC NULLS LAST,
          CASE WHEN ${sortKey} = 'shutouts' AND ${sortDir} = 'asc' THEN shutouts END ASC NULLS LAST,
          CASE WHEN ${sortKey} = 'shutouts' AND ${sortDir} = 'desc' THEN shutouts END DESC NULLS LAST,
          save_pct DESC NULLS LAST, saves DESC, last_name ASC, first_name ASC
        LIMIT ${pageSize} OFFSET ${offset}
      `;
      const total = rows[0]?.total ?? 0;
      const items = rows.map(({ total: _total, ...row }) => row);
      return res.json({ items, total, page, page_size: pageSize });
    }

    const skaters = await sql`
      WITH stat_agg AS (
        SELECT
          gps.player_id,
          COUNT(*)::int AS gp,
          SUM(gps.goals)::int AS goals,
          SUM(gps.assists)::int AS assists,
          SUM(gps.points)::int AS points
        FROM game_player_stats gps
        WHERE gps.season_id = ${id}
          AND gps.game_type = ${gameType}
          AND gps.is_goalie = false
        GROUP BY gps.player_id
      ),
      player_team AS (
        SELECT DISTINCT ON (pt.player_id)
          pt.player_id, pt.team_id, pt.jersey_number, pt.photo, pt.created_at
        FROM player_teams pt
        WHERE pt.season_id = ${id}
        ORDER BY pt.player_id, pt.end_date DESC NULLS FIRST
      )
      SELECT
        p.id                                          AS player_id,
        p.first_name,
        p.last_name,
        COALESCE(
          NULLIF(ptr.photo, ''),
          best_player_photo(p.id, ${id}, ptr.team_id),
          NULLIF(p.photo, '')
        )                                             AS photo,
        p.position,
        ptr.jersey_number,
        ptr.team_id,
        ptr.created_at                                AS team_stint_created,
        ti.code                                       AS team_code,
        ti.name                                       AS team_name,
        ti.logo                                       AS team_logo,
        ti.logo_dark                                  AS team_logo_dark,
        ti.logo_light                                 AS team_logo_light,
        t.primary_color                               AS team_primary_color,
        t.text_color                                  AS team_text_color,
        agg.gp,
        agg.goals,
        agg.assists,
        agg.points
      FROM stat_agg agg
      JOIN players  p   ON p.id   = agg.player_id
      LEFT JOIN player_team        ptr ON ptr.player_id = p.id
      LEFT JOIN teams              t   ON t.id          = ptr.team_id
      LEFT JOIN LATERAL (
        SELECT name, code, team_logo_default(logo_dark, logo_light) AS logo, team_logo_dark(logo_dark, logo_light) AS logo_dark, team_logo_light(logo_dark, logo_light) AS logo_light FROM team_iterations
        WHERE team_id = ptr.team_id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) ti ON true
      WHERE p.position != 'G'
      ORDER BY points DESC, goals DESC, assists DESC, gp DESC
    `;

    const goalies = await sql`
      WITH period_vals (p, v) AS (
        VALUES ('1',1),('2',2),('3',3),('OT',4),('SO',5)
      ),
      season_info AS (
        SELECT
          s.goalie_min_regular_minutes,
          l.goalie_min_regular_minutes AS league_goalie_min_regular_minutes
        FROM seasons s
        JOIN leagues l ON l.id = s.league_id
        WHERE s.id = ${id}
      ),
      player_team AS (
        SELECT DISTINCT ON (pt.player_id)
          pt.player_id, pt.team_id, pt.jersey_number, pt.photo, pt.created_at
        FROM player_teams pt
        WHERE pt.season_id = ${id}
        ORDER BY pt.player_id, pt.end_date DESC NULLS FIRST
      ),
      -- Per-stint GA: count goals against each goalie during their active window.
      -- Reads from game_goalie_stints using precise (period, time) position windows,
      -- matching the same attribution logic used by the per-game goalie stints query.
      stint_ranges AS (
        SELECT
          st.id, st.game_id, g.season_id, g.scheduled_at, st.team_id, st.goalie_id, st.stint_ord,
          st.shots_against,
          st.goals_against AS goals_against_override,
          st.exited_period,
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
          st.time_on_ice,
          -- Real elapsed game time (seconds) the stint started, for time-on-ice.
          CASE st.entered_period WHEN '1' THEN 0 WHEN '2' THEN 1200 WHEN '3' THEN 2400 WHEN 'OT' THEN 3600 ELSE 6000 END
            + COALESCE(SPLIT_PART(st.entered_time, ':', 1)::int * 60 + SPLIT_PART(st.entered_time, ':', 2)::int, 0) AS start_abs,
          CASE
            WHEN st.exited_period IS NULL THEN NULL
            ELSE CASE st.exited_period WHEN '1' THEN 0 WHEN '2' THEN 1200 WHEN '3' THEN 2400 WHEN 'OT' THEN 3600 ELSE 6000 END
              + COALESCE(SPLIT_PART(st.exited_time, ':', 1)::int * 60 + SPLIT_PART(st.exited_time, ':', 2)::int, 0)
          END AS exited_abs,
          -- Game end (seconds): regulation 3600, + OT length (OT-goal time, or full 300 on a shootout).
          CASE
            WHEN g.shootout THEN 3900
            WHEN EXISTS (SELECT 1 FROM goals og WHERE og.game_id = g.id AND og.period = 'OT')
              THEN 3600 + COALESCE((
                SELECT MAX(SPLIT_PART(og.period_time, ':', 1)::int * 60 + SPLIT_PART(og.period_time, ':', 2)::int)
                FROM goals og WHERE og.game_id = g.id AND og.period = 'OT'), 0)
            ELSE 3600
          END AS game_end_abs
        FROM game_goalie_stints st
        JOIN games g ON g.id = st.game_id AND g.season_id = ${id} AND g.status = 'final' AND g.game_type = ${gameType}
        JOIN      period_vals pv_in  ON pv_in.p  = st.entered_period
        LEFT JOIN period_vals pv_out ON pv_out.p = st.exited_period
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
        JOIN goals gl
          ON gl.game_id   = sr.game_id
         AND gl.team_id  != sr.team_id
         AND gl.empty_net = false
        JOIN period_vals pv ON pv.p = gl.period
        LEFT JOIN LATERAL (
          SELECT true AS is_own_goal
          FROM player_teams pt
          WHERE pt.player_id = gl.scorer_id
            AND pt.team_id = sr.team_id
            AND pt.season_id = sr.season_id
            AND (pt.start_date IS NULL OR pt.start_date <= COALESCE(sr.scheduled_at::date, CURRENT_DATE))
            AND (pt.end_date IS NULL OR pt.end_date >= COALESCE(sr.scheduled_at::date, CURRENT_DATE))
          LIMIT 1
        ) own_goal ON true
        WHERE (pv.v * 100000
               + COALESCE(
                   SPLIT_PART(gl.period_time, ':', 1)::int * 60
                   + SPLIT_PART(gl.period_time, ':', 2)::int,
                   0
                 )) >= sr.from_pos
          AND (sr.until_pos IS NULL
               OR (pv.v * 100000
                   + COALESCE(
                       SPLIT_PART(gl.period_time, ':', 1)::int * 60
                       + SPLIT_PART(gl.period_time, ':', 2)::int,
                       0
                     )) < sr.until_pos)
        GROUP BY sr.id
      ),
      stints_resolved AS (
        SELECT
          sr.*,
          COALESCE(sr.goals_against_override, sgd.ga, 0)::int AS resolved_ga,
          CASE
            WHEN sr.goals_against_override IS NULL
              THEN COALESCE(sgd.save_ga, 0)::int
            ELSE GREATEST(sr.goals_against_override - COALESCE(sgd.own_goal_ga, 0), 0)::int
          END AS resolved_save_ga,
          COALESCE(sr.time_on_ice, GREATEST(COALESCE(sr.exited_abs, sr.game_end_abs) - sr.start_abs, 0))::int AS toi
        FROM stint_ranges sr
        LEFT JOIN stint_ga_derived sgd ON sgd.stint_id = sr.id
      ),
      -- Per-game aggregation per goalie/team (one row per game per goalie)
      goalie_game AS (
        SELECT
          game_id, goalie_id, team_id,
          MIN(from_pos)           AS first_from_pos,
          SUM(shots_against)::int AS shots_against,
          SUM(resolved_ga)::int   AS goals_against,
          SUM(resolved_save_ga)::int AS save_goals_against,
          SUM(toi)::int           AS toi
        FROM stints_resolved
        GROUP BY game_id, goalie_id, team_id
      ),
      -- Last goalie in net per team per game (highest stint_ord = never replaced)
      team_game_last_goalie AS (
        SELECT DISTINCT ON (game_id, team_id)
          game_id, team_id, goalie_id
        FROM stints_resolved
        ORDER BY game_id, team_id, stint_ord DESC
      ),
      goalie_game_agg AS (
        SELECT
          gps.player_id AS goalie_id,
          gps.team_id,
          COUNT(*)::int AS gp,
          SUM(gps.shots_against)::int AS shots_against,
          SUM(gps.goals_against)::int AS goals_against,
          SUM(gps.saves)::int AS saves,
          SUM(gps.time_on_ice)::int AS toi,
          -- Shutout: goalie started at game start (period 1, 0:00 → from_pos = 100000),
          -- was never replaced (last goalie for the team in that game),
          -- faced at least one shot, and allowed zero goals.
          SUM(CASE WHEN gps.shutout THEN 1 ELSE 0 END)::int AS shutouts
        FROM game_player_stats gps
        WHERE gps.season_id = ${id}
          AND gps.game_type = ${gameType}
          AND gps.is_goalie = true
        GROUP BY gps.player_id, gps.team_id
      )
      SELECT
        p.id                                                   AS player_id,
        p.first_name,
        p.last_name,
        COALESCE(
          NULLIF(ptr.photo, ''),
          best_player_photo(p.id, ${id}, agg.team_id),
          NULLIF(p.photo, '')
        )                                                      AS photo,
        ptr.jersey_number,
        ptr.created_at                                         AS team_stint_created,
        agg.team_id                                            AS team_id,
        ti.code                                                AS team_code,
        ti.name                                                AS team_name,
        ti.logo                                                AS team_logo,
        ti.logo_dark                                           AS team_logo_dark,
        ti.logo_light                                          AS team_logo_light,
        t.primary_color                                        AS team_primary_color,
        t.text_color                                           AS team_text_color,
        agg.gp,
        agg.shots_against,
        agg.saves,
        agg.goals_against,
        agg.toi                                                 AS time_on_ice,
        CASE WHEN agg.shots_against > 0
          THEN ROUND(agg.saves::numeric / agg.shots_against, 3)
          ELSE NULL END                                        AS save_pct,
        agg.shutouts,
        CASE WHEN agg.toi > 0
          THEN ROUND(agg.goals_against::numeric * 3600 / agg.toi, 2)
          ELSE NULL END                                        AS gaa
      FROM goalie_game_agg agg
      JOIN players p    ON p.id  = agg.goalie_id
      LEFT JOIN player_team ptr ON ptr.player_id = agg.goalie_id
      LEFT JOIN teams       t   ON t.id          = agg.team_id
      LEFT JOIN LATERAL (
        SELECT name, code, team_logo_default(logo_dark, logo_light) AS logo, team_logo_dark(logo_dark, logo_light) AS logo_dark, team_logo_light(logo_dark, logo_light) AS logo_light FROM team_iterations
        WHERE team_id = agg.team_id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) ti ON true
      WHERE ${gameType} != 'regular'
         OR COALESCE(
              (SELECT goalie_min_regular_minutes FROM season_info),
              (SELECT league_goalie_min_regular_minutes FROM season_info)
            ) <= 0
         OR agg.toi >= COALESCE(
              (SELECT goalie_min_regular_minutes FROM season_info),
              (SELECT league_goalie_min_regular_minutes FROM season_info)
            ) * 60
      ORDER BY save_pct DESC NULLS LAST, agg.saves DESC
    `;

    return res.json({ skaters, goalies });
  } catch (err) {
    console.error('season stats error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/seasons/:id/awards
// League-scoped award definitions with season-specific nominees/winners.
// ---------------------------------------------------------------------------
router.get('/:id/awards', async (req, res) => {
  const { id } = req.params;
  try {
    const awards = await sql`
      SELECT
        la.id AS award_id,
        la.league_id,
        la.name,
        la.description,
        la.recipient_type,
        la.selection_method,
        la.competition_scope,
        la.stat_key,
        la.awarded_after_playoffs,
        la.uses_nominees,
        la.allow_multiple_winners,
        la.uses_team_selection,
        la.player_eligibility,
        la.team_eligibility,
        la.sort_order,
        sa.id AS season_award_id,
        sa.awarded_at::text AS awarded_at,
        sa.notes AS season_notes
      FROM seasons s
      JOIN league_awards la ON la.league_id = s.league_id
      LEFT JOIN season_awards sa ON sa.award_id = la.id AND sa.season_id = s.id
      WHERE s.id = ${id}
        AND la.active = true
      ORDER BY la.sort_order ASC, la.name ASC
    `;

    const recipients = await sql`
      SELECT
        sar.id,
        sar.season_award_id,
        sar.recipient_type,
        sar.player_id,
        sar.team_id,
        sar.role,
        sar.rank,
        sar.vote_points,
        sar.stat_value,
        sar.notes,
        p.first_name,
        p.last_name,
        COALESCE(
          NULLIF(ptr.photo, ''),
          best_player_photo(p.id, ${id}, ptr.team_id),
          NULLIF(p.photo, '')
        ) AS player_photo,
        COALESCE(ptr.position, p.position) AS position,
        ptr.jersey_number,
        ti.name AS team_name,
        ti.code AS team_code,
        ti.logo AS team_logo,
        ti.logo_dark AS team_logo_dark,
        ti.logo_light AS team_logo_light,
        t.primary_color AS team_primary_color,
        t.text_color AS team_text_color
      FROM season_award_recipients sar
      JOIN season_awards sa ON sa.id = sar.season_award_id
      LEFT JOIN players p ON p.id = sar.player_id
      LEFT JOIN LATERAL (
        SELECT player_id, team_id, jersey_number, photo, position
        FROM player_teams
        WHERE player_id = sar.player_id AND season_id = ${id}
        ORDER BY end_date DESC NULLS FIRST, start_date DESC NULLS LAST, created_at DESC
        LIMIT 1
      ) ptr ON true
      LEFT JOIN teams t ON t.id = COALESCE(sar.team_id, ptr.team_id)
      LEFT JOIN LATERAL (
        SELECT name, code, team_logo_default(logo_dark, logo_light) AS logo, team_logo_dark(logo_dark, logo_light) AS logo_dark, team_logo_light(logo_dark, logo_light) AS logo_light FROM team_iterations
        WHERE team_id = t.id
        ORDER BY CASE WHEN end_date IS NULL THEN 0 ELSE 1 END, start_date DESC NULLS LAST, recorded_at DESC
        LIMIT 1
      ) ti ON true
      WHERE sa.season_id = ${id}
      ORDER BY
        CASE sar.role WHEN 'winner' THEN 0 ELSE 1 END,
        sar.rank ASC NULLS LAST,
        sar.vote_points DESC NULLS LAST,
        p.last_name ASC NULLS LAST,
        ti.name ASC NULLS LAST
    `;

    const bySeasonAward = new Map();
    for (const row of recipients) {
      const list = bySeasonAward.get(row.season_award_id) ?? [];
      list.push({
        id: row.id,
        recipient_type: row.recipient_type,
        player_id: row.player_id,
        team_id: row.team_id,
        role: row.role,
        rank: row.rank,
        vote_points: row.vote_points,
        stat_value: row.stat_value,
        notes: row.notes,
        player_name: row.player_id
          ? [row.first_name, row.last_name].filter(Boolean).join(' ')
          : null,
        player_photo: row.player_photo,
        position: row.position,
        jersey_number: row.jersey_number,
        team_name: row.team_name,
        team_code: row.team_code,
        team_logo: row.team_logo,
        team_logo_dark: row.team_logo_dark,
        team_logo_light: row.team_logo_light,
        team_primary_color: row.team_primary_color,
        team_text_color: row.team_text_color,
      });
      bySeasonAward.set(row.season_award_id, list);
    }

    return res.json(
      awards.map((award) => ({
        ...award,
        recipients: award.season_award_id ? (bySeasonAward.get(award.season_award_id) ?? []) : [],
      })),
    );
  } catch (err) {
    console.error('season awards list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/seasons/:id/awards
// Attach an existing league award definition to this season.
// ---------------------------------------------------------------------------
router.post('/:id/awards', async (req, res) => {
  const { id } = req.params;
  const { award_id, awarded_at, notes } = req.body;

  if (!award_id) {
    return res.status(400).json({ error: 'award_id is required' });
  }

  try {
    const seasons = await sql`SELECT id, league_id FROM seasons WHERE id = ${id}`;
    if (seasons.length === 0) return res.status(404).json({ error: 'Season not found' });
    const leagueId = seasons[0].league_id;

    const existingAwards = await sql`
      SELECT id FROM league_awards
      WHERE id = ${award_id} AND league_id = ${leagueId} AND active = true
    `;
    if (existingAwards.length === 0) {
      return res.status(400).json({ error: 'award_id does not belong to this league' });
    }

    const seasonAward = await sql`
      INSERT INTO season_awards (season_id, award_id, awarded_at, notes)
      VALUES (${id}, ${award_id}, ${awarded_at || null}::date, ${notes?.trim() || null})
      ON CONFLICT (season_id, award_id) DO UPDATE SET
        awarded_at = COALESCE(EXCLUDED.awarded_at, season_awards.awarded_at),
        notes = COALESCE(EXCLUDED.notes, season_awards.notes)
      RETURNING id
    `;

    return res.status(201).json({ season_award_id: seasonAward[0].id, award_id });
  } catch (err) {
    console.error('season award create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id/awards/:seasonAwardId', async (req, res) => {
  const { id, seasonAwardId } = req.params;
  const { awarded_at, notes } = req.body;
  const awardedAtInBody = 'awarded_at' in req.body;
  const notesInBody = 'notes' in req.body;
  try {
    const rows = await sql`
      UPDATE season_awards SET
        awarded_at = CASE WHEN ${awardedAtInBody} THEN ${awarded_at || null}::date ELSE awarded_at END,
        notes = CASE WHEN ${notesInBody} THEN ${notes?.trim() || null} ELSE notes END
      WHERE id = ${seasonAwardId} AND season_id = ${id}
      RETURNING id
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Award not found' });
    return res.json({ id: rows[0].id });
  } catch (err) {
    console.error('season award update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id/awards/:seasonAwardId', async (req, res) => {
  const { id, seasonAwardId } = req.params;
  try {
    const awards = await sql`
      SELECT
        sa.id,
        COUNT(sar.id)::int AS recipient_count
      FROM season_awards sa
      LEFT JOIN season_award_recipients sar ON sar.season_award_id = sa.id
      WHERE sa.id = ${seasonAwardId} AND sa.season_id = ${id}
      GROUP BY sa.id
    `;
    if (awards.length === 0) return res.status(404).json({ error: 'Award not found' });
    if (awards[0].recipient_count > 0) {
      return res.status(409).json({
        error: 'Remove nominees and winners before removing this award from the season',
      });
    }

    await sql`
      DELETE FROM season_awards
      WHERE id = ${seasonAwardId} AND season_id = ${id}
    `;
    return res.status(204).send();
  } catch (err) {
    console.error('season award delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/awards/:seasonAwardId/recipients', async (req, res) => {
  const { id, seasonAwardId } = req.params;
  const {
    recipient_type,
    player_id,
    team_id,
    role = 'nominee',
    rank,
    vote_points,
    stat_value,
    notes,
  } = req.body;

  if (!['player', 'team'].includes(recipient_type)) {
    return res.status(400).json({ error: 'recipient_type must be player or team' });
  }
  if (!['nominee', 'winner'].includes(role)) {
    return res.status(400).json({ error: 'role must be nominee or winner' });
  }
  if (recipient_type === 'player' && !player_id) {
    return res.status(400).json({ error: 'player_id is required' });
  }
  if (recipient_type === 'team' && !team_id) {
    return res.status(400).json({ error: 'team_id is required' });
  }

  try {
    const rankValue = rank === undefined || rank === null || rank === '' ? null : Number(rank);
    const votePointsValue =
      vote_points === undefined || vote_points === null || vote_points === ''
        ? null
        : Number(vote_points);

    if (rankValue !== null && !Number.isFinite(rankValue)) {
      return res.status(400).json({ error: 'rank must be a number' });
    }
    if (votePointsValue !== null && !Number.isFinite(votePointsValue)) {
      return res.status(400).json({ error: 'vote_points must be a number' });
    }

    const awards = await sql`
      SELECT sa.id, la.recipient_type, la.player_eligibility, la.team_eligibility
      FROM season_awards sa
      JOIN league_awards la ON la.id = sa.award_id
      WHERE sa.id = ${seasonAwardId} AND sa.season_id = ${id}
    `;
    if (awards.length === 0) return res.status(404).json({ error: 'Award not found' });
    if (awards[0].recipient_type !== recipient_type) {
      return res.status(400).json({ error: 'recipient_type does not match award' });
    }
    if (recipient_type === 'player') {
      const eligibility = await validateAwardPlayerEligibility(
        id,
        player_id,
        awards[0].player_eligibility,
      );
      if (!eligibility.ok) {
        return res.status(400).json({ error: eligibility.error });
      }
    } else {
      const eligibility = await validateAwardTeamEligibility(
        id,
        team_id,
        awards[0].team_eligibility,
      );
      if (!eligibility.ok) {
        return res.status(400).json({ error: eligibility.error });
      }
    }

    const rows = await sql`
      INSERT INTO season_award_recipients (
        season_award_id, recipient_type, player_id, team_id, role, rank, vote_points, stat_value, notes
      )
      VALUES (
        ${seasonAwardId},
        ${recipient_type},
        ${recipient_type === 'player' ? player_id : null},
        ${recipient_type === 'team' ? team_id : null},
        ${role},
        ${rankValue},
        ${votePointsValue},
        ${stat_value ?? null},
        ${notes?.trim() || null}
      )
      RETURNING id
    `;
    return res.status(201).json({ id: rows[0].id });
  } catch (err) {
    if (err.code === '23503')
      return res.status(400).json({ error: 'Invalid player, team, or award' });
    console.error('season award recipient create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/awards/:seasonAwardId/nominees', async (req, res) => {
  const { id, seasonAwardId } = req.params;
  const { nominees } = req.body;

  if (!Array.isArray(nominees)) {
    return res.status(400).json({ error: 'nominees must be an array' });
  }

  try {
    const awards = await sql`
      SELECT sa.id, la.recipient_type, la.player_eligibility, la.team_eligibility
      FROM season_awards sa
      JOIN league_awards la ON la.id = sa.award_id
      WHERE sa.id = ${seasonAwardId} AND sa.season_id = ${id}
    `;
    if (awards.length === 0) return res.status(404).json({ error: 'Award not found' });

    const recipientType = awards[0].recipient_type;
    const normalized = [];
    const seenRecipientIds = new Set();

    for (let index = 0; index < nominees.length; index += 1) {
      const nominee = nominees[index] ?? {};
      const payloadType = nominee.recipient_type ?? recipientType;

      if (payloadType !== recipientType) {
        return res.status(400).json({ error: 'recipient_type does not match award' });
      }

      const recipientId = recipientType === 'player' ? nominee.player_id : nominee.team_id;
      if (!recipientId) {
        return res.status(400).json({
          error: recipientType === 'player' ? 'player_id is required' : 'team_id is required',
        });
      }
      if (seenRecipientIds.has(recipientId)) {
        return res.status(400).json({ error: 'nominees must be unique' });
      }
      seenRecipientIds.add(recipientId);

      const votePointsValue =
        nominee.vote_points === undefined || nominee.vote_points === null || nominee.vote_points === ''
          ? null
          : Number(nominee.vote_points);
      if (votePointsValue !== null && !Number.isFinite(votePointsValue)) {
        return res.status(400).json({ error: 'vote_points must be a number' });
      }

      normalized.push({
        player_id: recipientType === 'player' ? nominee.player_id : null,
        team_id: recipientType === 'team' ? nominee.team_id : null,
        rank: index + 1,
        vote_points: votePointsValue,
        stat_value: nominee.stat_value ?? null,
        notes: typeof nominee.notes === 'string' ? nominee.notes.trim() || null : null,
      });
    }

    for (const nominee of normalized) {
      if (recipientType === 'player') {
        const eligibility = await validateAwardPlayerEligibility(
          id,
          nominee.player_id,
          awards[0].player_eligibility,
        );
        if (!eligibility.ok) {
          return res.status(400).json({ error: eligibility.error });
        }
        continue;
      }

      const eligibility = await validateAwardTeamEligibility(
        id,
        nominee.team_id,
        awards[0].team_eligibility,
      );
      if (!eligibility.ok) {
        return res.status(400).json({ error: eligibility.error });
      }
    }

    await sql`
      DELETE FROM season_award_recipients sar
      USING season_awards sa
      WHERE sar.season_award_id = ${seasonAwardId}
        AND sar.role = 'nominee'
        AND sa.id = sar.season_award_id
        AND sa.season_id = ${id}
    `;

    for (const nominee of normalized) {
      await sql`
        INSERT INTO season_award_recipients (
          season_award_id, recipient_type, player_id, team_id, role, rank, vote_points, stat_value, notes
        )
        VALUES (
          ${seasonAwardId},
          ${recipientType},
          ${nominee.player_id},
          ${nominee.team_id},
          'nominee',
          ${nominee.rank},
          ${nominee.vote_points},
          ${nominee.stat_value},
          ${nominee.notes}
        )
      `;
    }

    return res.json({ count: normalized.length });
  } catch (err) {
    if (err.code === '23503')
      return res.status(400).json({ error: 'Invalid player, team, or award' });
    console.error('season award nominees replace error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id/awards/:seasonAwardId/recipients/:recipientId', async (req, res) => {
  const { id, seasonAwardId, recipientId } = req.params;
  try {
    const rows = await sql`
      DELETE FROM season_award_recipients sar
      USING season_awards sa
      WHERE sar.id = ${recipientId}
        AND sar.season_award_id = ${seasonAwardId}
        AND sa.id = sar.season_award_id
        AND sa.season_id = ${id}
      RETURNING sar.id
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Recipient not found' });
    return res.status(204).send();
  } catch (err) {
    console.error('season award recipient delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
