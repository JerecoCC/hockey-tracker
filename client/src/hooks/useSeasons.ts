import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-toastify';

const API = import.meta.env.VITE_API_URL || '/api';

export interface SeasonRecord {
  id: string;
  name: string;
  league_id: string;
  league_name: string;
  league_code: string;
  league_logo: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface CreateSeasonData {
  league_id: string;
  start_date?: string | null;
  end_date?: string | null;
}

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

const apiError = (err: unknown, fallback: string): string =>
  (err as AxiosError<{ error: string }>).response?.data?.error ?? fallback;

const useSeasons = () => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: seasons = [], isLoading: loading } = useQuery({
    queryKey: ['seasons'],
    queryFn: async () => {
      try {
        const { data } = await axios.get<SeasonRecord[]>(`${API}/admin/seasons`, {
          headers: authHeaders(),
        });
        return data;
      } catch (err) {
        toast.error(apiError(err, 'Failed to load seasons'));
        return [] as SeasonRecord[];
      }
    },
  });

  const addSeason = async (payload: CreateSeasonData): Promise<boolean> => {
    try {
      await axios.post(`${API}/admin/seasons`, payload, { headers: authHeaders() });
      toast.success('Season created!');
      await queryClient.invalidateQueries({ queryKey: ['seasons'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to create season'));
      return false;
    }
  };

  const updateSeason = async (id: string, payload: Partial<CreateSeasonData>): Promise<boolean> => {
    setBusy(id);
    try {
      await axios.patch(`${API}/admin/seasons/${id}`, payload, { headers: authHeaders() });
      toast.success('Season updated!');
      await queryClient.invalidateQueries({ queryKey: ['seasons'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update season'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const deleteSeason = async (id: string) => {
    setBusy(id);
    try {
      await axios.delete(`${API}/admin/seasons/${id}`, { headers: authHeaders() });
      toast.success('Season deleted');
      await queryClient.invalidateQueries({ queryKey: ['seasons'] });
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete season'));
    } finally {
      setBusy(null);
    }
  };

  return { seasons, loading, busy, addSeason, updateSeason, deleteSeason };
};

export default useSeasons;

