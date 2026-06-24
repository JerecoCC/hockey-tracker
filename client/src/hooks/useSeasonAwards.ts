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
  player_photo: string | null;
  position: string | null;
  jersey_number: number | null;
  team_name: string | null;
  team_code: string | null;
  team_logo: string | null;
  team_primary_color: string | null;
  team_text_color: string | null;
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

interface AwardMutationOptions {
  silent?: boolean;
  refresh?: boolean;
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

  const createAward = async (
    payload: CreateSeasonAwardPayload,
    options: AwardMutationOptions = {},
  ): Promise<boolean> => {
    try {
      await axios.post(`${API}/admin/seasons/${seasonId}/awards`, payload, {
        headers: authHeaders(),
      });
      if (!options.silent) {
        toast.success(payload.award_id ? 'Award added to season' : 'Award created');
      }
      if (options.refresh !== false) refresh();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to save award'));
      return false;
    }
  };

  const deleteSeasonAward = async (
    seasonAwardId: string,
    options: AwardMutationOptions = {},
  ): Promise<boolean> => {
    try {
      await axios.delete(`${API}/admin/seasons/${seasonId}/awards/${seasonAwardId}`, {
        headers: authHeaders(),
      });
      if (!options.silent) toast.success('Award removed from season');
      if (options.refresh !== false) refresh();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to remove award from season'));
      return false;
    }
  };

  const updateTrackedAwards = async (selectedAwardIds: string[]): Promise<boolean> => {
    const selected = new Set(selectedAwardIds);
    const trackedAwards = data.filter((award) => award.season_award_id);
    const awardsToRemove = trackedAwards.filter((award) => !selected.has(award.award_id));
    const lockedAward = awardsToRemove.find((award) => award.recipients.length > 0);
    if (lockedAward) {
      toast.error('Remove nominees and winners before removing this award from the season');
      return false;
    }

    const awardsToAdd = data.filter(
      (award) => selected.has(award.award_id) && !award.season_award_id,
    );

    try {
      for (const award of awardsToRemove) {
        await axios.delete(`${API}/admin/seasons/${seasonId}/awards/${award.season_award_id}`, {
          headers: authHeaders(),
        });
      }
      for (const award of awardsToAdd) {
        await axios.post(
          `${API}/admin/seasons/${seasonId}/awards`,
          { award_id: award.award_id },
          { headers: authHeaders() },
        );
      }
      toast.success('Season awards updated');
      refresh();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update season awards'));
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
    options: AwardMutationOptions = {},
  ): Promise<boolean> => {
    try {
      await axios.post(
        `${API}/admin/seasons/${seasonId}/awards/${seasonAwardId}/recipients`,
        payload,
        { headers: authHeaders() },
      );
      if (!options.silent) {
        toast.success(payload.role === 'winner' ? 'Winner recorded' : 'Nominee added');
      }
      if (options.refresh !== false) refresh();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to save award recipient'));
      return false;
    }
  };

  const deleteRecipient = async (
    seasonAwardId: string,
    recipientId: string,
    options: AwardMutationOptions = {},
  ): Promise<boolean> => {
    try {
      await axios.delete(
        `${API}/admin/seasons/${seasonId}/awards/${seasonAwardId}/recipients/${recipientId}`,
        { headers: authHeaders() },
      );
      if (!options.silent) toast.success('Recipient removed');
      if (options.refresh !== false) refresh();
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
    deleteSeasonAward,
    updateTrackedAwards,
    updateSeasonAward,
    addRecipient,
    deleteRecipient,
    refresh,
  };
};

export default useSeasonAwards;
