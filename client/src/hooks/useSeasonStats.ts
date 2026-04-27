import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';

const API = import.meta.env.VITE_API_URL || '/api';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SkaterStatRecord {
  player_id: string;
  first_name: string;
  last_name: string;
  photo: string | null;
  position: string | null;
  jersey_number: number | null;
  team_id: string | null;
  team_code: string | null;
  team_name: string | null;
  team_logo: string | null;
  team_primary_color: string | null;
  team_text_color: string | null;
  gp: number;
  goals: number;
  assists: number;
  points: number;
}

export interface GoalieStatRecord {
  player_id: string;
  first_name: string;
  last_name: string;
  photo: string | null;
  jersey_number: number | null;
  team_id: string | null;
  team_code: string | null;
  team_name: string | null;
  team_logo: string | null;
  team_primary_color: string | null;
  team_text_color: string | null;
  gp: number;
  shots_against: number;
  saves: number;
  goals_against: number;
  save_pct: number | null;
  shutouts: number;
  gaa: number | null;
}

interface SeasonStatsResponse {
  skaters: SkaterStatRecord[];
  goalies: GoalieStatRecord[];
}

// ── Hook ──────────────────────────────────────────────────────────────────────

const useSeasonStats = (seasonId: string | undefined) => {
  const { data, isLoading } = useQuery<SeasonStatsResponse>({
    queryKey: ['season-stats', seasonId],
    queryFn: async () => {
      try {
        const { data } = await axios.get<SeasonStatsResponse>(
          `${API}/admin/seasons/${seasonId}/stats`,
          { headers: authHeaders() },
        );
        return data;
      } catch {
        toast.error('Failed to load season stats');
        return { skaters: [], goalies: [] };
      }
    },
    enabled: !!seasonId,
  });

  return {
    skaters: data?.skaters ?? [],
    goalies: data?.goalies ?? [],
    loading: isLoading,
  };
};

export default useSeasonStats;
