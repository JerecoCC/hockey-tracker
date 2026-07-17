import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import { invalidateGameStatDependents } from './gameStatCache';

import { API, authHeaders, getApiErrorMessage as apiError } from '@/lib/apiClient';



export type LineupPositionSlot = 'G';

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
  date_of_birth: string | null;
  start_date: string | null;
  acquisition_type: string | null;
  inherited?: boolean;
}

const useGameLineup = (gameId: string | undefined) => {
  const queryClient = useQueryClient();
  const queryKey = ['game-lineup', gameId];

  const { data: lineup = [], isLoading: loading } = useQuery<LineupEntry[]>({
    queryKey,
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
      queryClient.setQueryData<LineupEntry[]>(queryKey, (current = []) =>
        current.filter((entry) => entry.team_id !== teamId),
      );
      if (gameId) {
        await invalidateGameStatDependents(queryClient, gameId);
      }
      return true;
    } catch (err) {
        toast.error(apiError(err, 'Failed to clear starting goalie'));
      return false;
    }
  };

  const saveTeamLineup = async (
    teamId: string,
    slots: Array<{ position_slot: LineupPositionSlot; player_id: string | null }>,
    teamName?: string,
  ): Promise<boolean> => {
    try {
      const { data: teamLineup } = await axios.put<LineupEntry[]>(
        `${API}/admin/games/${gameId}/lineup`,
        { team_id: teamId, slots },
        { headers: authHeaders() },
      );
      toast.success(teamName ? `${teamName} starting goalie saved` : 'Starting goalie saved');
      queryClient.setQueryData<LineupEntry[]>(queryKey, (current = []) => [
        ...current.filter((entry) => entry.team_id !== teamId),
        ...teamLineup,
      ]);
      if (gameId) {
        await invalidateGameStatDependents(queryClient, gameId);
      }
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to save starting goalie'));
      return false;
    }
  };

  return { lineup, loading, saveTeamLineup, clearTeamLineup };
};

export default useGameLineup;
