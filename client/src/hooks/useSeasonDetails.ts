import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-toastify';
import { type SeasonRecord } from './useSeasons';
import { type GroupTeamRecord } from './useLeagueGroups';

const API = import.meta.env.VITE_API_URL || '/api';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

const apiError = (err: unknown, fallback: string): string =>
  (err as AxiosError<{ error: string }>).response?.data?.error ?? fallback;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SeasonGroupRecord {
  id: string;
  league_id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
  created_at: string;
  teams: GroupTeamRecord[];
  /** True when this group has season-specific team overrides (vs. league defaults). */
  has_season_override: boolean;
}

/** Minimal team shape returned by the league endpoint — used for the override modal. */
export interface LeagueTeam {
  id: string;
  name: string;
  code: string;
  logo: string | null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

const useSeasonDetails = (seasonId: string | undefined) => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  // ① Season info (includes league_name, league_code, league_logo)
  const { data: season = null, isLoading: seasonLoading } = useQuery<SeasonRecord | null>({
    queryKey: ['season', seasonId],
    queryFn: async () => {
      try {
        const { data } = await axios.get<SeasonRecord>(
          `${API}/admin/seasons/${seasonId}`,
          { headers: authHeaders() },
        );
        return data;
      } catch (err) {
        toast.error(apiError(err, 'Failed to load season'));
        return null;
      }
    },
    enabled: !!seasonId,
  });

  // ② Season-resolved groups (override OR default teams per group)
  const { data: groups = [], isLoading: groupsLoading } = useQuery<SeasonGroupRecord[]>({
    queryKey: ['season-groups', seasonId],
    queryFn: async () => {
      try {
        const { data } = await axios.get<SeasonGroupRecord[]>(
          `${API}/admin/seasons/${seasonId}/groups`,
          { headers: authHeaders() },
        );
        return data;
      } catch (err) {
        toast.error(apiError(err, 'Failed to load season groups'));
        return [];
      }
    },
    enabled: !!seasonId,
  });

  // ③ All league teams — used to populate the override modal
  const leagueId = season?.league_id;
  const { data: leagueData = null, isLoading: leagueLoading } = useQuery<{ teams: LeagueTeam[] } | null>({
    queryKey: ['leagues', leagueId],
    queryFn: async () => {
      try {
        const { data } = await axios.get<{ teams: LeagueTeam[] }>(
          `${API}/admin/leagues/${leagueId}`,
          { headers: authHeaders() },
        );
        return data;
      } catch (err) {
        toast.error(apiError(err, 'Failed to load league'));
        return null;
      }
    },
    enabled: !!leagueId,
  });

  const leagueTeams: LeagueTeam[] = leagueData?.teams ?? [];
  const loading = seasonLoading || groupsLoading || (!!leagueId && leagueLoading);

  // ── Mutations ────────────────────────────────────────────────────────────────

  const setSeasonGroupTeams = async (groupId: string, teamIds: string[]): Promise<boolean> => {
    setBusy(groupId);
    try {
      await axios.put(
        `${API}/admin/seasons/${seasonId}/groups/${groupId}/teams`,
        { team_ids: teamIds },
        { headers: authHeaders() },
      );
      toast.success('Season teams updated!');
      await queryClient.invalidateQueries({ queryKey: ['season-groups', seasonId] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update season teams'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const resetSeasonGroupTeams = async (groupId: string): Promise<boolean> => {
    setBusy(groupId);
    try {
      await axios.delete(
        `${API}/admin/seasons/${seasonId}/groups/${groupId}/teams`,
        { headers: authHeaders() },
      );
      toast.success('Reverted to default teams');
      await queryClient.invalidateQueries({ queryKey: ['season-groups', seasonId] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to reset season teams'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  return { season, groups, leagueTeams, loading, busy, setSeasonGroupTeams, resetSeasonGroupTeams };
};

export default useSeasonDetails;
