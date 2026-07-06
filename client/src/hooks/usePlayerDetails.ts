import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import type { AwardCompetitionScope } from '@/lib/awardDefinitions';
import { type PlayerRecord } from './useLeaguePlayers';

const API = import.meta.env.VITE_API_URL || '/api';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

type PlayerDetailsMode = 'admin' | 'user';

interface PlayerDetailsOptions {
  mode?: PlayerDetailsMode;
  seasonId?: string | null;
}

const getPlayerEndpoint = (mode: PlayerDetailsMode) =>
  `${API}/${mode === 'user' ? 'user' : 'admin'}/players`;

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
  team_logo_dark?: string | null;
  team_logo_light?: string | null;
  primary_color: string | null;
  text_color: string | null;
}

export interface PlayerAwardRecord {
  id: string;
  award_id: string;
  season_award_id: string;
  award_name: string;
  competition_scope: AwardCompetitionScope | null;
  stat_key: string | null;
  recipient_type: 'player' | 'team';
  season_id: string;
  season_name: string;
  awarded_at: string | null;
  player_photo?: string | null;
  team_id: string | null;
  team_name: string | null;
  team_place_name?: string | null;
  team_team_name?: string | null;
  team_code: string | null;
  team_logo: string | null;
  team_logo_dark?: string | null;
  team_logo_light?: string | null;
  team_primary_color: string | null;
  team_secondary_color: string | null;
  team_text_color: string | null;
}

// ── Single player fetch ─────────────────────────────────────────────────────
export const usePlayer = (
  playerId: string | null | undefined,
  options: PlayerDetailsOptions = {},
) => {
  const mode = options.mode ?? 'admin';
  const { data: player = null, isLoading: loading } = useQuery<PlayerRecord | null>({
    queryKey: [mode === 'user' ? 'user-player' : 'player', playerId],
    queryFn: async () => {
      try {
        const { data } = await axios.get<PlayerRecord>(`${getPlayerEndpoint(mode)}/${playerId}`, {
          headers: authHeaders(),
        });
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
export const usePlayerCareerStats = (
  playerId: string | null | undefined,
  options: PlayerDetailsOptions = {},
) => {
  const mode = options.mode ?? 'admin';
  const { data: stats = [], isLoading: loading } = useQuery<PlayerCareerStatRecord[]>({
    queryKey: [mode === 'user' ? 'user-player-career-stats' : 'player-career-stats', playerId],
    queryFn: async () => {
      try {
        const { data } = await axios.get<PlayerCareerStatRecord[]>(
          `${getPlayerEndpoint(mode)}/${playerId}/stats`,
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

export const usePlayerAwards = (
  playerId: string | null | undefined,
  options: PlayerDetailsOptions = {},
) => {
  const mode = options.mode ?? 'admin';
  const { data: awards = [], isLoading: loading } = useQuery<PlayerAwardRecord[]>({
    queryKey: [mode === 'user' ? 'user-player-awards' : 'player-awards', playerId],
    queryFn: async () => {
      try {
        const { data } = await axios.get<PlayerAwardRecord[]>(
          `${getPlayerEndpoint(mode)}/${playerId}/awards`,
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
  /** Total goalie time on ice this season, in seconds. */
  time_on_ice: number;
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
  /** Goalie time on ice for this game, in seconds (null for skaters). */
  time_on_ice: number | null;
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
  options: PlayerDetailsOptions = {},
) => {
  const mode = options.mode ?? 'admin';
  const { data: routeLookup = null, isLoading: loading } = useQuery<PlayerRouteLookup | null>({
    queryKey: [
      mode === 'user' ? 'user-player-route-lookup' : 'player-route-lookup',
      leagueCode,
      teamCode,
      playerSlug,
    ],
    queryFn: async () => {
      try {
        const { data } = await axios.get<PlayerRouteLookup>(
          `${getPlayerEndpoint(mode)}/route-lookup`,
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

export const usePlayerCurrentSeasonStats = (
  playerId: string | null | undefined,
  options: PlayerDetailsOptions = {},
) => {
  const mode = options.mode ?? 'admin';
  const seasonId = options.seasonId ?? null;
  const { data: currentSeasonStats = null, isLoading: loading } =
    useQuery<PlayerCurrentSeasonStats | null>({
      queryKey: [
        mode === 'user' ? 'user-player-latest-season-stats' : 'player-latest-season-stats',
        playerId,
        seasonId,
      ],
      queryFn: async () => {
        try {
          const { data } = await axios.get<PlayerCurrentSeasonStats | null>(
            `${getPlayerEndpoint(mode)}/${playerId}/latest-season-stats`,
            {
              headers: authHeaders(),
              params: { season_id: seasonId || undefined },
            },
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
export const usePlayerLastFiveGames = (
  playerId: string | null | undefined,
  options: PlayerDetailsOptions = {},
) => {
  const mode = options.mode ?? 'admin';
  const { data: lastFiveGames = [], isLoading: loading } = useQuery<PlayerLastFiveGameRecord[]>({
    queryKey: [
      mode === 'user' ? 'user-player-last-five-games' : 'player-last-five-games',
      playerId,
    ],
    queryFn: async () => {
      try {
        const { data } = await axios.get<PlayerLastFiveGameRecord[]>(
          `${getPlayerEndpoint(mode)}/${playerId}/last-five-games`,
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
  options: PlayerDetailsOptions = {},
) => {
  const { seasonId = null, gameType = null, page = 1, pageSize = 20 } = params;
  const mode = options.mode ?? 'admin';
  const { data, isLoading: loading } = useQuery<PlayerGameLogsResponse>({
    queryKey: [
      mode === 'user' ? 'user-player-game-logs' : 'player-game-logs',
      playerId,
      seasonId,
      gameType,
      page,
      pageSize,
    ],
    queryFn: async () => {
      try {
        const { data } = await axios.get<PlayerGameLogsResponse>(
          `${getPlayerEndpoint(mode)}/${playerId}/game-logs`,
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

const usePlayerDetails = (
  playerId: string | null | undefined,
  options: PlayerDetailsOptions = {},
) => {
  const { player, loading: playerLoading } = usePlayer(playerId, options);
  const { stats, loading: statsLoading } = usePlayerCareerStats(playerId, options);

  return {
    player,
    stats,
    loading: playerLoading || statsLoading,
  };
};

export default usePlayerDetails;
