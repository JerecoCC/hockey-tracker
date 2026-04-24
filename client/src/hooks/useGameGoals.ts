import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-toastify';

const API = import.meta.env.VITE_API_URL || '/api';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

const apiError = (err: unknown, fallback: string): string =>
  (err as AxiosError<{ error: string }>).response?.data?.error ?? fallback;

// ── Types ────────────────────────────────────────────────────────────────────

export interface GoalRecord {
  id: string;
  game_id: string;
  team_id: string;
  period: string;
  goal_type: string;
  empty_net: boolean;
  period_time: string | null;
  scorer_id: string;
  assist_1_id: string | null;
  assist_2_id: string | null;
  created_at: string;
  // Team info
  team_name: string;
  team_code: string;
  team_logo: string | null;
  team_primary_color: string;
  team_text_color: string;
  // Scorer
  scorer_first_name: string;
  scorer_last_name: string;
  scorer_photo: string | null;
  scorer_jersey_number: number | null;
  // Assist 1
  assist_1_first_name: string | null;
  assist_1_last_name: string | null;
  assist_1_photo: string | null;
  assist_1_jersey_number: number | null;
  // Assist 2
  assist_2_first_name: string | null;
  assist_2_last_name: string | null;
  assist_2_photo: string | null;
  assist_2_jersey_number: number | null;
  // Prior-game cumulative stats (finalized games in same season before this game)
  scorer_prior_goals: number;
  assist_1_prior_assists: number;
  assist_2_prior_assists: number;
}

export interface PostGoalData {
  team_id: string;
  period: string;
  goal_type?: string;
  empty_net?: boolean;
  period_time?: string | null;
  scorer_id: string;
  assist_1_id?: string | null;
  assist_2_id?: string | null;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

const useGameGoals = (gameId: string | undefined) => {
  const queryClient = useQueryClient();

  const { data: goals = [], isLoading: loading } = useQuery<GoalRecord[]>({
    queryKey: ['game-goals', gameId],
    queryFn: async () => {
      try {
        const { data } = await axios.get<GoalRecord[]>(
          `${API}/admin/games/${gameId}/goals`,
          { headers: authHeaders() },
        );
        return data;
      } catch (err) {
        toast.error(apiError(err, 'Failed to load goals'));
        return [];
      }
    },
    enabled: !!gameId,
  });

  const addGoal = async (data: PostGoalData): Promise<boolean> => {
    if (!gameId) return false;
    try {
      await axios.post<GoalRecord>(
        `${API}/admin/games/${gameId}/goals`,
        data,
        { headers: authHeaders() },
      );
      await queryClient.invalidateQueries({ queryKey: ['game-goals', gameId] });
      // Also refresh the game record so period scores update in the scoreboard.
      await queryClient.invalidateQueries({ queryKey: ['games', gameId] });
      await queryClient.invalidateQueries({ queryKey: ['games'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to record goal'));
      return false;
    }
  };

  const updateGoal = async (goalId: string, data: PostGoalData): Promise<boolean> => {
    if (!gameId) return false;
    try {
      await axios.put<GoalRecord>(
        `${API}/admin/games/${gameId}/goals/${goalId}`,
        data,
        { headers: authHeaders() },
      );
      await queryClient.invalidateQueries({ queryKey: ['game-goals', gameId] });
      await queryClient.invalidateQueries({ queryKey: ['games', gameId] });
      await queryClient.invalidateQueries({ queryKey: ['games'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update goal'));
      return false;
    }
  };

  const deleteGoal = async (goalId: string): Promise<boolean> => {
    if (!gameId) return false;
    try {
      await axios.delete(
        `${API}/admin/games/${gameId}/goals/${goalId}`,
        { headers: authHeaders() },
      );
      await queryClient.invalidateQueries({ queryKey: ['game-goals', gameId] });
      // Refresh game so period scores and totals recalculate.
      await queryClient.invalidateQueries({ queryKey: ['games', gameId] });
      await queryClient.invalidateQueries({ queryKey: ['games'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete goal'));
      return false;
    }
  };

  return { goals, loading, addGoal, updateGoal, deleteGoal };
};

export default useGameGoals;
