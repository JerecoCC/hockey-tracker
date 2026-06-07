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
  timeRemaining: string;
  sortOrder: number;
  typeDescKey?: string;
}
const API = import.meta.env.VITE_API_URL || '/api';
const NHL_GAMECENTER_RE = /\/gamecenter\/(\d+)(?:\/|$)/i;
const SWITCH_EVENT_RE = /\b(goalie|keeper)\b/i;
const SWITCH_ACTION_RE =
  /\b(change|changed|enter|entered|left|leave|pulled|pull|returned|return|replace|reliev)/i;
const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});
export function extractGameIdFromNhlUrl(url: string): string | null {
  return url.match(NHL_GAMECENTER_RE)?.[1] ?? null;
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

export async function fetchNhlGoalieSwitchReport(url: string): Promise<NhlGoalieSwitchReport> {
  const gameId = extractGameIdFromNhlUrl(url);
  if (!gameId) {
    throw new Error('Paste a valid NHL GameCenter URL containing /gamecenter/{gameId}/.');
  }

  const base = `https://api-web.nhle.com/v1/gamecenter/${gameId}`;
  const [landing, playByPlay] = await Promise.all([
    fetchJson(`${base}/landing`),
    fetchJson(`${base}/play-by-play`),
  ]);

  let goaliesByTeam = getGoaliesFromLanding(landing);

  // Some current NHL landing responses omit playerByGameStats. Fetch boxscore as
  // a stats-only fallback while still normalizing through getGoaliesFromLanding.
  if (goaliesByTeam.away.length === 0 && goaliesByTeam.home.length === 0) {
    const boxscore = await fetchJson(`${base}/boxscore`);
    goaliesByTeam = getGoaliesFromLanding(boxscore);
  }

  const stints = buildGoalieStints(playByPlay, goaliesByTeam);
  const awayMeta = getTeamMeta(landing, 'away');
  const homeMeta = getTeamMeta(landing, 'home');

  return {
    gameId,
    scheduledStart: landing?.startTimeUTC ? formatEasternStartTime(landing.startTimeUTC) : null,
    away: buildTeamReport('away', awayMeta.abbrev, goaliesByTeam.away, stints),
    home: buildTeamReport('home', homeMeta.abbrev, goaliesByTeam.home, stints),
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

function buildTeamReport(
  side: TeamSide,
  abbrev: string,
  goalies: Goalie[],
  allStints: GoalieStint[],
): NhlGoalieSwitchTeamReport {
  const trueGoalies = goalies.filter(goalieActuallyPlayed);
  const stints = allStints.filter((stint) => stint.teamSide === side);

  return {
    side,
    abbrev,
    switchDetected: detectGoalieSwitch(goalies),
    trueGoalies,
    stints,
    timingUnavailable: stints.some((stint) => stint.timingUnavailable),
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
    timeRemaining: typeof play?.timeRemaining === 'string' ? play.timeRemaining : '00:00',
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
    return goalies.map((goalie) => fallbackStint(side, goalie, goalies.length > 1));
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
    enteredTime: '20:00',
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
    currentStint.exitedTime = switchTime.timeRemaining;

    activeGoalieId = observation.goalieId;
    activeGoalie = goaliesById.get(activeGoalieId)!;
    stints.push({
      teamSide: side,
      teamAbbrev: activeGoalie.teamAbbrev ?? side.toUpperCase(),
      goalieId: activeGoalie.playerId,
      goalieName: activeGoalie.name,
      enteredPeriod: periodLabel(switchTime.period),
      enteredTime: switchTime.timeRemaining,
      exitedPeriod: null,
      exitedTime: null,
      toi: activeGoalie.toi,
    });
    lastObservation = observation;
  }

  const observedGoalieIds = new Set(stints.map((stint) => stint.goalieId));
  for (const goalie of goalies) {
    if (!observedGoalieIds.has(goalie.playerId)) {
      stints.push(fallbackStint(side, goalie, true));
    }
  }

  return stints;
}

function fallbackStint(side: TeamSide, goalie: Goalie, timingUnavailable: boolean): GoalieStint {
  return {
    teamSide: side,
    teamAbbrev: goalie.teamAbbrev ?? side.toUpperCase(),
    goalieId: goalie.playerId,
    goalieName: goalie.name,
    enteredPeriod: timingUnavailable ? 'Unknown' : 'P1',
    enteredTime: timingUnavailable ? 'Unknown' : '20:00',
    exitedPeriod: null,
    exitedTime: null,
    toi: goalie.toi,
    timingUnavailable,
  };
}

function periodLabel(period: number): string {
  return `P${period}`;
}

function parseClockSeconds(clock: string): number {
  const [minutes, seconds] = String(clock).split(':').map(Number);
  return (minutes || 0) * 60 + (seconds || 0);
}
