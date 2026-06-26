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
  /** created_at of the player's most-recent team stint this season (for de-duping). */
  team_stint_created: string | null;
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
  /** created_at of the player's most-recent team stint this season (for de-duping). */
  team_stint_created: string | null;
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
export type SeasonStatsCompetition = 'regular' | 'playoff';

interface UseSeasonStatsOptions {
  group?: SeasonStatsGroup;
  page?: number;
  pageSize?: number;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  /** Which competition the stats are based on. Defaults to the regular season. */
  competition?: SeasonStatsCompetition;
  enabled?: boolean;
}

interface PaginatedSeasonStatsResponse {
  items: (SkaterStatRecord | GoalieStatRecord)[];
  total: number;
  page: number;
  page_size: number;
}

const useSeasonStats = (seasonId: string | undefined, options: UseSeasonStatsOptions = {}) => {
  const { enabled = true, ...queryOptions } = options;
  const isPaginated = !!queryOptions.group;

  const { data, isFetching, isLoading } = useQuery<
    SeasonStatsResponse | PaginatedSeasonStatsResponse
  >({
    queryKey: ['season-stats', seasonId, queryOptions],
    queryFn: async () => {
      try {
        const params: Record<string, string> = {};
        if (queryOptions.group) params.group = queryOptions.group;
        if (queryOptions.page !== undefined) params.page = String(queryOptions.page);
        if (queryOptions.pageSize !== undefined) params.page_size = String(queryOptions.pageSize);
        if (queryOptions.sortKey) params.sort_key = queryOptions.sortKey;
        if (queryOptions.competition) params.competition = queryOptions.competition;
        if (queryOptions.sortDir) params.sort_dir = queryOptions.sortDir;

        const { data } = await axios.get<SeasonStatsResponse | PaginatedSeasonStatsResponse>(
          `${API}/admin/seasons/${seasonId}/stats`,
          { headers: authHeaders(), params: Object.keys(params).length ? params : undefined },
        );
        return data;
      } catch {
        toast.error('Failed to load season stats');
        return isPaginated
          ? {
              items: [],
              total: 0,
              page: queryOptions.page ?? 1,
              page_size: queryOptions.pageSize ?? 10,
            }
          : { skaters: [], goalies: [] };
      }
    },
    enabled: !!seasonId && enabled,
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
