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

const teamNameRouteSlug = ({
  teamName,
  teamPlaceName,
}: {
  teamName?: string | null;
  teamPlaceName?: string | null;
}) => {
  const nameSlug = toRouteSlug(teamName);
  const placeSlug = toRouteSlug(teamPlaceName);
  if (placeSlug && nameSlug.startsWith(`${placeSlug}-`)) {
    return nameSlug.slice(placeSlug.length + 1);
  }
  return nameSlug;
};

const ISO_MIDNIGHT_RE = /[T ]00:00(?::00(?:\.0+)?)?(?:Z|[+-][0-9]{2}(?::?[0-9]{2})?)?$/;

export const playerRouteSlug = (
  firstName: string | null | undefined,
  lastName: string | null | undefined,
) => toRouteSlug([firstName, lastName].filter(Boolean).join(' '));

export const playerTeamRouteSlug = ({
  firstName,
  lastName,
  jerseyNumber,
}: {
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  jerseyNumber?: number | string | null;
}) => {
  const nameSlug = playerRouteSlug(firstName, lastName);
  const jerseySlug = jerseyNumber == null ? '' : toRouteSlug(String(jerseyNumber));
  if (jerseySlug && nameSlug) return `${jerseySlug}-${nameSlug}`;
  return nameSlug || jerseySlug;
};

export const leaguePlayerRouteSlug = ({
  leaguePlayerNumber,
  firstName,
  lastName,
}: {
  leaguePlayerNumber?: number | string | null;
  firstName: string | null | undefined;
  lastName: string | null | undefined;
}) => toRouteSlug(leaguePlayerNumber == null ? '' : String(leaguePlayerNumber)) || playerRouteSlug(firstName, lastName);

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
  seasonName,
  seasonId,
}: {
  leagueCode: string | null | undefined;
  leagueId?: string | null;
  teamCode: string | null | undefined;
  teamId?: string | null;
  seasonName?: string | null;
  seasonId?: string | null;
}) => {
  const path = `${buildLeagueDetailsPath({ leagueCode, leagueId })}/teams/${slugOrId(teamCode, teamId)}`;
  const seasonParam = slugOrId(seasonName, seasonId);
  return seasonParam ? `${path}?season=${encodeURIComponent(seasonParam)}` : path;
};

export const buildUserTeamDetailsPath = ({
  leagueCode,
  leagueId,
  teamCode,
  teamId,
  seasonName,
  seasonId,
}: {
  leagueCode: string | null | undefined;
  leagueId?: string | null;
  teamCode: string | null | undefined;
  teamId?: string | null;
  seasonName?: string | null;
  seasonId?: string | null;
}) => {
  const path = `/leagues/${slugOrId(leagueCode, leagueId)}/teams/${slugOrId(teamCode, teamId)}`;
  const seasonParam = slugOrId(seasonName, seasonId);
  return seasonParam ? `${path}?season=${encodeURIComponent(seasonParam)}` : path;
};

export const buildUserPlayerDetailsPath = ({
  leagueCode,
  leagueId,
  teamCode,
  teamId,
  firstName,
  lastName,
  jerseyNumber,
}: {
  leagueCode: string | null | undefined;
  leagueId?: string | null;
  teamCode: string | null | undefined;
  teamId?: string | null;
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  jerseyNumber?: number | string | null;
}) =>
  `${buildUserTeamDetailsPath({ leagueCode, leagueId, teamCode, teamId })}/players/${playerTeamRouteSlug({
    firstName,
    lastName,
    jerseyNumber,
  })}`;

export const buildUserLeaguePlayerDetailsPath = ({
  leagueCode,
  leagueId,
  leaguePlayerNumber,
  firstName,
  lastName,
}: {
  leagueCode: string | null | undefined;
  leagueId?: string | null;
  leaguePlayerNumber?: number | string | null;
  firstName: string | null | undefined;
  lastName: string | null | undefined;
}) =>
  `/leagues/${slugOrId(leagueCode, leagueId)}/players/${leaguePlayerRouteSlug({
    leaguePlayerNumber,
    firstName,
    lastName,
  })}`;

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
  `${buildLeagueDetailsPath({ leagueCode, leagueId })}/seasons/${slugOrId(seasonName, seasonId)}`;

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

export const playoffSeriesRouteSlug = ({
  awayTeamCode,
  homeTeamCode,
  seriesId,
}: {
  awayTeamCode?: string | null;
  homeTeamCode?: string | null;
  seriesId: string;
}) => gameRouteSlug({ awayTeamCode, homeTeamCode }) || seriesId;

const easternDatePart = (value: string | null | undefined, scheduledTime?: string | null) => {
  if (!value) return null;
  const rawDate = value.slice(0, 10);
  if (!value.includes('T')) return rawDate;
  if (scheduledTime && scheduledTime !== '00:00' && ISO_MIDNIGHT_RE.test(value)) {
    return rawDate;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return rawDate;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return year && month && day ? `${year}-${month}-${day}` : rawDate;
};

export const gameDateRouteSlug = (
  scheduledAt: string | null | undefined,
  options: {
    leagueCode?: string | null;
    forceEastern?: boolean;
    scheduledTime?: string | null;
  } = {},
) => {
  const datePart =
    options.forceEastern || toRouteSlug(options.leagueCode) === 'nhl'
      ? easternDatePart(scheduledAt, options.scheduledTime)
      : scheduledAt?.slice(0, 10);
  const [year, month, day] = datePart?.split('-') ?? [];
  if (!year || !month || !day) return '';
  return `${month}-${day}-${year}`;
};

export const dateKeyToGameDateRouteSlug = (dateKey: string | null | undefined) =>
  gameDateRouteSlug(dateKey, { forceEastern: true });

const isValidDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};

export const gameDateRouteSlugToDateKey = (dateSlug: string | null | undefined) => {
  if (!dateSlug) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateSlug)) {
    return isValidDateKey(dateSlug) ? dateSlug : null;
  }

  const match = dateSlug.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;

  const [, month, day, year] = match;
  const dateKey = `${year}-${month}-${day}`;
  return isValidDateKey(dateKey) ? dateKey : null;
};

export const buildSeasonDayGamesPath = ({
  leagueCode,
  leagueId,
  seasonName,
  seasonId,
  dateKey,
}: {
  leagueCode: string | null | undefined;
  leagueId?: string | null;
  seasonName: string | null | undefined;
  seasonId?: string | null;
  dateKey: string;
}) =>
  `${buildSeasonDetailsPath({ leagueCode, leagueId, seasonName, seasonId })}/games/${dateKeyToGameDateRouteSlug(
    dateKey,
  )}`;

export const buildGameDetailsPath = ({
  leagueCode,
  leagueId,
  seasonName,
  seasonId,
  gameId,
  awayTeamCode,
  homeTeamCode,
  scheduledAt,
  scheduledTime,
}: {
  leagueCode: string | null | undefined;
  leagueId?: string | null;
  seasonName: string | null | undefined;
  seasonId?: string | null;
  gameId: string;
  awayTeamCode?: string | null;
  homeTeamCode?: string | null;
  scheduledAt?: string | null;
  scheduledTime?: string | null;
}) => {
  const dateSlug = gameDateRouteSlug(scheduledAt, {
    leagueCode,
    forceEastern: true,
    scheduledTime,
  });
  const matchupSlug = gameRouteSlug({ awayTeamCode, homeTeamCode });
  return `${buildSeasonDetailsPath({ leagueCode, leagueId, seasonName, seasonId })}/games/${
    dateSlug && matchupSlug ? `${dateSlug}/${matchupSlug}` : gameId
  }`;
};

export const buildUserGameDetailsPath = ({
  gameId,
  awayTeamCode,
  homeTeamCode,
  scheduledAt,
  scheduledTime,
}: {
  gameId: string;
  awayTeamCode?: string | null;
  homeTeamCode?: string | null;
  scheduledAt?: string | null;
  scheduledTime?: string | null;
}) => {
  const dateSlug = gameDateRouteSlug(scheduledAt, { forceEastern: true, scheduledTime });
  const matchupSlug = gameRouteSlug({ awayTeamCode, homeTeamCode });
  return `/games/${dateSlug && matchupSlug ? `${dateSlug}/${matchupSlug}` : gameId}`;
};

export const userWatchedTeamRouteSlug = ({
  teamCode,
  teamName,
  teamPlaceName,
  teamId,
}: {
  teamCode?: string | null;
  teamName?: string | null;
  teamPlaceName?: string | null;
  teamId?: string | null;
}) => {
  const codeSlug = toRouteSlug(teamCode);
  const nameSlug = teamNameRouteSlug({ teamName, teamPlaceName });
  if (codeSlug && nameSlug) return `${codeSlug}-${nameSlug}`;
  return codeSlug || nameSlug || teamId || '';
};

export const buildUserWatchedTeamPath = ({
  teamCode,
  teamName,
  teamPlaceName,
  teamId,
}: {
  teamCode?: string | null;
  teamName?: string | null;
  teamPlaceName?: string | null;
  teamId?: string | null;
}) =>
  `/dashboard/games-watched/${userWatchedTeamRouteSlug({
    teamCode,
    teamName,
    teamPlaceName,
    teamId,
  })}`;

export const buildPlayoffSeriesDetailsPath = ({
  leagueCode,
  leagueId,
  seasonName,
  seasonId,
  seriesId,
  awayTeamCode,
  homeTeamCode,
}: {
  leagueCode: string | null | undefined;
  leagueId?: string | null;
  seasonName: string | null | undefined;
  seasonId?: string | null;
  seriesId: string;
  awayTeamCode?: string | null;
  homeTeamCode?: string | null;
}) =>
  `${buildSeasonDetailsPath({ leagueCode, leagueId, seasonName, seasonId })}/playoffs/${playoffSeriesRouteSlug(
    {
      awayTeamCode,
      homeTeamCode,
      seriesId,
    },
  )}`;

export const buildPlayerDetailsPath = ({
  leagueCode,
  leagueId,
  teamCode,
  teamId,
  firstName,
  lastName,
  jerseyNumber,
}: {
  leagueCode: string | null | undefined;
  leagueId?: string | null;
  teamCode: string | null | undefined;
  teamId?: string | null;
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  jerseyNumber?: number | string | null;
}) =>
  `${buildTeamDetailsPath({ leagueCode, leagueId, teamCode, teamId })}/players/${playerTeamRouteSlug({
    firstName,
    lastName,
    jerseyNumber,
  })}`;

export const buildLeaguePlayerDetailsPath = ({
  leagueCode,
  leagueId,
  leaguePlayerNumber,
  firstName,
  lastName,
}: {
  leagueCode: string | null | undefined;
  leagueId?: string | null;
  leaguePlayerNumber?: number | string | null;
  firstName: string | null | undefined;
  lastName: string | null | undefined;
}) =>
  `${buildLeagueDetailsPath({ leagueCode, leagueId })}/players/${leaguePlayerRouteSlug({
    leaguePlayerNumber,
    firstName,
    lastName,
  })}`;

export type PlayerDetailsPathInput = Parameters<typeof buildPlayerDetailsPath>[0];
