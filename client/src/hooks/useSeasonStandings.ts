import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';

const API = import.meta.env.VITE_API_URL || '/api';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

export interface TeamStandingRecord {
  team_id: string;
  team_name: string | null;
  team_code: string | null;
  team_logo: string | null;
  team_logo_dark?: string | null;
  team_logo_light?: string | null;
  team_primary_color: string | null;
  team_text_color: string | null;
  gp: number;
  wins: number;
  reg_wins: number;
  ot_wins: number;
  losses: number;
  otl: number;
  points: number;
  games_remaining: number | null;
  goals_for?: number;
  goals_against?: number;
  goal_diff?: number;
}

interface UseSeasonStandingsOptions {
  enabled?: boolean;
}

const useSeasonStandings = (
  seasonId: string | undefined,
  options: UseSeasonStandingsOptions = {},
) => {
  const { enabled = true } = options;
  const { data = [], isLoading } = useQuery<TeamStandingRecord[]>({
    queryKey: ['season-standings', seasonId],
    queryFn: async () => {
      try {
        const { data } = await axios.get<TeamStandingRecord[]>(
          `${API}/admin/seasons/${seasonId}/standings`,
          { headers: authHeaders() },
        );
        return data;
      } catch {
        toast.error('Failed to load season standings');
        return [];
      }
    },
    enabled: !!seasonId && enabled,
  });

  return { standings: data, loading: isLoading };
};

export default useSeasonStandings;
