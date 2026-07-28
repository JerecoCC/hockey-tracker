/* eslint-disable @typescript-eslint/no-unused-vars */
import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { toast } from 'react-toastify';
import { type PlayerRecord, type CreatePlayerData, type BulkPlayerInput } from './useLeaguePlayers';

/** A single player_teams stint row returned by the history endpoint. */
export interface PlayerStintRecord {
  id: string;
  player_id: string;
  team_id: string;
  season_id: string | null;
  roster_player_team_id?: string | null;
  jersey_number: number | null;
  is_prospect: boolean;
  photo: string | null;
  position: string | null;
  acquisition_type: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  has_stats?: boolean;
  can_delete?: boolean;
  team: {
    id: string;
    name: string | null;
    code: string | null;
    logo: string | null;
    logo_dark?: string | null;
    logo_light?: string | null;
    primary_color: string | null;
    text_color: string | null;
  };
}

export interface UpdateStintData {
  team_id?: string;
  season_id?: string;
  jersey_number?: number | null;
  is_prospect?: boolean;
  photo?: string | null;
  position?: string | null;
  acquisition_type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface CreateStintData {
  team_id: string;
  season_id: string;
  jersey_number?: number | null;
  is_prospect?: boolean;
  photo?: string | null;
  position?: string | null;
  acquisition_type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface ReconcilePlayerStintInput {
  import_key: string;
  team_id: string;
  position?: string | null;
  acquisition_type?: string | null;
  start_date: string;
  end_date?: string | null;
}

export type ReconcilePlayerStintAction = 'create' | 'update' | 'adopt' | 'unchanged' | 'conflict';

export interface ReconcilePlayerStintsResult {
  actions: Array<{
    import_key: string;
    action: ReconcilePlayerStintAction;
    stint_id?: string | null;
    changes?: string[];
    conflicts?: string[];
    conflict_type?: string | null;
    applied?: boolean;
  }>;
  summary: {
    total: number;
    create: number;
    update: number;
    adopt: number;
    unchanged: number;
    conflict: number;
  };
}

export interface UpdateJerseyHistoryEntryData {
  jersey_number: number;
  effective_from: string;
}

/** One row from jersey_number_history for a player's stint. */
export interface JerseyHistoryEntry {
  id: string;
  player_teams_id: string;
  jersey_number: number;
  /** YYYY-MM-DD */
  effective_from: string;
}

export interface PlayerPhotoEntry {
  id: string | null;
  player_id: string;
  team_id: string;
  season_id: string;
  photo: string | null;
  created_at: string | null;
  season_name: string | null;
  team_name: string | null;
  has_saved_photo?: boolean;
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

export const usePlayerPhotoHistory = (playerId: string | null) => {
  const { data: photos = [] } = useQuery<PlayerPhotoEntry[]>({
    queryKey: ['player-photo-history', playerId],
    queryFn: async () => {
      const { data } = await axios.get<PlayerPhotoEntry[]>(
        `${API}/admin/player-teams/history/${playerId}/photos`,
        { headers: authHeaders() },
      );
      return data;
    },
    enabled: !!playerId,
  });

  const byTeam = useMemo(() => {
    const map: Record<string, PlayerPhotoEntry[]> = {};
    for (const entry of photos) {
      if (!map[entry.team_id]) map[entry.team_id] = [];
      map[entry.team_id].push(entry);
    }
    return map;
  }, [photos]);

  return { photos, byTeam };
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
    staleTime: PLAYER_HISTORY_STALE_MS,
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
      await queryClient.invalidateQueries({ queryKey: ['player-photo-history', playerId] });
      await queryClient.invalidateQueries({ queryKey: ['players'] });
      await queryClient.invalidateQueries({ queryKey: ['game-roster'] });
      await queryClient.invalidateQueries({ queryKey: ['game-lineup'] });
      await queryClient.invalidateQueries({ queryKey: ['game-goalie-stats'] });
      await queryClient.invalidateQueries({ queryKey: ['game-goals'] });
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
      await queryClient.invalidateQueries({ queryKey: ['game-goals'] });
      await queryClient.invalidateQueries({ queryKey: ['shootout-attempts'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to record stint'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const reconcilePlayerStints = async (
    stints: ReconcilePlayerStintInput[],
    options: { dryRun?: boolean; source?: string } = {},
  ): Promise<ReconcilePlayerStintsResult | null> => {
    if (!playerId || stints.length === 0) return null;

    setSaving(true);
    try {
      const { data } = await axios.post<ReconcilePlayerStintsResult>(
        `${API}/admin/player-teams/history/${playerId}/reconcile`,
        {
          source: options.source ?? 'nhl_puckpedia',
          dry_run: options.dryRun ?? false,
          stints,
        },
        { headers: authHeaders() },
      );

      if (!options.dryRun) {
        await queryClient.invalidateQueries({ queryKey: ['player-trade-history', playerId] });
        await queryClient.invalidateQueries({ queryKey: ['player', playerId] });
        await queryClient.invalidateQueries({ queryKey: ['players'] });
      }
      return data;
    } catch (err) {
      toast.error(apiError(err, 'Failed to apply player team stints'));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const deleteStint = async (stintId: string): Promise<boolean> => {
    setSaving(true);
    try {
      await axios.delete(`${API}/admin/player-teams/${stintId}`, { headers: authHeaders() });
      toast.success('Stint deleted!');
      await queryClient.invalidateQueries({ queryKey: ['player-trade-history', playerId] });
      await queryClient.invalidateQueries({ queryKey: ['player', playerId] });
      await queryClient.invalidateQueries({ queryKey: ['players'] });
      await queryClient.invalidateQueries({ queryKey: ['game-roster'] });
      await queryClient.invalidateQueries({ queryKey: ['game-lineup'] });
      await queryClient.invalidateQueries({ queryKey: ['game-goalie-stats'] });
      await queryClient.invalidateQueries({ queryKey: ['game-goals'] });
      await queryClient.invalidateQueries({ queryKey: ['shootout-attempts'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete stint'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const uploadStintPhoto = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append('photo', file);
    try {
      const { data } = await axios.post<{ url: string }>(`${API}/admin/players/upload`, formData, {
        headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' },
      });
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
    if (!stint.season_id) {
      toast.error('Add this player to a season roster before changing jersey number');
      return false;
    }
    if (!effectiveDate) {
      toast.error('Effective date is required to change a jersey number');
      return false;
    }

    setSaving(true);
    try {
      await axios.patch(
        `${API}/admin/player-teams`,
        {
          player_id: stint.player_id,
          team_id: stint.team_id,
          season_id: stint.season_id,
          jersey_number: jerseyNumber,
          effective_date: effectiveDate,
        },
        { headers: authHeaders() },
      );
      toast.success('Jersey number updated!');
      await queryClient.invalidateQueries({ queryKey: ['player-trade-history', playerId] });
      await queryClient.invalidateQueries({ queryKey: ['jersey-history', playerId] });
      await queryClient.invalidateQueries({ queryKey: ['players'] });
      await queryClient.invalidateQueries({ queryKey: ['game-roster'] });
      await queryClient.invalidateQueries({ queryKey: ['game-goals'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update jersey number'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateJerseyHistoryEntry = async (
    entryId: string,
    data: UpdateJerseyHistoryEntryData,
  ): Promise<boolean> => {
    setSaving(true);
    try {
      await axios.patch(`${API}/admin/player-teams/history/jerseys/${entryId}`, data, {
        headers: authHeaders(),
      });
      toast.success('Jersey history updated!');
      await queryClient.invalidateQueries({ queryKey: ['player-trade-history', playerId] });
      await queryClient.invalidateQueries({ queryKey: ['jersey-history', playerId] });
      await queryClient.invalidateQueries({ queryKey: ['players'] });
      await queryClient.invalidateQueries({ queryKey: ['game-roster'] });
      await queryClient.invalidateQueries({ queryKey: ['game-lineup'] });
      await queryClient.invalidateQueries({ queryKey: ['game-goalie-stats'] });
      await queryClient.invalidateQueries({ queryKey: ['game-goals'] });
      await queryClient.invalidateQueries({ queryKey: ['shootout-attempts'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update jersey history'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteJerseyHistoryEntry = async (entryId: string): Promise<boolean> => {
    setSaving(true);
    try {
      await axios.delete(`${API}/admin/player-teams/history/jerseys/${entryId}`, {
        headers: authHeaders(),
      });
      toast.success('Jersey history deleted!');
      await queryClient.invalidateQueries({ queryKey: ['player-trade-history', playerId] });
      await queryClient.invalidateQueries({ queryKey: ['jersey-history', playerId] });
      await queryClient.invalidateQueries({ queryKey: ['players'] });
      await queryClient.invalidateQueries({ queryKey: ['game-roster'] });
      await queryClient.invalidateQueries({ queryKey: ['game-lineup'] });
      await queryClient.invalidateQueries({ queryKey: ['game-goalie-stats'] });
      await queryClient.invalidateQueries({ queryKey: ['game-goals'] });
      await queryClient.invalidateQueries({ queryKey: ['shootout-attempts'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete jersey history'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const changePlayerPhoto = async (
    stint: PlayerStintRecord,
    seasonId: string,
    photo: string,
  ): Promise<boolean> => {
    setSaving(true);
    try {
      await axios.post(
        `${API}/admin/player-teams/history/${playerId}/photos`,
        {
          team_id: stint.team_id,
          season_id: seasonId,
          photo,
        },
        { headers: authHeaders() },
      );
      toast.success('Season photo updated!');
      await queryClient.invalidateQueries({ queryKey: ['player-photo-history', playerId] });
      await queryClient.invalidateQueries({ queryKey: ['player-trade-history', playerId] });
      await queryClient.invalidateQueries({ queryKey: ['players'] });
      await queryClient.invalidateQueries({ queryKey: ['game-roster'] });
      await queryClient.invalidateQueries({ queryKey: ['game-lineup'] });
      await queryClient.invalidateQueries({ queryKey: ['game-goalie-stats'] });
      await queryClient.invalidateQueries({ queryKey: ['game-goals'] });
      await queryClient.invalidateQueries({ queryKey: ['shootout-attempts'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update season photo'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deletePlayerPhoto = async (photoId: string): Promise<boolean> => {
    setSaving(true);
    try {
      await axios.delete(`${API}/admin/player-teams/history/photos/${photoId}`, {
        headers: authHeaders(),
      });
      toast.success('Season photo deleted!');
      await queryClient.invalidateQueries({ queryKey: ['player-photo-history', playerId] });
      await queryClient.invalidateQueries({ queryKey: ['player-trade-history', playerId] });
      await queryClient.invalidateQueries({ queryKey: ['players'] });
      await queryClient.invalidateQueries({ queryKey: ['game-roster'] });
      await queryClient.invalidateQueries({ queryKey: ['game-lineup'] });
      await queryClient.invalidateQueries({ queryKey: ['game-goalie-stats'] });
      await queryClient.invalidateQueries({ queryKey: ['game-goals'] });
      await queryClient.invalidateQueries({ queryKey: ['shootout-attempts'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete season photo'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    createStint,
    reconcilePlayerStints,
    updateStint,
    deleteStint,
    changeJerseyNumber,
    updateJerseyHistoryEntry,
    deleteJerseyHistoryEntry,
    changePlayerPhoto,
    deletePlayerPhoto,
    uploadStintPhoto,
    saving,
  };
};

export interface PlayerRosterInput {
  player_id: string;
  jersey_number?: number | null;
  is_prospect?: boolean;
}

/** Extends PlayerRecord with team-assignment fields returned when fetching by team_id. */
export interface TeamPlayerRecord extends PlayerRecord {
  player_team_id: string | null;
  jersey_number: number | null;
  team_id: string | null;
  team_name: string | null;
  primary_color: string | null;
  text_color: string | null;
  is_prospect: boolean;
}

import { API, authHeaders, getApiErrorMessage as apiError } from '@/lib/apiClient';
const PLAYER_HISTORY_STALE_MS = 30_000;



interface UseTeamPlayersOptions {
  includeProspects?: boolean;
  prospectsOnly?: boolean;
  mode?: 'admin' | 'user';
}

type PlayersCacheData =
  | PlayerRecord[]
  | {
      players?: PlayerRecord[];
      [key: string]: unknown;
    };

const isPlayersQuery = (queryKey: readonly unknown[]) => queryKey[0] === 'players';

const mapPlayersCache = (
  data: PlayersCacheData | undefined,
  queryKey: readonly unknown[],
  mapPlayer: (player: PlayerRecord, queryKey: readonly unknown[]) => PlayerRecord | null,
) => {
  if (Array.isArray(data)) {
    let changed = false;
    const nextPlayers = data.flatMap((player) => {
      const next = mapPlayer(player, queryKey);
      if (next !== player) changed = true;
      return next ? [next] : [];
    });
    return changed ? nextPlayers : data;
  }

  if (data && Array.isArray(data.players)) {
    let changed = false;
    const nextPlayers = data.players.flatMap((player) => {
      const next = mapPlayer(player, queryKey);
      if (next !== player) changed = true;
      return next ? [next] : [];
    });
    return changed ? { ...data, players: nextPlayers } : data;
  }

  return data;
};

const updatePlayerCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  mapPlayer: (player: PlayerRecord, queryKey: readonly unknown[]) => PlayerRecord | null,
) => {
  const playerQueries = queryClient
    .getQueryCache()
    .findAll({ predicate: (query) => isPlayersQuery(query.queryKey) });

  for (const query of playerQueries) {
    queryClient.setQueryData<PlayersCacheData>(query.queryKey, (data) =>
      mapPlayersCache(data, query.queryKey, mapPlayer),
    );
  }
};

const isSameRosterRecord = (cachedPlayer: PlayerRecord, targetPlayer: TeamPlayerRecord) => {
  const cachedRoster = cachedPlayer as Partial<TeamPlayerRecord>;
  if (targetPlayer.player_team_id) {
    return cachedRoster.player_team_id === targetPlayer.player_team_id;
  }
  return cachedPlayer.id === targetPlayer.id && cachedRoster.team_id === targetPlayer.team_id;
};

const rosterCacheOptions = (queryKey: readonly unknown[]) =>
  typeof queryKey[1] === 'object' && queryKey[1] !== null
    ? (queryKey[1] as UseTeamPlayersOptions & { team_id?: string; season_id?: string })
    : null;

const useTeamPlayers = (
  teamId: string | undefined,
  seasonId?: string,
  options: UseTeamPlayersOptions = {},
) => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const { mode = 'admin', ...playerFilters } = options;
  const basePath = mode === 'user' ? 'user' : 'admin';

  const { data: players = [], isLoading: loading } = useQuery<TeamPlayerRecord[]>({
    queryKey: [
      mode === 'user' ? 'user-team-players' : 'players',
      { team_id: teamId, season_id: seasonId, ...playerFilters },
    ],
    queryFn: async () => {
      try {
        const params: Record<string, string> = {};
        if (teamId) params.team_id = teamId;
        if (seasonId) params.season_id = seasonId;
        if (playerFilters.includeProspects) params.include_prospects = 'true';
        if (playerFilters.prospectsOnly) params.prospects_only = 'true';
        const { data } = await axios.get<TeamPlayerRecord[]>(`${API}/${basePath}/players`, {
          headers: authHeaders(),
          params,
        });
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
      updatePlayerCaches(queryClient, (player) =>
        player.id === playerId ? { ...player, ...payload } : player,
      );
      await queryClient.invalidateQueries({ queryKey: ['game-roster'] });
      await queryClient.invalidateQueries({ queryKey: ['game-goals'] });
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
      updatePlayerCaches(queryClient, (player) =>
        player.id === playerId && player.team_id === teamId
          ? { ...player, jersey_number: jerseyNumber }
          : player,
      );
      await queryClient.invalidateQueries({ queryKey: ['game-goals'] });
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
      const { data } = await axios.post<{ url: string }>(`${API}/admin/players/upload`, formData, {
        headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' },
      });
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
    payload: {
      jersey_number?: number | null;
      effective_date?: string;
      photo?: string | null;
    },
  ): Promise<boolean> => {
    setBusy(playerId);
    try {
      await axios.patch(
        `${API}/admin/player-teams`,
        { player_id: playerId, team_id: tId, season_id: sId, ...payload },
        { headers: authHeaders() },
      );
      updatePlayerCaches(queryClient, (player) =>
        player.id === playerId && player.team_id === tId ? { ...player, ...payload } : player,
      );
      await queryClient.invalidateQueries({ queryKey: ['player-trade-history', playerId] });
      await queryClient.invalidateQueries({ queryKey: ['game-roster'] });
      await queryClient.invalidateQueries({ queryKey: ['game-lineup'] });
      await queryClient.invalidateQueries({ queryKey: ['game-goalie-stats'] });
      await queryClient.invalidateQueries({ queryKey: ['game-goals'] });
      await queryClient.invalidateQueries({ queryKey: ['shootout-attempts'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update player'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const updatePlayerRosterRole = async (
    player: TeamPlayerRecord,
    isProspect: boolean,
  ): Promise<boolean> => {
    if (!player.player_team_id && (!player.team_id || !seasonId)) return false;
    setBusy(player.id);
    try {
      if (player.player_team_id) {
        await axios.patch(
          `${API}/admin/player-teams/${player.player_team_id}`,
          { is_prospect: isProspect },
          { headers: authHeaders() },
        );
      } else {
        await axios.patch(
          `${API}/admin/player-teams`,
          {
            player_id: player.id,
            team_id: player.team_id,
            season_id: seasonId,
            is_prospect: isProspect,
          },
          { headers: authHeaders() },
        );
      }
      toast.success(isProspect ? 'Player moved to reserves' : 'Player moved to roster');
      updatePlayerCaches(queryClient, (cachedPlayer, queryKey) => {
        if (!isSameRosterRecord(cachedPlayer, player)) {
          return cachedPlayer;
        }
        const cacheOptions = rosterCacheOptions(queryKey);
        if (cacheOptions?.prospectsOnly && !isProspect) return null;
        if (!cacheOptions?.includeProspects && !cacheOptions?.prospectsOnly && isProspect) {
          return null;
        }
        return { ...cachedPlayer, is_prospect: isProspect };
      });
      // Cached destination lists may not contain the player yet, so mapping
      // existing rows cannot add them. Mark every player list stale so the
      // destination roster/reserve view refetches when the user switches tabs.
      await queryClient.invalidateQueries({ queryKey: ['players'] });
      await queryClient.invalidateQueries({ queryKey: ['game-roster'] });
      await queryClient.invalidateQueries({ queryKey: ['game-lineup'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update roster status'));
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

  const removePlayerFromTeam = async (player: TeamPlayerRecord): Promise<boolean> => {
    if (!player.player_team_id) {
      toast.error('Player team record not found');
      return false;
    }
    setBusy(player.id);
    try {
      await axios.delete(`${API}/admin/player-teams/${player.player_team_id}`, {
        headers: authHeaders(),
      });
      toast.success('Player removed from team');
      updatePlayerCaches(queryClient, (cachedPlayer) =>
        isSameRosterRecord(cachedPlayer, player) ? null : cachedPlayer,
      );
      await queryClient.invalidateQueries({ queryKey: ['player-trade-history', player.id] });
      await queryClient.invalidateQueries({ queryKey: ['game-roster'] });
      await queryClient.invalidateQueries({ queryKey: ['game-lineup'] });
      await queryClient.invalidateQueries({ queryKey: ['game-goalie-stats'] });
      await queryClient.invalidateQueries({ queryKey: ['game-goals'] });
      await queryClient.invalidateQueries({ queryKey: ['shootout-attempts'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to remove player from team'));
      return false;
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
      await queryClient.invalidateQueries({ queryKey: ['players'] });
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
    players: Array<
      Omit<BulkPlayerInput, 'shoots'> & {
        shoots?: BulkPlayerInput['shoots'];
        jersey_number?: number | null;
      }
    >,
  ): Promise<string[] | null> => {
    // Step 1: bulk-create the new players.
    // If this fails, nothing was written — return null so the modal stays open.
    let created: Array<{ id: string }>;
    try {
      const { data: createData } = await axios.post(
        `${API}/admin/players/bulk`,
        { players: players.map(({ jersey_number: _jn, ...p }) => p) },
        { headers: authHeaders() },
      );
      created = createData.created ?? [];
    } catch (err) {
      toast.error(apiError(err, 'Failed to create players'));
      return null;
    }

    // Step 2: add the newly created players to the season roster.
    // If this fails the players already exist in the DB, so we still return
    // their IDs — the modal will close and won't offer a retry that would
    // create duplicates. A separate toast warns about the rostering failure.
    if (created.length > 0) {
      try {
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
      } catch (err) {
        toast.error(apiError(err, 'Players created but could not be added to the season roster'));
      }
    }

    const n = created.length;
    toast.success(`${n} player${n !== 1 ? 's' : ''} created and added to roster!`);
    await queryClient.invalidateQueries({ queryKey: ['players'] });
    return created.map((p) => p.id);
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
    acquisitionType = 'trade',
  ): Promise<boolean> => {
    try {
      const { data } = await axios.post(
        `${API}/admin/player-teams/bulk-trade`,
        {
          players: playerRows.map((r) => ({
            player_id: r.playerId,
            jersey_number: r.jerseyNumber,
          })),
          season_id: sId,
          to_team_id: toTeamId,
          trade_date: tradeDate,
          acquisition_type: acquisitionType,
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

  return {
    players,
    loading,
    busy,
    addPlayersToRoster,
    createAndRosterPlayers,
    updatePlayer,
    updateJerseyNumber,
    updatePlayerTeam,
    updatePlayerRosterRole,
    removePlayerFromTeam,
    uploadPlayerPhoto,
    deletePlayer,
    bulkTradePlayers,
  };
};

export default useTeamPlayers;
