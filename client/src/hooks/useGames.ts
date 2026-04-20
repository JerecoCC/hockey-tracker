import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-toastify';

const API = import.meta.env.VITE_API_URL || '/api';

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const apiError = (err: unknown, fallback: string) =>
  (err as AxiosError<{ error?: string }>).response?.data?.error ?? fallback;

// ── Types ─────────────────────────────────────────────────────────────────────

export type GameType      = 'preseason' | 'regular' | 'playoff';
export type GameStatus    = 'scheduled' | 'in_progress' | 'final' | 'postponed' | 'cancelled';
export type CurrentPeriod = '1' | '2' | '3' | 'OT' | 'SO';
export type SeriesStatus = 'upcoming' | 'active' | 'complete';

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
  current_period?:       CurrentPeriod | null;
  /** Period-by-period goal totals stored as static columns. */
  p1_home_goals:         number;
  p1_away_goals:         number;
  p2_home_goals:         number;
  p2_away_goals:         number;
  p3_home_goals:         number;
  p3_away_goals:         number;
  season_name?:          string;
  league_id?:            string;
  league_name?:          string;
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

  return { games, loading, busy, createGame, updateGame, deleteGame, bulkCreateGames };
};

export default useGames;

// ── Single-game detail hook ───────────────────────────────────────────────────

export const useGameDetails = (id: string | undefined) => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: game = null, isLoading: loading } = useQuery<GameRecord | null>({
    queryKey: ['games', id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) return null;
      try {
        const { data } = await axios.get<GameRecord>(`${API}/admin/games/${id}`, {
          headers: authHeaders(),
        });
        return data;
      } catch (err) {
        toast.error(apiError(err, 'Failed to load game'));
        return null;
      }
    },
  });

  const scoreGoal = async (period: 1 | 2 | 3, team: 'home' | 'away'): Promise<boolean> => {
    if (!id || !game) return false;
    setBusy('score-goal');
    const col = `p${period}_${team}_goals` as keyof GameRecord;
    const current = (game[col] as number) ?? 0;
    try {
      await axios.patch(
        `${API}/admin/games/${id}`,
        { [col]: current + 1 },
        { headers: authHeaders() },
      );
      await queryClient.invalidateQueries({ queryKey: ['games', id] });
      await queryClient.invalidateQueries({ queryKey: ['games'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to score goal'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const advancePeriod = async (nextPeriod: CurrentPeriod): Promise<boolean> => {
    if (!id) return false;
    setBusy('advance-period');
    try {
      await axios.patch(
        `${API}/admin/games/${id}`,
        { current_period: nextPeriod },
        { headers: authHeaders() },
      );
      await queryClient.invalidateQueries({ queryKey: ['games', id] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to advance period'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const updateStatus = async (status: GameStatus): Promise<boolean> => {
    if (!id) return false;
    setBusy(status);
    try {
      await axios.patch(`${API}/admin/games/${id}`, { status }, { headers: authHeaders() });
      const label =
        status === 'in_progress' ? 'Game started!'
        : status === 'final'      ? 'Game ended!'
        : status === 'cancelled'  ? 'Game cancelled.'
        : 'Status updated.';
      toast.success(label);
      await queryClient.invalidateQueries({ queryKey: ['games', id] });
      await queryClient.invalidateQueries({ queryKey: ['games'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update game status'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  return { game, loading, busy, updateStatus, scoreGoal, advancePeriod };
};

