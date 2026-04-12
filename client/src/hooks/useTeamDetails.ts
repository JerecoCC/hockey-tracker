import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-toastify';
import { type CreateTeamData } from './useTeams';

const API = import.meta.env.VITE_API_URL || '/api';

export interface TeamDetailRecord {
  id: string;
  name: string;
  code: string;
  description: string | null;
  location: string | null;
  logo: string | null;
  league_id: string | null;
  primary_color: string;
  text_color: string;
  league_name: string | null;
  league_code: string | null;
  league_logo: string | null;
  league_primary_color: string | null;
  league_text_color: string | null;
  created_at: string;
}

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

const apiError = (err: unknown, fallback: string) => {
  const e = err as AxiosError<{ error?: string }>;
  return e.response?.data?.error ?? fallback;
};

const useTeamDetails = (id: string | undefined) => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: team = null, isLoading: loading } = useQuery({
    queryKey: ['teams', id],
    queryFn: async () => {
      try {
        const { data } = await axios.get<TeamDetailRecord>(
          `${API}/admin/teams/${id}`,
          { headers: authHeaders() },
        );
        return data;
      } catch (err) {
        toast.error(apiError(err, 'Failed to load team'));
        return null;
      }
    },
    enabled: !!id,
  });

  const uploadLogo = async (file: File): Promise<string | null> => {
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

  const updateTeam = async (teamId: string, payload: Partial<CreateTeamData>): Promise<boolean> => {
    setBusy(teamId);
    try {
      await axios.patch(`${API}/admin/teams/${teamId}`, payload, { headers: authHeaders() });
      toast.success('Team updated!');
      await queryClient.invalidateQueries({ queryKey: ['teams', teamId] });
      await queryClient.invalidateQueries({ queryKey: ['teams'] });
      await queryClient.invalidateQueries({ queryKey: ['leagues'] });
      // Remove the specific league detail from cache so the league details page
      // fetches fresh data on next mount instead of flashing stale team info.
      if (team?.league_id) {
        queryClient.removeQueries({ queryKey: ['leagues', team.league_id] });
      }
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update team'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  return { team, loading, busy, uploadLogo, updateTeam };
};

export default useTeamDetails;
