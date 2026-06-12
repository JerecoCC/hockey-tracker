import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-toastify';

const API = import.meta.env.VITE_API_URL || '/api';

export interface TeamIteration {
  id: string;
  team_id: string;
  name: string;
  place_name?: string | null;
  team_name?: string | null;
  code: string | null;
  logo: string | null;
  logo_dark: string | null;
  logo_light: string | null;
  icon: string | null;
  note: string | null;
  recorded_at: string;
  /** Date this version first applied. */
  start_date: string | null;
  /** Date this version stopped applying. Null means still active/current. */
  end_date: string | null;
}

export interface AddIterationPayload {
  name: string;
  place_name?: string | null;
  team_name?: string | null;
  code?: string | null;
  logo?: string | null;
  logo_dark?: string | null;
  logo_light?: string | null;
  icon?: string | null;
  note?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface UpdateIterationPayload {
  name?: string;
  place_name?: string | null;
  team_name?: string | null;
  code?: string | null;
  logo?: string | null;
  logo_dark?: string | null;
  logo_light?: string | null;
  icon?: string | null;
  note?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

const apiError = (err: unknown, fallback: string) => {
  const e = err as AxiosError<{ error?: string }>;
  return e.response?.data?.error ?? fallback;
};

const useTeamHistory = (teamId: string | undefined) => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: iterations = [], isLoading } = useQuery<TeamIteration[]>({
    queryKey: ['team-iterations', teamId],
    queryFn: async () => {
      try {
        const { data } = await axios.get<TeamIteration[]>(
          `${API}/admin/teams/${teamId}/iterations`,
          { headers: authHeaders() },
        );
        return data;
      } catch (err) {
        toast.error(apiError(err, 'Failed to load team history'));
        return [];
      }
    },
    enabled: !!teamId,
  });

  const addIteration = async (payload: AddIterationPayload): Promise<boolean> => {
    if (!teamId) return false;
    setBusy(true);
    try {
      await axios.post(`${API}/admin/teams/${teamId}/iterations`, payload, {
        headers: authHeaders(),
      });
      toast.success('Version recorded!');
      await queryClient.invalidateQueries({ queryKey: ['team-iterations', teamId] });
      await queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to record version'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const updateIteration = async (iterationId: string, payload: UpdateIterationPayload): Promise<boolean> => {
    if (!teamId) return false;
    setBusy(true);
    try {
      await axios.patch(`${API}/admin/teams/${teamId}/iterations/${iterationId}`, payload, {
        headers: authHeaders(),
      });
      toast.success('Version updated!');
      await queryClient.invalidateQueries({ queryKey: ['team-iterations', teamId] });
      await queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update version'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const deleteIteration = async (iterationId: string): Promise<boolean> => {
    if (!teamId) return false;
    setBusy(true);
    try {
      await axios.delete(`${API}/admin/teams/${teamId}/iterations/${iterationId}`, {
        headers: authHeaders(),
      });
      toast.success('Version deleted');
      await queryClient.invalidateQueries({ queryKey: ['team-iterations', teamId] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete version'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { iterations, isLoading, busy, addIteration, updateIteration, deleteIteration };
};

export default useTeamHistory;
