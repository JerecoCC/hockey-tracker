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

export interface UpdateGameInfoData {
  venue?: string | null;
  scheduled_at?: string | null;
  scheduled_time?: string | null;
  game_type?: GameType;
  playoff_round?: number | null;
  game_number_in_series?: number | null;
  time_start?: string | null;
  time_end?: string | null;
  shootout_first_team_id?: string | null;
}
export type SeriesStatus = 'upcoming' | 'active' | 'complete';

/** A head-to-head meeting between the two teams in the current game's season. */
export interface PreviousMeeting {
  game_id:               string;
  scheduled_at:          string | null;
  created_at:            string;
  status:                GameStatus;
  /** True when the current game's home team was also home in this meeting. */
  current_home_was_home: boolean;
  /** Actual home team for this meeting. */
  home_team:             TeamInfo;
  /** Actual away team for this meeting. */
  away_team:             TeamInfo;
  /** Score of the meeting's home team (not necessarily the current game's home team). */
  home_score:            number;
  /** Score of the meeting's away team (not necessarily the current game's away team). */
  away_score:            number;
  overtime_periods:      number | null;
  shootout:              boolean;
}

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
  opponent_logo_dark?: string | null;
  opponent_logo_light?: string | null;
}

export interface TeamInfo {
  id:              string;
  name:            string;
  place_name?:     string | null;
  team_name?:      string | null;
  code:            string;
  logo:            string | null;
  logo_dark?:      string | null;
  logo_light?:     string | null;
  primary_color:   string;
  secondary_color: string;
  text_color:      string;
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
  home_team:             TeamInfo;
  away_team:             TeamInfo;
  home_score:            number;
  away_score:            number;
  overtime_periods:         number | null;
  shootout:                 boolean;
  /** Winning team for a completed game when it can be derived from goals / shootout attempts. */
  winner_team_id?:          string | null;
  /** UUID of the team that shoots first in a shootout, or null if not applicable. */
  shootout_first_team_id:   string | null;
  playoff_series_id:        string | null;
  game_number_in_series: number | null;
  game_number:           number | null;
  playoff_round:         number | null;
  series_home_team_id:   string | null;
  series_away_team_id:   string | null;
  series_home_wins:      number | null;
  series_away_wins:      number | null;
  series_home_wins_at_game?: number | null;
  series_away_wins_at_game?: number | null;
  series_games_to_win:   number | null;
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
  league_code?:          string;
  league_name?:          string;
  league_primary_color?: string;
  league_text_color?:    string;
  watched_by_user?:      boolean;
  watched_on?:           string | null;
  scheduled_for?:        string | null;
  /** Last 5 final games for the home team within the same season (detail endpoint only). */
  home_last_five?:       LastFiveGame[];
  /** Last 5 final games for the away team within the same season (detail endpoint only). */
  away_last_five?:       LastFiveGame[];
  /** All other meetings between home and away teams this season (detail endpoint only). */
  previous_meetings?:    PreviousMeeting[];
  /** Number of regulation shootout rounds before sudden death (from the league settings). */
  best_of_shootout:      number;
  /** Custom display names for each playoff round from the season's bracket rule set (detail endpoint only). */
  playoff_round_names?:  Record<string, string> | null;
}

export interface SeriesGame {
  id:                    string;
  game_number_in_series: number;
  status:                string;
  scheduled_at:          string | null;
  home_team_id:          string;
  away_team_id:          string;
  home_goals:            number;
  away_goals:            number;
}

export interface PlayoffSeriesRecord {
  id:             string;
  season_id:      string;
  round:          number;
  series_letter:  string | null;
  /** Null when the team has not yet been determined (partial series shell). */
  home_team_id:   string | null;
  home_team_name: string | null;
  home_team_code: string | null;
  home_team_logo: string | null;
  home_team_logo_dark?: string | null;
  home_team_logo_light?: string | null;
  /** Null when the team has not yet been determined (partial series shell). */
  away_team_id:   string | null;
  away_team_name: string | null;
  away_team_code: string | null;
  away_team_logo: string | null;
  away_team_logo_dark?: string | null;
  away_team_logo_light?: string | null;
  games_to_win:   number;
  home_wins:      number;
  away_wins:      number;
  status:           SeriesStatus;
  winner_team_id:   string | null;
  bracket_slot_key: string | null;
  created_at:       string;
  games:            SeriesGame[];
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
  week?:      string;
}

interface GameRouteLookupInput {
  seasonId?: string;
  gameDateSlug?: string;
  gameSlug?: string;
  enabled?: boolean;
}

interface GameRouteLookupResponse {
  game_id: string;
}

const isGameListQuery = (queryKey: readonly unknown[]) =>
  queryKey[0] === 'games' &&
  queryKey.length === 2 &&
  typeof queryKey[1] === 'object' &&
  queryKey[1] !== null;

const mergeGame = (game: GameRecord | null | undefined, patch: Partial<GameRecord>) =>
  game ? { ...game, ...patch } : game;

const updateCachedGame = (
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
  patch: Partial<GameRecord>,
) => {
  queryClient.setQueryData<GameRecord | null>(['games', id], (game) => mergeGame(game, patch));

  const gameListQueries = queryClient
    .getQueryCache()
    .findAll({ predicate: (query) => isGameListQuery(query.queryKey) });

  for (const query of gameListQueries) {
    queryClient.setQueryData<GameRecord[]>(query.queryKey, (games) => {
      if (!Array.isArray(games)) return games;
      let changed = false;
      const nextGames = games.map((game) => {
        if (game.id !== id) return game;
        changed = true;
        return { ...game, ...patch };
      });
      return changed ? nextGames : games;
    });
  }
};

const removeCachedGame = (queryClient: ReturnType<typeof useQueryClient>, id: string) => {
  queryClient.removeQueries({ queryKey: ['games', id], exact: true });

  const gameListQueries = queryClient
    .getQueryCache()
    .findAll({ predicate: (query) => isGameListQuery(query.queryKey) });

  for (const query of gameListQueries) {
    queryClient.setQueryData<GameRecord[]>(query.queryKey, (games) =>
      Array.isArray(games) ? games.filter((game) => game.id !== id) : games,
    );
  }
};

const useGames = (filters: Filters = {}) => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const params: Record<string, string> = {};
  if (filters.seasonId)  params.season_id  = filters.seasonId;
  if (filters.teamId)    params.team_id    = filters.teamId;
  if (filters.gameType)  params.game_type  = filters.gameType;
  if (filters.status)    params.status     = filters.status;
  if (filters.week)      params.week       = filters.week;

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

export const useGameRouteLookup = ({
  seasonId,
  gameDateSlug,
  gameSlug,
  enabled = true,
}: GameRouteLookupInput) => {
  const {
    data = null,
    isLoading: loading,
    error,
    isError,
  } = useQuery<GameRouteLookupResponse | null, AxiosError<{ error?: string }>>({
    queryKey: ['game-route-lookup', { seasonId, gameDateSlug, gameSlug }],
    enabled: enabled && !!seasonId && !!gameDateSlug && !!gameSlug,
    queryFn: async () => {
      try {
        const { data } = await axios.get<GameRouteLookupResponse>(
          `${API}/admin/games/route-lookup`,
          {
            headers: authHeaders(),
            params: {
              season_id: seasonId,
              game_date: gameDateSlug,
              game_slug: gameSlug,
            },
          },
        );
        return data;
      } catch (err) {
        if ((err as AxiosError).response?.status !== 404) {
          toast.error(apiError(err, 'Failed to resolve game route'));
        }
        throw err;
      }
    },
  });

  const notFound = isError && error?.response?.status === 404;
  return { gameId: data?.game_id ?? null, loading, notFound, failed: isError && !notFound };
};

// ── Single-game detail hook ───────────────────────────────────────────────────

export const useGameDetails = (
  id: string | undefined,
  options: { mode?: 'admin' | 'user' } = {},
) => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const mode = options.mode ?? 'admin';

  const {
    data: game = null,
    isLoading: loading,
    error,
    isError,
  } = useQuery<GameRecord | null, AxiosError<{ error?: string }>>({
    queryKey: [mode === 'user' ? 'user-game-details' : 'games', id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) return null;
      try {
        const { data } = await axios.get<GameRecord>(
          `${API}/${mode === 'user' ? 'user' : 'admin'}/games/${id}`,
          {
            headers: authHeaders(),
          },
        );
        return data;
      } catch (err) {
        if ((err as AxiosError).response?.status !== 404) {
          toast.error(apiError(err, 'Failed to load game'));
        }
        throw err;
      }
    },
  });
  const notFound = isError && error?.response?.status === 404;

  const advancePeriod = async (nextPeriod: CurrentPeriod): Promise<boolean> => {
    if (!id) return false;
    setBusy('advance-period');
    try {
      const { data: game } = await axios.patch<GameRecord>(
        `${API}/admin/games/${id}`,
        { current_period: nextPeriod },
        { headers: authHeaders() },
      );
      updateCachedGame(queryClient, id, game);
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
      const { data: game } = await axios.patch<GameRecord>(
        `${API}/admin/games/${id}`,
        { status: 'in_progress', time_start },
        { headers: authHeaders() },
      );
      toast.success('Game started!');
      updateCachedGame(queryClient, id, game);
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
      const { data: game } = await axios.patch<GameRecord>(
        `${API}/admin/games/${id}`,
        { status },
        { headers: authHeaders() },
      );
      const label =
        status === 'in_progress' ? 'Game started!'
        : status === 'final'      ? 'Game ended!'
        : status === 'cancelled'  ? 'Game cancelled.'
        : 'Status updated.';
      toast.success(label);
      updateCachedGame(queryClient, id, game);
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
      const { data: game } = await axios.patch<GameRecord>(
        `${API}/admin/games/${id}`,
        { status: 'final', star_1_id: stars.star1, star_2_id: stars.star2, star_3_id: stars.star3 },
        { headers: authHeaders() },
      );
      toast.success('Game ended!');
      updateCachedGame(queryClient, id, game);
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to end game'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const updateGameInfo = async (data: UpdateGameInfoData): Promise<boolean> => {
    if (!id) return false;
    setBusy('update-info');
    try {
      const { data: game } = await axios.patch<GameRecord>(
        `${API}/admin/games/${id}`,
        data,
        { headers: authHeaders() },
      );
      toast.success('Game updated!');
      updateCachedGame(queryClient, id, game);
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
      const { data: game } = await axios.patch<GameRecord>(
        `${API}/admin/games/${id}`,
        { star_1_id: stars.star1, star_2_id: stars.star2, star_3_id: stars.star3 },
        { headers: authHeaders() },
      );
      toast.success('Three Stars updated!');
      updateCachedGame(queryClient, id, game);
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
      const { data } = await axios.patch<Pick<GameRecord, 'period_shots'>>(
        `${API}/admin/games/${id}/shots`,
        { period, home_shots, away_shots },
        { headers: authHeaders() },
      );
      updateCachedGame(queryClient, id, { period_shots: data.period_shots });
      await queryClient.invalidateQueries({ queryKey: ['game-goalie-stats', id] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to save shots'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  // Only needed for edge-case old games where current_period was never persisted.
  // Status is NOT changed — the game stays final; only current_period is set.
  const revertToEditMode = async (lastPeriod: CurrentPeriod): Promise<boolean> => {
    if (!id) return false;
    setBusy('revert-edit');
    try {
      const { data: game } = await axios.patch<GameRecord>(
        `${API}/admin/games/${id}`,
        { current_period: lastPeriod },
        { headers: authHeaders() },
      );
      updateCachedGame(queryClient, id, game);
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to set current period'));
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
      removeCachedGame(queryClient, id);
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete game'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  /** Go back to a specific OT period number (keeps current_period = 'OT', sets overtime_periods = targetNum). */
  const revertOTPeriod = async (targetOTPeriods: number): Promise<boolean> => {
    if (!id) return false;
    setBusy('advance-period');
    try {
      const { data: game } = await axios.patch<GameRecord>(
        `${API}/admin/games/${id}`,
        { current_period: 'OT', overtime_periods: targetOTPeriods },
        { headers: authHeaders() },
      );
      updateCachedGame(queryClient, id, game);
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to revert overtime period'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  /** Advance to the next overtime period for playoff games (keeps current_period = 'OT', increments overtime_periods). */
  const advanceOTPeriod = async (currentOvertimePeriods: number): Promise<boolean> => {
    if (!id) return false;
    setBusy('advance-period');
    try {
      const { data: game } = await axios.patch<GameRecord>(
        `${API}/admin/games/${id}`,
        { current_period: 'OT', overtime_periods: currentOvertimePeriods + 1 },
        { headers: authHeaders() },
      );
      updateCachedGame(queryClient, id, game);
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to advance overtime period'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  return { game, loading, notFound, failed: isError && !notFound, busy, startGame, updateStatus, advancePeriod, advanceOTPeriod, revertOTPeriod, endGame, updateStars, updateGameInfo, updatePeriodShots, revertToEditMode, deleteGame };
};

// ── Playoff series hook ────────────────────────────────────────────────────────

export interface CreateSeriesData {
  season_id: string;
  round: number;
  series_letter?: string | null;
  home_team_id: string;
  away_team_id: string;
  games_to_win?: number;
  status?: SeriesStatus;
  home_wins?: number;
  away_wins?: number;
  winner_team_id?: string | null;
  bracket_slot_key?: string | null;
}

export const usePlayoffSeries = (seasonId: string | undefined) => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: series = [], isLoading: loading } = useQuery<PlayoffSeriesRecord[]>({
    queryKey: ['playoff-series', seasonId],
    enabled: !!seasonId,
    queryFn: async () => {
      try {
        const { data } = await axios.get<PlayoffSeriesRecord[]>(
          `${API}/admin/games/playoff-series`,
          { headers: authHeaders(), params: { season_id: seasonId } },
        );
        return data;
      } catch (err) {
        toast.error(apiError(err, 'Failed to load playoff series'));
        return [];
      }
    },
  });

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['playoff-series', seasonId] }),
      queryClient.invalidateQueries({ queryKey: ['games', { season_id: seasonId }] }),
    ]);

  const createSeries = async (data: CreateSeriesData): Promise<boolean> => {
    setBusy('creating');
    try {
      await axios.post(`${API}/admin/games/playoff-series`, data, { headers: authHeaders() });
      toast.success('Series created!');
      await invalidate();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to create series'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const updateSeries = async (id: string, data: Partial<CreateSeriesData>): Promise<boolean> => {
    setBusy(id);
    try {
      await axios.patch(`${API}/admin/games/playoff-series/${id}`, data, { headers: authHeaders() });
      toast.success('Series updated!');
      await invalidate();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update series'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const deleteSeries = async (id: string): Promise<boolean> => {
    setBusy(id);
    try {
      await axios.delete(`${API}/admin/games/playoff-series/${id}`, { headers: authHeaders() });
      toast.success('Series deleted!');
      await invalidate();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete series'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const startSeries = async (id: string): Promise<boolean> => {
    setBusy(id);
    try {
      await axios.post(
        `${API}/admin/games/playoff-series/${id}/start`,
        {},
        { headers: authHeaders() },
      );
      toast.success('Series started — games generated!');
      await invalidate();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to start series'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const advanceBracket = async (): Promise<boolean> => {
    setBusy('advancing');
    try {
      const { data } = await axios.post<{ created: number }>(
        `${API}/admin/seasons/${seasonId}/advance-bracket`,
        {},
        { headers: authHeaders() },
      );
      if (data.created > 0) {
        toast.success(`Bracket advanced — ${data.created} new series created!`);
      } else {
        toast.info('Bracket is already up to date.');
      }
      await invalidate();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to advance bracket'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const forceAdvance = async (seriesId: string): Promise<boolean> => {
    setBusy(seriesId);
    try {
      await axios.post(
        `${API}/admin/games/playoff-series/${seriesId}/force-advance`,
        {},
        { headers: authHeaders() },
      );
      toast.success('Winner advanced to next round!');
      await invalidate();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to advance winner'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  return { series, loading, busy, createSeries, updateSeries, deleteSeries, startSeries, advanceBracket, forceAdvance };
};

