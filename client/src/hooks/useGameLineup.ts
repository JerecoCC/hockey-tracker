import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-toastify';

const API = import.meta.env.VITE_API_URL || '/api';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

const apiError = (err: unknown, fallback: string): string =>
  (err as AxiosError<{ error: string }>).response?.data?.error ?? fallback;

export type LineupPositionSlot = 'C' | 'LW' | 'RW' | 'D1' | 'D2' | 'G';

export interface LineupEntry {
  id: string;
  game_id: string;
  team_id: string;
  player_id: string;
  position_slot: LineupPositionSlot;
  player_first_name: string;
  player_last_name: string;
  player_photo: string | null;
  jersey_number: number | null;
  /** True when pre-populated from the last finished game; not yet saved to this game. */
  inherited?: boolean;
}

const useGameLineup = (gameId: string | undefined) => {
  const queryClient = useQueryClient();

  const { data: lineup = [], isLoading: loading } = useQuery<LineupEntry[]>({
    queryKey: ['game-lineup', gameId],
    queryFn: async () => {
      try {
        const { data } = await axios.get<LineupEntry[]>(
          `${API}/admin/games/${gameId}/lineup`,
          { headers: authHeaders() },
        );
        return data;
      } catch (err) {
        toast.error(apiError(err, 'Failed to load lineup'));
        return [];
      }
    },
    enabled: !!gameId,
  });

  const clearTeamLineup = async (teamId: string): Promise<boolean> => {
    try {
      await axios.delete(`${API}/admin/games/${gameId}/lineup/${teamId}`, {
        headers: authHeaders(),
      });
      await queryClient.invalidateQueries({ queryKey: ['game-lineup', gameId] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to clear lineup'));
      return false;
    }
  };

  const saveTeamLineup = async (
    teamId: string,
    slots: Array<{ position_slot: LineupPositionSlot; player_id: string | null }>,
  ): Promise<boolean> => {
    try {
      await axios.put(
        `${API}/admin/games/${gameId}/lineup`,
        { team_id: teamId, slots },
        { headers: authHeaders() },
      );
      toast.success('Lineup saved!');
      await queryClient.invalidateQueries({ queryKey: ['game-lineup', gameId] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to save lineup'));
      return false;
    }
  };

  return { lineup, loading, saveTeamLineup, clearTeamLineup };
};

export default useGameLineup;
