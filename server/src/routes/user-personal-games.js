'use strict';

// Personal games: games a user adds to their own schedule and scores by hand, separate from
// the admin-managed games table. Watch actions (mark watched, postpone, unwatch) go through
// the shared /api/user/watched-games endpoints, which recognise personal game ids.

const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { sql } = require('../db');
const {
  assertValidResult,
  fetchPersonalGames,
  findOwnedPersonalGame,
  normalizePersonalGameInput,
} = require('../lib/personalGames');
const { syncScheduledGameToGoogleCalendar } = require('../services/googleCalendar');

router.use(requireAuth);

const syncCalendar = async (userId, gameId) => {
  try {
    await syncScheduledGameToGoogleCalendar({ userId, gameId });
  } catch (err) {
    // The saved game stays authoritative; the connection keeps the error for a retry.
    console.error('Google Calendar personal game sync error:', err);
  }
};

const sendError = (res, err, label) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (err.code === '23503') return res.status(400).json({ error: 'Team or season not found' });
  if (err.code === '23514') return res.status(400).json({ error: 'Invalid personal game' });
  console.error(`personal games ${label} error:`, err);
  return res.status(500).json({ error: 'Internal server error' });
};

const assertWatchDateAfterGame = ({ scheduled_for: watchDate, scheduled_at: gameDate }) => {
  if (watchDate && gameDate && watchDate <= gameDate) {
    const err = new Error('The watch date must be after the game date');
    err.status = 400;
    throw err;
  }
};

// ---------------------------------------------------------------------------
// POST /api/user/personal-games  – add a game to the user's own schedule
// Body: { season_id?, home_team_id, away_team_id, game_type, scheduled_at, scheduled_time?,
//         home_score?, away_score?, result_type?, scheduled_for?, watched_on? }
// A score is only known once the user has watched the game, so recording one marks it
// watched: on the postponed watch date if set, else watched_on (the client's today).
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const userId = req.user.id;
  try {
    const input = normalizePersonalGameInput(req.body);
    assertValidResult(input);
    assertWatchDateAfterGame(input);
    const [created] = await sql`
      INSERT INTO user_personal_games (
        user_id, season_id, home_team_id, away_team_id, game_type, scheduled_at, scheduled_time,
        home_score, away_score, result_type, scheduled_for, watched_on
      )
      VALUES (
        ${userId}, ${input.season_id}, ${input.home_team_id}, ${input.away_team_id}, ${input.game_type},
        ${input.scheduled_at}::date, ${input.scheduled_time}, ${input.home_score},
        ${input.away_score}, ${input.result_type}, ${input.scheduled_for}::date,
        CASE
          WHEN ${input.home_score}::smallint IS NULL THEN NULL
          ELSE COALESCE(${input.scheduled_for}::date, ${input.watched_on ?? null}::date, CURRENT_DATE)
        END
      )
      RETURNING id
    `;
    await syncCalendar(userId, created.id);
    const [game] = await fetchPersonalGames(userId, { id: created.id });
    return res.status(201).json(game);
  } catch (err) {
    return sendError(res, err, 'create');
  }
});

// ---------------------------------------------------------------------------
// POST /api/user/personal-games/bulk  – add several unplayed games under one season
// Body: { season_id?, games: [{ home_team_id, away_team_id, game_type, scheduled_at }] }
// Every row is validated before anything is saved, and they're inserted together.
// ---------------------------------------------------------------------------
const BULK_MAX_GAMES = 100;

router.post('/bulk', async (req, res) => {
  const userId = req.user.id;
  const { season_id: seasonId = null, games } = req.body ?? {};
  try {
    if (!Array.isArray(games) || games.length === 0) {
      return res.status(400).json({ error: 'games must be a non-empty array' });
    }
    if (games.length > BULK_MAX_GAMES) {
      return res.status(400).json({ error: `Add at most ${BULK_MAX_GAMES} games at a time` });
    }
    const rows = games.map((game, index) => {
      try {
        const input = normalizePersonalGameInput({
          season_id: seasonId,
          home_team_id: game?.home_team_id,
          away_team_id: game?.away_team_id,
          game_type: game?.game_type,
          scheduled_at: game?.scheduled_at,
        });
        return {
          season_id: input.season_id,
          home_team_id: input.home_team_id,
          away_team_id: input.away_team_id,
          game_type: input.game_type,
          scheduled_at: input.scheduled_at,
        };
      } catch (err) {
        err.message = `Game ${index + 1}: ${err.message}`;
        throw err;
      }
    });

    const created = await sql`
      INSERT INTO user_personal_games (
        user_id, season_id, home_team_id, away_team_id, game_type, scheduled_at
      )
      SELECT ${userId}, r.season_id, r.home_team_id, r.away_team_id, r.game_type, r.scheduled_at
      FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS r(
        season_id uuid, home_team_id uuid, away_team_id uuid, game_type text, scheduled_at date
      )
      RETURNING id
    `;
    for (const { id } of created) await syncCalendar(userId, id);
    return res.status(201).json({ created: created.length, ids: created.map(({ id }) => id) });
  } catch (err) {
    return sendError(res, err, 'bulk create');
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/user/personal-games/:id  – edit any of the fields above
// ---------------------------------------------------------------------------
router.patch('/:id', async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  try {
    const owned = await findOwnedPersonalGame(userId, id);
    if (!owned) return res.status(404).json({ error: 'Personal game not found' });

    const changes = normalizePersonalGameInput(req.body, { partial: true });
    const [current] = await sql`
      SELECT season_id, home_team_id, away_team_id, game_type, scheduled_at::text AS scheduled_at,
             scheduled_time, scheduled_for::text AS scheduled_for, home_score, away_score,
             result_type
      FROM user_personal_games WHERE id = ${id}
    `;
    const merged = { ...current, ...changes };
    if (merged.home_team_id === merged.away_team_id) {
      return res.status(400).json({ error: 'home_team_id and away_team_id must be different' });
    }
    assertValidResult(merged);
    assertWatchDateAfterGame(merged);

    // Recording a score marks an unwatched game watched (keeping an existing watched date);
    // clearing the score means it hasn't been watched.
    await sql`
      UPDATE user_personal_games SET
        season_id      = ${merged.season_id},
        home_team_id   = ${merged.home_team_id},
        away_team_id   = ${merged.away_team_id},
        game_type      = ${merged.game_type},
        scheduled_at   = ${merged.scheduled_at}::date,
        scheduled_time = ${merged.scheduled_time},
        home_score     = ${merged.home_score},
        away_score     = ${merged.away_score},
        result_type    = ${merged.result_type},
        scheduled_for  = ${merged.scheduled_for}::date,
        watched_on     = CASE
                           WHEN ${merged.home_score}::smallint IS NULL THEN NULL
                           ELSE COALESCE(
                             watched_on,
                             ${merged.scheduled_for}::date,
                             ${changes.watched_on ?? null}::date,
                             CURRENT_DATE
                           )
                         END,
        updated_at     = NOW()
      WHERE id = ${id} AND user_id = ${userId}
    `;
    await syncCalendar(userId, id);
    const [game] = await fetchPersonalGames(userId, { id });
    return res.json(game);
  } catch (err) {
    return sendError(res, err, 'update');
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/user/personal-games/:id  – remove it (and its calendar event)
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  try {
    const owned = await findOwnedPersonalGame(userId, id);
    if (!owned) return res.status(404).json({ error: 'Personal game not found' });
    await sql`DELETE FROM user_personal_games WHERE id = ${id} AND user_id = ${userId}`;
    await syncCalendar(userId, id);
    return res.json({ id, deleted: true });
  } catch (err) {
    return sendError(res, err, 'delete');
  }
});

module.exports = router;
