import axios from "axios";
import { toast } from "react-toastify";

export type TeamSide = 'away' | 'home';

export interface Goalie {
  playerId: number;
  name: string;
  teamId?: number;
  teamAbbrev?: string;
  toi?: string;
  shotsAgainst?: number;
  saves?: number;
  goalsAgainst?: number;
  starter?: boolean;
}

export interface GoaliesByTeam {
  away: Goalie[];
  home: Goalie[];
}

export interface GoalieStint {
  teamSide: TeamSide;
  teamAbbrev: string;
  goalieId: number;
  goalieName: string;
  enteredPeriod: string;
  enteredTime: string;
  exitedPeriod: string | null;
  exitedTime: string | null;
  toi?: string;
  timingUnavailable?: boolean;
}

export interface NhlGoalieSwitchTeamReport {
  side: TeamSide;
  abbrev: string;
  switchDetected: boolean;
  trueGoalies: Goalie[];
  stints: GoalieStint[];
  timingUnavailable: boolean;
}

export interface NhlGoalieSwitchReport {
  gameId: string;
  scheduledStart: string | null;
  away: NhlGoalieSwitchTeamReport;
  home: NhlGoalieSwitchTeamReport;
}

interface TeamMeta {
  id?: number;
  abbrev: string;
}

interface GoalieObservation {
  teamSide: TeamSide;
  goalieId: number;
  period: number;
  timeInPeriod: string;
  sortOrder: number;
  typeDescKey?: string;
}

interface NhlShiftChartRow {
  playerId?: number;
  teamAbbrev?: string;
  period?: number;
  startTime?: string;
  endTime?: string;
  duration?: string;
}

interface HtmlGoalieShift {
  goalie: Goalie;
  teamSide: TeamSide;
  period: number;
  startTime: string;
  endTime: string;
  duration?: string;
}

export interface NhlGameIdContext {
  seasonName?: string | null;
  scheduledAt?: string | null;
}

const API = import.meta.env.VITE_API_URL || '/api';
const NHL_GAMECENTER_RE = /\/gamecenter\/(\d+)(?:\/|$)/i;
const NHL_FULL_GAME_ID_RE = /^\d{10}$/;
const NHL_SHORT_GAME_NUMBER_RE = /^\d{1,4}$/;
const SWITCH_EVENT_RE = /\b(goalie|keeper)\b/i;
const SWITCH_ACTION_RE =
  /\b(change|changed|enter|entered|left|leave|pulled|pull|returned|return|replace|reliev)/i;
const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});
export function extractGameIdFromNhlUrl(url: string): string | null {
  return url.match(NHL_GAMECENTER_RE)?.[1] ?? null;
}

export function buildNhlGamecenterGameId(input: string, context: NhlGameIdContext = {}): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const gamecenterId = extractGameIdFromNhlUrl(trimmed);
  if (gamecenterId) return gamecenterId;
  if (NHL_FULL_GAME_ID_RE.test(trimmed)) return trimmed;
  if (!NHL_SHORT_GAME_NUMBER_RE.test(trimmed)) return null;

  const seasonStartYear = getSeasonStartYear(context);
  if (seasonStartYear == null) return null;

  return `${seasonStartYear}02${trimmed.padStart(4, '0')}`;
}

export function formatEasternStartTime(startTimeUTC: string): string {
  const date = new Date(startTimeUTC);
  if (Number.isNaN(date.getTime())) return startTimeUTC;

  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}

export function getGoaliesFromLanding(landing: any): GoaliesByTeam {
  const stats =
    landing?.boxscore?.playerByGameStats ??
    landing?.playerByGameStats ??
    landing?.summary?.playerByGameStats;

  const awayMeta = getTeamMeta(landing, 'away');
  const homeMeta = getTeamMeta(landing, 'home');

  return {
    away: normalizeGoalies(stats?.awayTeam?.goalies ?? landing?.awayTeam?.goalies, awayMeta),
    home: normalizeGoalies(stats?.homeTeam?.goalies ?? landing?.homeTeam?.goalies, homeMeta),
  };
}

export function goalieActuallyPlayed(goalie: Goalie): boolean {
  const toi = goalie.toi?.trim();
  return (
    (!!toi && toi !== '00:00' && toi !== '0:00') ||
    (goalie.shotsAgainst ?? 0) > 0 ||
    (goalie.saves ?? 0) > 0 ||
    (goalie.goalsAgainst ?? 0) > 0
  );
}

export function detectGoalieSwitch(goalies: Goalie[]): boolean {
  return goalies.filter(goalieActuallyPlayed).length > 1;
}

export function buildGoalieStints(playByPlay: any, goaliesByTeam: GoaliesByTeam): GoalieStint[] {
  const teamGoalies = {
    away: playableGoalies(goaliesByTeam.away),
    home: playableGoalies(goaliesByTeam.home),
  } satisfies GoaliesByTeam;
  const goalieTeamById = buildGoalieTeamMap(teamGoalies);

  // The NHL feed can expose goalie changes as explicit text events in some seasons,
  // but the current GameCenter feed mostly exposes the goalie in net on shot/goal
  // events. Use explicit events first when they contain a real goalie id, then
  // derive stints from on-ice goalie ids as a fallback.
  const explicitObservations = extractExplicitGoalieObservations(playByPlay, goalieTeamById);
  const observations =
    explicitObservations.length > 0
      ? explicitObservations
      : extractOnIceGoalieObservations(playByPlay, goalieTeamById);

  return (['away', 'home'] as const).flatMap((side) =>
    buildTeamStints(side, teamGoalies[side], observations),
  );
}

export async function fetchNhlGoalieSwitchReport(
  input: string,
  context: NhlGameIdContext = {},
): Promise<NhlGoalieSwitchReport> {
  const gameId = buildNhlGamecenterGameId(input, context);
  if (!gameId) {
    throw new Error('Enter an NHL game number, full GameCenter id, or GameCenter URL.');
  }

  const base = `https://api-web.nhle.com/v1/gamecenter/${gameId}`;
  const landing = await fetchJson(`${base}/landing`);

  let goaliesByTeam = getGoaliesFromLanding(landing);

  // Some current NHL landing responses omit playerByGameStats. Fetch boxscore as
  // a stats-only fallback while still normalizing through getGoaliesFromLanding.
  if (goaliesByTeam.away.length === 0 && goaliesByTeam.home.length === 0) {
    const boxscore = await fetchJson(`${base}/boxscore`);
    goaliesByTeam = getGoaliesFromLanding(boxscore);
  }

  const hasGoalieSwitch =
    detectGoalieSwitch(goaliesByTeam.away) || detectGoalieSwitch(goaliesByTeam.home);
  const htmlStints = hasGoalieSwitch
    ? buildGoalieStintsFromToiHtml(await fetchToiHtmlReports(gameId), goaliesByTeam)
    : [];
  const awayMeta = getTeamMeta(landing, 'away');
  const homeMeta = getTeamMeta(landing, 'home');

  return {
    gameId,
    scheduledStart: landing?.startTimeUTC ? formatEasternStartTime(landing.startTimeUTC) : null,
    away: buildTeamReport('away', awayMeta.abbrev, goaliesByTeam.away, htmlStints),
    home: buildTeamReport('home', homeMeta.abbrev, goaliesByTeam.home, htmlStints),
  };
}

async function fetchJson(url: string) {
  try {
        const { data } =  await axios.get(`${API}/admin/games/nhl-api?url=${encodeURIComponent(url)}`, { headers: authHeaders() });
        return data;
      } catch (err) {
        toast.error('API Error');
        return [];
      }
}

async function fetchOptionalJson(url: string) {
  try {
    const { data } = await axios.get(
      `${API}/admin/games/nhl-api?url=${encodeURIComponent(url)}`,
      { headers: authHeaders() },
    );
    return data;
  } catch {
    return null;
  }
}

async function fetchShiftChart(gameId: string) {
  return fetchOptionalJson(
    `https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=${gameId}`,
  );
}

async function fetchToiHtmlReports(gameId: string) {
  const urls = buildToiHtmlReportUrls(gameId);
  const reports = await Promise.all(urls.map((url) => fetchOptionalText(url)));
  return reports.filter((report): report is string => typeof report === 'string' && !!report);
}

async function fetchOptionalText(url: string): Promise<string | null> {
  try {
    const { data } = await axios.get(
      `${API}/admin/games/nhl-api?url=${encodeURIComponent(url)}`,
      { headers: authHeaders(), responseType: 'text' },
    );
    return typeof data === 'string' ? data : null;
  } catch {
    return null;
  }
}

function buildToiHtmlReportUrls(gameId: string): string[] {
  const seasonStart = gameId.slice(0, 4);
  const seasonEnd = String(Number(seasonStart) + 1);
  const gameTypeAndNumber = gameId.slice(4);
  return ['TV', 'TH'].map(
    (prefix) =>
      `https://www.nhl.com/scores/htmlreports/${seasonStart}${seasonEnd}/${prefix}${gameTypeAndNumber}.HTM`,
  );
}

function buildTeamReport(
  side: TeamSide,
  abbrev: string,
  goalies: Goalie[],
  allStints: GoalieStint[],
): NhlGoalieSwitchTeamReport {
  const trueGoalies = goalies.filter(goalieActuallyPlayed);
  const stints = allStints.filter((stint) => stint.teamSide === side);
  const stintGoalieIds = new Set(stints.map((stint) => stint.goalieId));
  const switchDetected = detectGoalieSwitch(goalies);

  return {
    side,
    abbrev,
    switchDetected,
    trueGoalies,
    stints,
    timingUnavailable:
      stints.some((stint) => stint.timingUnavailable) ||
      (switchDetected && trueGoalies.some((goalie) => !stintGoalieIds.has(goalie.playerId))),
  };
}

function getTeamMeta(source: any, side: TeamSide): TeamMeta {
  const team = source?.[`${side}Team`];
  return {
    id: toOptionalNumber(team?.id),
    abbrev: readLocalizedText(team?.abbrev) ?? team?.abbrev ?? side.toUpperCase(),
  };
}

function normalizeGoalies(rawGoalies: any, teamMeta: TeamMeta): Goalie[] {
  if (!Array.isArray(rawGoalies)) return [];

  return rawGoalies
    .map((raw) => {
      const playerId = toOptionalNumber(raw?.playerId ?? raw?.goalieId ?? raw?.id);
      if (playerId == null) return null;

      const fullName = [readLocalizedText(raw?.firstName), readLocalizedText(raw?.lastName)]
        .filter(Boolean)
        .join(' ');

      return {
        playerId,
        name: readLocalizedText(raw?.name) ?? fullName ?? `Goalie ${playerId}`,
        teamId: toOptionalNumber(raw?.teamId) ?? teamMeta.id,
        teamAbbrev: readLocalizedText(raw?.teamAbbrev) ?? teamMeta.abbrev,
        toi: typeof raw?.toi === 'string' ? raw.toi : undefined,
        shotsAgainst: toOptionalNumber(raw?.shotsAgainst),
        saves: toOptionalNumber(raw?.saves),
        goalsAgainst: toOptionalNumber(raw?.goalsAgainst),
        starter: typeof raw?.starter === 'boolean' ? raw.starter : undefined,
      } satisfies Goalie;
    })
    .filter((goalie): goalie is Goalie => !!goalie);
}

function readLocalizedText(value: any): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value?.default === 'string') return value.default;
  return undefined;
}

function toOptionalNumber(value: any): number | undefined {
  if (value == null || value === '') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function playableGoalies(goalies: Goalie[]): Goalie[] {
  const trueGoalies = goalies.filter(goalieActuallyPlayed);
  return trueGoalies.length > 0 ? trueGoalies : goalies;
}

function buildGoalieTeamMap(goaliesByTeam: GoaliesByTeam) {
  const map = new Map<number, { side: TeamSide; goalie: Goalie }>();
  for (const side of ['away', 'home'] as const) {
    for (const goalie of goaliesByTeam[side]) {
      map.set(goalie.playerId, { side, goalie });
    }
  }
  return map;
}

function extractExplicitGoalieObservations(
  playByPlay: any,
  goalieTeamById: Map<number, { side: TeamSide; goalie: Goalie }>,
): GoalieObservation[] {
  return getPlays(playByPlay).flatMap((play) => {
    const text = collectStringValues(play).join(' ');
    if (!SWITCH_EVENT_RE.test(text) || !SWITCH_ACTION_RE.test(text)) return [];

    return collectGoalieIds(play, goalieTeamById).map((goalieId) =>
      toObservation(play, goalieId, goalieTeamById.get(goalieId)!.side),
    );
  });
}

function extractOnIceGoalieObservations(
  playByPlay: any,
  goalieTeamById: Map<number, { side: TeamSide; goalie: Goalie }>,
): GoalieObservation[] {
  return getPlays(playByPlay).flatMap((play) =>
    collectGoalieIds(play, goalieTeamById).map((goalieId) =>
      toObservation(play, goalieId, goalieTeamById.get(goalieId)!.side),
    ),
  );
}

export function buildGoalieStintsFromToiHtml(
  reports: string | string[] | null | undefined,
  goaliesByTeam: GoaliesByTeam,
): GoalieStint[] {
  const htmlReports = Array.isArray(reports) ? reports : reports ? [reports] : [];
  if (htmlReports.length === 0) return [];

  const teamGoalies = {
    away: playableGoalies(goaliesByTeam.away),
    home: playableGoalies(goaliesByTeam.home),
  } satisfies GoaliesByTeam;

  const shifts = htmlReports.flatMap((html) => extractHtmlGoalieShifts(html, teamGoalies));
  const rawStints = shifts
    .map(({ goalie, teamSide, period, startTime, endTime, duration }) => ({
      teamSide,
      teamAbbrev: goalie.teamAbbrev ?? teamSide.toUpperCase(),
      goalieId: goalie.playerId,
      goalieName: goalie.name,
      enteredPeriod: periodLabel(period),
      enteredTime: normalizeClock(startTime),
      exitedPeriod: periodLabel(period),
      exitedTime: normalizeClock(endTime),
      toi: goalie.toi ?? duration,
    }))
    .sort(
      (a, b) =>
        stintSortValue(a.enteredPeriod, a.enteredTime) -
        stintSortValue(b.enteredPeriod, b.enteredTime),
    );

  return completeMissingGoalieStintsFromToiHtml(
    mergeAdjacentGoalieShiftStints(rawStints),
    teamGoalies,
  );
}

function extractHtmlGoalieShifts(html: string, goaliesByTeam: GoaliesByTeam): HtmlGoalieShift[] {
  const text = htmlToText(html);
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const goalieEntries = (['away', 'home'] as const).flatMap((teamSide) =>
    goaliesByTeam[teamSide].map((goalie) => ({
      teamSide,
      goalie,
      reportName: toHtmlReportName(goalie.name),
      reportLastName: toHtmlReportLastName(goalie.name),
    })),
  );
  const shifts: HtmlGoalieShift[] = [];
  let active: { teamSide: TeamSide; goalie: Goalie } | null = null;

  for (const line of lines) {
    const matchedGoalie = goalieEntries.find(
      ({ reportName, reportLastName }) =>
        new RegExp(`^\\d+\\s+${escapeRegExp(reportName)}\\b`, 'i').test(line) ||
        new RegExp(`^\\d+\\s+${escapeRegExp(reportLastName)},(?:\\s|$)`, 'i').test(line),
    );
    if (matchedGoalie) {
      active = { teamSide: matchedGoalie.teamSide, goalie: matchedGoalie.goalie };
      continue;
    }

    if (!active) continue;
    if (/^Per SHF\b/i.test(line) || /^TOT\b/i.test(line)) {
      active = null;
      continue;
    }

    const shift = line.match(
      /^\d+\s+(\d+)\s+(\d{1,2}:\d{2})\s*\/\s*\d{1,2}:\d{2}\s+(\d{1,2}:\d{2})\s*\/\s*\d{1,2}:\d{2}\s+(\d{1,2}:\d{2})\b/,
    );
    if (!shift) continue;

    shifts.push({
      ...active,
      period: Number(shift[1]),
      startTime: normalizeClock(shift[2]),
      endTime: normalizeClock(shift[3]),
      duration: normalizeClock(shift[4]),
    });
  }

  return shifts;
}

export function buildGoalieStintsFromShiftChart(
  shiftChart: any,
  goaliesByTeam: GoaliesByTeam,
): GoalieStint[] {
  const rows = Array.isArray(shiftChart?.data) ? shiftChart.data : [];
  if (rows.length === 0) return [];

  const teamGoalies = {
    away: playableGoalies(goaliesByTeam.away),
    home: playableGoalies(goaliesByTeam.home),
  } satisfies GoaliesByTeam;
  const goalieTeamById = buildGoalieTeamMap(teamGoalies);

  const rawStints = rows
    .map((row: NhlShiftChartRow) => {
      const playerId = toOptionalNumber(row?.playerId);
      if (playerId == null) return null;

      const goalieInfo = goalieTeamById.get(playerId);
      if (!goalieInfo) return null;

      const period = toOptionalNumber(row?.period) ?? 1;
      const startTime = typeof row?.startTime === 'string' ? row.startTime : '00:00';
      const endTime = typeof row?.endTime === 'string' ? row.endTime : null;
      const goalie = goalieInfo.goalie;

      return {
        teamSide: goalieInfo.side,
        teamAbbrev: goalie.teamAbbrev ?? row?.teamAbbrev ?? goalieInfo.side.toUpperCase(),
        goalieId: goalie.playerId,
        goalieName: goalie.name,
        enteredPeriod: periodLabel(period),
        enteredTime: startTime,
        exitedPeriod: endTime ? periodLabel(period) : null,
        exitedTime: endTime,
        toi: goalie.toi ?? (typeof row?.duration === 'string' ? row.duration : undefined),
      } satisfies GoalieStint;
    })
    .filter((stint): stint is GoalieStint => !!stint)
    .sort(
      (a, b) =>
        stintSortValue(a.enteredPeriod, a.enteredTime) -
        stintSortValue(b.enteredPeriod, b.enteredTime),
    );

  return mergeAdjacentGoalieShiftStints(rawStints);
}

function mergeAdjacentGoalieShiftStints(stints: GoalieStint[]): GoalieStint[] {
  const lastIndexBySide = new Map<TeamSide, number>();

  return stints.reduce<GoalieStint[]>((merged, stint) => {
    const previousIndex = lastIndexBySide.get(stint.teamSide);
    const previous = previousIndex == null ? undefined : merged[previousIndex];
    if (previous && previous.goalieId === stint.goalieId) {
      previous.exitedPeriod = stint.exitedPeriod;
      previous.exitedTime = stint.exitedTime;
      previous.toi = previous.toi === stint.toi ? previous.toi : (previous.toi ?? stint.toi);
      return merged;
    }

    merged.push({ ...stint });
    lastIndexBySide.set(stint.teamSide, merged.length - 1);
    return merged;
  }, []);
}

function completeMissingGoalieStintsFromToiHtml(
  stints: GoalieStint[],
  goaliesByTeam: GoaliesByTeam,
): GoalieStint[] {
  const completed = [...stints];

  for (const side of ['away', 'home'] as const) {
    const playedGoalies = goaliesByTeam[side].filter(goalieActuallyPlayed);
    const sideStints = completed
      .filter((stint) => stint.teamSide === side)
      .sort(
        (a, b) =>
          stintSortValue(a.enteredPeriod, a.enteredTime) -
          stintSortValue(b.enteredPeriod, b.enteredTime),
      );
    if (playedGoalies.length <= sideStints.length || sideStints.length === 0) continue;

    const stintGoalieIds = new Set(sideStints.map((stint) => stint.goalieId));
    let previousStint = sideStints[sideStints.length - 1]!;

    for (const goalie of playedGoalies.filter((playedGoalie) => !stintGoalieIds.has(playedGoalie.playerId))) {
      const entry = nextGoalieEntryAfterStint(previousStint);
      if (!entry) continue;

      const inferredStint: GoalieStint = {
        teamSide: side,
        teamAbbrev: goalie.teamAbbrev ?? side.toUpperCase(),
        goalieId: goalie.playerId,
        goalieName: goalie.name,
        enteredPeriod: entry.period,
        enteredTime: entry.time,
        exitedPeriod: null,
        exitedTime: null,
        toi: goalie.toi,
      };

      completed.push(inferredStint);
      stintGoalieIds.add(goalie.playerId);
      previousStint = inferredStint;
    }
  }

  return completed.sort(
    (a, b) =>
      stintSortValue(a.enteredPeriod, a.enteredTime) -
      stintSortValue(b.enteredPeriod, b.enteredTime),
  );
}

function nextGoalieEntryAfterStint(stint: GoalieStint): { period: string; time: string } | null {
  if (!stint.exitedPeriod || !stint.exitedTime) return null;

  const periodNumber = parsePeriodNumber(stint.exitedPeriod);
  if (periodNumber == null) return { period: stint.exitedPeriod, time: normalizeClock(stint.exitedTime) };

  const exitSeconds = parseClockSeconds(stint.exitedTime);
  if (exitSeconds >= 20 * 60) {
    return { period: periodLabel(periodNumber + 1), time: '00:00' };
  }

  return { period: stint.exitedPeriod, time: normalizeClock(stint.exitedTime) };
}

function getPlays(playByPlay: any): any[] {
  return Array.isArray(playByPlay?.plays) ? playByPlay.plays : [];
}

function collectStringValues(value: any): string[] {
  if (!value || typeof value !== 'object') return [];
  const values: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === 'string') values.push(`${key} ${child}`);
    else if (child && typeof child === 'object') values.push(...collectStringValues(child));
  }
  return values;
}

function collectGoalieIds(
  value: any,
  goalieTeamById: Map<number, { side: TeamSide; goalie: Goalie }>,
): number[] {
  const ids = new Set<number>();

  const visit = (node: any, keyPath = '') => {
    if (!node || typeof node !== 'object') return;

    for (const [key, child] of Object.entries(node)) {
      const path = `${keyPath}.${key}`;
      const isGoalieKey = /goalie.*id|goalieinnetid/i.test(path);
      if (isGoalieKey) {
        const maybeId = toOptionalNumber(child);
        if (maybeId != null && goalieTeamById.has(maybeId)) ids.add(maybeId);
      }
      if (child && typeof child === 'object') visit(child, path);
    }
  };

  visit(value);
  return [...ids];
}

function toObservation(play: any, goalieId: number, side: TeamSide): GoalieObservation {
  const period = toOptionalNumber(play?.periodDescriptor?.number) ?? 1;
  return {
    teamSide: side,
    goalieId,
    period,
    timeInPeriod: typeof play?.timeInPeriod === 'string' ? play.timeInPeriod : '00:00',
    sortOrder:
      toOptionalNumber(play?.sortOrder) ??
      period * 100000 + parseClockSeconds(play?.timeInPeriod ?? '00:00'),
    typeDescKey: typeof play?.typeDescKey === 'string' ? play.typeDescKey : undefined,
  };
}

function buildTeamStints(
  side: TeamSide,
  goalies: Goalie[],
  observations: GoalieObservation[],
): GoalieStint[] {
  const goaliesById = new Map(goalies.map((goalie) => [goalie.playerId, goalie]));
  if (goaliesById.size === 0) return [];

  const teamObservations = observations
    .filter((observation) => observation.teamSide === side && goaliesById.has(observation.goalieId))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (teamObservations.length === 0) {
    return buildTeamStintsFromGoalieToi(side, goalies) ??
      goalies.map((goalie) => fallbackStint(side, goalie, goalies.length > 1));
  }

  const stints: GoalieStint[] = [];
  let activeGoalieId = teamObservations[0]!.goalieId;
  let activeGoalie = goaliesById.get(activeGoalieId)!;
  let lastObservation = teamObservations[0]!;

  stints.push({
    teamSide: side,
    teamAbbrev: activeGoalie.teamAbbrev ?? side.toUpperCase(),
    goalieId: activeGoalie.playerId,
    goalieName: activeGoalie.name,
    enteredPeriod: 'P1',
    enteredTime: '00:00',
    exitedPeriod: null,
    exitedTime: null,
    toi: activeGoalie.toi,
  });

  for (const observation of teamObservations.slice(1)) {
    if (observation.goalieId === activeGoalieId) {
      lastObservation = observation;
      continue;
    }

    const switchTime = lastObservation.typeDescKey === 'goal' ? lastObservation : observation;
    const currentStint = stints[stints.length - 1]!;
    currentStint.exitedPeriod = periodLabel(switchTime.period);
    currentStint.exitedTime = switchTime.timeInPeriod;

    activeGoalieId = observation.goalieId;
    activeGoalie = goaliesById.get(activeGoalieId)!;
    stints.push({
      teamSide: side,
      teamAbbrev: activeGoalie.teamAbbrev ?? side.toUpperCase(),
      goalieId: activeGoalie.playerId,
      goalieName: activeGoalie.name,
      enteredPeriod: periodLabel(switchTime.period),
      enteredTime: switchTime.timeInPeriod,
      exitedPeriod: null,
      exitedTime: null,
      toi: activeGoalie.toi,
    });
    lastObservation = observation;
  }

  const observedGoalieIds = new Set(stints.map((stint) => stint.goalieId));
  if (goalies.some((goalie) => !observedGoalieIds.has(goalie.playerId))) {
    return buildTeamStintsFromGoalieToi(side, goalies) ?? [
      ...stints,
      ...goalies
        .filter((goalie) => !observedGoalieIds.has(goalie.playerId))
        .map((goalie) => fallbackStint(side, goalie, true)),
    ];
  }

  return stints;
}

function buildTeamStintsFromGoalieToi(side: TeamSide, goalies: Goalie[]): GoalieStint[] | null {
  const playedGoalies = goalies.filter(goalieActuallyPlayed);
  if (playedGoalies.length === 0) return null;

  const orderedGoalies = [...playedGoalies].sort((a, b) => Number(!!b.starter) - Number(!!a.starter));
  let elapsedSeconds = 0;

  return orderedGoalies.map((goalie, index) => {
    const entered = secondsToPeriodTime(elapsedSeconds);
    elapsedSeconds += parseClockSeconds(goalie.toi ?? '00:00');
    const exited = index < orderedGoalies.length - 1 ? secondsToPeriodTime(elapsedSeconds) : null;

    return {
      teamSide: side,
      teamAbbrev: goalie.teamAbbrev ?? side.toUpperCase(),
      goalieId: goalie.playerId,
      goalieName: goalie.name,
      enteredPeriod: entered.period,
      enteredTime: entered.time,
      exitedPeriod: exited?.period ?? null,
      exitedTime: exited?.time ?? null,
      toi: goalie.toi,
    };
  });
}

function fallbackStint(side: TeamSide, goalie: Goalie, timingUnavailable: boolean): GoalieStint {
  return {
    teamSide: side,
    teamAbbrev: goalie.teamAbbrev ?? side.toUpperCase(),
    goalieId: goalie.playerId,
    goalieName: goalie.name,
    enteredPeriod: timingUnavailable ? 'Unknown' : 'P1',
    enteredTime: timingUnavailable ? 'Unknown' : '00:00',
    exitedPeriod: null,
    exitedTime: null,
    toi: goalie.toi,
    timingUnavailable,
  };
}

function periodLabel(period: number): string {
  return `P${period}`;
}

function parsePeriodNumber(period: string): number | null {
  const number = Number(period.replace(/^P/i, ''));
  return Number.isFinite(number) ? number : null;
}

function htmlToText(html: string): string {
  const normalized = html
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi, (_row, cells: string) => {
      const rowText = String(cells).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      return rowText ? `${rowText}\n` : '\n';
    });

  return normalized
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(tr|div|p|table|tbody|thead|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, ' ');
}

function toHtmlReportName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name.toUpperCase();
  const first = parts[0]!;
  const last = parts.slice(1).join(' ');
  return `${last}, ${first}`.toUpperCase();
}

function toHtmlReportLastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts.length < 2 ? name : parts.slice(1).join(' ')).toUpperCase();
}

function normalizeClock(clock: string): string {
  const [minutes, seconds] = String(clock).split(':');
  return `${String(Number(minutes)).padStart(2, '0')}:${String(seconds ?? '00').padStart(2, '0')}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseClockSeconds(clock: string): number {
  const [minutes, seconds] = String(clock).split(':').map(Number);
  return (minutes || 0) * 60 + (seconds || 0);
}

function secondsToPeriodTime(totalSeconds: number): { period: string; time: string } {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const periodNumber = Math.floor(safeSeconds / 1200) + 1;
  const periodSeconds = safeSeconds % 1200;
  const minutes = Math.floor(periodSeconds / 60);
  const seconds = periodSeconds % 60;

  return {
    period: periodLabel(periodNumber),
    time: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
  };
}

function getSeasonStartYear(context: NhlGameIdContext): string | null {
  const fromSeasonName = context.seasonName?.match(/\b(20\d{2})\b/)?.[1];
  if (fromSeasonName) return fromSeasonName;

  if (!context.scheduledAt) return null;
  const match = context.scheduledAt.match(/^(\d{4})-(\d{2})-/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;

  return String(month >= 7 ? year : year - 1);
}

function stintSortValue(period: string, time: string): number {
  const periodNumber = Number(period.replace(/^P/, ''));
  return (Number.isFinite(periodNumber) ? periodNumber : 0) * 100000 + parseClockSeconds(time);
}
