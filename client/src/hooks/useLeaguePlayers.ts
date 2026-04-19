import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-toastify';

const API = import.meta.env.VITE_API_URL || '/api';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

const apiError = (err: unknown, fallback: string): string =>
  (err as AxiosError<{ error: string }>).response?.data?.error ?? fallback;

export type PlayerPosition = 'C' | 'LW' | 'RW' | 'D' | 'G';
export type PlayerShoots = 'L' | 'R';

export interface PlayerRecord {
  id: string;
  first_name: string;
  last_name: string;
  photo: string | null;
  date_of_birth: string | null;
  birth_city: string | null;
  birth_country: string | null;
  nationality: string | null;
  height_cm: number | null;
  weight_lbs: number | null;
  position: PlayerPosition | null;
  shoots: PlayerShoots | null;
  is_active: boolean;
  created_at: string;
  // Roster fields — populated when fetching by league_id or team_id
  jersey_number?: number | null;
  team_name?: string | null;
  primary_color?: string | null;
  text_color?: string | null;
}

export interface CreatePlayerData {
  first_name: string;
  last_name: string;
  position?: PlayerPosition | null;
  shoots?: PlayerShoots | null;
  date_of_birth?: string | null;
  birth_city?: string | null;
  birth_country?: string | null;
  nationality?: string | null;
  height_cm?: number | null;
  weight_lbs?: number | null;
  is_active?: boolean;
}

/** Minimal payload used by the bulk-add endpoint. */
export interface BulkPlayerInput {
  first_name: string;
  last_name: string;
  position: PlayerPosition;
  shoots: PlayerShoots;
}

const useLeaguePlayers = (leagueId?: string, seasonId?: string) => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: players = [], isLoading: loading } = useQuery<PlayerRecord[]>({
    queryKey: ['players', { league_id: leagueId, season_id: seasonId }],
    queryFn: async () => {
      try {
        const params: Record<string, string> = {};
        if (leagueId) params.league_id = leagueId;
        if (seasonId) params.season_id = seasonId;
        const { data } = await axios.get<PlayerRecord[]>(
          `${API}/admin/players`,
          { headers: authHeaders(), params: Object.keys(params).length ? params : undefined },
        );
        return data;
      } catch (err) {
        toast.error(apiError(err, 'Failed to load players'));
        return [];
      }
    },
  });

  const addPlayer = async (payload: CreatePlayerData): Promise<boolean> => {
    try {
      await axios.post(`${API}/admin/players`, payload, { headers: authHeaders() });
      toast.success('Player created!');
      await queryClient.invalidateQueries({ queryKey: ['players'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to create player'));
      return false;
    }
  };

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

  const bulkAddPlayers = async (players: BulkPlayerInput[]): Promise<boolean> => {
    try {
      await axios.post(
        `${API}/admin/players/bulk`,
        { players },
        { headers: authHeaders() },
      );
      const n = players.length;
      toast.success(`${n} player${n !== 1 ? 's' : ''} added!`);
      await queryClient.invalidateQueries({ queryKey: ['players'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to bulk add players'));
      return false;
    }
  };

  return { players, loading, busy, addPlayer, bulkAddPlayers, updatePlayer, deletePlayer };
};

export default useLeaguePlayers;
