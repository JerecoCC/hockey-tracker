import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-toastify';
import type { AwardRecipientType, AwardSelectionMethod } from './useSeasonAwards';

const API = import.meta.env.VITE_API_URL || '/api';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const apiError = (err: unknown, fallback: string): string =>
  (err as AxiosError<{ error: string }>).response?.data?.error ?? fallback;

export interface LeagueAwardRecord {
  id: string;
  league_id: string;
  name: string;
  description: string | null;
  recipient_type: AwardRecipientType;
  selection_method: AwardSelectionMethod;
  stat_key: string | null;
  awarded_after_playoffs: boolean;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export interface LeagueAwardPayload {
  name: string;
  description?: string | null;
  recipient_type: AwardRecipientType;
  selection_method: AwardSelectionMethod;
  stat_key?: string | null;
  awarded_after_playoffs: boolean;
  sort_order?: number | null;
}

const useLeagueAwards = (leagueId: string | undefined) => {
  const queryClient = useQueryClient();
  const queryKey = ['league-awards', leagueId];

  const { data = [], isLoading } = useQuery<LeagueAwardRecord[]>({
    queryKey,
    queryFn: async () => {
      try {
        const { data } = await axios.get<LeagueAwardRecord[]>(
          `${API}/admin/leagues/${leagueId}/awards`,
          { headers: authHeaders() },
        );
        return data;
      } catch (err) {
        toast.error(apiError(err, 'Failed to load award definitions'));
        return [];
      }
    },
    enabled: !!leagueId,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey });
    await queryClient.invalidateQueries({ queryKey: ['season-awards'] });
  };

  const createAward = async (payload: LeagueAwardPayload): Promise<boolean> => {
    try {
      await axios.post(`${API}/admin/leagues/${leagueId}/awards`, payload, {
        headers: authHeaders(),
      });
      toast.success('Award definition created');
      await refresh();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to create award definition'));
      return false;
    }
  };

  const updateAward = async (
    awardId: string,
    payload: Partial<LeagueAwardPayload>,
  ): Promise<boolean> => {
    try {
      await axios.patch(`${API}/admin/leagues/${leagueId}/awards/${awardId}`, payload, {
        headers: authHeaders(),
      });
      toast.success('Award definition updated');
      await refresh();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update award definition'));
      return false;
    }
  };

  const deleteAward = async (awardId: string): Promise<boolean> => {
    try {
      await axios.delete(`${API}/admin/leagues/${leagueId}/awards/${awardId}`, {
        headers: authHeaders(),
      });
      toast.success('Award definition removed');
      await refresh();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to remove award definition'));
      return false;
    }
  };

  return {
    awards: data,
    loading: isLoading,
    createAward,
    updateAward,
    deleteAward,
  };
};

export default useLeagueAwards;
