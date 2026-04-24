import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { useState } from 'react';
import { toast } from 'react-toastify';
import { type PlayerRecord, type CreatePlayerData, type BulkPlayerInput } from './useLeaguePlayers';

export interface PlayerRosterInput {
  player_id: string;
  jersey_number?: number | null;
}

/** Extends PlayerRecord with team-assignment fields returned when fetching by team_id. */
export interface TeamPlayerRecord extends PlayerRecord {
  jersey_number: number | null;
  team_name: string | null;
  primary_color: string | null;
  text_color: string | null;
}

const API = import.meta.env.VITE_API_URL || '/api';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

const apiError = (err: unknown, fallback: string): string =>
  (err as AxiosError<{ error: string }>).response?.data?.error ?? fallback;

const useTeamPlayers = (teamId: string | undefined, seasonId?: string) => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: players = [], isLoading: loading } = useQuery<TeamPlayerRecord[]>({
    queryKey: ['players', { team_id: teamId, season_id: seasonId }],
    queryFn: async () => {
      try {
        const params: Record<string, string> = {};
        if (teamId) params.team_id = teamId;
        if (seasonId) params.season_id = seasonId;
        const { data } = await axios.get<TeamPlayerRecord[]>(
          `${API}/admin/players`,
          { headers: authHeaders(), params },
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

  const updateJerseyNumber = async (
    playerId: string,
    teamId: string,
    seasonId: string,
    jerseyNumber: number | null,
  ): Promise<boolean> => {
    setBusy(playerId);
    try {
      await axios.patch(
        `${API}/admin/player-teams`,
        { player_id: playerId, team_id: teamId, season_id: seasonId, jersey_number: jerseyNumber },
        { headers: authHeaders() },
      );
      toast.success('Jersey number updated!');
      await queryClient.invalidateQueries({ queryKey: ['players'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update jersey number'));
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

  const addPlayersToRoster = async (
    teamId: string,
    seasonId: string,
    players: PlayerRosterInput[],
  ): Promise<boolean> => {
    try {
      const { data } = await axios.post(
        `${API}/admin/player-teams/bulk`,
        { team_id: teamId, season_id: seasonId, players },
        { headers: authHeaders() },
      );
      const count: number = data.created?.length ?? 0;
      const skipped: number = data.skipped ?? 0;
      toast.success(
        skipped > 0
          ? `${count} player${count !== 1 ? 's' : ''} added (${skipped} already rostered)`
          : `${count} player${count !== 1 ? 's' : ''} added to roster!`,
      );
      await queryClient.invalidateQueries({ queryKey: ['players', { team_id: teamId }] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to add players to roster'));
      return false;
    }
  };

  /**
   * Bulk-creates players then adds them to the season roster.
   * Returns the array of created player IDs on success, or null on failure.
   * The caller can use the IDs to also add the players to a game roster.
   */
  const createAndRosterPlayers = async (
    tId: string,
    sId: string,
    players: Array<BulkPlayerInput & { jersey_number?: number | null }>,
  ): Promise<string[] | null> => {
    try {
      // Step 1: bulk-create the new players
      const { data: createData } = await axios.post(
        `${API}/admin/players/bulk`,
        { players: players.map(({ jersey_number: _jn, ...p }) => p) },
        { headers: authHeaders() },
      );
      const created: Array<{ id: string }> = createData.created ?? [];

      // Step 2: add them to the team roster for the season
      if (created.length > 0) {
        await axios.post(
          `${API}/admin/player-teams/bulk`,
          {
            team_id: tId,
            season_id: sId,
            players: created.map((p, i) => ({
              player_id: p.id,
              jersey_number: players[i]?.jersey_number ?? null,
            })),
          },
          { headers: authHeaders() },
        );
      }

      const n = created.length;
      toast.success(`${n} player${n !== 1 ? 's' : ''} created and added to roster!`);
      await queryClient.invalidateQueries({ queryKey: ['players'] });
      return created.map((p) => p.id);
    } catch (err) {
      toast.error(apiError(err, 'Failed to create players'));
      return null;
    }
  };

  return { players, loading, busy, addPlayersToRoster, createAndRosterPlayers, updatePlayer, updateJerseyNumber, deletePlayer };
};

export default useTeamPlayers;
