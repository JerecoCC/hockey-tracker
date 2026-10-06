'use strict';

const { sql } = require('../db');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GAME_TYPES = new Set(['preseason', 'regular', 'playoff']);
const RESULT_TYPES = new Set(['regulation', 'overtime', 'shootout']);

const badRequest = (message) => {
  const err = new Error(message);
  err.status = 400;
  return err;
};

const isUuid = (value) => typeof value === 'string' && UUID_RE.test(value);

const toScore = (value, name) => {
  if (value === null || value === undefined || value === '') return null;
  const score = Number(value);
  if (!Number.isInteger(score) || score < 0 || score > 99) {
    throw badRequest(`${name} must be a whole number from 0 to 99`);
  }
  return score;
};

/**
 * Validates a personal game body. With `partial`, only the fields present are checked and
 * returned (for PATCH); otherwise teams, game type and date are required (for POST).
 * Scores are recorded as a pair: both set (a final) or both cleared (not played yet).
 */
function normalizePersonalGameInput(body = {}, { partial = false } = {}) {
  const has = (key) => Object.prototype.hasOwnProperty.call(body, key);
  const out = {};

  if (!partial || has('season_id')) {
    const seasonId = body.season_id || null;
    if (seasonId !== null && !isUuid(seasonId)) throw badRequest('season_id must be a season id');
    out.season_id = seasonId;
  }

  for (const key of ['home_team_id', 'away_team_id']) {
    if (!partial || has(key)) {
      if (!isUuid(body[key])) throw badRequest(`${key} is required`);
      out[key] = body[key];
    }
  }
  if (out.home_team_id && out.away_team_id && out.home_team_id === out.away_team_id) {
    throw badRequest('home_team_id and away_team_id must be different');
  }

  if (!partial || has('game_type')) {
    const gameType = body.game_type ?? 'regular';
    if (!GAME_TYPES.has(gameType)) throw badRequest('game_type must be preseason, regular, or playoff');
    out.game_type = gameType;
  }

  if (!partial || has('scheduled_at')) {
    if (!DATE_RE.test(String(body.scheduled_at ?? ''))) {
      throw badRequest('scheduled_at must be a YYYY-MM-DD date');
    }
    out.scheduled_at = body.scheduled_at;
  }

  if (!partial || has('scheduled_time')) {
    const time = body.scheduled_time || null;
    if (time !== null && !TIME_RE.test(time)) throw badRequest('scheduled_time must be HH:MM');
    out.scheduled_time = time;
  }

  if (!partial || has('home_score') || has('away_score')) {
    const homeScore = toScore(body.home_score, 'home_score');
    const awayScore = toScore(body.away_score, 'away_score');
    if ((homeScore === null) !== (awayScore === null)) {
      throw badRequest('Enter both scores, or neither for a game not played yet');
    }
    out.home_score = homeScore;
    out.away_score = awayScore;
  }

  if (!partial || has('result_type')) {
    const resultType = body.result_type ?? 'regulation';
    if (!RESULT_TYPES.has(resultType)) {
      throw badRequest('result_type must be regulation, overtime, or shootout');
    }
    out.result_type = resultType;
  }

  if (!partial || has('scheduled_for')) {
    const scheduledFor = body.scheduled_for || null;
    if (scheduledFor !== null && !DATE_RE.test(scheduledFor)) {
      throw badRequest('scheduled_for must be a YYYY-MM-DD date');
    }
    out.scheduled_for = scheduledFor;
  }

  // The client's "today", used as the watched date when recording a score marks the game
  // watched (a postponed watch date takes precedence). Not stored on its own.
  if (has('watched_on')) {
    const watchedOn = body.watched_on || null;
    if (watchedOn !== null && !DATE_RE.test(watchedOn)) {
      throw badRequest('watched_on must be a YYYY-MM-DD date');
    }
    out.watched_on = watchedOn;
  }

  return out;
}

/** A tied final can only stand in regulation; overtime and shootouts have a winner. */
function assertValidResult({ home_score: home, away_score: away, result_type: resultType }) {
  if (home !== null && home !== undefined && home === away && resultType !== 'regulation') {
    throw badRequest('An overtime or shootout result needs a winner');
  }
}

/**
 * The user's personal games shaped like GET /api/user/games rows, with is_personal: true.
 * Filters mirror that endpoint: the effective date is the postponed watch date, or else the
 * game date, with the same one-day margins on date windows. The league comes from the game's
 * season when it has one, otherwise from the home team.
 */
async function fetchPersonalGames(userId, filters = {}) {
  const {
    seasonId = null,
    id = null,
    status = null,
    leagueId = null,
    gameType = null,
    watchedOnly = false,
    originalDate = null,
    date = null,
    week = null,
    month = null,
    from = null,
    to = null,
  } = filters;

  return sql`
    SELECT
      pg.id,
      pg.season_id,
      pg.game_type,
      CASE WHEN pg.home_score IS NULL THEN 'scheduled' ELSE 'final' END AS status,
      to_char(pg.scheduled_at, 'YYYY-MM-DD') || 'T00:00:00.000Z' AS scheduled_at,
      pg.scheduled_time,
      NULL::text AS venue,
      NULL::text AS time_start,
      NULL::text AS time_end,
      CASE WHEN pg.result_type = 'regulation' THEN 0 ELSE 1 END AS overtime_periods,
      (pg.result_type = 'shootout') AS shootout,
      CASE
        WHEN pg.home_score > pg.away_score THEN pg.home_team_id
        WHEN pg.away_score > pg.home_score THEN pg.away_team_id
      END AS winner_team_id,
      pg.home_score,
      pg.away_score,
      pg.result_type,
      '[]'::json AS period_scores,
      json_build_object(
        'id',              pg.home_team_id,
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
      json_build_object(
        'id',              pg.away_team_id,
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
      s.name AS season_name,
      l.id   AS league_id,
      l.code AS league_code,
      l.name AS league_name,
      l.primary_color AS league_primary_color,
      l.text_color AS league_text_color,
      pg.watched_on::text AS watched_on,
      pg.scheduled_for::text AS scheduled_for,
      false AS skipped_by_user,
      (pg.watched_on IS NOT NULL) AS watched_by_user,
      true AS is_personal,
      pg.created_at
    FROM user_personal_games pg
    JOIN teams t_home ON t_home.id = pg.home_team_id
    JOIN teams t_away ON t_away.id = pg.away_team_id
    LEFT JOIN seasons s ON s.id = pg.season_id
    LEFT JOIN leagues l ON l.id = COALESCE(s.league_id, t_home.league_id, t_away.league_id)
    LEFT JOIN LATERAL (
      SELECT name, place_name, team_name, code, team_logo_default(logo_dark, logo_light) AS logo, team_logo_dark(logo_dark, logo_light) AS logo_dark, team_logo_light(logo_dark, logo_light) AS logo_light FROM team_iterations
      WHERE team_id = pg.home_team_id
      ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
      LIMIT 1
    ) ht ON true
    LEFT JOIN LATERAL (
      SELECT name, place_name, team_name, code, team_logo_default(logo_dark, logo_light) AS logo, team_logo_dark(logo_dark, logo_light) AS logo_dark, team_logo_light(logo_dark, logo_light) AS logo_light FROM team_iterations
      WHERE team_id = pg.away_team_id
      ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
      LIMIT 1
    ) at ON true
    CROSS JOIN LATERAL (
      SELECT COALESCE(pg.scheduled_for, pg.scheduled_at) AS effective_user_date
    ) d
    WHERE pg.user_id = ${userId}
      AND (${id}::uuid IS NULL OR pg.id = ${id}::uuid)
      AND (${seasonId}::uuid IS NULL OR pg.season_id = ${seasonId}::uuid)
      AND (
        ${status}::text IS NULL
        OR (CASE WHEN pg.home_score IS NULL THEN 'scheduled' ELSE 'final' END) = ${status}::text
      )
      AND (${leagueId}::uuid IS NULL OR l.id = ${leagueId}::uuid)
      AND (${gameType}::text IS NULL OR pg.game_type = ${gameType}::text)
      AND (${watchedOnly}::boolean IS FALSE OR pg.watched_on IS NOT NULL)
      AND (
        ${originalDate}::date IS NULL
        OR pg.scheduled_at BETWEEN ${originalDate}::date - 1 AND ${originalDate}::date + 1
      )
      AND (${date}::date IS NULL OR d.effective_user_date = ${date}::date)
      AND (
        ${week}::date IS NULL
        OR (
          d.effective_user_date >= ${week}::date - 1
          AND d.effective_user_date < ${week}::date + 8
        )
      )
      AND (
        ${month}::text IS NULL
        OR (
          d.effective_user_date >= (${month} || '-01')::date - 1
          AND d.effective_user_date < ((${month} || '-01')::date + INTERVAL '1 month' + INTERVAL '1 day')
        )
      )
      AND (${from}::date IS NULL OR d.effective_user_date >= ${from}::date - 1)
      AND (${to}::date IS NULL OR d.effective_user_date < ${to}::date + 2)
    ORDER BY pg.scheduled_at, pg.scheduled_time NULLS LAST, pg.created_at
  `;
}

/** The personal game with this id if the user owns it, else null. */
async function findOwnedPersonalGame(userId, gameId) {
  if (!isUuid(gameId)) return null;
  const rows = await sql`
    SELECT id, home_score, scheduled_for::text AS scheduled_for, watched_on::text AS watched_on
    FROM user_personal_games
    WHERE id = ${gameId} AND user_id = ${userId}
  `;
  return rows[0] ?? null;
}

module.exports = {
  assertValidResult,
  fetchPersonalGames,
  findOwnedPersonalGame,
  normalizePersonalGameInput,
};
