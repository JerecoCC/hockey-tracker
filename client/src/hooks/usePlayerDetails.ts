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
