import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import { invalidateGameStatDependents } from './gameStatCache';

import { API, authHeaders, getApiErrorMessage as apiError } from '@/lib/apiClient';



// ── Types ────────────────────────────────────────────────────────────────────

export interface ShootoutAttempt {
  id: string;
  game_id: string;
  team_id: string;
  shooter_id: string;
  scored: boolean;
  attempt_order: number;
  created_at: string;
  // Shooter info
  shooter_first_name: string;
  shooter_last_name: string;
  shooter_photo: string | null;
  shooter_jersey_number: number | null;
  shooter_date_of_birth: string | null;
  shooter_start_date : string | null;
  shooter_acquisition_type: string | null;
  // Team info
  team_name: string;
  team_code: string;
  team_logo: string | null;
  team_primary_color: string;
  team_text_color: string;
}

export interface PostAttemptData {
  team_id: string;
  shooter_id: string;
  scored?: boolean;
}

export interface PutAttemptData {
  team_id?: string;
  shooter_id?: string;
  scored?: boolean;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

const useShootoutAttempts = (gameId: string | undefined, options: { enabled?: boolean } = {}) => {
  const queryClient = useQueryClient();
  const { enabled = true } = options;
  const queryKey = ['shootout-attempts', gameId];

  const { data: attempts = [], isLoading: loading } = useQuery<ShootoutAttempt[]>({
    queryKey,
    queryFn: async () => {
      try {
        const { data } = await axios.get<ShootoutAttempt[]>(
          `${API}/admin/games/${gameId}/shootout-attempts`,
          { headers: authHeaders() },
        );
        return data;
      } catch (err) {
        toast.error(apiError(err, 'Failed to load shootout attempts'));
        return [];
      }
    },
    enabled: !!gameId && enabled,
  });

  const addAttempt = async (payload: PostAttemptData): Promise<ShootoutAttempt | null> => {
    if (!gameId) return null;
    try {
      const { data } = await axios.post<ShootoutAttempt>(
        `${API}/admin/games/${gameId}/shootout-attempts`,
        payload,
        { headers: authHeaders() },
      );
      queryClient.setQueryData<ShootoutAttempt[]>(queryKey, (current = []) =>
        [...current.filter((attempt) => attempt.id !== data.id), data].sort(
          (a, b) => a.attempt_order - b.attempt_order,
        ),
      );
      await invalidateGameStatDependents(queryClient, gameId);
      return data;
    } catch (err) {
      toast.error(apiError(err, 'Failed to record shootout attempt'));
      return null;
    }
  };

  const updateAttempt = async (
    attemptId: string,
    payload: PutAttemptData,
  ): Promise<ShootoutAttempt | null> => {
    if (!gameId) return null;
    try {
      const { data } = await axios.put<ShootoutAttempt>(
        `${API}/admin/games/${gameId}/shootout-attempts/${attemptId}`,
        payload,
        { headers: authHeaders() },
      );
      queryClient.setQueryData<ShootoutAttempt[]>(queryKey, (current = []) =>
        current
          .map((attempt) => (attempt.id === attemptId ? data : attempt))
          .sort((a, b) => a.attempt_order - b.attempt_order),
      );
      await invalidateGameStatDependents(queryClient, gameId);
      return data;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update shootout attempt'));
      return null;
    }
  };

  const deleteAttempt = async (attemptId: string): Promise<boolean> => {
    if (!gameId) return false;
    try {
      await axios.delete(
        `${API}/admin/games/${gameId}/shootout-attempts/${attemptId}`,
        { headers: authHeaders() },
      );
      queryClient.setQueryData<ShootoutAttempt[]>(queryKey, (current = []) =>
        current.filter((attempt) => attempt.id !== attemptId),
      );
      await invalidateGameStatDependents(queryClient, gameId);
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete shootout attempt'));
      return false;
    }
  };

  return { attempts, loading, addAttempt, updateAttempt, deleteAttempt };
};

export default useShootoutAttempts;
