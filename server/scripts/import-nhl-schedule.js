"use strict";

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

const DEFAULT_SEASON_NAME = "2026-27";
const DEFAULT_NHL_SEASON = "20262027";
const DEFAULT_EXPECTED_GAMES = 1344;
const NHL_SCHEDULE_URL = "https://api-web.nhle.com/v1/schedule";

function readArg(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

const apply = process.argv.includes("--apply");
const seasonName = readArg("season", DEFAULT_SEASON_NAME);
const nhlSeason = readArg("nhl-season", DEFAULT_NHL_SEASON);
const expectedGames = Number(
  readArg("expected-games", String(DEFAULT_EXPECTED_GAMES)),
);

function readDefault(value) {
  if (typeof value === "string") return value;
  if (typeof value?.default === "string") return value.default;
  return "";
}

function gameNumberFromId(id) {
  return String(id).slice(-4);
}

function addDays(dateValue, days) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function easternTime(isoTimestamp) {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid NHL start time: ${isoTimestamp}`);
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

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, label, retries = 5) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      lastError = new Error(`${label} returned HTTP ${response.status}`);
      if (![429, 500, 502, 503, 504].includes(response.status)) break;
    } catch (error) {
      lastError = error;
    }
    await sleep(Math.min(30000, 1000 * 2 ** attempt));
  }
  throw lastError;
}

async function loadTargetSeason() {
  const rows = await sql`
    SELECT
      s.id,
      s.name,
      s.start_date::text AS start_date,
      s.end_date::text AS end_date,
      s.games_per_season,
      s.group_alignment_set_id,
      l.id AS league_id,
      l.code AS league_code
    FROM seasons s
    JOIN leagues l ON l.id = s.league_id
    WHERE UPPER(l.code) = 'NHL'
      AND s.name = ${seasonName}
  `;
  if (rows.length !== 1) {
    throw new Error(
      `Expected one NHL ${seasonName} season, found ${rows.length}`,
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
    const code = String(team.code ?? "")
      .trim()
      .toUpperCase();
    if (!code)
      throw new Error(`Team ${team.id} has no code for season ${seasonName}`);
    if (byCode.has(code))
      throw new Error(`Duplicate team code in target season: ${code}`);
    byCode.set(code, team);
  }
  return byCode;
}

async function loadOfficialSchedule(startDate) {
  const gamesById = new Map();
  let cursor = startDate;
  let metadata = null;

  while (cursor) {
    const schedule = await fetchJson(
      `${NHL_SCHEDULE_URL}/${cursor}`,
      `NHL schedule ${cursor}`,
    );
    metadata ??= {
      regularSeasonStartDate: schedule.regularSeasonStartDate,
      regularSeasonEndDate: schedule.regularSeasonEndDate,
      playoffEndDate: schedule.playoffEndDate,
    };

    for (const day of schedule.gameWeek ?? []) {
      for (const game of day.games ?? []) {
        if (String(game.season) !== nhlSeason || Number(game.gameType) !== 2)
          continue;
        gamesById.set(String(game.id), {
          ...game,
          gameDate: game.gameDate ?? day.date,
        });
      }
    }

    const next = schedule.nextStartDate ?? addDays(cursor, 7);
    if (!next || next <= cursor || next > metadata.regularSeasonEndDate) break;
    cursor = next;
  }

  return {
    metadata,
    games: [...gamesById.values()].sort(
      (left, right) => Number(left.id) - Number(right.id),
    ),
  };
}

function validateOfficialSchedule({ metadata, games }, seasonTeams) {
  if (!metadata?.regularSeasonStartDate || !metadata?.regularSeasonEndDate) {
    throw new Error(
      "The NHL API response did not include the regular-season date range",
    );
  }
  if (games.length !== expectedGames) {
    throw new Error(
      `Expected ${expectedGames} NHL games, received ${games.length}`,
    );
  }

  const leagueNumbers = new Set();
  const teamCounts = new Map();
  const missingTeamCodes = new Set();

  for (const game of games) {
    const leagueGameNumber = gameNumberFromId(game.id);
    if (leagueNumbers.has(leagueGameNumber)) {
      throw new Error(`Duplicate NHL game number: ${leagueGameNumber}`);
    }
    leagueNumbers.add(leagueGameNumber);

    const awayCode = String(game.awayTeam?.abbrev ?? "")
      .trim()
      .toUpperCase();
    const homeCode = String(game.homeTeam?.abbrev ?? "")
      .trim()
      .toUpperCase();
    if (!awayCode || !homeCode || awayCode === homeCode) {
      throw new Error(`Invalid matchup for NHL game ${game.id}`);
    }
    if (!seasonTeams.has(awayCode)) missingTeamCodes.add(awayCode);
    if (!seasonTeams.has(homeCode)) missingTeamCodes.add(homeCode);
    teamCounts.set(awayCode, (teamCounts.get(awayCode) ?? 0) + 1);
    teamCounts.set(homeCode, (teamCounts.get(homeCode) ?? 0) + 1);

    if (!game.gameDate || !game.startTimeUTC || !readDefault(game.venue)) {
      throw new Error(
        `NHL game ${game.id} is missing its date, start time, or venue`,
      );
    }
  }

  if (missingTeamCodes.size > 0) {
    throw new Error(
      `Unmapped NHL team codes: ${[...missingTeamCodes].sort().join(", ")}`,
    );
  }
  if (teamCounts.size !== 32) {
    throw new Error(
      `Expected schedules for 32 teams, received ${teamCounts.size}`,
    );
  }
  const invalidTeamCounts = [...teamCounts].filter(([, count]) => count !== 84);
  if (invalidTeamCounts.length > 0) {
    throw new Error(
      `Expected 84 games per team: ${invalidTeamCounts
        .map(([code, count]) => `${code}=${count}`)
        .join(", ")}`,
    );
  }
}

function buildImportRows(games, seasonTeams) {
  return games.map((game) => {
    const awayCode = String(game.awayTeam.abbrev).trim().toUpperCase();
    const homeCode = String(game.homeTeam.abbrev).trim().toUpperCase();
    return {
      league_game_number: gameNumberFromId(game.id),
      away_team_id: seasonTeams.get(awayCode).id,
      home_team_id: seasonTeams.get(homeCode).id,
      scheduled_at: `${game.gameDate}T00:00:00.000Z`,
      scheduled_time: easternTime(game.startTimeUTC),
      venue: readDefault(game.venue),
    };
  });
}

async function loadExistingGames(seasonId) {
  return sql`
    SELECT
      id,
      league_game_number,
      status
    FROM games
    WHERE season_id = ${seasonId}
      AND game_type = 'regular'
  `;
}

async function importSchedule(season, metadata, rows) {
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
    updated AS (
      UPDATE games g
      SET
        away_team_id = source.away_team_id,
        home_team_id = source.home_team_id,
        scheduled_at = source.scheduled_at::timestamptz,
        scheduled_time = source.scheduled_time,
        venue = source.venue
      FROM source
      WHERE g.season_id = ${season.id}
        AND g.game_type = 'regular'
        AND g.league_game_number = source.league_game_number
        AND g.status = 'scheduled'
      RETURNING g.id
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
        'regular',
        'scheduled',
        source.league_game_number
      FROM source
      WHERE NOT EXISTS (
        SELECT 1
        FROM games g
        WHERE g.season_id = ${season.id}
          AND g.game_type = 'regular'
          AND g.league_game_number = source.league_game_number
      )
      RETURNING id
    ),
    season_updated AS (
      UPDATE seasons
      SET
        start_date = ${metadata.regularSeasonStartDate}::date,
        end_date = ${metadata.playoffEndDate}::date
      WHERE id = ${season.id}
      RETURNING id
    )
    SELECT
      (SELECT COUNT(*)::int FROM updated) AS updated_count,
      (SELECT COUNT(*)::int FROM inserted) AS inserted_count,
      (SELECT COUNT(*)::int FROM season_updated) AS season_updated_count
  `;
  return result[0];
}

async function verifyImport(seasonId) {
  const summary = await sql`
    WITH team_games AS (
      SELECT home_team_id AS team_id
      FROM games
      WHERE season_id = ${seasonId} AND game_type = 'regular'

      UNION ALL

      SELECT away_team_id AS team_id
      FROM games
      WHERE season_id = ${seasonId} AND game_type = 'regular'
    ),
    per_team AS (
      SELECT team_id, COUNT(*)::int AS games
      FROM team_games
      GROUP BY team_id
    )
    SELECT
      COUNT(*)::int AS game_count,
      COUNT(DISTINCT league_game_number)::int AS distinct_game_numbers,
      MIN((scheduled_at AT TIME ZONE 'UTC')::date)::text AS first_game_date,
      MAX((scheduled_at AT TIME ZONE 'UTC')::date)::text AS last_game_date,
      (SELECT MIN(games)::int FROM per_team) AS min_team_games,
      (SELECT MAX(games)::int FROM per_team) AS max_team_games,
      (SELECT COUNT(*)::int FROM per_team) AS team_count
    FROM games
    WHERE season_id = ${seasonId}
      AND game_type = 'regular'
  `;
  return summary[0];
}

async function main() {
  if (!Number.isInteger(expectedGames) || expectedGames <= 0) {
    throw new Error(`Invalid --expected-games value: ${expectedGames}`);
  }

  const season = await loadTargetSeason();
  const seasonTeams = await loadSeasonTeams(season);
  if (seasonTeams.size !== 32) {
    throw new Error(
      `Expected 32 participating NHL teams, found ${seasonTeams.size}`,
    );
  }

  const official = await loadOfficialSchedule(season.start_date);
  validateOfficialSchedule(official, seasonTeams);
  const rows = buildImportRows(official.games, seasonTeams);
  const existing = await loadExistingGames(season.id);
  const officialNumbers = new Set(rows.map((row) => row.league_game_number));
  const unnumbered = existing.filter((game) => !game.league_game_number);
  const unexpected = existing.filter(
    (game) =>
      game.league_game_number && !officialNumbers.has(game.league_game_number),
  );

  if (unnumbered.length > 0) {
    throw new Error(
      `Target season has ${unnumbered.length} regular-season game(s) without an NHL game number`,
    );
  }
  if (unexpected.length > 0) {
    throw new Error(
      `Target season has ${unexpected.length} regular-season game number(s) absent from the NHL schedule`,
    );
  }

  const existingNumbers = new Set(
    existing.map((game) => game.league_game_number),
  );
  const toInsert = rows.filter(
    (row) => !existingNumbers.has(row.league_game_number),
  ).length;
  const toUpdate = rows.length - toInsert;

  console.log(
    `Official NHL ${seasonName}: ${rows.length} games, ` +
      `${official.metadata.regularSeasonStartDate} to ${official.metadata.regularSeasonEndDate}`,
  );
  console.log(`Target season: ${season.id} (${seasonTeams.size} teams)`);
  console.log(`Database plan: insert ${toInsert}, update ${toUpdate}`);

  if (!apply) {
    console.log("Dry run complete. Re-run with --apply to write the schedule.");
    return;
  }

  const result = await importSchedule(season, official.metadata, rows);
  const verification = await verifyImport(season.id);
  console.log(
    `Applied schedule: inserted ${result.inserted_count}, updated ${result.updated_count}`,
  );
  console.log(`Verification: ${JSON.stringify(verification)}`);

  if (
    verification.game_count !== expectedGames ||
    verification.distinct_game_numbers !== expectedGames ||
    verification.team_count !== 32 ||
    verification.min_team_games !== 84 ||
    verification.max_team_games !== 84 ||
    verification.first_game_date !== official.metadata.regularSeasonStartDate ||
    verification.last_game_date !== official.metadata.regularSeasonEndDate
  ) {
    throw new Error("Post-import verification failed");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
