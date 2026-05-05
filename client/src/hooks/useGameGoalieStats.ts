import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { useState } from 'react';
import { toast } from 'react-toastify';

const API = import.meta.env.VITE_API_URL || '/api';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

const apiError = (err: unknown, fallback: string): string =>
  (err as AxiosError<{ error: string }>).response?.data?.error ?? fallback;

// ── Types ────────────────────────────────────────────────────────────────────

export interface UpsertGoalieStatData {
  goalie_id: string;
  team_id: string;
  shots_against: number;
}

export interface GoalieSwitchData {
  goalie_id: string;
  team_id: string;
  entered_period: string;
}

export interface GoalieStatRecord {
  id: string;
  game_id: string;
  team_id: string;
  goalie_id: string;
  shots_against: number;
  goals_against: number;
  saves: number;
  entered_period: string | null;
  created_at: string;
  goalie_first_name: string;
  goalie_last_name: string;
  goalie_photo: string | null;
  goalie_jersey_number: number | null;
  team_name: string;
  team_code: string;
  team_logo: string | null;
  team_primary_color: string;
  team_text_color: string;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

const useGameGoalieStats = (gameId: string | undefined) => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const queryKey = ['game-goalie-stats', gameId];

  const { data: goalieStats = [], isLoading: loading } = useQuery<GoalieStatRecord[]>({
    queryKey,
    enabled: !!gameId,
    queryFn: async () => {
      if (!gameId) return [];
      try {
        const { data } = await axios.get<GoalieStatRecord[]>(
          `${API}/admin/games/${gameId}/goalie-stats`,
          { headers: authHeaders() },
        );
        return data;
      } catch (err) {
        toast.error(apiError(err, 'Failed to load goalie stats'));
        return [];
      }
    },
  });

  const upsertGoalieStat = async (data: UpsertGoalieStatData): Promise<GoalieStatRecord | null> => {
    if (!gameId) return null;
    setBusy(data.goalie_id);
    try {
      const { data: row } = await axios.put<GoalieStatRecord>(
        `${API}/admin/games/${gameId}/goalie-stats`,
        data,
        { headers: authHeaders() },
      );
      await queryClient.invalidateQueries({ queryKey });
      return row;
    } catch (err) {
      toast.error(apiError(err, 'Failed to save goalie stats'));
      return null;
    } finally {
      setBusy(null);
    }
  };

  const switchGoalie = async (data: GoalieSwitchData): Promise<GoalieStatRecord[] | null> => {
    if (!gameId) return null;
    setBusy(data.goalie_id);
    try {
      const { data: rows } = await axios.post<GoalieStatRecord[]>(
        `${API}/admin/games/${gameId}/goalie-stats/switch`,
        data,
        { headers: authHeaders() },
      );
      await queryClient.invalidateQueries({ queryKey });
      return rows;
    } catch (err) {
      toast.error(apiError(err, 'Failed to record goalie switch'));
      return null;
    } finally {
      setBusy(null);
    }
  };

  const removeGoalieStat = async (goalieId: string): Promise<boolean> => {
    if (!gameId) return false;
    setBusy(goalieId);
    try {
      await axios.delete(
        `${API}/admin/games/${gameId}/goalie-stats/${goalieId}`,
        { headers: authHeaders() },
      );
      await queryClient.invalidateQueries({ queryKey });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to remove goalie stat'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  return { goalieStats, loading, busy, upsertGoalieStat, switchGoalie, removeGoalieStat };
};

export default useGameGoalieStats;
