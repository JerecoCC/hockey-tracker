import { useEffect, useState, useCallback } from 'react';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-toastify';

const API = import.meta.env.VITE_API_URL || '/api';

export interface LeagueRecord {
  id: string;
  name: string;
  code: string;
  description: string | null;
  logo: string | null;
  created_at: string;
}

export interface CreateLeagueData {
  name: string;
  code: string;
  description?: string;
  logo?: string;
}

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

const apiError = (err: unknown, fallback: string): string =>
  (err as AxiosError<{ error: string }>).response?.data?.error ?? fallback;

const useLeagues = () => {
  const [leagues, setLeagues] = useState<LeagueRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeagues = useCallback(async (signal?: AbortSignal) => {
    try {
      const { data } = await axios.get<LeagueRecord[]>(`${API}/admin/leagues`, { headers: authHeaders(), signal });
      setLeagues(data);
    } catch (err) {
      if (axios.isCancel(err)) return;
      toast.error(apiError(err, 'Failed to load leagues'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchLeagues(controller.signal);
    return () => controller.abort();
  }, [fetchLeagues]);

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

  const addLeague = async (payload: CreateLeagueData): Promise<boolean> => {
    try {
      await axios.post(`${API}/admin/leagues`, payload, { headers: authHeaders() });
      toast.success('League created!');
      await fetchLeagues();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to create league'));
      return false;
    }
  };

  return { leagues, loading, uploadLogo, addLeague };
};

export default useLeagues;