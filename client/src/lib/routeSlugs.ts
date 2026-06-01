export const toRouteSlug = (value: string | null | undefined) =>
  (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const playerRouteSlug = (
  firstName: string | null | undefined,
  lastName: string | null | undefined,
) => toRouteSlug([firstName, lastName].filter(Boolean).join(' '));

export const buildPlayerDetailsPath = ({
  leagueCode,
  teamCode,
  firstName,
  lastName,
}: {
  leagueCode: string | null | undefined;
  teamCode: string | null | undefined;
  firstName: string | null | undefined;
  lastName: string | null | undefined;
}) =>
  `/admin/leagues/${toRouteSlug(leagueCode)}/teams/${toRouteSlug(teamCode)}/players/${playerRouteSlug(
    firstName,
    lastName,
  )}`;

export type PlayerDetailsPathInput = Parameters<typeof buildPlayerDetailsPath>[0];
