import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-toastify';

const API = import.meta.env.VITE_API_URL || '/api';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

const apiError = (err: unknown, fallback: string): string =>
  (err as AxiosError<{ error: string }>).response?.data?.error ?? fallback;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BracketSlotRule {
  slot_key: string;
  rule_type: 'seed' | 'choice' | 'unchosen' | 'winner';
  rank: number | null;
  scope: 'league' | 'conference' | 'division' | 'specific_conference' | 'specific_division' | null;
  group_id: string | null;
  pool: Array<{ rank: number; scope: string; group_id?: string | null }>;
  choice_ref: string | null;
  matchup_ref: string | null;
}

export interface BracketRuleSet {
  id: string;
  league_id: string;
  name: string;
  created_at: string;
  slots: BracketSlotRule[];
}

export interface SaveSlotsPayload {
  slot_key: string;
  rule_type: string;
  rank?: number | null;
  scope?: string | null;
  group_id?: string | null;
  pool?: Array<{ rank: number; scope: string; group_id?: string | null }>;
  choice_ref?: string | null;
  matchup_ref?: string | null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

const useBracketRuleSets = (leagueId: string | undefined) => {
  const queryClient = useQueryClient();

  // List all rule sets for this league
  const { data: ruleSets = [], isLoading: loading } = useQuery<BracketRuleSet[]>({
    queryKey: ['bracket-rule-sets', leagueId],
    queryFn: async () => {
      try {
        const { data } = await axios.get<BracketRuleSet[]>(
          `${API}/admin/bracket-rule-sets`,
          { headers: authHeaders(), params: { league_id: leagueId } },
        );
        return data;
      } catch (err) {
        toast.error(apiError(err, 'Failed to load bracket rule sets'));
        return [];
      }
    },
    enabled: !!leagueId,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['bracket-rule-sets', leagueId] });

  /** Fetch a single rule set (with slots) by id. */
  const fetchRuleSet = async (id: string): Promise<BracketRuleSet | null> => {
    try {
      const { data } = await axios.get<BracketRuleSet>(
        `${API}/admin/bracket-rule-sets/${id}`,
        { headers: authHeaders() },
      );
      return data;
    } catch (err) {
      toast.error(apiError(err, 'Failed to load bracket rule set'));
      return null;
    }
  };

  /** Create a new rule set and return its id, or null on failure. */
  const createRuleSet = async (
    name: string,
    slots: SaveSlotsPayload[],
  ): Promise<BracketRuleSet | null> => {
    try {
      const { data } = await axios.post<BracketRuleSet>(
        `${API}/admin/bracket-rule-sets`,
        { league_id: leagueId, name, slots },
        { headers: authHeaders() },
      );
      await invalidate();
      return data;
    } catch (err) {
      toast.error(apiError(err, 'Failed to save bracket rules'));
      return null;
    }
  };

  /** Replace all slots for an existing rule set. */
  const updateSlots = async (
    id: string,
    name: string,
    slots: SaveSlotsPayload[],
  ): Promise<boolean> => {
    try {
      await Promise.all([
        axios.patch(
          `${API}/admin/bracket-rule-sets/${id}`,
          { name },
          { headers: authHeaders() },
        ),
        axios.put(
          `${API}/admin/bracket-rule-sets/${id}/slots`,
          { slots },
          { headers: authHeaders() },
        ),
      ]);
      await invalidate();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update bracket rules'));
      return false;
    }
  };

  /** Delete a rule set by id. */
  const deleteRuleSet = async (id: string): Promise<boolean> => {
    try {
      await axios.delete(`${API}/admin/bracket-rule-sets/${id}`, { headers: authHeaders() });
      await invalidate();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete bracket rule set'));
      return false;
    }
  };

  return { ruleSets, loading, fetchRuleSet, createRuleSet, updateSlots, deleteRuleSet };
};

export default useBracketRuleSets;
