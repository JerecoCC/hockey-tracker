import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-toastify';

const API = import.meta.env.VITE_API_URL || '/api';

export interface TeamRecord {
  id: string;
  name: string;
  code: string;
  description: string | null;
  location: string | null;
  logo: string | null;
  league_id: string | null;
  created_at: string;
}

export interface CreateTeamData {
  name: string;
  code: string;
  description?: string;
  location?: string;
  logo?: string | null;
  league_id?: string | null;
}

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

const apiError = (err: unknown, fallback: string): string =>
  (err as AxiosError<{ error: string }>).response?.data?.error ?? fallback;

const useTeams = () => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: teams = [], isLoading: loading } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      try {
        const { data } = await axios.get<TeamRecord[]>(`${API}/admin/teams`, {
          headers: authHeaders(),
        });
        return data;
      } catch (err) {
        toast.error(apiError(err, 'Failed to load teams'));
        return [] as TeamRecord[];
      }
    },
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

  const addTeam = async (payload: CreateTeamData): Promise<boolean> => {
    try {
      await axios.post(`${API}/admin/teams`, payload, { headers: authHeaders() });
      toast.success('Team created!');
      await queryClient.invalidateQueries({ queryKey: ['teams'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to create team'));
      return false;
    }
  };

  const updateTeam = async (id: string, payload: Partial<CreateTeamData>): Promise<boolean> => {
    setBusy(id);
    try {
      await axios.patch(`${API}/admin/teams/${id}`, payload, { headers: authHeaders() });
      toast.success('Team updated!');
      await queryClient.invalidateQueries({ queryKey: ['teams'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update team'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const deleteTeam = async (id: string) => {
    setBusy(id);
    try {
      await axios.delete(`${API}/admin/teams/${id}`, { headers: authHeaders() });
      toast.success('Team deleted');
      await queryClient.invalidateQueries({ queryKey: ['teams'] });
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete team'));
    } finally {
      setBusy(null);
    }
  };

  return { teams, loading, busy, uploadLogo, addTeam, updateTeam, deleteTeam };
};

export default useTeams;
