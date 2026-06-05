import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-toastify';

const API = import.meta.env.VITE_API_URL || '/api';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const apiError = (err: unknown, fallback: string): string =>
  (err as AxiosError<{ error: string }>).response?.data?.error ?? fallback;

export type AwardRecipientType = 'player' | 'team';
export type AwardSelectionMethod = 'manual' | 'voted' | 'automatic' | 'playoff';
export type AwardRecipientRole = 'winner' | 'nominee';

export interface SeasonAwardRecipient {
  id: string;
  recipient_type: AwardRecipientType;
  player_id: string | null;
  team_id: string | null;
  role: AwardRecipientRole;
  rank: number | null;
  vote_points: number | null;
  stat_value: string | null;
  notes: string | null;
  player_name: string | null;
  team_name: string | null;
  team_code: string | null;
  team_logo: string | null;
}

export interface SeasonAwardRecord {
  award_id: string;
  league_id: string;
  name: string;
  description: string | null;
  recipient_type: AwardRecipientType;
  selection_method: AwardSelectionMethod;
  stat_key: string | null;
  awarded_after_playoffs: boolean;
  sort_order: number;
  season_award_id: string | null;
  awarded_at: string | null;
  season_notes: string | null;
  recipients: SeasonAwardRecipient[];
}

export interface CreateSeasonAwardPayload {
  award_id?: string;
  name?: string;
  description?: string | null;
  recipient_type?: AwardRecipientType;
  selection_method?: AwardSelectionMethod;
  stat_key?: string | null;
  awarded_after_playoffs?: boolean;
  awarded_at?: string | null;
  notes?: string | null;
}

export interface AddAwardRecipientPayload {
  recipient_type: AwardRecipientType;
  player_id?: string | null;
  team_id?: string | null;
  role: AwardRecipientRole;
  rank?: number | null;
  vote_points?: number | null;
  stat_value?: string | null;
  notes?: string | null;
}

const useSeasonAwards = (seasonId: string | undefined) => {
  const queryClient = useQueryClient();
  const queryKey = ['season-awards', seasonId];

  const { data = [], isLoading } = useQuery<SeasonAwardRecord[]>({
    queryKey,
    queryFn: async () => {
      try {
        const { data } = await axios.get<SeasonAwardRecord[]>(
          `${API}/admin/seasons/${seasonId}/awards`,
          { headers: authHeaders() },
        );
        return data;
      } catch (err) {
        toast.error(apiError(err, 'Failed to load season awards'));
        return [];
      }
    },
    enabled: !!seasonId,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey });

  const createAward = async (payload: CreateSeasonAwardPayload): Promise<boolean> => {
    try {
      await axios.post(`${API}/admin/seasons/${seasonId}/awards`, payload, {
        headers: authHeaders(),
      });
      toast.success(payload.award_id ? 'Award added to season' : 'Award created');
      refresh();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to save award'));
      return false;
    }
  };

  const updateSeasonAward = async (
    seasonAwardId: string,
    payload: { awarded_at?: string | null; notes?: string | null },
  ): Promise<boolean> => {
    try {
      await axios.patch(`${API}/admin/seasons/${seasonId}/awards/${seasonAwardId}`, payload, {
        headers: authHeaders(),
      });
      toast.success('Award updated');
      refresh();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update award'));
      return false;
    }
  };

  const addRecipient = async (
    seasonAwardId: string,
    payload: AddAwardRecipientPayload,
  ): Promise<boolean> => {
    try {
      await axios.post(
        `${API}/admin/seasons/${seasonId}/awards/${seasonAwardId}/recipients`,
        payload,
        { headers: authHeaders() },
      );
      toast.success(payload.role === 'winner' ? 'Winner recorded' : 'Nominee added');
      refresh();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to save award recipient'));
      return false;
    }
  };

  const deleteRecipient = async (
    seasonAwardId: string,
    recipientId: string,
  ): Promise<boolean> => {
    try {
      await axios.delete(
        `${API}/admin/seasons/${seasonId}/awards/${seasonAwardId}/recipients/${recipientId}`,
        { headers: authHeaders() },
      );
      toast.success('Recipient removed');
      refresh();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to remove recipient'));
      return false;
    }
  };

  return {
    awards: data,
    loading: isLoading,
    createAward,
    updateSeasonAward,
    addRecipient,
    deleteRecipient,
  };
};

export default useSeasonAwards;
