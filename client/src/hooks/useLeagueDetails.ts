import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import { type LeagueRecord, type CreateLeagueData } from './useLeagues';
import { type TeamRecord, type CreateTeamData } from './useTeams';
import { type CreateSeasonData } from './useSeasons';

import { API, authHeaders, getApiErrorMessage as apiError } from '@/lib/apiClient';

/** Full league shape returned by the details endpoint (superset of the list record). */
export interface LeagueFullRecord extends LeagueRecord {
  description: string | null;
  created_at: string;
}

export interface LeagueSeasonRecord {
  id: string;
  name: string;
  league_id: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  games_per_season: number | null;
  created_at: string;
}

export interface LeagueDetailsRecord extends LeagueFullRecord {
  teams: TeamRecord[];
  seasons: LeagueSeasonRecord[];
}



type LeagueDetailsMode = 'admin' | 'user';

const useLeagueDetails = (id: string | undefined, options: { mode?: LeagueDetailsMode } = {}) => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const mode = options.mode ?? 'admin';
  const basePath = mode === 'user' ? 'user' : 'admin';

  const { data, isLoading: loading } = useQuery({
    queryKey: [mode === 'user' ? 'user-league-details' : 'leagues', id],
    queryFn: async () => {
      try {
        const { data } = await axios.get<LeagueDetailsRecord>(`${API}/${basePath}/leagues/${id}`, {
          headers: authHeaders(),
        });
        return data;
      } catch (err) {
        toast.error(apiError(err, 'Failed to load league'));
        return null;
      }
    },
    enabled: !!id,
  });

  const teams: TeamRecord[] = data?.teams ?? [];
  const seasons: LeagueSeasonRecord[] = data?.seasons ?? [];
  const league: LeagueFullRecord | null = useMemo(() => {
    if (!data) return null;
    const leagueData = { ...data } as Record<string, unknown>;
    delete leagueData.teams;
    delete leagueData.seasons;
    return leagueData as unknown as LeagueFullRecord;
  }, [data]);

  const uploadLogo = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append('logo', file);
    try {
      const { data } = await axios.post<{ url: string }>(`${API}/admin/leagues/upload`, formData, {
        headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' },
      });
      return data.url;
    } catch (err) {
      toast.error(apiError(err, 'Failed to upload logo'));
      return null;
    }
  };

  const uploadTeamLogo = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append('logo', file);
    try {
      const { data } = await axios.post<{ url: string }>(`${API}/admin/teams/upload`, formData, {
        headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' },
      });
      return data.url;
    } catch (err) {
      toast.error(apiError(err, 'Failed to upload logo'));
      return null;
    }
  };

  const updateLeague = async (
    leagueId: string,
    payload: Partial<CreateLeagueData>,
  ): Promise<boolean> => {
    setBusy(leagueId);
    try {
      await axios.patch(`${API}/admin/leagues/${leagueId}`, payload, { headers: authHeaders() });
      toast.success('League updated!');
      await queryClient.invalidateQueries({ queryKey: ['leagues', id] });
      await queryClient.invalidateQueries({ queryKey: ['leagues'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update league'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const addTeam = async (payload: CreateTeamData): Promise<string | null> => {
    try {
      const { data } = await axios.post<TeamRecord>(`${API}/admin/teams`, payload, {
        headers: authHeaders(),
      });
      toast.success('Team created!');
      await queryClient.invalidateQueries({ queryKey: ['leagues', id] });
      await queryClient.invalidateQueries({ queryKey: ['teams'] });
      return data.id;
    } catch (err) {
      toast.error(apiError(err, 'Failed to create team'));
      return null;
    }
  };

  const updateTeam = async (teamId: string, payload: Partial<CreateTeamData>): Promise<boolean> => {
    setBusy(teamId);
    try {
      await axios.patch(`${API}/admin/teams/${teamId}`, payload, { headers: authHeaders() });
      toast.success('Team updated!');
      await queryClient.invalidateQueries({ queryKey: ['leagues', id] });
      await queryClient.invalidateQueries({ queryKey: ['teams', teamId] });
      await queryClient.invalidateQueries({ queryKey: ['teams'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update team'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const deleteTeam = async (teamId: string): Promise<void> => {
    setBusy(teamId);
    try {
      await axios.delete(`${API}/admin/teams/${teamId}`, { headers: authHeaders() });
      toast.success('Team deleted');
      await queryClient.invalidateQueries({ queryKey: ['leagues', id] });
      await queryClient.invalidateQueries({ queryKey: ['teams'] });
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete team'));
    } finally {
      setBusy(null);
    }
  };

  const addSeason = async (payload: CreateSeasonData): Promise<boolean> => {
    try {
      await axios.post(`${API}/admin/seasons`, payload, { headers: authHeaders() });
      toast.success('Season created!');
      await queryClient.invalidateQueries({ queryKey: ['leagues', id] });
      await queryClient.invalidateQueries({ queryKey: ['seasons'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to create season'));
      return false;
    }
  };

  const updateSeason = async (
    seasonId: string,
    payload: Partial<CreateSeasonData>,
  ): Promise<boolean> => {
    setBusy(seasonId);
    try {
      await axios.patch(`${API}/admin/seasons/${seasonId}`, payload, { headers: authHeaders() });
      toast.success('Season updated!');
      await queryClient.invalidateQueries({ queryKey: ['leagues', id] });
      await queryClient.invalidateQueries({ queryKey: ['seasons'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update season'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const deleteSeason = async (seasonId: string): Promise<void> => {
    setBusy(seasonId);
    try {
      await axios.delete(`${API}/admin/seasons/${seasonId}`, { headers: authHeaders() });
      toast.success('Season deleted');
      await queryClient.invalidateQueries({ queryKey: ['leagues', id] });
      await queryClient.invalidateQueries({ queryKey: ['seasons'] });
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete season'));
    } finally {
      setBusy(null);
    }
  };

  return {
    league,
    teams,
    seasons,
    loading,
    busy,
    uploadLogo,
    uploadTeamLogo,
    updateLeague,
    addTeam,
    updateTeam,
    deleteTeam,
    addSeason,
    updateSeason,
    deleteSeason,
  };
};

export default useLeagueDetails;
