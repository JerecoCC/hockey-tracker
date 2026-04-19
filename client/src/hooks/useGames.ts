import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-toastify';

const API = import.meta.env.VITE_API_URL || '/api';

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const apiError = (err: unknown, fallback: string) =>
  (err as AxiosError<{ error?: string }>).response?.data?.error ?? fallback;

// ── Types ─────────────────────────────────────────────────────────────────────

export type GameType   = 'preseason' | 'regular' | 'playoff';
export type GameStatus = 'scheduled' | 'final' | 'postponed' | 'cancelled';
export type PeriodType = 'regulation' | 'overtime' | 'shootout';
export type SeriesStatus = 'upcoming' | 'active' | 'complete';

export interface GamePeriod {
  period:      number;
  period_type: PeriodType;
  home_goals:  number;
  away_goals:  number;
}

export interface GameRecord {
  id:                    string;
  season_id:             string;
  game_type:             GameType;
  status:                GameStatus;
  scheduled_at:          string | null;
  venue:                 string | null;
  home_team_id:          string;
  home_team_name:        string;
  home_team_code:        string;
  home_team_logo:        string | null;
  away_team_id:          string;
  away_team_name:        string;
  away_team_code:        string;
  away_team_logo:        string | null;
  home_score:            number | null;
  away_score:            number | null;
  home_score_reg:        number | null;
  away_score_reg:        number | null;
  overtime_periods:      number | null;
  shootout:              boolean;
  playoff_series_id:     string | null;
  game_number_in_series: number | null;
  game_number:           number | null;
  notes:                 string | null;
  created_at:            string;
  /** Present only on the detail endpoint. */
  periods?:              GamePeriod[];
}

export interface PlayoffSeriesRecord {
  id:             string;
  season_id:      string;
  round:          number;
  series_letter:  string | null;
  home_team_id:   string;
  home_team_name: string;
  home_team_code: string;
  home_team_logo: string | null;
  away_team_id:   string;
  away_team_name: string;
  away_team_code: string;
  away_team_logo: string | null;
  games_to_win:   number;
  home_wins:      number;
  away_wins:      number;
  status:         SeriesStatus;
  winner_team_id: string | null;
  created_at:     string;
}

export interface CreateGameData {
  season_id:             string;
  home_team_id:          string;
  away_team_id:          string;
  game_type?:            GameType;
  status?:               GameStatus;
  scheduled_at?:         string | null;
  venue?:                string | null;
  home_score?:           number | null;
  away_score?:           number | null;
  home_score_reg?:       number | null;
  away_score_reg?:       number | null;
  overtime_periods?:     number | null;
  shootout?:             boolean;
  playoff_series_id?:    string | null;
  game_number_in_series?: number | null;
  game_number?:          number | null;
  notes?:                string | null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

interface Filters {
  seasonId?:  string;
  teamId?:    string;
  gameType?:  GameType;
  status?:    GameStatus;
}

const useGames = (filters: Filters = {}) => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const params: Record<string, string> = {};
  if (filters.seasonId)  params.season_id  = filters.seasonId;
  if (filters.teamId)    params.team_id    = filters.teamId;
  if (filters.gameType)  params.game_type  = filters.gameType;
  if (filters.status)    params.status     = filters.status;

  const queryKey = ['games', params];

  const { data: games = [], isLoading: loading } = useQuery<GameRecord[]>({
    queryKey,
    queryFn: async () => {
      try {
        const { data } = await axios.get<GameRecord[]>(`${API}/admin/games`, {
          headers: authHeaders(),
          params,
        });
        return data;
      } catch (err) {
        toast.error(apiError(err, 'Failed to load games'));
        return [];
      }
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['games'] });

  const createGame = async (data: CreateGameData): Promise<GameRecord | null> => {
    setBusy('creating');
    try {
      const { data: game } = await axios.post<GameRecord>(`${API}/admin/games`, data, {
        headers: authHeaders(),
      });
      toast.success('Game created!');
      await invalidate();
      return game;
    } catch (err) {
      toast.error(apiError(err, 'Failed to create game'));
      return null;
    } finally {
      setBusy(null);
    }
  };

  const updateGame = async (id: string, data: Partial<CreateGameData>): Promise<boolean> => {
    setBusy(id);
    try {
      await axios.patch(`${API}/admin/games/${id}`, data, { headers: authHeaders() });
      toast.success('Game updated!');
      await invalidate();
      queryClient.invalidateQueries({ queryKey: ['games', id] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update game'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const deleteGame = async (id: string): Promise<boolean> => {
    setBusy(id);
    try {
      await axios.delete(`${API}/admin/games/${id}`, { headers: authHeaders() });
      toast.success('Game deleted!');
      await invalidate();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete game'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const updatePeriods = async (id: string, periods: GamePeriod[]): Promise<boolean> => {
    setBusy(`periods-${id}`);
    try {
      await axios.put(`${API}/admin/games/${id}/periods`, { periods }, { headers: authHeaders() });
      toast.success('Period scores saved!');
      queryClient.invalidateQueries({ queryKey: ['games', id] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to save period scores'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const bulkCreateGames = async (data: CreateGameData[]): Promise<boolean> => {
    setBusy('bulk-creating');
    try {
      await Promise.all(
        data.map((game) =>
          axios.post(`${API}/admin/games`, game, { headers: authHeaders() }),
        ),
      );
      toast.success(`${data.length} game${data.length !== 1 ? 's' : ''} created!`);
      await invalidate();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to create games'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  return { games, loading, busy, createGame, updateGame, deleteGame, updatePeriods, bulkCreateGames };
};

export default useGames;

