import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import { type PlayerRecord } from './useLeaguePlayers';

const API = import.meta.env.VITE_API_URL || '/api';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

// ── Career stat row returned by GET /players/:id/stats ─────────────────────
export interface PlayerCareerStatRecord {
  season_id: string;
  season_name: string;
  jersey_number: number | null;
  gp: number;
  goals: number;
  assists: number;
  points: number;
  team_id: string | null;
  team_name: string | null;
  team_logo: string | null;
  primary_color: string | null;
  text_color: string | null;
}

export interface PlayerAwardRecord {
  id: string;
  award_id: string;
  season_award_id: string;
  award_name: string;
  season_id: string;
  season_name: string;
  awarded_at: string | null;
  team_id: string | null;
  team_name: string | null;
  team_code: string | null;
  team_logo: string | null;
  team_primary_color: string | null;
  team_text_color: string | null;
}

// ── Single player fetch ─────────────────────────────────────────────────────
export const usePlayer = (playerId: string | null | undefined) => {
  const { data: player = null, isLoading: loading } = useQuery<PlayerRecord | null>({
    queryKey: ['player', playerId],
    queryFn: async () => {
      try {
        const { data } = await axios.get<PlayerRecord>(
          `${API}/admin/players/${playerId}`,
          { headers: authHeaders() },
        );
        return data;
      } catch {
        toast.error('Failed to load player');
        return null;
      }
    },
    enabled: !!playerId,
  });
  return { player, loading };
};

// ── Career stats fetch ──────────────────────────────────────────────────────
export const usePlayerCareerStats = (playerId: string | null | undefined) => {
  const { data: stats = [], isLoading: loading } = useQuery<PlayerCareerStatRecord[]>({
    queryKey: ['player-career-stats', playerId],
    queryFn: async () => {
      try {
        const { data } = await axios.get<PlayerCareerStatRecord[]>(
          `${API}/admin/players/${playerId}/stats`,
          { headers: authHeaders() },
        );
        return data;
      } catch {
        toast.error('Failed to load player stats');
        return [];
      }
    },
    enabled: !!playerId,
  });
  return { stats, loading };
};

export const usePlayerAwards = (playerId: string | null | undefined) => {
  const { data: awards = [], isLoading: loading } = useQuery<PlayerAwardRecord[]>({
    queryKey: ['player-awards', playerId],
    queryFn: async () => {
      try {
        const { data } = await axios.get<PlayerAwardRecord[]>(
          `${API}/admin/players/${playerId}/awards`,
          { headers: authHeaders() },
        );
        return data;
      } catch {
        toast.error('Failed to load player awards');
        return [];
      }
    },
    enabled: !!playerId,
  });
  return { awards, loading };
};

// ── Latest played season stats returned by GET /players/:id/latest-season-stats ─
export interface PlayerCurrentSeasonStatBlock {
  gp: number;
  goals: number;
  assists: number;
  points: number;
  wins: number;
  shootout_wins: number;
  goals_against: number;
  shots_against: number;
  save_pct: number | null;
}

export interface PlayerCurrentSeasonStats {
  season_id: string;
  season_name: string;
  regular: PlayerCurrentSeasonStatBlock | null;
  playoffs: PlayerCurrentSeasonStatBlock | null;
}

export interface PlayerLastFiveGameRecord {
  game_id: string;
  season_id: string;
  season_name?: string;
  scheduled_at: string | null;
  game_type: string;
  team_id: string | null;
  team_name: string | null;
  team_code: string | null;
  team_logo: string | null;
  team_primary_color: string | null;
  team_text_color: string | null;
  opponent_team_id: string | null;
  opponent_name: string | null;
  opponent_code: string | null;
  opponent_logo: string | null;
  opponent_primary_color: string | null;
  opponent_text_color: string | null;
  is_home: boolean;
  goals: number;
  assists: number;
  points: number;
  goalie_started: boolean | null;
  shots_against: number | null;
  goals_against: number | null;
  save_pct: number | null;
}

export interface PlayerGameLogsResponse {
  games: PlayerLastFiveGameRecord[];
  total: number;
}

export interface PlayerRouteLookup {
  player_id: string;
  team_id: string | null;
  league_id: string;
  league_code: string;
  team_code: string | null;
  player_slug: string;
}

export const usePlayerRouteLookup = (
  leagueCode: string | null | undefined,
  teamCode: string | null | undefined,
  playerSlug: string | null | undefined,
  enabled = true,
) => {
  const { data: routeLookup = null, isLoading: loading } = useQuery<PlayerRouteLookup | null>({
    queryKey: ['player-route-lookup', leagueCode, teamCode, playerSlug],
    queryFn: async () => {
      try {
        const { data } = await axios.get<PlayerRouteLookup>(
          `${API}/admin/players/route-lookup`,
          {
            headers: authHeaders(),
            params: {
              league_code: leagueCode,
              team_code: teamCode || undefined,
              player_slug: playerSlug,
            },
          },
        );
        return data;
      } catch {
        toast.error('Failed to find player route');
        return null;
      }
    },
    enabled: enabled && !!leagueCode && !!playerSlug,
  });
  return { routeLookup, loading };
};

export const usePlayerCurrentSeasonStats = (playerId: string | null | undefined) => {
  const { data: currentSeasonStats = null, isLoading: loading } =
    useQuery<PlayerCurrentSeasonStats | null>({
      queryKey: ['player-latest-season-stats', playerId],
      queryFn: async () => {
        try {
          const { data } = await axios.get<PlayerCurrentSeasonStats | null>(
            `${API}/admin/players/${playerId}/latest-season-stats`,
            { headers: authHeaders() },
          );
          return data;
        } catch {
          toast.error('Failed to load latest season stats');
          return null;
        }
      },
      enabled: !!playerId,
    });
  return { currentSeasonStats, loading };
};

// ── Combined hook ───────────────────────────────────────────────────────────
export const usePlayerLastFiveGames = (playerId: string | null | undefined) => {
  const { data: lastFiveGames = [], isLoading: loading } = useQuery<PlayerLastFiveGameRecord[]>({
    queryKey: ['player-last-five-games', playerId],
    queryFn: async () => {
      try {
        const { data } = await axios.get<PlayerLastFiveGameRecord[]>(
          `${API}/admin/players/${playerId}/last-five-games`,
          { headers: authHeaders() },
        );
        return data;
      } catch {
        toast.error('Failed to load recent games');
        return [];
      }
    },
    enabled: !!playerId,
  });
  return { lastFiveGames, loading };
};

export const usePlayerGameLogs = (
  playerId: string | null | undefined,
  params: {
    seasonId?: string | null;
    gameType?: string | null;
    page?: number;
    pageSize?: number;
  },
) => {
  const { seasonId = null, gameType = null, page = 1, pageSize = 20 } = params;
  const { data, isLoading: loading } = useQuery<PlayerGameLogsResponse>({
    queryKey: ['player-game-logs', playerId, seasonId, gameType, page, pageSize],
    queryFn: async () => {
      try {
        const { data } = await axios.get<PlayerGameLogsResponse>(
          `${API}/admin/players/${playerId}/game-logs`,
          {
            headers: authHeaders(),
            params: {
              season_id: seasonId || undefined,
              game_type: gameType || undefined,
              limit: pageSize,
              offset: (page - 1) * pageSize,
            },
          },
        );
        return data;
      } catch {
        toast.error('Failed to load game logs');
        return { games: [], total: 0 };
      }
    },
    enabled: !!playerId,
  });
  return { gameLogs: data?.games ?? [], total: data?.total ?? 0, loading };
};

const usePlayerDetails = (playerId: string | null | undefined) => {
  const { player, loading: playerLoading } = usePlayer(playerId);
  const { stats, loading: statsLoading } = usePlayerCareerStats(playerId);

  return {
    player,
    stats,
    loading: playerLoading || statsLoading,
  };
};

export default usePlayerDetails;
