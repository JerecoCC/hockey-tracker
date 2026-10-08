import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';

import { API, authHeaders, getApiErrorMessage as apiError } from '@/lib/apiClient';
import { toLocalDateKey } from '@/lib/gameSchedule';
import type { GameRecord, GameType } from './useGames';

export type PersonalGameResultType = 'regulation' | 'overtime' | 'shootout';

export interface PersonalGameInput {
  /** The league season the game is filed under, or null. */
  season_id: string | null;
  home_team_id: string;
  away_team_id: string;
  game_type: GameType;
  /** YYYY-MM-DD */
  scheduled_at: string;
  /** Eastern HH:MM, or null when the start time isn't known. */
  scheduled_time: string | null;
  /** Both null until the user records a final score. */
  home_score: number | null;
  away_score: number | null;
  result_type: PersonalGameResultType;
  /** The postponed watch date (YYYY-MM-DD), or null. */
  scheduled_for: string | null;
  /** Today's local date: recording a score marks the game watched on it (unless postponed). */
  watched_on?: string | null;
}

export interface PersonalGameBulkInput {
  season_id: string | null;
  games: Array<Pick<PersonalGameInput, 'away_team_id' | 'home_team_id' | 'game_type' | 'scheduled_at' | 'scheduled_time'>>;
}

export interface PersonalGameScore {
  away_score: number;
  home_score: number;
  result_type: PersonalGameResultType;
}

// Every list a personal game can appear in: my games, the dashboard, and watched games.
const PERSONAL_GAME_QUERY_ROOTS = new Set([
  'user-games',
  'user-dashboard-games',
  'user-dashboard-watched-games',
  'user-dashboard-available-games',
  'user-games-watched',
]);

const usePersonalGames = () => {
  const queryClient = useQueryClient();

  const refreshGameLists = () =>
    queryClient.invalidateQueries({
      predicate: (query) => PERSONAL_GAME_QUERY_ROOTS.has(String(query.queryKey[0])),
    });

  const createPersonalGame = async (input: PersonalGameInput): Promise<GameRecord | null> => {
    try {
      const { data } = await axios.post<GameRecord>(`${API}/user/personal-games`, input, {
        headers: authHeaders(),
      });
      toast.success('Game added to your schedule');
      await refreshGameLists();
      return data;
    } catch (err) {
      toast.error(apiError(err, 'Failed to add game'));
      return null;
    }
  };

  const updatePersonalGame = async (
    id: string,
    input: PersonalGameInput,
  ): Promise<GameRecord | null> => {
    try {
      const { data } = await axios.patch<GameRecord>(`${API}/user/personal-games/${id}`, input, {
        headers: authHeaders(),
      });
      toast.success('Game updated');
      await refreshGameLists();
      return data;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update game'));
      return null;
    }
  };

  /** Adds several unplayed games under one season; nothing is saved if any row is invalid. */
  const bulkCreatePersonalGames = async (input: PersonalGameBulkInput): Promise<boolean> => {
    try {
      const { data } = await axios.post<{ created: number }>(
        `${API}/user/personal-games/bulk`,
        input,
        { headers: authHeaders() },
      );
      toast.success(
        `${data.created} personal game${data.created === 1 ? '' : 's'} added to your schedule`,
      );
      await refreshGameLists();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to add games'));
      return false;
    }
  };

  /** Records the final score after watching, which also marks the game watched. */
  const recordPersonalGameScore = async (
    id: string,
    score: PersonalGameScore,
  ): Promise<GameRecord | null> => {
    try {
      const { data } = await axios.patch<GameRecord>(
        `${API}/user/personal-games/${id}`,
        { ...score, watched_on: toLocalDateKey(new Date()) },
        { headers: authHeaders() },
      );
      toast.success('Score recorded and marked as watched');
      await refreshGameLists();
      return data;
    } catch (err) {
      toast.error(apiError(err, 'Failed to record the score'));
      return null;
    }
  };

  const deletePersonalGame = async (id: string): Promise<boolean> => {
    try {
      await axios.delete(`${API}/user/personal-games/${id}`, { headers: authHeaders() });
      toast.success('Game removed from your schedule');
      await refreshGameLists();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to remove game'));
      return false;
    }
  };

  return {
    createPersonalGame,
    bulkCreatePersonalGames,
    updatePersonalGame,
    recordPersonalGameScore,
    deletePersonalGame,
  };
};

export default usePersonalGames;
