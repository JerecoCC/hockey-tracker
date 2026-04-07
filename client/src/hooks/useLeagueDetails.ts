import { useEffect, useState, useCallback } from 'react';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-toastify';
import { type LeagueRecord, type CreateLeagueData } from './useLeagues';
import { type TeamRecord, type CreateTeamData } from './useTeams';

const API = import.meta.env.VITE_API_URL || '/api';

/** Full league shape returned by the details endpoint (superset of the list record). */
export interface LeagueFullRecord extends LeagueRecord {
  description: string | null;
  created_at: string;
}

export interface LeagueSeasonRecord {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface LeagueDetailsRecord extends LeagueFullRecord {
  teams: TeamRecord[];
  seasons: LeagueSeasonRecord[];
}

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

const apiError = (err: unknown, fallback: string): string =>
  (err as AxiosError<{ error: string }>).response?.data?.error ?? fallback;

const useLeagueDetails = (id: string | undefined) => {
  const [league, setLeague] = useState<LeagueFullRecord | null>(null);
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [seasons, setSeasons] = useState<LeagueSeasonRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const fetchDetails = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) return;
      try {
        const { data } = await axios.get<LeagueDetailsRecord>(
          `${API}/admin/leagues/${id}`,
          { headers: authHeaders(), signal },
        );
        const { teams: t, seasons: s, ...leagueData } = data;
        setLeague(leagueData);
        setTeams(t);
        setSeasons(s);
        setLoading(false);
      } catch (err) {
        if (axios.isCancel(err)) return;
        toast.error(apiError(err, 'Failed to load league'));
        setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    setLoading(true);
    const controller = new AbortController();
    fetchDetails(controller.signal);
    return () => controller.abort();
  }, [fetchDetails]);

  const uploadLogo = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append('logo', file);
    try {
      const { data } = await axios.post<{ url: string }>(
        `${API}/admin/leagues/upload`,
        formData,
        { headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' } },
      );
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
      const { data } = await axios.post<{ url: string }>(
        `${API}/admin/teams/upload`,
        formData,
        { headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' } },
      );
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
      await fetchDetails();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update league'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const addTeam = async (payload: CreateTeamData): Promise<boolean> => {
    try {
      await axios.post(`${API}/admin/teams`, payload, { headers: authHeaders() });
      toast.success('Team created!');
      await fetchDetails();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to create team'));
      return false;
    }
  };

  const deleteTeam = async (teamId: string): Promise<void> => {
    setBusy(teamId);
    try {
      await axios.delete(`${API}/admin/teams/${teamId}`, { headers: authHeaders() });
      toast.success('Team deleted');
      await fetchDetails();
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete team'));
    } finally {
      setBusy(null);
    }
  };

  return { league, teams, seasons, loading, busy, uploadLogo, uploadTeamLogo, updateLeague, addTeam, deleteTeam };
};

export default useLeagueDetails;
