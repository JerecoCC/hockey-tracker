import { useEffect, useState, useCallback } from 'react';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-toastify';

const API = import.meta.env.VITE_API_URL || '/api';

export interface TeamDetailRecord {
  id: string;
  name: string;
  code: string;
  description: string | null;
  location: string | null;
  logo: string | null;
  league_id: string | null;
  league_name: string | null;
  league_code: string | null;
  league_logo: string | null;
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
  const [team, setTeam] = useState<TeamDetailRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTeam = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) return;
      try {
        const { data } = await axios.get<TeamDetailRecord>(
          `${API}/admin/teams/${id}`,
          { headers: authHeaders(), signal },
        );
        setTeam(data);
        setLoading(false);
      } catch (err) {
        if (axios.isCancel(err)) return;
        toast.error(apiError(err, 'Failed to load team'));
        setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    setLoading(true);
    const controller = new AbortController();
    fetchTeam(controller.signal);
    return () => controller.abort();
  }, [fetchTeam]);

  return { team, loading };
};

export default useTeamDetails;
