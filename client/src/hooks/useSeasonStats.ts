import { keepPreviousData, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';

const API = import.meta.env.VITE_API_URL || '/api';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

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

type SeasonStatsGroup = 'forwards' | 'defense' | 'goalies';

interface UseSeasonStatsOptions {
  group?: SeasonStatsGroup;
  page?: number;
  pageSize?: number;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
}

interface PaginatedSeasonStatsResponse {
  items: (SkaterStatRecord | GoalieStatRecord)[];
  total: number;
  page: number;
  page_size: number;
}

const useSeasonStats = (seasonId: string | undefined, options: UseSeasonStatsOptions = {}) => {
  const isPaginated = !!options.group;

  const { data, isFetching, isLoading } = useQuery<
    SeasonStatsResponse | PaginatedSeasonStatsResponse
  >({
    queryKey: ['season-stats', seasonId, options],
    queryFn: async () => {
      try {
        const params: Record<string, string> = {};
        if (options.group) params.group = options.group;
        if (options.page !== undefined) params.page = String(options.page);
        if (options.pageSize !== undefined) params.page_size = String(options.pageSize);
        if (options.sortKey) params.sort_key = options.sortKey;
        if (options.sortDir) params.sort_dir = options.sortDir;

        const { data } = await axios.get<SeasonStatsResponse | PaginatedSeasonStatsResponse>(
          `${API}/admin/seasons/${seasonId}/stats`,
          { headers: authHeaders(), params: Object.keys(params).length ? params : undefined },
        );
        return data;
      } catch {
        toast.error('Failed to load season stats');
        return isPaginated
          ? { items: [], total: 0, page: options.page ?? 1, page_size: options.pageSize ?? 10 }
          : { skaters: [], goalies: [] };
      }
    },
    enabled: !!seasonId,
    placeholderData: keepPreviousData,
  });

  const skaters = data && 'skaters' in data ? data.skaters : [];
  const goalies = data && 'goalies' in data ? data.goalies : [];
  const items = data && 'items' in data ? data.items : [];
  const total = data && 'total' in data ? data.total : 0;

  return {
    skaters,
    goalies,
    items,
    total,
    loading: isLoading,
    fetching: isFetching,
  };
};

export default useSeasonStats;
