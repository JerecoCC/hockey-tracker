import { useQuery } from '@tanstack/react-query';
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

  return { team, loading };
};

export default useTeamDetails;
