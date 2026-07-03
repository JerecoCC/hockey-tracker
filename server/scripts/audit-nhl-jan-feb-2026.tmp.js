'use strict';

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env.local'), quiet: true });
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: false, quiet: true });

const { sql } = require('../src/db');

const START_DATE = '2026-01-01';
const END_DATE = '2026-03-01';
const DB_START_DATE = '2025-12-31';
const DB_END_DATE = '2026-03-02';
const SEASON_NAME = '2025-26';
const SEASON_CODE = '20252026';
const CONCURRENCY = 2;
const MAX_ISSUES = 400;

const args = new Set(process.argv.slice(2));
const jsonOnly = args.has('--json');
const compact = args.has('--compact');

function log(message) {
  if (!jsonOnly) console.log(message);
}

function addDays(dateValue, days) {
  const date = new Date(`${dateValue}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function gameNoFromId(id) {
  return String(id).slice(-4);
}

function normalizeText(value) {
  return String(value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function htmlCellText(value) {
  return normalizeText(
    String(value ?? '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&#160;/g, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&rsquo;|&#8217;/gi, "'")
      .replace(/&apos;/gi, "'")
      .replace(/&quot;/gi, '"')
      .replace(/<[^>]*>/g, ' '),
  );
}

function normalizeNameKey(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();
}

function normalizeReportPlayerName(value) {
  return normalizeText(value).replace(/\s+\([AC]\)$/i, '');
}

function splitOfficialName(value) {
  const name = normalizeReportPlayerName(value);
  if (name.includes(',')) {
    const [last, first] = name.split(',').map((part) => normalizeText(part));
    return { firstName: first || last, lastName: last || first };
  }
  const parts = name.split(' ').filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] ?? name, lastName: parts[0] ?? name };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function fullNameKey(firstName, lastName) {
  return normalizeNameKey(`${firstName} ${lastName}`);
}

function lastInitialKey(firstName, lastName) {
  return `${normalizeNameKey(lastName)}|${normalizeNameKey(firstName).slice(0, 1)}`;
}

function officialNameKeys(name) {
  const parsed = splitOfficialName(name);
  return {
    full: fullNameKey(parsed.firstName, parsed.lastName),
    lastInitial: lastInitialKey(parsed.firstName, parsed.lastName),
  };
}

function dbNameKeys(player) {
  return {
    full: fullNameKey(player.first_name, player.last_name),
    lastInitial: lastInitialKey(player.first_name, player.last_name),
  };
}

function namesMatch(officialName, dbPlayer) {
  const official = officialNameKeys(officialName);
  const db = dbNameKeys(dbPlayer);
  return official.full === db.full || official.lastInitial === db.lastInitial;
}

function readText(value) {
  if (typeof value === 'string') return value;
  if (typeof value?.default === 'string') return value.default;
  return '';
}

function parseToiSeconds(value) {
  const match = String(value ?? '').trim().match(/^(\d{1,3}):([0-5]\d)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function bool(value) {
  return value === true || value === 'true';
}

function periodName(periodDescriptor) {
  const number = Number(periodDescriptor?.number ?? 1);
  const type = String(periodDescriptor?.periodType ?? '').toUpperCase();
  if (type === 'SO') return 'SO';
  if (type === 'OT' || number > 3) return number <= 4 ? 'OT' : `OT${number - 3}`;
  return String(number);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, label, responseType = 'json', retries = 12) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return responseType === 'text' ? response.text() : response.json();
      lastError = new Error(`${label} HTTP ${response.status}`);
      if (![429, 500, 502, 503, 504].includes(response.status)) break;
      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfter = retryAfterHeader == null ? NaN : Number(retryAfterHeader);
      const fallbackDelay = response.status === 429
        ? Math.min(120000, 15000 * (attempt + 1))
        : Math.min(90000, 3000 * (2 ** attempt));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : fallbackDelay);
    } catch (error) {
      lastError = error;
      await sleep(Math.min(90000, 2500 * (2 ** attempt)));
    }
  }
  throw lastError;
}

async function fetchOptionalText(url, label) {
  try {
    return await fetchWithRetry(url, label, 'text', 3);
  } catch {
    return null;
  }
}

async function mapLimit(items, concurrency, worker) {
  const results = new Array(items.length);
  let index = 0;
  async function run() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

function eachDate(startDate, endDate) {
  const dates = [];
  for (let date = startDate; date < endDate; date = addDays(date, 1)) dates.push(date);
  return dates;
}

async function loadOfficialSchedule() {
  const byId = new Map();
  for (const date of eachDate(START_DATE, END_DATE)) {
    const schedule = await fetchWithRetry(`https://api-web.nhle.com/v1/schedule/${date}`, `schedule ${date}`);
    const week = Array.isArray(schedule?.gameWeek) ? schedule.gameWeek : [];
    const games = week
      .flatMap((entry) =>
        Array.isArray(entry?.games)
          ? entry.games.map((game) => ({ ...game, gameDate: game.gameDate ?? entry.date }))
          : [],
      )
      .filter((game) => game.gameDate === date && Number(game.gameType) === 2);
    for (const game of games) byId.set(String(game.id), game);
  }
  return [...byId.values()].sort((a, b) => Number(a.id) - Number(b.id));
}

function rosterReportUrl(gamecenterId) {
  return `https://www.nhl.com/scores/htmlreports/${SEASON_CODE}/RO${String(gamecenterId).slice(4)}.HTM`;
}

function parseRosterReport(html) {
  if (!html?.trim()) return null;
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[1]);
  const blocks = [];
  let current = null;
  for (const row of rows) {
    const cellMatches = [...row.matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)];
    const cells = cellMatches.map((match) => htmlCellText(match[1])).filter(Boolean);
    if (cells.includes('#') && cells.includes('Pos') && cells.includes('Name')) {
      current = [];
      blocks.push(current);
      continue;
    }
    if (!current || cells.length < 3) continue;
    const sweaterNumber = Number(cells[0]);
    if (!Number.isFinite(sweaterNumber)) continue;
    const position = normalizeText(cells[1]).toUpperCase();
    if (!/^(C|L|R|LW|RW|F|D|LD|RD|G)$/.test(position)) continue;
    current.push({
      sweaterNumber,
      position: position === 'L' ? 'LW' : position === 'R' ? 'RW' : position,
      name: normalizeReportPlayerName(cells[2]),
      starter: /class\s*=\s*["'][^"']*\bbold\b/i.test(row),
    });
  }
  const rosterBlocks = blocks.filter((block) => block.length > 0).slice(0, 2);
  if (rosterBlocks.length < 2) return null;
  return { away: rosterBlocks[0], home: rosterBlocks[1] };
}

async function prepareOfficialGame(scheduleGame) {
  const id = String(scheduleGame.id);
  const [boxscore, playByPlay, rosterHtml] = await Promise.all([
    fetchWithRetry(`https://api-web.nhle.com/v1/gamecenter/${id}/boxscore`, `boxscore ${id}`),
    fetchWithRetry(`https://api-web.nhle.com/v1/gamecenter/${id}/play-by-play`, `play-by-play ${id}`),
    fetchOptionalText(rosterReportUrl(id), `roster ${id}`),
  ]);
  return {
    id,
    game_number: gameNoFromId(id),
    scheduleGame,
    boxscore,
    playByPlay,
    rosterReport: parseRosterReport(rosterHtml),
  };
}

async function loadDbGames() {
  return sql`
    SELECT
      g.id,
      g.season_id,
      g.game_number,
      g.status,
      g.current_period,
      g.overtime_periods,
      g.shootout,
      g.period_shots,
      g.home_team_id,
      g.away_team_id,
      g.home_starting_goalie_id,
      g.away_starting_goalie_id,
      (g.scheduled_at AT TIME ZONE 'UTC')::date::text AS db_utc_date,
      (g.scheduled_at AT TIME ZONE 'America/New_York')::date::text AS db_et_date,
      COALESCE(ati.code, '') AS away_code,
      COALESCE(hti.code, '') AS home_code
    FROM games g
    JOIN seasons s ON s.id = g.season_id
    JOIN leagues l ON l.id = s.league_id
    LEFT JOIN LATERAL (
      SELECT code FROM team_iterations ti
      WHERE ti.team_id = g.away_team_id AND (ti.season_id = g.season_id OR ti.season_id IS NULL)
      ORDER BY CASE WHEN ti.season_id = g.season_id THEN 0 ELSE 1 END, ti.recorded_at DESC
      LIMIT 1
    ) ati ON true
    LEFT JOIN LATERAL (
      SELECT code FROM team_iterations ti
      WHERE ti.team_id = g.home_team_id AND (ti.season_id = g.season_id OR ti.season_id IS NULL)
      ORDER BY CASE WHEN ti.season_id = g.season_id THEN 0 ELSE 1 END, ti.recorded_at DESC
      LIMIT 1
    ) hti ON true
    WHERE UPPER(l.code) = 'NHL'
      AND s.name = ${SEASON_NAME}
      AND g.game_type = 'regular'
      AND (g.scheduled_at AT TIME ZONE 'UTC')::date >= ${DB_START_DATE}::date
      AND (g.scheduled_at AT TIME ZONE 'UTC')::date < ${DB_END_DATE}::date
  `;
}

async function loadDbRosters() {
  return sql`
    SELECT
      gr.game_id,
      gr.team_id,
      gr.player_id,
      p.first_name,
      p.last_name,
      COALESCE(pt_jnh.jersey_number, pt.jersey_number) AS jersey_number,
      COALESCE(pts.position, pt.position, p.position) AS position
    FROM game_rosters gr
    JOIN games g ON g.id = gr.game_id
    JOIN seasons s ON s.id = g.season_id
    JOIN leagues l ON l.id = s.league_id
    JOIN players p ON p.id = gr.player_id
    LEFT JOIN LATERAL (
      SELECT id, jersey_number, position
      FROM player_teams pt
      WHERE pt.player_id = gr.player_id
        AND pt.team_id = gr.team_id
        AND pt.season_id = g.season_id
        AND (pt.start_date IS NULL OR pt.start_date <= COALESCE(g.scheduled_at::date, CURRENT_DATE))
        AND (pt.end_date IS NULL OR pt.end_date >= COALESCE(g.scheduled_at::date, CURRENT_DATE))
      ORDER BY CASE WHEN pt.end_date IS NULL THEN 0 ELSE 1 END, pt.start_date DESC NULLS LAST, pt.created_at DESC
      LIMIT 1
    ) pt ON true
    LEFT JOIN LATERAL (
      SELECT position
      FROM player_team_stints pts
      WHERE pts.player_id = gr.player_id
        AND pts.team_id = gr.team_id
        AND (pts.start_date IS NULL OR pts.start_date <= COALESCE(g.scheduled_at::date, CURRENT_DATE))
        AND (pts.end_date IS NULL OR pts.end_date >= COALESCE(g.scheduled_at::date, CURRENT_DATE))
      ORDER BY CASE WHEN pts.end_date IS NULL THEN 0 ELSE 1 END, pts.start_date DESC NULLS LAST, pts.created_at DESC
      LIMIT 1
    ) pts ON true
    LEFT JOIN LATERAL (
      SELECT jersey_number
      FROM jersey_number_history
      WHERE player_teams_id = pt.id
        AND effective_from <= COALESCE(g.scheduled_at::date, CURRENT_DATE)
      ORDER BY effective_from DESC, id DESC
      LIMIT 1
    ) pt_jnh ON true
    WHERE UPPER(l.code) = 'NHL'
      AND s.name = ${SEASON_NAME}
      AND g.game_type = 'regular'
      AND (g.scheduled_at AT TIME ZONE 'UTC')::date >= ${DB_START_DATE}::date
      AND (g.scheduled_at AT TIME ZONE 'UTC')::date < ${DB_END_DATE}::date
  `;
}

async function loadDbGoals() {
  return sql`
    SELECT game_id, team_id, period, period_time, goal_type, empty_net, penalty_shot,
           scorer_id, assist_1_id, assist_2_id
    FROM goals
    WHERE game_id IN (
      SELECT g.id
      FROM games g
      JOIN seasons s ON s.id = g.season_id
      JOIN leagues l ON l.id = s.league_id
      WHERE UPPER(l.code) = 'NHL'
        AND s.name = ${SEASON_NAME}
        AND g.game_type = 'regular'
        AND (g.scheduled_at AT TIME ZONE 'UTC')::date >= ${DB_START_DATE}::date
        AND (g.scheduled_at AT TIME ZONE 'UTC')::date < ${DB_END_DATE}::date
    )
  `;
}

async function loadDbShootoutAttempts() {
  return sql`
    SELECT game_id, team_id, shooter_id, scored
    FROM shootout_attempts
    WHERE game_id IN (
      SELECT g.id
      FROM games g
      JOIN seasons s ON s.id = g.season_id
      JOIN leagues l ON l.id = s.league_id
      WHERE UPPER(l.code) = 'NHL'
        AND s.name = ${SEASON_NAME}
        AND g.game_type = 'regular'
        AND (g.scheduled_at AT TIME ZONE 'UTC')::date >= ${DB_START_DATE}::date
        AND (g.scheduled_at AT TIME ZONE 'UTC')::date < ${DB_END_DATE}::date
    )
  `;
}

async function loadDbGoalieStints() {
  return sql`
    SELECT game_id, team_id, goalie_id, stint_ord, shots_against, goals_against, time_on_ice
    FROM game_goalie_stints
    WHERE game_id IN (
      SELECT g.id
      FROM games g
      JOIN seasons s ON s.id = g.season_id
      JOIN leagues l ON l.id = s.league_id
      WHERE UPPER(l.code) = 'NHL'
        AND s.name = ${SEASON_NAME}
        AND g.game_type = 'regular'
        AND (g.scheduled_at AT TIME ZONE 'UTC')::date >= ${DB_START_DATE}::date
        AND (g.scheduled_at AT TIME ZONE 'UTC')::date < ${DB_END_DATE}::date
    )
  `;
}

async function loadDbPlayerStats() {
  return sql`
    SELECT game_id, team_id, player_id, position, is_goalie, goals, assists, points,
           shots_against, goals_against, saves, time_on_ice, goalie_started
    FROM game_player_stats
    WHERE game_id IN (
      SELECT g.id
      FROM games g
      JOIN seasons s ON s.id = g.season_id
      JOIN leagues l ON l.id = s.league_id
      WHERE UPPER(l.code) = 'NHL'
        AND s.name = ${SEASON_NAME}
        AND g.game_type = 'regular'
        AND (g.scheduled_at AT TIME ZONE 'UTC')::date >= ${DB_START_DATE}::date
        AND (g.scheduled_at AT TIME ZONE 'UTC')::date < ${DB_END_DATE}::date
    )
  `;
}

async function loadDbTeamStats() {
  return sql`
    SELECT game_id, team_id, goals_for, goals_against, shootout_goals_for,
           shootout_goals_against, shots_for, shots_against, is_shootout
    FROM game_team_stats
    WHERE game_id IN (
      SELECT g.id
      FROM games g
      JOIN seasons s ON s.id = g.season_id
      JOIN leagues l ON l.id = s.league_id
      WHERE UPPER(l.code) = 'NHL'
        AND s.name = ${SEASON_NAME}
        AND g.game_type = 'regular'
        AND (g.scheduled_at AT TIME ZONE 'UTC')::date >= ${DB_START_DATE}::date
        AND (g.scheduled_at AT TIME ZONE 'UTC')::date < ${DB_END_DATE}::date
    )
  `;
}

function groupBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    const values = map.get(key) ?? [];
    values.push(row);
    map.set(key, values);
  }
  return map;
}

function byCompositeDateKey(dbGames) {
  const byKey = new Map();
  for (const game of dbGames) {
    for (const date of [game.db_utc_date, game.db_et_date]) {
      if (!date) continue;
      const key = `${date}|${String(game.away_code).toUpperCase()}|${String(game.home_code).toUpperCase()}`;
      const rows = byKey.get(key) ?? [];
      if (!rows.some((row) => row.id === game.id)) rows.push(game);
      byKey.set(key, rows);
    }
  }
  return byKey;
}

function matchDbGame(dbByKey, official) {
  const away = String(official.boxscore.awayTeam?.abbrev ?? '').toUpperCase();
  const home = String(official.boxscore.homeTeam?.abbrev ?? '').toUpperCase();
  const exactKey = `${official.boxscore.gameDate}|${away}|${home}`;
  const shiftedKey = `${addDays(official.boxscore.gameDate, -1)}|${away}|${home}`;
  const exact = dbByKey.get(exactKey) ?? [];
  if (exact.length === 1) return { game: exact[0], matchType: 'exact' };
  const shifted = dbByKey.get(shiftedKey) ?? [];
  if (shifted.length === 1) return { game: shifted[0], matchType: 'shifted_minus_1' };
  return { game: null, matchType: exact.length > 1 ? 'duplicate_exact' : shifted.length > 1 ? 'duplicate_shifted' : 'missing' };
}

function getNhlPlayers(boxscore, side) {
  const stats = boxscore?.playerByGameStats?.[`${side}Team`] ?? {};
  return ['forwards', 'defense', 'goalies'].flatMap((group) =>
    Array.isArray(stats[group])
      ? stats[group].map((player) => ({
          playerId: Number(player.playerId),
          sweaterNumber: Number(player.sweaterNumber),
          name: readText(player.name) || [readText(player.firstName), readText(player.lastName)].filter(Boolean).join(' '),
          group,
          goals: Number(player.goals ?? 0),
          assists: Number(player.assists ?? 0),
          points: Number(player.points ?? Number(player.goals ?? 0) + Number(player.assists ?? 0)),
          shotsAgainst: Number(player.shotsAgainst ?? 0),
          goalsAgainst: Number(player.goalsAgainst ?? 0),
          saves: Number(player.saves ?? Math.max(0, Number(player.shotsAgainst ?? 0) - Number(player.goalsAgainst ?? 0))),
          toi: parseToiSeconds(player.toi ?? player.timeOnIce),
          starter: bool(player.starter),
        }))
      : [],
  );
}

function getGoalPlays(playByPlay) {
  return (Array.isArray(playByPlay?.plays) ? playByPlay.plays : [])
    .filter((play) => play.typeDescKey === 'goal' && String(play.periodDescriptor?.periodType ?? '').toUpperCase() !== 'SO')
    .map((play) => ({
      period: periodName(play.periodDescriptor),
      periodTime: play.timeInPeriod,
      ownerTeamId: Number(play.details?.eventOwnerTeamId),
      scorerId: Number(play.details?.scoringPlayerId),
      assist1Id: play.details?.assist1PlayerId ? Number(play.details.assist1PlayerId) : null,
      assist2Id: play.details?.assist2PlayerId ? Number(play.details.assist2PlayerId) : null,
      emptyNet: bool(play.details?.emptyNet),
    }));
}

function getShootoutPlays(playByPlay) {
  return (Array.isArray(playByPlay?.plays) ? playByPlay.plays : [])
    .filter((play) => String(play.periodDescriptor?.periodType ?? '').toUpperCase() === 'SO')
    .filter((play) => ['goal', 'missed-shot', 'shot-on-goal'].includes(play.typeDescKey))
    .map((play) => ({
      ownerTeamId: Number(play.details?.eventOwnerTeamId),
      shooterId: Number(play.details?.shootingPlayerId ?? play.details?.scoringPlayerId),
      scored: play.typeDescKey === 'goal',
    }));
}

function officialShots(boxscore) {
  return {
    away: Number(boxscore?.awayTeam?.sog ?? boxscore?.awayTeam?.shotsOnGoal ?? 0),
    home: Number(boxscore?.homeTeam?.sog ?? boxscore?.homeTeam?.shotsOnGoal ?? 0),
  };
}

function dbPeriodShotTotals(game) {
  const rows = Array.isArray(game.period_shots) ? game.period_shots : [];
  return rows.reduce(
    (acc, row) => {
      if (!/^(1|2|3|OT|OT[1-9][0-9]*)$/.test(String(row.period))) return acc;
      acc.away += Number(row.away_shots ?? 0);
      acc.home += Number(row.home_shots ?? 0);
      return acc;
    },
    { away: 0, home: 0 },
  );
}

function addIssue(result, type, details = {}) {
  result.issueCounts[type] = (result.issueCounts[type] ?? 0) + 1;
  result.totalIssues += 1;
  if (details.game_number) {
    const row = { game_number: details.game_number, matchup: details.matchup };
    const existing = result.issueGamesByType[type] ?? [];
    if (!existing.some((item) => item.game_number === row.game_number && item.matchup === row.matchup)) {
      existing.push(row);
    }
    result.issueGamesByType[type] = existing;
  }
  if (type !== 'game_number_mismatch') {
    const rows = result.issueDetailsByType[type] ?? [];
    rows.push({ ...details });
    result.issueDetailsByType[type] = rows;
  }
  if (!compact && result.issues.length < MAX_ISSUES) {
    result.issues.push({
      game_number: details.game_number,
      matchup: details.matchup,
      type,
      ...Object.fromEntries(Object.entries(details).filter(([key]) => !['game_number', 'matchup'].includes(key))),
    });
  }
}

function teamCode(game, side) {
  return side === 'away' ? game.away_code : game.home_code;
}

function teamId(game, side) {
  return side === 'away' ? game.away_team_id : game.home_team_id;
}

function compareRosterSide(context, side, reportPlayers, dbRosterRows, matchedByOfficialName) {
  const { result, official, game, matchup } = context;
  const code = teamCode(game, side);
  const sideTeamId = teamId(game, side);
  const sideRows = dbRosterRows.filter((row) => row.team_id === sideTeamId);
  const byJersey = groupBy(sideRows, (row) => String(row.jersey_number ?? ''));
  const usedDbIds = new Set();
  const matches = new Map();

  if (!reportPlayers) {
    addIssue(result, 'missing_roster_report', { game_number: official.game_number, matchup, team: code });
    return { matches, sideRows };
  }

  if (sideRows.length !== reportPlayers.length) {
    addIssue(result, 'roster_count_mismatch', {
      game_number: official.game_number,
      matchup,
      team: code,
      db_count: sideRows.length,
      official_count: reportPlayers.length,
    });
  }

  for (const reportPlayer of reportPlayers) {
    const sameName = sideRows.filter((row) => namesMatch(reportPlayer.name, row));
    const jerseyRows = byJersey.get(String(reportPlayer.sweaterNumber)) ?? [];
    let matched = null;
    if (sameName.length === 1) {
      matched = sameName[0];
      if (Number(matched.jersey_number) !== Number(reportPlayer.sweaterNumber)) {
        addIssue(result, 'jersey_history_mismatch', {
          game_number: official.game_number,
          matchup,
          team: code,
          player: reportPlayer.name,
          official_jersey: reportPlayer.sweaterNumber,
          db_jersey: matched.jersey_number,
        });
      }
      if (jerseyRows.length === 1 && jerseyRows[0].player_id !== matched.player_id) {
        addIssue(result, 'jersey_conflict_wrong_player', {
          game_number: official.game_number,
          matchup,
          team: code,
          official_jersey: reportPlayer.sweaterNumber,
          official_player: reportPlayer.name,
          db_player: `${jerseyRows[0].first_name} ${jerseyRows[0].last_name}`,
        });
      }
    } else if (jerseyRows.length === 1) {
      matched = jerseyRows[0];
      if (!namesMatch(reportPlayer.name, matched)) {
        addIssue(result, 'jersey_match_name_mismatch', {
          game_number: official.game_number,
          matchup,
          team: code,
          official_jersey: reportPlayer.sweaterNumber,
          official_player: reportPlayer.name,
          db_player: `${matched.first_name} ${matched.last_name}`,
        });
      }
    } else if (jerseyRows.length > 1) {
      addIssue(result, 'duplicate_roster_jersey', {
        game_number: official.game_number,
        matchup,
        team: code,
        jersey: reportPlayer.sweaterNumber,
        players: jerseyRows.map((row) => `${row.first_name} ${row.last_name}`).join(', '),
      });
    } else {
      addIssue(result, 'missing_roster_player', {
        game_number: official.game_number,
        matchup,
        team: code,
        official_jersey: reportPlayer.sweaterNumber,
        official_player: reportPlayer.name,
      });
    }

    if (matched) {
      usedDbIds.add(matched.player_id);
      const key = officialNameKeys(reportPlayer.name).full;
      matchedByOfficialName.set(`${side}|${key}`, matched);
      matches.set(`${reportPlayer.sweaterNumber}|${normalizeNameKey(reportPlayer.name)}`, matched);
    }
  }

  for (const row of sideRows) {
    if (!usedDbIds.has(row.player_id)) {
      addIssue(result, 'extra_roster_player', {
        game_number: official.game_number,
        matchup,
        team: code,
        db_jersey: row.jersey_number,
        db_player: `${row.first_name} ${row.last_name}`,
      });
    }
  }

  return { matches, sideRows };
}

function findMatchedDbPlayer(sideRows, officialPlayer, reportPlayers) {
  const report = reportPlayers?.find((player) => player.sweaterNumber === officialPlayer.sweaterNumber);
  const officialName = report?.name || officialPlayer.name;
  const sameName = sideRows.filter((row) => namesMatch(officialName, row));
  if (sameName.length === 1) return sameName[0];
  const jerseyRows = sideRows.filter((row) => Number(row.jersey_number) === Number(officialPlayer.sweaterNumber));
  if (jerseyRows.length === 1) return jerseyRows[0];
  return null;
}

function auditOfficialGame(context, groups) {
  const { result, official, game } = context;
  const matchup = `${official.boxscore.awayTeam?.abbrev}@${official.boxscore.homeTeam?.abbrev}`;
  context.matchup = matchup;

  if (game.game_number !== Number(official.game_number)) {
    addIssue(result, 'game_number_mismatch', {
      game_number: official.game_number,
      matchup,
      db_game_number: game.game_number,
    });
  }

  if (game.db_utc_date !== official.boxscore.gameDate && game.db_et_date !== official.boxscore.gameDate) {
    addIssue(result, 'scheduled_date_mismatch', {
      game_number: official.game_number,
      matchup,
      official_date: official.boxscore.gameDate,
      db_utc_date: game.db_utc_date,
      db_et_date: game.db_et_date,
    });
  }

  if (game.status !== 'final') {
    addIssue(result, 'status_not_final', { game_number: official.game_number, matchup, status: game.status });
  }

  const rosterRows = groups.rosters.get(game.id) ?? [];
  const matchedByOfficialName = new Map();
  const awayRoster = compareRosterSide(context, 'away', official.rosterReport?.away, rosterRows, matchedByOfficialName);
  const homeRoster = compareRosterSide(context, 'home', official.rosterReport?.home, rosterRows, matchedByOfficialName);
  const rosterBySide = { away: awayRoster.sideRows, home: homeRoster.sideRows };
  const reportBySide = { away: official.rosterReport?.away ?? [], home: official.rosterReport?.home ?? [] };

  for (const side of ['away', 'home']) {
    const starter = reportBySide[side].find((player) => player.position === 'G' && player.starter);
    const dbStarterId = side === 'away' ? game.away_starting_goalie_id : game.home_starting_goalie_id;
    if (!starter) {
      addIssue(result, 'official_starting_goalie_missing', { game_number: official.game_number, matchup, team: teamCode(game, side) });
      continue;
    }
    const matched = findMatchedDbPlayer(rosterBySide[side], { sweaterNumber: starter.sweaterNumber, name: starter.name }, reportBySide[side]);
    if (!matched) {
      addIssue(result, 'starting_goalie_unmatched', {
        game_number: official.game_number,
        matchup,
        team: teamCode(game, side),
        official_goalie: starter.name,
      });
    } else if (dbStarterId !== matched.player_id) {
      addIssue(result, 'starting_goalie_mismatch', {
        game_number: official.game_number,
        matchup,
        team: teamCode(game, side),
        official_goalie: starter.name,
        db_goalie_id: dbStarterId,
        expected_goalie_id: matched.player_id,
      });
    }
  }

  const officialGoals = getGoalPlays(official.playByPlay);
  const dbGoals = groups.goals.get(game.id) ?? [];
  if (dbGoals.length !== officialGoals.length) {
    addIssue(result, 'goal_count_mismatch', {
      game_number: official.game_number,
      matchup,
      db_goals: dbGoals.length,
      official_goals: officialGoals.length,
    });
  }

  const officialGoalCounts = { away: 0, home: 0 };
  for (const goal of officialGoals) {
    if (goal.ownerTeamId === Number(official.boxscore.awayTeam?.id)) officialGoalCounts.away += 1;
    if (goal.ownerTeamId === Number(official.boxscore.homeTeam?.id)) officialGoalCounts.home += 1;
  }
  const dbGoalCounts = {
    away: dbGoals.filter((goal) => goal.team_id === game.away_team_id && goal.period !== 'SO').length,
    home: dbGoals.filter((goal) => goal.team_id === game.home_team_id && goal.period !== 'SO').length,
  };
  for (const side of ['away', 'home']) {
    if (dbGoalCounts[side] !== officialGoalCounts[side]) {
      addIssue(result, 'team_goal_count_mismatch', {
        game_number: official.game_number,
        matchup,
        team: teamCode(game, side),
        db_goals: dbGoalCounts[side],
        official_goals: officialGoalCounts[side],
      });
    }
  }

  const officialShootout = getShootoutPlays(official.playByPlay);
  const dbShootout = groups.shootouts.get(game.id) ?? [];
  if (dbShootout.length !== officialShootout.length) {
    addIssue(result, 'shootout_attempt_count_mismatch', {
      game_number: official.game_number,
      matchup,
      db_attempts: dbShootout.length,
      official_attempts: officialShootout.length,
    });
  }

  const shots = officialShots(official.boxscore);
  const dbShotTotals = dbPeriodShotTotals(game);
  if (shots.away && dbShotTotals.away !== shots.away) {
    addIssue(result, 'period_shots_mismatch', {
      game_number: official.game_number,
      matchup,
      team: teamCode(game, 'away'),
      db_shots: dbShotTotals.away,
      official_shots: shots.away,
    });
  }
  if (shots.home && dbShotTotals.home !== shots.home) {
    addIssue(result, 'period_shots_mismatch', {
      game_number: official.game_number,
      matchup,
      team: teamCode(game, 'home'),
      db_shots: dbShotTotals.home,
      official_shots: shots.home,
    });
  }

  const teamStats = groups.teamStats.get(game.id) ?? [];
  if (teamStats.length !== 2) {
    addIssue(result, 'team_stats_count_mismatch', { game_number: official.game_number, matchup, db_rows: teamStats.length });
  }
  for (const side of ['away', 'home']) {
    const row = teamStats.find((stat) => stat.team_id === teamId(game, side));
    if (!row) continue;
    const officialFor = side === 'away' ? officialGoalCounts.away : officialGoalCounts.home;
    const officialAgainst = side === 'away' ? officialGoalCounts.home : officialGoalCounts.away;
    const officialShotsFor = side === 'away' ? shots.away : shots.home;
    if (row.goals_for !== officialFor || row.goals_against !== officialAgainst) {
      addIssue(result, 'team_stats_goals_mismatch', {
        game_number: official.game_number,
        matchup,
        team: teamCode(game, side),
        db_for: row.goals_for,
        db_against: row.goals_against,
        official_for: officialFor,
        official_against: officialAgainst,
      });
    }
    if (officialShotsFor && row.shots_for !== officialShotsFor) {
      addIssue(result, 'team_stats_shots_mismatch', {
        game_number: official.game_number,
        matchup,
        team: teamCode(game, side),
        db_shots: row.shots_for,
        official_shots: officialShotsFor,
      });
    }
  }

  const playerStats = groups.playerStats.get(game.id) ?? [];
  const playerStatsByPlayer = new Map(playerStats.map((row) => [row.player_id, row]));
  const expectedPlayerStatIds = new Set();

  for (const side of ['away', 'home']) {
    const nhlPlayers = getNhlPlayers(official.boxscore, side);
    for (const nhlPlayer of nhlPlayers) {
      const playedGoalie = nhlPlayer.group === 'goalies' && ((nhlPlayer.toi ?? 0) > 0 || nhlPlayer.shotsAgainst > 0);
      const shouldHavePlayerStat = nhlPlayer.group !== 'goalies' || playedGoalie;
      if (!shouldHavePlayerStat) continue;

      const matched = findMatchedDbPlayer(rosterBySide[side], nhlPlayer, reportBySide[side]);
      if (!matched) {
        addIssue(result, 'boxscore_player_unmatched', {
          game_number: official.game_number,
          matchup,
          team: teamCode(game, side),
          official_jersey: nhlPlayer.sweaterNumber,
          official_player: nhlPlayer.name,
        });
        continue;
      }
      const stat = playerStatsByPlayer.get(matched.player_id);
      expectedPlayerStatIds.add(matched.player_id);
      if (!stat) {
        addIssue(result, 'missing_player_stat', {
          game_number: official.game_number,
          matchup,
          team: teamCode(game, side),
          player: `${matched.first_name} ${matched.last_name}`,
        });
        continue;
      }
      if (stat.goals !== nhlPlayer.goals || stat.assists !== nhlPlayer.assists || stat.points !== nhlPlayer.points) {
        addIssue(result, 'player_scoring_stat_mismatch', {
          game_number: official.game_number,
          matchup,
          team: teamCode(game, side),
          player: `${matched.first_name} ${matched.last_name}`,
          db: `${stat.goals}-${stat.assists}-${stat.points}`,
          official: `${nhlPlayer.goals}-${nhlPlayer.assists}-${nhlPlayer.points}`,
        });
      }
      if (playedGoalie) {
        if (
          stat.shots_against !== nhlPlayer.shotsAgainst ||
          stat.goals_against !== nhlPlayer.goalsAgainst ||
          stat.saves !== nhlPlayer.saves ||
          (nhlPlayer.toi != null && stat.time_on_ice !== nhlPlayer.toi)
        ) {
          addIssue(result, 'goalie_player_stat_mismatch', {
            game_number: official.game_number,
            matchup,
            team: teamCode(game, side),
            goalie: `${matched.first_name} ${matched.last_name}`,
            db: `SA ${stat.shots_against}, GA ${stat.goals_against}, SV ${stat.saves}, TOI ${stat.time_on_ice}`,
            official: `SA ${nhlPlayer.shotsAgainst}, GA ${nhlPlayer.goalsAgainst}, SV ${nhlPlayer.saves}, TOI ${nhlPlayer.toi}`,
          });
        }
      }
    }
  }

  if (playerStats.length !== expectedPlayerStatIds.size) {
    addIssue(result, 'player_stats_count_mismatch', {
      game_number: official.game_number,
      matchup,
      db_rows: playerStats.length,
      expected_rows: expectedPlayerStatIds.size,
    });
  }

  const stints = groups.goalieStints.get(game.id) ?? [];
  if (stints.length < 2) {
    addIssue(result, 'goalie_stints_count_mismatch', { game_number: official.game_number, matchup, db_rows: stints.length });
  }

  for (const side of ['away', 'home']) {
    const goaliePlayers = getNhlPlayers(official.boxscore, side).filter((player) => player.group === 'goalies' && ((player.toi ?? 0) > 0 || player.shotsAgainst > 0));
    for (const goalie of goaliePlayers) {
      const matched = findMatchedDbPlayer(rosterBySide[side], goalie, reportBySide[side]);
      if (!matched) continue;
      const goalieStints = stints.filter((stint) => stint.goalie_id === matched.player_id);
      const totals = goalieStints.reduce(
        (acc, stint) => {
          acc.shotsAgainst += Number(stint.shots_against ?? 0);
          acc.goalsAgainst += Number(stint.goals_against ?? 0);
          acc.toi += Number(stint.time_on_ice ?? 0);
          return acc;
        },
        { shotsAgainst: 0, goalsAgainst: 0, toi: 0 },
      );
      if (
        goalieStints.length === 0 ||
        totals.shotsAgainst !== goalie.shotsAgainst ||
        totals.goalsAgainst !== goalie.goalsAgainst ||
        (goalie.toi != null && totals.toi !== goalie.toi)
      ) {
        addIssue(result, 'goalie_stint_totals_mismatch', {
          game_number: official.game_number,
          matchup,
          team: teamCode(game, side),
          goalie: `${matched.first_name} ${matched.last_name}`,
          db: `stints ${goalieStints.length}, SA ${totals.shotsAgainst}, GA ${totals.goalsAgainst}, TOI ${totals.toi}`,
          official: `SA ${goalie.shotsAgainst}, GA ${goalie.goalsAgainst}, TOI ${goalie.toi}`,
        });
      }
    }
  }
}

async function main() {
  log(`Fetching official NHL schedule ${START_DATE} to ${addDays(END_DATE, -1)}...`);
  const schedule = await loadOfficialSchedule();
  log(`Official regular games: ${schedule.length}`);

  log('Loading DB games and related rows...');
  const [dbGames, rosters, goals, shootouts, goalieStints, playerStats, teamStats] = await Promise.all([
    loadDbGames(),
    loadDbRosters(),
    loadDbGoals(),
    loadDbShootoutAttempts(),
    loadDbGoalieStints(),
    loadDbPlayerStats(),
    loadDbTeamStats(),
  ]);

  log('Fetching NHL boxscore/play-by-play/report data...');
  const officialGames = await mapLimit(schedule, CONCURRENCY, async (game, index) => {
    const prepared = await prepareOfficialGame(game);
    if (!jsonOnly && ((index + 1) % 25 === 0 || index === schedule.length - 1)) {
      log(`Prepared ${index + 1}/${schedule.length} through ${prepared.game_number}`);
    }
    return prepared;
  });

  const groups = {
    rosters: groupBy(rosters, (row) => row.game_id),
    goals: groupBy(goals, (row) => row.game_id),
    shootouts: groupBy(shootouts, (row) => row.game_id),
    goalieStints: groupBy(goalieStints, (row) => row.game_id),
    playerStats: groupBy(playerStats, (row) => row.game_id),
    teamStats: groupBy(teamStats, (row) => row.game_id),
  };

  const dbByKey = byCompositeDateKey(dbGames);
  const result = {
    range: { start: START_DATE, end_exclusive: END_DATE },
    officialGames: schedule.length,
    dbCandidates: dbGames.length,
    matchedGames: 0,
    cleanGames: 0,
    totalIssues: 0,
    issueCounts: {},
    issueGamesByType: {},
    issueDetailsByType: {},
    matchTypes: {},
    issues: [],
    clean: [],
  };

  const matchedDbIds = new Set();
  for (const official of officialGames) {
    const matchup = `${official.boxscore.awayTeam?.abbrev}@${official.boxscore.homeTeam?.abbrev}`;
    const beforeIssues = result.totalIssues;
    const { game, matchType } = matchDbGame(dbByKey, official);
    result.matchTypes[matchType] = (result.matchTypes[matchType] ?? 0) + 1;
    if (!game) {
      addIssue(result, 'db_game_not_found', {
        game_number: official.game_number,
        matchup,
        official_date: official.boxscore.gameDate,
        match_type: matchType,
      });
      continue;
    }
    matchedDbIds.add(game.id);
    result.matchedGames += 1;
    auditOfficialGame({ result, official, game, matchup }, groups);
    if (result.totalIssues === beforeIssues) {
      result.cleanGames += 1;
      result.clean.push({ game_number: official.game_number, matchup });
    }
  }

  const officialDateSet = new Set(eachDate(START_DATE, END_DATE));
  for (const game of dbGames) {
    const inWindow = officialDateSet.has(game.db_utc_date) || officialDateSet.has(game.db_et_date);
    if (inWindow && !matchedDbIds.has(game.id)) {
      addIssue(result, 'extra_db_game', {
        game_number: game.game_number == null ? null : String(game.game_number).padStart(4, '0'),
        matchup: `${game.away_code}@${game.home_code}`,
        db_utc_date: game.db_utc_date,
        db_et_date: game.db_et_date,
      });
    }
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
