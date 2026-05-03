import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { useState } from 'react';
import { toast } from 'react-toastify';
import { type PlayerRecord, type CreatePlayerData, type BulkPlayerInput } from './useLeaguePlayers';

/** A single player_teams stint row returned by the history endpoint. */
export interface PlayerStintRecord {
  id: string;
  player_id: string;
  team_id: string;
  season_id: string;
  jersey_number: number | null;
  photo: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  team_name: string | null;
  team_code: string | null;
  team_logo: string | null;
  primary_color: string | null;
  text_color: string | null;
}

export interface UpdateStintData {
  team_id?: string;
  season_id?: string;
  jersey_number?: number | null;
  photo?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface CreateStintData {
  team_id: string;
  season_id: string;
  jersey_number?: number | null;
  photo?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

/** One row from jersey_number_history for a player's stint. */
export interface JerseyHistoryEntry {
  id: string;
  player_teams_id: string;
  jersey_number: number;
  /** YYYY-MM-DD */
  effective_from: string;
}

/**
 * Fetches all jersey number history entries across every stint for a player.
 * Returns `byStint`: a map of player_teams_id → sorted entries (oldest first).
 */
export const useJerseyHistory = (playerId: string | null) => {
  const { data = [] } = useQuery<JerseyHistoryEntry[]>({
    queryKey: ['jersey-history', playerId],
    queryFn: async () => {
      const { data } = await axios.get<JerseyHistoryEntry[]>(
        `${API}/admin/player-teams/history/${playerId}/jerseys`,
        { headers: authHeaders() },
      );
      return data;
    },
    enabled: !!playerId,
  });

  const byStint = useMemo(() => {
    const map: Record<string, JerseyHistoryEntry[]> = {};
    for (const entry of data) {
      if (!map[entry.player_teams_id]) map[entry.player_teams_id] = [];
      map[entry.player_teams_id].push(entry);
    }
    return map;
  }, [data]);

  return { byStint };
};

/** Fetch all stints for a player, optionally scoped to a season. */
export const usePlayerTradeHistory = (playerId: string | null, seasonId?: string | null) => {
  const { data: stints = [], isLoading: loading } = useQuery<PlayerStintRecord[]>({
    queryKey: ['player-trade-history', playerId, seasonId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (seasonId) params.season_id = seasonId;
      const { data } = await axios.get<PlayerStintRecord[]>(
        `${API}/admin/player-teams/history/${playerId}`,
        { headers: authHeaders(), params },
      );
      return data;
    },
    enabled: !!playerId,
  });
  return { stints, loading };
};

/** Actions for editing and uploading photos on individual player_teams stints. */
export const useStintActions = (playerId: string | null) => {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const updateStint = async (stintId: string, data: UpdateStintData): Promise<boolean> => {
    setSaving(true);
    try {
      await axios.patch(`${API}/admin/player-teams/${stintId}`, data, { headers: authHeaders() });
      toast.success('Stint updated!');
      await queryClient.invalidateQueries({ queryKey: ['player-trade-history', playerId] });
      await queryClient.invalidateQueries({ queryKey: ['players'] });
      await queryClient.invalidateQueries({ queryKey: ['game-roster'] });
      await queryClient.invalidateQueries({ queryKey: ['game-lineup'] });
      await queryClient.invalidateQueries({ queryKey: ['game-goalie-stats'] });
      await queryClient.invalidateQueries({ queryKey: ['shootout-attempts'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update stint'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const createStint = async (data: CreateStintData): Promise<boolean> => {
    setSaving(true);
    try {
      await axios.post(
        `${API}/admin/player-teams`,
        { player_id: playerId, ...data },
        { headers: authHeaders() },
      );
      toast.success('Stint recorded!');
      await queryClient.invalidateQueries({ queryKey: ['player-trade-history', playerId] });
      await queryClient.invalidateQueries({ queryKey: ['players'] });
      await queryClient.invalidateQueries({ queryKey: ['game-roster'] });
      await queryClient.invalidateQueries({ queryKey: ['game-lineup'] });
      await queryClient.invalidateQueries({ queryKey: ['game-goalie-stats'] });
      await queryClient.invalidateQueries({ queryKey: ['shootout-attempts'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to record stint'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const uploadStintPhoto = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append('photo', file);
    try {
      const { data } = await axios.post<{ url: string }>(
        `${API}/admin/players/upload`,
        formData,
        { headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' } },
      );
      return data.url;
    } catch (err) {
      toast.error(apiError(err, 'Failed to upload photo'));
      return null;
    }
  };

  const changeJerseyNumber = async (
    stint: PlayerStintRecord,
    jerseyNumber: number,
    effectiveDate?: string | null,
  ): Promise<boolean> => {
    setSaving(true);
    try {
      await axios.patch(
        `${API}/admin/player-teams`,
        {
          player_id: stint.player_id,
          team_id: stint.team_id,
          season_id: stint.season_id,
          jersey_number: jerseyNumber,
          ...(effectiveDate ? { effective_date: effectiveDate } : {}),
        },
        { headers: authHeaders() },
      );
      toast.success('Jersey number updated!');
      await queryClient.invalidateQueries({ queryKey: ['player-trade-history', playerId] });
      await queryClient.invalidateQueries({ queryKey: ['jersey-history', playerId] });
      await queryClient.invalidateQueries({ queryKey: ['players'] });
      await queryClient.invalidateQueries({ queryKey: ['game-roster'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update jersey number'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { createStint, updateStint, changeJerseyNumber, uploadStintPhoto, saving };
};

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

  /** Upload a player photo file to Vercel Blob and return the public URL, or null on failure. */
  const uploadPlayerPhoto = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append('photo', file);
    try {
      const { data } = await axios.post<{ url: string }>(
        `${API}/admin/players/upload`,
        formData,
        { headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' } },
      );
      return data.url;
    } catch (err) {
      toast.error(apiError(err, 'Failed to upload player photo'));
      return null;
    }
  };

  /**
   * Update jersey_number and/or photo on the active player_teams stint.
   * Only the fields included in `payload` are changed.
   */
  const updatePlayerTeam = async (
    playerId: string,
    tId: string,
    sId: string,
    payload: { jersey_number?: number | null; photo?: string | null },
  ): Promise<boolean> => {
    setBusy(playerId);
    try {
      await axios.patch(
        `${API}/admin/player-teams`,
        { player_id: playerId, team_id: tId, season_id: sId, ...payload },
        { headers: authHeaders() },
      );
      await queryClient.invalidateQueries({ queryKey: ['players'] });
      await queryClient.invalidateQueries({ queryKey: ['player-trade-history', playerId] });
      await queryClient.invalidateQueries({ queryKey: ['game-roster'] });
      await queryClient.invalidateQueries({ queryKey: ['game-lineup'] });
      await queryClient.invalidateQueries({ queryKey: ['game-goalie-stats'] });
      await queryClient.invalidateQueries({ queryKey: ['shootout-attempts'] });
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
    players: Array<Omit<BulkPlayerInput, 'shoots'> & { shoots?: BulkPlayerInput['shoots']; jersey_number?: number | null }>,
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

  /**
   * Bulk-trade players to a new team within the same season.
   * Closes each player's current active stint and opens a new one on toTeamId.
   * Each entry may carry an optional jerseyNumber for the new stint.
   */
  const bulkTradePlayers = async (
    playerRows: { playerId: string; jerseyNumber: number | null }[],
    sId: string,
    toTeamId: string,
    tradeDate: string,
  ): Promise<boolean> => {
    try {
      const { data } = await axios.post(
        `${API}/admin/player-teams/bulk-trade`,
        {
          players: playerRows.map((r) => ({ player_id: r.playerId, jersey_number: r.jerseyNumber })),
          season_id: sId,
          to_team_id: toTeamId,
          trade_date: tradeDate,
        },
        { headers: authHeaders() },
      );
      const count: number = data.traded?.length ?? 0;
      const failed: number = data.failed?.length ?? 0;
      toast.success(
        failed > 0
          ? `${count} player${count !== 1 ? 's' : ''} traded (${failed} had no active stint)`
          : `${count} player${count !== 1 ? 's' : ''} traded successfully!`,
      );
      await queryClient.invalidateQueries({ queryKey: ['players'] });
      await queryClient.invalidateQueries({ queryKey: ['player-trade-history'] });
      return count > 0;
    } catch (err) {
      toast.error(apiError(err, 'Failed to trade players'));
      return false;
    }
  };

  return { players, loading, busy, addPlayersToRoster, createAndRosterPlayers, updatePlayer, updateJerseyNumber, updatePlayerTeam, uploadPlayerPhoto, deletePlayer, bulkTradePlayers };
};

export default useTeamPlayers;
