import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

import { API, authHeaders } from '@/lib/apiClient';
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

  // These run behind the modals' progress toasts (see useBackgroundModalAction): they throw on
  // failure rather than toasting, and the game lists refresh in the background so the success
  // message doesn't wait on them.

  const createPersonalGame = async (input: PersonalGameInput): Promise<GameRecord> => {
    const { data } = await axios.post<GameRecord>(`${API}/user/personal-games`, input, {
      headers: authHeaders(),
    });
    void refreshGameLists();
    return data;
  };

  const updatePersonalGame = async (id: string, input: PersonalGameInput): Promise<GameRecord> => {
    const { data } = await axios.patch<GameRecord>(`${API}/user/personal-games/${id}`, input, {
      headers: authHeaders(),
    });
    void refreshGameLists();
    return data;
  };

  /** Adds several unplayed games under one season; nothing is saved if any row is invalid. */
  const bulkCreatePersonalGames = async (input: PersonalGameBulkInput): Promise<number> => {
    const { data } = await axios.post<{ created: number }>(
      `${API}/user/personal-games/bulk`,
      input,
      { headers: authHeaders() },
    );
    void refreshGameLists();
    return data.created;
  };

  /** Records the final score after watching, which also marks the game watched. */
  const recordPersonalGameScore = async (
    id: string,
    score: PersonalGameScore,
  ): Promise<GameRecord> => {
    const { data } = await axios.patch<GameRecord>(
      `${API}/user/personal-games/${id}`,
      { ...score, watched_on: toLocalDateKey(new Date()) },
      { headers: authHeaders() },
    );
    void refreshGameLists();
    return data;
  };

  const deletePersonalGame = async (id: string): Promise<void> => {
    await axios.delete(`${API}/user/personal-games/${id}`, { headers: authHeaders() });
    void refreshGameLists();
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
