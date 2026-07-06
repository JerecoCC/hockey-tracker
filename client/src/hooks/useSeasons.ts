import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-toastify';
import { type PlayoffFormatRule } from './useLeagues';

const API = import.meta.env.VITE_API_URL || '/api';

export interface SeasonRecord {
  id: string;
  name: string;
  league_id: string;
  league_name: string;
  league_code: string;
  league_logo: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  /** True when the season has been explicitly marked as ended — roster editing is locked. */
  is_ended: boolean;
  /** True once the admin has formally ended the regular season and playoff setup has begun. */
  playoffs_started: boolean;
  /** Target number of regular-season games per team for this season. Null if not set. */
  games_per_season: number | null;
  /** Scoring system inherited from the league: '2-1-0' or '3-2-1-0'. */
  league_scoring_system: '2-1-0' | '3-2-1-0';
  /** League-level default series length (used when season override is null). */
  league_best_of_playoff: number;
  /** League-level default shootout rounds (used when season override is null). */
  league_best_of_shootout: number;
  /** League-level default goalie leaderboard eligibility in minutes. */
  league_goalie_min_regular_minutes: number;
  /** Season-level playoff qualification rules (overrides any league-level format). */
  playoff_format: PlayoffFormatRule[] | null;
  /** ID of the reusable playoff qualification format assigned to this season. */
  playoff_qualification_format_id: string | null;
  /** Name of the reusable playoff qualification format assigned to this season. */
  playoff_qualification_format_name?: string | null;
  /** Season-level playoff series length override. Null falls back to league default. */
  best_of_playoff: number | null;
  /** Season-level shootout rounds override. Null falls back to league default. */
  best_of_shootout: number | null;
  /** Season-level scoring system override. Null falls back to league default. */
  scoring_system: '2-1-0' | '3-2-1-0' | null;
  /** Regular-season goalie leaderboard eligibility in minutes. Null falls back to league default. */
  goalie_min_regular_minutes: number | null;
  /** ID of the bracket rule set assigned to this season. Null if none is assigned. */
  bracket_rule_set_id: string | null;
  /** ID of the team alignment set assigned to this season. Null uses legacy group fallback. */
  group_alignment_set_id: string | null;
  /** True once any game exists for the season; alignment edits are locked after this. */
  has_scheduled_games: boolean;
  /** True while regular-season games are still scheduled or in progress. */
  has_unfinished_regular_games: boolean;
  created_at: string;
}

export interface CreateSeasonData {
  league_id: string;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  games_per_season?: number | null;
  playoff_format?: PlayoffFormatRule[] | null;
  playoff_qualification_format_id?: string | null;
  best_of_playoff?: number | null;
  best_of_shootout?: number | null;
  scoring_system?: '2-1-0' | '3-2-1-0' | null;
  goalie_min_regular_minutes?: number | null;
  bracket_rule_set_id?: string | null;
  group_alignment_set_id?: string | null;
}

// Re-export so consumers can import from one place.
export type { PlayoffFormatRule };

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

const apiError = (err: unknown, fallback: string): string =>
  (err as AxiosError<{ error: string }>).response?.data?.error ?? fallback;

type SeasonsMode = 'admin' | 'user';

const useSeasons = (leagueId?: string, options: { mode?: SeasonsMode } = {}) => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const mode = options.mode ?? 'admin';
  const basePath = mode === 'user' ? 'user' : 'admin';

  const { data: seasons = [], isLoading: loading } = useQuery({
    queryKey: [
      mode === 'user' ? 'user-seasons' : 'seasons',
      ...(leagueId ? [{ league_id: leagueId }] : []),
    ],
    queryFn: async () => {
      try {
        const params = leagueId ? { league_id: leagueId } : undefined;
        const { data } = await axios.get<SeasonRecord[]>(`${API}/${basePath}/seasons`, {
          headers: authHeaders(),
          params,
        });
        return data;
      } catch (err) {
        toast.error(apiError(err, 'Failed to load seasons'));
        return [] as SeasonRecord[];
      }
    },
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const addSeason = async (payload: CreateSeasonData): Promise<boolean> => {
    try {
      await axios.post(`${API}/admin/seasons`, payload, { headers: authHeaders() });
      toast.success('Season created!');
      await queryClient.invalidateQueries({ queryKey: ['seasons'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to create season'));
      return false;
    }
  };

  const updateSeason = async (id: string, payload: Partial<CreateSeasonData>): Promise<boolean> => {
    setBusy(id);
    try {
      await axios.patch(`${API}/admin/seasons/${id}`, payload, { headers: authHeaders() });
      toast.success('Season updated!');
      await queryClient.invalidateQueries({ queryKey: ['seasons'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update season'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const deleteSeason = async (id: string) => {
    setBusy(id);
    try {
      await axios.delete(`${API}/admin/seasons/${id}`, { headers: authHeaders() });
      toast.success('Season deleted');
      await queryClient.invalidateQueries({ queryKey: ['seasons'] });
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete season'));
    } finally {
      setBusy(null);
    }
  };

  return { seasons, loading, busy, addSeason, updateSeason, deleteSeason };
};

export default useSeasons;
