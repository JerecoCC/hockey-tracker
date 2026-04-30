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

/** A single entry in a team's last-five-games form guide. */
export interface LastFiveGame {
  game_id:          string;
  scheduled_at:     string | null;
  home_score:       number;
  away_score:       number;
  overtime_periods: number | null;
  shootout:         boolean;
  /** Result from the perspective of the team whose last-five list this belongs to. */
  result:           'W' | 'L' | 'T';
  /** True if the team was the home team in that historical game (determines square background color). */
  is_home:          boolean;
  opponent_team_id: string;
  opponent_name:    string;
  opponent_code:    string;
  opponent_logo:    string | null;
}

export interface GameRecord {
  id:                    string;
  season_id:             string;
  game_type:             GameType;
  status:                GameStatus;
  scheduled_at:          string | null;
  scheduled_time:        string | null;
  venue:                 string | null;
  /** Actual kick-off timestamp (set when the game starts, distinct from scheduled_at). */
  time_start:            string | null;
  /** Actual end timestamp (set when the game is finalised). */
  time_end:              string | null;
  home_team_id:            string;
  home_team_name:          string;
  home_team_code:          string;
  home_team_logo:          string | null;
  home_team_primary_color:   string;
  home_team_secondary_color: string;
  home_team_text_color:      string;
  away_team_id:              string;
  away_team_name:            string;
  away_team_code:            string;
  away_team_logo:            string | null;
  away_team_primary_color:   string;
  away_team_secondary_color: string;
  away_team_text_color:      string;
  overtime_periods:         number | null;
  shootout:                 boolean;
  /** UUID of the team that shoots first in a shootout, or null if not applicable. */
  shootout_first_team_id:   string | null;
  playoff_series_id:        string | null;
  game_number_in_series: number | null;
  game_number:           number | null;
  notes:                 string | null;
  created_at:            string;
  current_period?:       CurrentPeriod | null;
  /** Period-by-period goal totals aggregated from the goals table. */
  period_scores:         { period: string; home_goals: number; away_goals: number }[];
  /** Period-by-period shots on goal entered manually via the admin UI. */
  period_shots:          { period: string; home_shots: number; away_shots: number }[];
  star_1_id:             string | null;
  star_2_id:             string | null;
  star_3_id:             string | null;
  season_name?:          string;
  league_id?:            string;
  league_name?:          string;
  /** Last 5 final games for the home team within the same season (detail endpoint only). */
  home_last_five?:       LastFiveGame[];
  /** Last 5 final games for the away team within the same season (detail endpoint only). */
  away_last_five?:       LastFiveGame[];
  /** Number of regulation shootout rounds before sudden death (from the league settings). */
  best_of_shootout:      number;
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
  scheduled_time?:       string | null;
  venue?:                string | null;
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

  /**
   * Start the game: sets status to in_progress and records the actual kick-off
   * time in time_start. Sends a single PATCH so both fields are consistent.
   */
  const startGame = async (time_start: string): Promise<boolean> => {
    if (!id) return false;
    setBusy('in_progress');
    try {
      await axios.patch(
        `${API}/admin/games/${id}`,
        { status: 'in_progress', time_start },
        { headers: authHeaders() },
      );
      toast.success('Game started!');
      await queryClient.invalidateQueries({ queryKey: ['games', id] });
      await queryClient.invalidateQueries({ queryKey: ['games'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to start game'));
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

  const endGame = async (stars: {
    star1: string;
    star2: string;
    star3: string;
  }): Promise<boolean> => {
    if (!id) return false;
    setBusy('final');
    try {
      await axios.patch(
        `${API}/admin/games/${id}`,
        { status: 'final', star_1_id: stars.star1, star_2_id: stars.star2, star_3_id: stars.star3 },
        { headers: authHeaders() },
      );
      toast.success('Game ended!');
      await queryClient.invalidateQueries({ queryKey: ['games', id] });
      await queryClient.invalidateQueries({ queryKey: ['games'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to end game'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const updateGameInfo = async (data: {
    venue?: string | null;
    scheduled_at?: string | null;
    scheduled_time?: string | null;
    game_type?: GameType;
    time_start?: string | null;
    time_end?: string | null;
    shootout_first_team_id?: string | null;
  }): Promise<boolean> => {
    if (!id) return false;
    setBusy('update-info');
    try {
      await axios.patch(`${API}/admin/games/${id}`, data, { headers: authHeaders() });
      toast.success('Game updated!');
      await queryClient.invalidateQueries({ queryKey: ['games', id] });
      await queryClient.invalidateQueries({ queryKey: ['games'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update game'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const updateStars = async (stars: {
    star1: string;
    star2: string;
    star3: string;
  }): Promise<boolean> => {
    if (!id) return false;
    setBusy('update-stars');
    try {
      await axios.patch(
        `${API}/admin/games/${id}`,
        { star_1_id: stars.star1, star_2_id: stars.star2, star_3_id: stars.star3 },
        { headers: authHeaders() },
      );
      toast.success('Three Stars updated!');
      await queryClient.invalidateQueries({ queryKey: ['games', id] });
      await queryClient.invalidateQueries({ queryKey: ['games'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update stars'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const updatePeriodShots = async (
    period: string,
    home_shots: number,
    away_shots: number,
  ): Promise<boolean> => {
    if (!id) return false;
    setBusy('shots');
    try {
      await axios.patch(
        `${API}/admin/games/${id}/shots`,
        { period, home_shots, away_shots },
        { headers: authHeaders() },
      );
      await queryClient.invalidateQueries({ queryKey: ['games', id] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to save shots'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const deleteGame = async (): Promise<boolean> => {
    if (!id) return false;
    setBusy('deleting');
    try {
      await axios.delete(`${API}/admin/games/${id}`, { headers: authHeaders() });
      toast.success('Game deleted!');
      await queryClient.invalidateQueries({ queryKey: ['games'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete game'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  return { game, loading, busy, startGame, updateStatus, advancePeriod, endGame, updateStars, updateGameInfo, updatePeriodShots, deleteGame };
};

