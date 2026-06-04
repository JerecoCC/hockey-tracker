export const toRouteSlug = (value: string | null | undefined) =>
  (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const slugOrId = (value: string | null | undefined, fallbackId?: string | null) =>
  toRouteSlug(value) || fallbackId || '';

export const playerRouteSlug = (
  firstName: string | null | undefined,
  lastName: string | null | undefined,
) => toRouteSlug([firstName, lastName].filter(Boolean).join(' '));

export const buildLeagueDetailsPath = ({
  leagueCode,
  leagueId,
}: {
  leagueCode: string | null | undefined;
  leagueId?: string | null;
}) => `/admin/leagues/${slugOrId(leagueCode, leagueId)}`;

export const buildTeamDetailsPath = ({
  leagueCode,
  leagueId,
  teamCode,
  teamId,
  seasonId,
}: {
  leagueCode: string | null | undefined;
  leagueId?: string | null;
  teamCode: string | null | undefined;
  teamId?: string | null;
  seasonId?: string | null;
}) => {
  const path = `${buildLeagueDetailsPath({ leagueCode, leagueId })}/teams/${slugOrId(teamCode, teamId)}`;
  return seasonId ? `${path}?season=${encodeURIComponent(seasonId)}` : path;
};

export const buildSeasonDetailsPath = ({
  leagueCode,
  leagueId,
  seasonName,
  seasonId,
}: {
  leagueCode: string | null | undefined;
  leagueId?: string | null;
  seasonName: string | null | undefined;
  seasonId?: string | null;
}) =>
  `${buildLeagueDetailsPath({ leagueCode, leagueId })}/seasons/${slugOrId(
    seasonName,
    seasonId,
  )}`;

export const gameRouteSlug = ({
  awayTeamCode,
  homeTeamCode,
}: {
  awayTeamCode: string | null | undefined;
  homeTeamCode: string | null | undefined;
}) => {
  if (!awayTeamCode || !homeTeamCode) return '';
  return `${toRouteSlug(awayTeamCode)}-vs-${toRouteSlug(homeTeamCode)}`;
};

export const gameDateRouteSlug = (scheduledAt: string | null | undefined) => {
  const datePart = scheduledAt?.slice(0, 10);
  const [year, month, day] = datePart?.split('-') ?? [];
  if (!year || !month || !day) return '';
  return `${month}-${day}-${year}`;
};

export const buildGameDetailsPath = ({
  leagueCode,
  leagueId,
  seasonName,
  seasonId,
  gameId,
  awayTeamCode,
  homeTeamCode,
  scheduledAt,
}: {
  leagueCode: string | null | undefined;
  leagueId?: string | null;
  seasonName: string | null | undefined;
  seasonId?: string | null;
  gameId: string;
  awayTeamCode?: string | null;
  homeTeamCode?: string | null;
  scheduledAt?: string | null;
}) =>
  `${buildSeasonDetailsPath({ leagueCode, leagueId, seasonName, seasonId })}/games/${
    gameDateRouteSlug(scheduledAt)
      ? `${gameDateRouteSlug(scheduledAt)}/${gameRouteSlug({ awayTeamCode, homeTeamCode }) || gameId}`
      : gameId
  }`;

export const buildPlayerDetailsPath = ({
  leagueCode,
  leagueId,
  teamCode,
  teamId,
  firstName,
  lastName,
}: {
  leagueCode: string | null | undefined;
  leagueId?: string | null;
  teamCode: string | null | undefined;
  teamId?: string | null;
  firstName: string | null | undefined;
  lastName: string | null | undefined;
}) =>
  `${buildTeamDetailsPath({ leagueCode, leagueId, teamCode, teamId })}/players/${playerRouteSlug(
    firstName,
    lastName,
  )}`;

export const buildLeaguePlayerDetailsPath = ({
  leagueCode,
  leagueId,
  firstName,
  lastName,
}: {
  leagueCode: string | null | undefined;
  leagueId?: string | null;
  firstName: string | null | undefined;
  lastName: string | null | undefined;
}) =>
  `${buildLeagueDetailsPath({ leagueCode, leagueId })}/players/${playerRouteSlug(
    firstName,
    lastName,
  )}`;

export type PlayerDetailsPathInput = Parameters<typeof buildPlayerDetailsPath>[0];
