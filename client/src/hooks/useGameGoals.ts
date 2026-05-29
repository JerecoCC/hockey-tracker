import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-toastify';

const API = import.meta.env.VITE_API_URL || '/api';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

const apiError = (err: unknown, fallback: string): string =>
  (err as AxiosError<{ error: string }>).response?.data?.error ?? fallback;

const goalPeriodOrder = (period: string) => {
  switch (period) {
    case '1': return 1;
    case '2': return 2;
    case '3': return 3;
    case 'OT': return 4;
    case 'SO': return 5;
    default: return 6;
  }
};

const sortGoals = (goals: GoalRecord[]) =>
  [...goals].sort((a, b) => {
    const periodDiff = goalPeriodOrder(a.period) - goalPeriodOrder(b.period);
    if (periodDiff !== 0) return periodDiff;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

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
  scorer_date_of_birth: string | null;
  scorer_start_date: string | null;
  scorer_acquisition_type: string | null;
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
      const response = await axios.post<GoalRecord>(
        `${API}/admin/games/${gameId}/goals`,
        data,
        { headers: authHeaders() },
      );
      queryClient.setQueryData<GoalRecord[]>(['game-goals', gameId], (current = []) =>
        sortGoals([...current.filter((goal) => goal.id !== response.data.id), response.data]),
      );
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
      const response = await axios.put<GoalRecord>(
        `${API}/admin/games/${gameId}/goals/${goalId}`,
        data,
        { headers: authHeaders() },
      );
      queryClient.setQueryData<GoalRecord[]>(['game-goals', gameId], (current = []) =>
        sortGoals(current.map((goal) => (goal.id === goalId ? response.data : goal))),
      );
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
      queryClient.setQueryData<GoalRecord[]>(['game-goals', gameId], (current = []) =>
        current.filter((goal) => goal.id !== goalId),
      );
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
