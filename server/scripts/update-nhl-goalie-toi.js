'use strict';

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env.local'), quiet: true });
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: false, quiet: true });

const { sql } = require('../src/db');
const { rebuildGameStats } = require('../src/lib/gameStatsSnapshots');

const NHL_GAME_TYPE_CODE = {
  preseason: '01',
  regular: '02',
  playoff: '03',
  playoffs: '03',
};

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const quiet = args.has('--quiet');
const limit = readNumberArg('--limit');
const concurrency = readNumberArg('--concurrency') ?? 8;
const retries = readNumberArg('--retries') ?? 4;
const onlyGameId = readStringArg('--game-id');
const scheduleCache = new Map();

function readStringArg(name) {
  const prefix = `${name}=`;
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function readNumberArg(name) {
  const value = readStringArg(name);
  if (value == null) return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function parseToiSeconds(value) {
  const match = String(value ?? '').trim().match(/^(\d{1,3}):([0-5]\d)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(response, attempt) {
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
    const dateMs = Date.parse(retryAfter);
    if (Number.isFinite(dateMs)) return Math.max(dateMs - Date.now(), 0);
  }
  return Math.min(30000, 1000 * (2 ** attempt));
}

async function fetchJsonWithRetry(url, label) {
  let lastStatus = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetch(url);
    if (response.ok) return response.json();

    lastStatus = response.status;
    const retryable = [429, 500, 502, 503, 504].includes(response.status);
    if (!retryable || attempt >= retries) break;
    await sleep(retryDelayMs(response, attempt));
  }
  throw new Error(`${label} returned HTTP ${lastStatus}`);
}

function formatSeconds(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function readText(value) {
  if (typeof value === 'string') return value;
  if (typeof value?.default === 'string') return value.default;
  return '';
}

function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();
}

function localGoalieName(stint) {
  return `${stint.first_name ?? ''} ${stint.last_name ?? ''}`.trim();
}

function officialGoalieName(goalie) {
  return `${readText(goalie.firstName)} ${readText(goalie.lastName)}`.trim();
}

function goalieActuallyPlayed(goalie) {
  const toi = parseToiSeconds(goalie.toi);
  return (
    (toi != null && toi > 0) ||
    Number(goalie.shotsAgainst ?? 0) > 0 ||
    Number(goalie.saves ?? 0) > 0 ||
    Number(goalie.goalsAgainst ?? 0) > 0
  );
}

function goalieMatches(localStint, officialGoalie) {
  const officialNumber = Number(officialGoalie.sweaterNumber);
  if (Number.isFinite(officialNumber) && Number(localStint.jersey_number) === officialNumber) {
    return true;
  }
  return normalizeName(localGoalieName(localStint)) === normalizeName(officialGoalieName(officialGoalie));
}

function seasonStartYear(game) {
  const fromName = String(game.season_name ?? '').match(/\b(20\d{2})\b/)?.[1];
  if (fromName) return fromName;

  const scheduled = game.scheduled_at ? new Date(game.scheduled_at) : null;
  if (!scheduled || Number.isNaN(scheduled.getTime())) return null;
  const year = scheduled.getUTCFullYear();
  const month = scheduled.getUTCMonth() + 1;
  return String(month >= 7 ? year : year - 1);
}

function buildGamecenterId(game) {
  const raw = String(game.game_number ?? '').trim();
  if (/^\d{10}$/.test(raw)) return raw;
  if (!/^\d{1,4}$/.test(raw)) return null;

  const startYear = seasonStartYear(game);
  if (!startYear) return null;

  const typeCode = NHL_GAME_TYPE_CODE[String(game.game_type ?? 'regular').toLowerCase()] ??
    NHL_GAME_TYPE_CODE.regular;
  return `${startYear}${typeCode}${raw.padStart(4, '0')}`;
}

function gameTypeNumber(game) {
  return Number(NHL_GAME_TYPE_CODE[String(game.game_type ?? 'regular').toLowerCase()] ??
    NHL_GAME_TYPE_CODE.regular);
}

function easternDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return year && month && day ? `${year}-${month}-${day}` : null;
}

function utcDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function shiftDate(dateValue, dayOffset) {
  if (!dateValue) return null;
  const date = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return date.toISOString().slice(0, 10);
}

function scheduleDateCandidates(value) {
  const candidates = [easternDate(value), utcDate(value)];
  for (const date of [...candidates]) {
    candidates.push(shiftDate(date, -1), shiftDate(date, 1));
  }
  return [...new Set(candidates.filter(Boolean))];
}

function collectScheduledGames(schedule, targetDate) {
  const days = Array.isArray(schedule?.gameWeek) ? schedule.gameWeek : [];
  const weekGames = days.flatMap((day) =>
    Array.isArray(day?.games)
      ? day.games.map((game) => ({ ...game, gameDate: game?.gameDate ?? day.date }))
      : [],
  );
  const directGames = Array.isArray(schedule?.games) ? schedule.games : [];
  return [...weekGames, ...directGames].filter((game) => game?.gameDate === targetDate);
}

async function fetchScheduleGames(date) {
  if (scheduleCache.has(date)) return scheduleCache.get(date);
  const promise = fetchJsonWithRetry(
    `https://api-web.nhle.com/v1/schedule/${date}`,
    `NHL schedule ${date}`,
  ).then((schedule) => {
    return collectScheduledGames(schedule, date);
  });
  scheduleCache.set(date, promise);
  return promise;
}

async function resolveGamecenterId(game) {
  const direct = buildGamecenterId(game);
  if (direct) return { gamecenterId: direct, source: 'game_number' };

  const awayCode = String(game.away_code ?? '').toUpperCase();
  const homeCode = String(game.home_code ?? '').toUpperCase();
  const type = gameTypeNumber(game);
  for (const date of scheduleDateCandidates(game.scheduled_at)) {
    const scheduledGames = await fetchScheduleGames(date);
    const matches = scheduledGames.filter((scheduledGame) =>
      String(scheduledGame?.awayTeam?.abbrev ?? '').toUpperCase() === awayCode &&
      String(scheduledGame?.homeTeam?.abbrev ?? '').toUpperCase() === homeCode &&
      Number(scheduledGame?.gameType ?? type) === type
    );

    if (matches.length === 1 && matches[0]?.id != null) {
      return { gamecenterId: String(matches[0].id), source: `schedule:${date}` };
    }
  }
  return null;
}

function officialGoalies(boxscore) {
  return ['away', 'home'].flatMap((side) => {
    const rows = boxscore?.playerByGameStats?.[`${side}Team`]?.goalies;
    if (!Array.isArray(rows)) return [];
    return rows
      .filter(goalieActuallyPlayed)
      .map((goalie) => ({
        ...goalie,
        side,
        teamCode: boxscore?.[`${side}Team`]?.abbrev,
        seconds: parseToiSeconds(goalie.toi),
      }))
      .filter((goalie) => goalie.seconds != null);
  });
}

async function fetchBoxscore(gamecenterId) {
  return fetchJsonWithRetry(
    `https://api-web.nhle.com/v1/gamecenter/${gamecenterId}/boxscore`,
    `NHL boxscore ${gamecenterId}`,
  );
}

async function loadGames() {
  const rows = await sql`
    SELECT
      g.id,
      g.game_number,
      g.game_type,
      g.scheduled_at,
      s.name AS season_name,
      g.away_team_id,
      g.home_team_id,
      away_ti.code AS away_code,
      home_ti.code AS home_code
    FROM games g
    JOIN seasons s ON s.id = g.season_id
    JOIN leagues l ON l.id = s.league_id
    LEFT JOIN LATERAL (
      SELECT code
      FROM team_iterations
      WHERE team_id = g.away_team_id
      ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
      LIMIT 1
    ) away_ti ON true
    LEFT JOIN LATERAL (
      SELECT code
      FROM team_iterations
      WHERE team_id = g.home_team_id
      ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
      LIMIT 1
    ) home_ti ON true
    WHERE UPPER(l.code) = 'NHL'
      AND g.status = 'final'
      AND (${onlyGameId}::uuid IS NULL OR g.id = ${onlyGameId})
      AND EXISTS (SELECT 1 FROM game_goalie_stints st WHERE st.game_id = g.id)
    ORDER BY g.scheduled_at NULLS LAST, g.created_at, g.id
  `;
  return limit ? rows.slice(0, limit) : rows;
}

async function loadNhlGameSummary() {
  const [summary] = await sql`
    SELECT
      COUNT(*)::int AS final_games,
      COUNT(*) FILTER (WHERE g.game_number IS NOT NULL)::int AS with_game_number,
      COUNT(*) FILTER (WHERE g.game_number IS NULL)::int AS missing_game_number,
      COUNT(*) FILTER (
        WHERE EXISTS (SELECT 1 FROM game_goalie_stints st WHERE st.game_id = g.id)
      )::int AS backfillable_games
    FROM games g
    JOIN seasons s ON s.id = g.season_id
    JOIN leagues l ON l.id = s.league_id
    WHERE UPPER(l.code) = 'NHL'
      AND g.status = 'final'
      AND (${onlyGameId}::uuid IS NULL OR g.id = ${onlyGameId})
  `;
  return summary ?? {
    final_games: 0,
    with_game_number: 0,
    missing_game_number: 0,
    backfillable_games: 0,
  };
}

async function loadStints(gameId) {
  return sql`
    SELECT
      st.id,
      st.game_id,
      st.team_id,
      st.goalie_id,
      st.stint_ord,
      st.time_on_ice,
      p.first_name,
      p.last_name,
      COALESCE(pt_jnh.jersey_number, pt.jersey_number) AS jersey_number
    FROM game_goalie_stints st
    JOIN games g ON g.id = st.game_id
    JOIN players p ON p.id = st.goalie_id
    LEFT JOIN player_teams pt
      ON pt.player_id = st.goalie_id
      AND pt.team_id = st.team_id
      AND pt.season_id = g.season_id
      AND (pt.start_date IS NULL OR pt.start_date <= COALESCE(g.scheduled_at::date, CURRENT_DATE))
      AND (pt.end_date IS NULL OR pt.end_date >= COALESCE(g.scheduled_at::date, CURRENT_DATE))
    LEFT JOIN LATERAL (
      SELECT jersey_number
      FROM jersey_number_history
      WHERE player_teams_id = pt.id
        AND effective_from <= COALESCE(g.scheduled_at::date, CURRENT_DATE)
      ORDER BY effective_from DESC
      LIMIT 1
    ) pt_jnh ON true
    WHERE st.game_id = ${gameId}
    ORDER BY st.team_id, st.stint_ord
  `;
}

async function processGame(game) {
  const result = {
    updatedRows: 0,
    updatedGames: 0,
    skippedGoalies: 0,
    failedGames: 0,
  };

  try {
    const resolved = await resolveGamecenterId(game);
    if (!resolved) {
      result.failedGames += 1;
      console.warn(
        `${game.id}: could not resolve NHL GameCenter id from game_number=${game.game_number ?? 'null'} ` +
        `or schedule date/team codes (${scheduleDateCandidates(game.scheduled_at).join(',') || 'no-date'} ` +
        `${game.away_code ?? '?'}@${game.home_code ?? '?'} ${game.game_type})`,
      );
      return result;
    }
    const { gamecenterId } = resolved;
    const boxscore = await fetchBoxscore(gamecenterId);
    const awayCode = String(boxscore?.awayTeam?.abbrev ?? '').toUpperCase();
    const homeCode = String(boxscore?.homeTeam?.abbrev ?? '').toUpperCase();
    if (
      awayCode !== String(game.away_code ?? '').toUpperCase() ||
      homeCode !== String(game.home_code ?? '').toUpperCase()
    ) {
      result.failedGames += 1;
      console.warn(
        `${game.id}: NHL ${gamecenterId} teams ${awayCode}@${homeCode} do not match local ` +
        `${game.away_code}@${game.home_code}`,
      );
      return result;
    }

    const stints = await loadStints(game.id);
    const updates = [];

    for (const goalie of officialGoalies(boxscore)) {
      const teamId = goalie.side === 'away' ? game.away_team_id : game.home_team_id;
      const matches = stints.filter((stint) => stint.team_id === teamId && goalieMatches(stint, goalie));
      if (matches.length !== 1) {
        result.skippedGoalies += 1;
        console.warn(
          `${game.id}: skipped ${goalie.teamCode} #${goalie.sweaterNumber ?? '?'} ` +
          `${officialGoalieName(goalie)}; matched ${matches.length} local stint(s)`,
        );
        continue;
      }

      const match = matches[0];
      if (Number(match.time_on_ice ?? -1) === goalie.seconds) continue;
      updates.push({ stint: match, goalie, seconds: goalie.seconds });
    }

    if (updates.length === 0) return result;

    for (const update of updates) {
      if (!dryRun) {
        await sql`
          UPDATE game_goalie_stints
          SET time_on_ice = ${update.seconds}
          WHERE id = ${update.stint.id}
        `;
      }
      result.updatedRows += 1;
      if (!quiet) {
        console.log(
          `${game.id} ${gamecenterId} (${resolved.source}): ${localGoalieName(update.stint)} ` +
          `${formatSeconds(Number(update.stint.time_on_ice ?? 0))} -> ${formatSeconds(update.seconds)}`,
        );
      }
    }

    if (!dryRun) {
      await rebuildGameStats(sql, game.id);
    }
    result.updatedGames += 1;
    return result;
  } catch (err) {
    result.failedGames += 1;
    console.warn(`${game.id}: ${err.message}`);
    return result;
  }
}

async function main() {
  if (typeof fetch !== 'function') {
    throw new Error('This script requires a Node.js runtime with global fetch.');
  }

  const summary = await loadNhlGameSummary();
  const games = await loadGames();
  let updatedRows = 0;
  let updatedGames = 0;
  let skippedGoalies = 0;
  let failedGames = 0;

  console.log(
    `NHL finals: ${summary.final_games}; with game_number: ${summary.with_game_number}; ` +
    `missing game_number: ${summary.missing_game_number}; backfillable with stints: ${summary.backfillable_games}.`,
  );
  console.log(`${dryRun ? '[dry-run] ' : ''}Checking ${games.length} NHL game(s) with concurrency ${concurrency}...`);

  let processed = 0;
  let lastProgress = 0;
  for (let index = 0; index < games.length; index += concurrency) {
    const chunk = games.slice(index, index + concurrency);
    const results = await Promise.all(chunk.map(processGame));
    for (const result of results) {
      updatedRows += result.updatedRows;
      updatedGames += result.updatedGames;
      skippedGoalies += result.skippedGoalies;
      failedGames += result.failedGames;
    }
    processed += chunk.length;
    if (quiet && (processed === games.length || processed - lastProgress >= 100)) {
      console.log(`Processed ${processed}/${games.length} game(s)...`);
      lastProgress = processed;
    }
  }

  console.log(
    `${dryRun ? 'Would update' : 'Updated'} ${updatedRows} goalie stint(s) across ${updatedGames} game(s). ` +
    `Skipped ${skippedGoalies} ambiguous goalie match(es); ${failedGames} game(s) failed.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
