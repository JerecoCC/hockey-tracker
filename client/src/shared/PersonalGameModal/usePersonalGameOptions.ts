import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import type { SelectOption } from '@jerecocc/tracker-ui/components/Select/Select';
import { API, authHeaders } from '@/lib/apiClient';

/** A selectable option (the shared SelectOption type also covers dividers). */
export type PersonalGameOption = Extract<SelectOption, { value: string }>;

interface TeamRecord {
  id: string;
  name: string | null;
  code: string | null;
  league_id: string | null;
  logo: string | null;
  logo_dark?: string | null;
  logo_light?: string | null;
}

interface LeagueRecord {
  id: string;
  name: string;
  code: string | null;
  logo: string | null;
}

interface SeasonRecord {
  id: string;
  name: string;
  is_current: boolean;
}

// Stable fallbacks: a fresh [] each render would rebuild the options every render, and the
// bulk modal lifts them into state, which would then re-render forever.
const NO_LEAGUES: LeagueRecord[] = [];
const NO_SEASONS: SeasonRecord[] = [];
const NO_TEAMS: TeamRecord[] = [];

const fetchUserData = async <T>(path: string, params?: Record<string, string>) => {
  const { data } = await axios.get<T>(`${API}${path}`, { headers: authHeaders(), params });
  return data;
};

interface Options {
  open: boolean;
  leagueId: string;
  seasonId: string;
  /** Picks the league's current season when none is chosen (on open, or after a league change). */
  autoPickSeason: boolean;
  onPickSeason: (seasonId: string) => void;
}

/**
 * League, season and team options for personal game forms: a league narrows the seasons,
 * and a season narrows the teams to the ones taking part in it (otherwise the league does).
 * Options show logos, with the team code ahead of the name.
 */
const usePersonalGameOptions = ({
  open,
  leagueId,
  seasonId,
  autoPickSeason,
  onPickSeason,
}: Options) => {
  const { data: leagues = NO_LEAGUES } = useQuery<LeagueRecord[]>({
    queryKey: ['user-leagues'],
    queryFn: () => fetchUserData<LeagueRecord[]>('/user/leagues'),
    enabled: open,
  });
  const { data: seasons = NO_SEASONS, isLoading: seasonsLoading } = useQuery<SeasonRecord[]>({
    queryKey: ['user-seasons', leagueId],
    queryFn: () => fetchUserData<SeasonRecord[]>('/user/seasons', { league_id: leagueId }),
    enabled: open && !!leagueId,
  });
  const { data: teams = NO_TEAMS, isLoading: teamsLoading } = useQuery<TeamRecord[]>({
    queryKey: seasonId ? ['user-teams', 'season', seasonId] : ['user-teams'],
    queryFn: () =>
      fetchUserData<TeamRecord[]>('/user/teams', seasonId ? { season_id: seasonId } : undefined),
    enabled: open && !!leagueId,
  });

  const leagueOptions = useMemo<PersonalGameOption[]>(
    () =>
      [...leagues]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((league) => ({
          value: league.id,
          label: league.name,
          logo: league.logo,
          code: league.code ?? undefined,
        })),
    [leagues],
  );
  const seasonOptions = useMemo<PersonalGameOption[]>(
    () => seasons.map((season) => ({ value: season.id, label: season.name })),
    [seasons],
  );
  const teamOptions = useMemo<PersonalGameOption[]>(
    () =>
      teams
        .filter((team) => (team.name || team.code) && (seasonId || team.league_id === leagueId))
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
        .map((team) => ({
          value: team.id,
          // The code leads the name and stays in the label so searching by code still works.
          label: team.code ? `${team.code} · ${team.name ?? team.code}` : (team.name ?? ''),
          logo: team.logo,
          logoDark: team.logo_dark,
          logoLight: team.logo_light,
          code: team.code ?? undefined,
        })),
    [leagueId, seasonId, teams],
  );

  const onPickSeasonRef = useRef(onPickSeason);
  onPickSeasonRef.current = onPickSeason;
  useEffect(() => {
    if (!autoPickSeason || !leagueId || seasonId || seasonsLoading || !seasons.length) return;
    const season = seasons.find((candidate) => candidate.is_current) ?? seasons[0];
    onPickSeasonRef.current(season.id);
  }, [autoPickSeason, leagueId, seasonId, seasons, seasonsLoading]);

  const seasonPlaceholder = !leagueId
    ? 'Select a league first'
    : seasonsLoading
      ? 'Loading seasons…'
      : seasonOptions.length === 0
        ? 'No seasons in this league'
        : 'Select season…';
  const teamPlaceholder = !leagueId
    ? 'Select a league first'
    : teamsLoading
      ? 'Loading teams…'
      : 'Select team…';

  return {
    leagueOptions,
    seasonOptions,
    teamOptions,
    teamsLoading,
    seasonPlaceholder,
    teamPlaceholder,
  };
};

export default usePersonalGameOptions;
