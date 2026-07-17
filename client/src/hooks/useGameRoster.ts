import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import { invalidateGameStatDependents } from './gameStatCache';

import { API, authHeaders, getApiErrorMessage as apiError } from '@/lib/apiClient';



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
  date_of_birth: string | null;
  start_date: string | null;
  acquisition_type: string | null;
  inherited?: boolean;
}

const useGameRoster = (gameId: string | undefined) => {
  const queryClient = useQueryClient();
  const queryKey = ['game-roster', gameId];

  const { data: roster = [], isLoading: loading } = useQuery<GameRosterEntry[]>({
    queryKey,
    queryFn: async () => {
      try {
        const { data } = await axios.get<GameRosterEntry[]>(
          `${API}/admin/games/${gameId}/roster`,
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

  const addToRoster = async (teamId: string, playerIds: string[]): Promise<boolean> => {
    if (!gameId || playerIds.length === 0) return false;
    try {
      const { data: teamRows } = await axios.post<GameRosterEntry[]>(
        `${API}/admin/games/${gameId}/roster`,
        { team_id: teamId, player_ids: playerIds },
        { headers: authHeaders() },
      );
      toast.success(`${playerIds.length} player${playerIds.length !== 1 ? 's' : ''} added to lineup`);
      queryClient.setQueryData<GameRosterEntry[]>(queryKey, (current = []) => [
        ...current.filter((entry) => entry.team_id !== teamId),
        ...teamRows,
      ]);
      await invalidateGameStatDependents(queryClient, gameId);
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to add players to lineup'));
      return false;
    }
  };

  const removeFromRoster = async (rosterId: string): Promise<boolean> => {
    if (!gameId) return false;
    try {
      const removed = queryClient
        .getQueryData<GameRosterEntry[]>(queryKey)
        ?.find((entry) => entry.id === rosterId);
      await axios.delete(`${API}/admin/games/${gameId}/roster/${rosterId}`, {
        headers: authHeaders(),
      });
      queryClient.setQueryData<GameRosterEntry[]>(queryKey, (current = []) =>
        current.filter((entry) => entry.id !== rosterId),
      );
      if (removed) {
        queryClient.setQueryData<{ player_id: string }[]>(['game-lineup', gameId], (current = []) =>
          current.filter((entry) => entry.player_id !== removed.player_id),
        );
      }
      await invalidateGameStatDependents(queryClient, gameId);
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to remove player from lineup'));
      return false;
    }
  };

  return { roster, loading, addToRoster, removeFromRoster };
};

export default useGameRoster;
