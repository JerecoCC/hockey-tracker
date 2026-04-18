import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { useState } from 'react';
import { toast } from 'react-toastify';
import { type PlayerRecord, type CreatePlayerData } from './useLeaguePlayers';

const API = import.meta.env.VITE_API_URL || '/api';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

const apiError = (err: unknown, fallback: string): string =>
  (err as AxiosError<{ error: string }>).response?.data?.error ?? fallback;

const useTeamPlayers = (teamId: string | undefined) => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: players = [], isLoading: loading } = useQuery<PlayerRecord[]>({
    queryKey: ['players', { team_id: teamId }],
    queryFn: async () => {
      try {
        const { data } = await axios.get<PlayerRecord[]>(
          `${API}/admin/players`,
          { headers: authHeaders(), params: { team_id: teamId } },
        );
        return data;
      } catch (err) {
        toast.error(apiError(err, 'Failed to load roster'));
        return [];
      }
    },
    enabled: !!teamId,
  });

  const updatePlayer = async (
    playerId: string,
    payload: Partial<CreatePlayerData>,
  ): Promise<boolean> => {
    setBusy(playerId);
    try {
      await axios.patch(`${API}/admin/players/${playerId}`, payload, { headers: authHeaders() });
      toast.success('Player updated!');
      await queryClient.invalidateQueries({ queryKey: ['players'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update player'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const deletePlayer = async (playerId: string): Promise<void> => {
    setBusy(playerId);
    try {
      await axios.delete(`${API}/admin/players/${playerId}`, { headers: authHeaders() });
      toast.success('Player deleted');
      await queryClient.invalidateQueries({ queryKey: ['players'] });
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete player'));
    } finally {
      setBusy(null);
    }
  };

  return { players, loading, busy, updatePlayer, deletePlayer };
};

export default useTeamPlayers;
