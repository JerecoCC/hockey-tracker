"use strict";

// Adds PWHL games from the official HockeyTech schedule that a season doesn't have yet.
// Existing games are never changed. Dry run by default; pass --apply to insert.
//
//   node scripts/import-pwhl-schedule.js --season=2026-27 --game-type=regular
//   node scripts/import-pwhl-schedule.js --season=2026-27 --game-type=preseason --apply

const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../.env.local"),
  quiet: true,
});
dotenv.config({
  path: path.resolve(__dirname, "../.env"),
  override: false,
  quiet: true,
});

const { sql } = require("../src/db");

const PWHL_FEED_URL = "https://lscluster.hockeytech.com/feed/index.php";
const PWHL_FEED_PARAMS = {
  key: "446521baf8c38984",
  client_code: "pwhl",
  league_id: "1",
  fmt: "json",
};
// HockeyTech season ids for the 2026-27 schedule.
const DEFAULT_PWHL_SEASON_IDS = { regular: "11", preseason: "10" };
// HockeyTech codes that differ from ours: Las Vegas is VEG in the preseason feed (VGS
// elsewhere), and San Jose is SJ where we use SJS.
const TEAM_CODE_ALIASES = { VEG: ["VGS"], SJ: ["SJS"] };

function readArg(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

const apply = process.argv.includes("--apply");
const gameType = readArg("game-type", "regular");
if (!["regular", "preseason"].includes(gameType)) {
  throw new Error("--game-type must be regular or preseason");
}
const seasonName = readArg("season", "2026-27");
const pwhlSeasonId = readArg("pwhl-season", DEFAULT_PWHL_SEASON_IDS[gameType]);

function easternTime(isoTimestamp) {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid PWHL start time: ${isoTimestamp}`);
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("hour")}:${value("minute")}`;
}

async function loadTargetSeason() {
  const rows = await sql`
    SELECT
      s.id,
      s.name,
      s.group_alignment_set_id
    FROM seasons s
    JOIN leagues l ON l.id = s.league_id
    WHERE UPPER(l.code) = 'PWHL'
      AND s.name = ${seasonName}
  `;
  if (rows.length !== 1) {
    const seasons = await sql`
      SELECT s.name
      FROM seasons s
      JOIN leagues l ON l.id = s.league_id
      WHERE UPPER(l.code) = 'PWHL'
      ORDER BY s.start_date DESC NULLS LAST
    `;
    throw new Error(
      `Expected one PWHL ${seasonName} season, found ${rows.length}. ` +
        `PWHL seasons: ${seasons.map((s) => s.name).join(", ") || "none"}`,
    );
  }
  return rows[0];
}

async function loadSeasonTeams(season) {
  const rows = await sql`
    WITH participating AS (
      SELECT team_id
      FROM group_alignment_set_teams
      WHERE alignment_set_id = ${season.group_alignment_set_id}

      UNION

      SELECT gat.team_id
      FROM group_alignment_teams gat
      JOIN group_alignment_groups gag ON gag.id = gat.alignment_group_id
      WHERE gag.alignment_set_id = ${season.group_alignment_set_id}

      UNION

      SELECT team_id
      FROM season_teams
      WHERE season_id = ${season.id}
    )
    SELECT
      t.id,
      ti.code,
      ti.name
    FROM participating p
    JOIN teams t ON t.id = p.team_id
    LEFT JOIN LATERAL (
      SELECT code, name
      FROM team_iterations
      WHERE team_id = t.id
        AND (season_id = ${season.id} OR season_id IS NULL)
      ORDER BY
        CASE WHEN season_id = ${season.id} THEN 0 ELSE 1 END,
        recorded_at DESC
      LIMIT 1
    ) ti ON true
    ORDER BY ti.code
  `;

  const byCode = new Map();
  for (const team of rows) {
    const code = String(team.code ?? "").trim().toUpperCase();
    if (!code) throw new Error(`Team ${team.id} has no code for season ${seasonName}`);
    if (byCode.has(code)) throw new Error(`Duplicate team code in target season: ${code}`);
    byCode.set(code, team);
  }
  return byCode;
}

function findTeam(seasonTeams, code) {
  for (const candidate of [code, ...(TEAM_CODE_ALIASES[code] ?? [])]) {
    if (seasonTeams.has(candidate)) return seasonTeams.get(candidate);
  }
  return null;
}

async function loadOfficialSchedule() {
  const params = new URLSearchParams({
    feed: "modulekit",
    view: "schedule",
    season_id: pwhlSeasonId,
    ...PWHL_FEED_PARAMS,
  });
  const response = await fetch(`${PWHL_FEED_URL}?${params}`);
  if (!response.ok) throw new Error(`PWHL schedule returned HTTP ${response.status}`);
  const data = await response.json();
  const games = data?.SiteKit?.Schedule;
  if (!Array.isArray(games) || games.length === 0) {
    throw new Error(`PWHL season ${pwhlSeasonId} returned no scheduled games`);
  }
  return games;
}

function buildRows(games, seasonTeams) {
  const missingCodes = new Set();
  const rows = [];
  for (const game of games) {
    const awayCode = String(game.visiting_team_code ?? "").trim().toUpperCase();
    const homeCode = String(game.home_team_code ?? "").trim().toUpperCase();
    const away = findTeam(seasonTeams, awayCode);
    const home = findTeam(seasonTeams, homeCode);
    if (!away) missingCodes.add(awayCode);
    if (!home) missingCodes.add(homeCode);
    if (!away || !home) continue;
    if (away.id === home.id) throw new Error(`Invalid matchup for PWHL game ${game.game_id}`);
    if (!game.date_played || !game.GameDateISO8601) {
      throw new Error(`PWHL game ${game.game_id} is missing its date or start time`);
    }
    rows.push({
      league_game_number: String(game.game_id),
      date: game.date_played,
      away_team_id: away.id,
      home_team_id: home.id,
      away_code: awayCode,
      home_code: homeCode,
      scheduled_at: `${game.date_played}T00:00:00.000Z`,
      scheduled_time: game.time_tbd === "1" ? null : easternTime(game.GameDateISO8601),
      venue: game.venue_name || null,
    });
  }
  if (missingCodes.size > 0) {
    throw new Error(
      `PWHL team codes with no team in ${seasonName}: ${[...missingCodes].sort().join(", ")}. ` +
        `Season teams: ${[...seasonTeams.keys()].join(", ")}`,
    );
  }
  return rows;
}

async function loadExistingGames(seasonId) {
  return sql`
    SELECT
      league_game_number,
      home_team_id,
      away_team_id,
      scheduled_at::date::text AS date
    FROM games
    WHERE season_id = ${seasonId}
      AND game_type = ${gameType}
  `;
}

// A game is already added when its PWHL game number is on the season, or when the same
// matchup is already scheduled that day (games created by hand may have no number).
function findMissingRows(rows, existingGames) {
  const numbers = new Set(existingGames.map((g) => g.league_game_number).filter(Boolean));
  const matchups = new Set(
    existingGames.map((g) => `${g.date}|${g.home_team_id}|${g.away_team_id}`),
  );
  return rows.filter(
    (row) =>
      !numbers.has(row.league_game_number) &&
      !matchups.has(`${row.date}|${row.home_team_id}|${row.away_team_id}`),
  );
}

async function insertGames(season, rows) {
  const payload = JSON.stringify(rows);
  const result = await sql`
    WITH source AS (
      SELECT *
      FROM jsonb_to_recordset(${payload}::jsonb) AS item(
        league_game_number text,
        away_team_id uuid,
        home_team_id uuid,
        scheduled_at text,
        scheduled_time text,
        venue text
      )
    ),
    inserted AS (
      INSERT INTO games (
        season_id,
        home_team_id,
        away_team_id,
        scheduled_at,
        scheduled_time,
        venue,
        game_type,
        status,
        league_game_number
      )
      SELECT
        ${season.id},
        source.home_team_id,
        source.away_team_id,
        source.scheduled_at::timestamptz,
        source.scheduled_time,
        source.venue,
        ${gameType},
        'scheduled',
        source.league_game_number
      FROM source
      WHERE NOT EXISTS (
        SELECT 1
        FROM games g
        WHERE g.season_id = ${season.id}
          AND g.game_type = ${gameType}
          AND g.league_game_number = source.league_game_number
      )
      RETURNING id
    )
    SELECT COUNT(*)::int AS inserted_count FROM inserted
  `;
  return result[0].inserted_count;
}

async function main() {
  const season = await loadTargetSeason();
  const seasonTeams = await loadSeasonTeams(season);
  const games = await loadOfficialSchedule();
  const rows = buildRows(games, seasonTeams);
  const existingGames = await loadExistingGames(season.id);
  const missing = findMissingRows(rows, existingGames);

  console.log(
    `PWHL ${seasonName} ${gameType}: ${rows.length} official games, ` +
      `${existingGames.length} already in the season, ${missing.length} to add.`,
  );
  for (const row of missing) {
    console.log(
      `  #${row.league_game_number} ${row.date} ${row.scheduled_time ?? "TBD"} ` +
        `${row.away_code} @ ${row.home_code} - ${row.venue ?? "no venue"}`,
    );
  }

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to add these games.");
    return;
  }
  if (missing.length === 0) return;
  const inserted = await insertGames(season, missing);
  console.log(`Added ${inserted} games.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
