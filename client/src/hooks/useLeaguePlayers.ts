import { useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-toastify';
import { type PlayerStatus } from '@/lib/playerStatus';

const API = import.meta.env.VITE_API_URL || '/api';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

const apiError = (err: unknown, fallback: string): string =>
  (err as AxiosError<{ error: string }>).response?.data?.error ?? fallback;

export type PlayerPosition = 'C' | 'LW' | 'RW' | 'F' | 'D' | 'LD' | 'RD' | 'G';
export type PlayerShoots = 'L' | 'R';
export type { PlayerStatus } from '@/lib/playerStatus';

export interface PlayerRecord {
  id: string;
  league_player_number?: string | null;
  first_name: string;
  last_name: string;
  photo: string | null;
  date_of_birth: string | null;
  birth_city: string | null;
  birth_country: string | null;
  height_cm: number | null;
  weight_lbs: number | null;
  position: PlayerPosition | null;
  shoots: PlayerShoots | null;
  rookie_season_id?: string | null;
  rookie_season_name?: string | null;
  status?: PlayerStatus;
  is_active: boolean;
  created_at: string;
  // Roster fields — populated when fetching by league_id or team_id
  player_team_id?: string | null;
  jersey_number?: number | null;
  team_id?: string | null;
  team_name?: string | null;
  team_code?: string | null;
  team_logo?: string | null;
  team_logo_dark?: string | null;
  team_logo_light?: string | null;
  primary_color?: string | null;
  text_color?: string | null;
  is_prospect?: boolean;
  acquisition_type?: string | null;
  start_date?: string | null;
  has_games?: boolean;
  season_points?: number | null;
}

export interface CreatePlayerData {
  first_name: string;
  last_name: string;
  league_player_number?: string | null;
  position?: PlayerPosition | null;
  shoots?: PlayerShoots | null;
  date_of_birth?: string | null;
  birth_city?: string | null;
  birth_country?: string | null;
  height_cm?: number | null;
  weight_lbs?: number | null;
  rookie_season_id?: string | null;
  status?: PlayerStatus;
  is_active?: boolean;
}

/** Minimal payload used by the bulk-add endpoint. */
export interface BulkPlayerInput {
  first_name: string;
  last_name: string;
  league_player_number?: string | null;
  position: PlayerPosition;
  shoots: PlayerShoots;
  rookie_season_id?: string | null;
}

interface UseLeaguePlayersOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  rookiesOnly?: boolean;
  includeInactive?: boolean;
  includeProspects?: boolean;
}

interface PaginatedPlayersResponse {
  players: PlayerRecord[];
  total: number;
  page: number;
  page_size: number;
}

const useLeaguePlayers = (
  leagueId?: string,
  seasonId?: string,
  options: UseLeaguePlayersOptions = {},
) => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const isPaginated =
    options.page !== undefined || options.pageSize !== undefined || options.search !== undefined;

  const { data, isFetching: fetching, isLoading: loading } = useQuery<PlayerRecord[] | PaginatedPlayersResponse>({
    queryKey: [
      'players',
      {
        league_id: leagueId,
        season_id: seasonId,
        page: options.page,
        page_size: options.pageSize,
        search: options.search,
        rookies_only: options.rookiesOnly,
        include_inactive: options.includeInactive,
        include_prospects: options.includeProspects,
      },
    ],
    queryFn: async () => {
      try {
        const params: Record<string, string> = {};
        if (leagueId) params.league_id = leagueId;
        if (seasonId) params.season_id = seasonId;
        if (options.page !== undefined) params.page = String(options.page);
        if (options.pageSize !== undefined) params.page_size = String(options.pageSize);
        if (options.search !== undefined) params.search = options.search;
        if (options.rookiesOnly) params.rookies_only = 'true';
        if (options.includeInactive) params.include_inactive = 'true';
        if (options.includeProspects) params.include_prospects = 'true';
        const { data } = await axios.get<PlayerRecord[] | PaginatedPlayersResponse>(
          `${API}/admin/players`,
          { headers: authHeaders(), params: Object.keys(params).length ? params : undefined },
        );
        return data;
      } catch (err) {
        toast.error(apiError(err, 'Failed to load players'));
        return isPaginated ? { players: [], total: 0, page: options.page ?? 1, page_size: options.pageSize ?? 20 } : [];
      }
    },
    placeholderData: keepPreviousData,
  });

  const players = Array.isArray(data) ? data : (data?.players ?? []);
  const total = Array.isArray(data) ? data.length : (data?.total ?? 0);

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
      await queryClient.invalidateQueries({ queryKey: ['player', playerId] });
      await queryClient.invalidateQueries({ queryKey: ['game-goals'] });
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

  return { players, total, loading, fetching, busy, addPlayer, bulkAddPlayers, updatePlayer, deletePlayer };
};

export default useLeaguePlayers;
