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

export interface GameRosterEntry {
  id: string;
  game_id: string;
  team_id: string;
  player_id: string;
  first_name: string;
  last_name: string;
  photo: string | null;
  position: string | null;
  jersey_number: number | null;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

const useGameRoster = (gameId: string | undefined) => {
  const queryClient = useQueryClient();

  const { data: roster = [], isLoading: loading } = useQuery<GameRosterEntry[]>({
    queryKey: ['game-roster', gameId],
    queryFn: async () => {
      try {
        const { data } = await axios.get<GameRosterEntry[]>(
          `${API}/admin/games/${gameId}/roster`,
          { headers: authHeaders() },
        );
        return data;
      } catch (err) {
        toast.error(apiError(err, 'Failed to load game roster'));
        return [];
      }
    },
    enabled: !!gameId,
  });

  const addToRoster = async (teamId: string, playerIds: string[]): Promise<boolean> => {
    if (!gameId || playerIds.length === 0) return false;
    try {
      await axios.post(
        `${API}/admin/games/${gameId}/roster`,
        { team_id: teamId, player_ids: playerIds },
        { headers: authHeaders() },
      );
      toast.success(`${playerIds.length} player${playerIds.length !== 1 ? 's' : ''} added to roster`);
      await queryClient.invalidateQueries({ queryKey: ['game-roster', gameId] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to add players to roster'));
      return false;
    }
  };

  const removeFromRoster = async (rosterId: string): Promise<boolean> => {
    if (!gameId) return false;
    try {
      await axios.delete(`${API}/admin/games/${gameId}/roster/${rosterId}`, {
        headers: authHeaders(),
      });
      await queryClient.invalidateQueries({ queryKey: ['game-roster', gameId] });
      // Also invalidate lineup — a removed player may have been a starter
      await queryClient.invalidateQueries({ queryKey: ['game-lineup', gameId] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to remove player from roster'));
      return false;
    }
  };

  return { roster, loading, addToRoster, removeFromRoster };
};

export default useGameRoster;
