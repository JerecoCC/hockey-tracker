const crypto = require('crypto');

// Google Calendar's fixed event colors are colorId 1-11. A league without a chosen color
// gets a stable one from its id, so different leagues usually differ by default.
const GOOGLE_EVENT_COLOR_COUNT = 11;

/** The Google Calendar event colorId (1-11) a league's games use, or null without a league. */
function leagueCalendarColorId(leagueId, chosenColorId) {
  const chosen = Number(chosenColorId);
  if (Number.isInteger(chosen) && chosen >= 1 && chosen <= GOOGLE_EVENT_COLOR_COUNT) {
    return chosen;
  }
  if (!leagueId) return null;
  const hash = crypto.createHash('sha256').update(String(leagueId), 'utf8').digest();
  return (hash.readUInt32BE(0) % GOOGLE_EVENT_COLOR_COUNT) + 1;
}

/** Replaces each game's chosen league_calendar_color_id with the color actually used. */
const withLeagueCalendarColors = (games) =>
  games.map((game) => ({
    ...game,
    league_calendar_color_id: leagueCalendarColorId(game.league_id, game.league_calendar_color_id),
  }));

module.exports = { leagueCalendarColorId, withLeagueCalendarColors };
