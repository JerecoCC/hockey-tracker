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
  /** Override GA; null clears the override (reverts to auto-calc from goals table); omit to leave unchanged. */
  goals_against?: number | null;
  /** Set to a period string to mark as a sub; null to clear; omit to leave unchanged. */
  entered_period?: string | null;
  /** MM:SS timestamp within the period when the sub occurred; null to clear; omit to leave unchanged. */
  sub_time?: string | null;
}

export interface GoalieSwitchData {
  goalie_id: string;
  team_id: string;
  entered_period: string;
  /** MM:SS timestamp within the entered period when the new goalie entered. */
  entered_time?: string | null;
  /**
   * Close the team's currently-open stint before opening the new one.
   * - true → close it at the new entered_period / entered_time.
   * - object → close at an explicit point (must be ≤ new entered point).
   */
  close_previous?: boolean | { exited_period: string; exited_time?: string | null };
}

export interface UpdateGoalieStintData {
  goalie_id?: string;
  team_id?: string;
  entered_period?: string;
  entered_time?: string | null;
  exited_period?: string | null;
  exited_time?: string | null;
  shots_against?: number;
  /** Override GA for this stint. null removes the override (reverts to goal-table derivation). */
  goals_against?: number | null;
}

export interface GoalieStintRecord {
  id: string;
  stint_ord: number;
  entered_period: string;
  entered_time: string | null;
  exited_period: string | null;
  exited_time: string | null;
  shots_against: number;
  /** Resolved GA: override if set, otherwise derived from goals table for this stint window. */
  goals_against: number;
  /** Raw stored override (null = no override → derived). */
  goals_against_override: number | null;
  saves: number;
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
  sub_time: string | null;
  created_at: string;
  /** Per-stint detail (Phase 2+). One entry per stint; aggregated fields above SUM across these. */
  stints: GoalieStintRecord[];
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

const useGameGoalieStats = (gameId: string | undefined, options: { enabled?: boolean } = {}) => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const { enabled = true } = options;

  const queryKey = ['game-goalie-stats', gameId];

  const { data: goalieStats = [], isLoading: loading } = useQuery<GoalieStatRecord[]>({
    queryKey,
    enabled: !!gameId && enabled,
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
      queryClient.setQueryData<GoalieStatRecord[]>(queryKey, (current = []) => [
        ...current.filter((stat) => stat.goalie_id !== row.goalie_id),
        row,
      ]);
      return row;
    } catch (err) {
      toast.error(apiError(err, 'Failed to save goalie stats'));
      return null;
    } finally {
      setBusy(null);
    }
  };

  // Phase 3+: switch → POST /goalie-stints (with optional close_previous)
  const switchGoalie = async (data: GoalieSwitchData): Promise<GoalieStatRecord[] | null> => {
    if (!gameId) return null;
    setBusy(data.goalie_id);
    try {
      const { data: rows } = await axios.post<GoalieStatRecord[]>(
        `${API}/admin/games/${gameId}/goalie-stints`,
        data,
        { headers: authHeaders() },
      );
      queryClient.setQueryData<GoalieStatRecord[]>(queryKey, rows);
      return rows;
    } catch (err) {
      toast.error(apiError(err, 'Failed to record goalie switch'));
      return null;
    } finally {
      setBusy(null);
    }
  };

  const updateGoalieStint = async (
    stintId: string,
    data: UpdateGoalieStintData,
  ): Promise<GoalieStatRecord[] | null> => {
    if (!gameId) return null;
    setBusy(stintId);
    try {
      const { data: rows } = await axios.put<GoalieStatRecord[]>(
        `${API}/admin/games/${gameId}/goalie-stints/${stintId}`,
        data,
        { headers: authHeaders() },
      );
      queryClient.setQueryData<GoalieStatRecord[]>(queryKey, rows);
      return rows;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update goalie stint'));
      return null;
    } finally {
      setBusy(null);
    }
  };

  const removeGoalieStint = async (stintId: string): Promise<boolean> => {
    if (!gameId) return false;
    setBusy(stintId);
    try {
      const { data: rows } = await axios.delete<GoalieStatRecord[]>(
        `${API}/admin/games/${gameId}/goalie-stints/${stintId}`,
        { headers: authHeaders() },
      );
      queryClient.setQueryData<GoalieStatRecord[]>(queryKey, rows);
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to remove goalie stint'));
      return false;
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
      queryClient.setQueryData<GoalieStatRecord[]>(queryKey, (current = []) =>
        current.filter((stat) => stat.goalie_id !== goalieId),
      );
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to remove goalie stat'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  return {
    goalieStats, loading, busy,
    upsertGoalieStat, switchGoalie, removeGoalieStat,
    updateGoalieStint, removeGoalieStint,
  };
};

export default useGameGoalieStats;
