import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import { type PlayoffFormatRule } from './useLeagues';

import { API, authHeaders, getApiErrorMessage as apiError } from '@/lib/apiClient';



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
  qualification_format_id: string | null;
  qualification_format_name?: string | null;
  qualification_rules?: PlayoffFormatRule[] | null;
  /** Custom display labels keyed by round number string, e.g. { "1": "Wild Card", "4": "Final" }. Null = use default labels. */
  round_names: Record<string, string> | null;
  /** Optional display labels keyed by matchup slot, e.g. { "r3m0": "Eastern Conference Final" }. Null = use round labels. */
  matchup_names?: Record<string, string> | null;
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
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['bracket-rule-sets', leagueId] }),
      queryClient.invalidateQueries({ queryKey: ['season'] }),
      queryClient.invalidateQueries({ queryKey: ['seasons'] }),
    ]);

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
    round_names?: Record<string, string> | null,
    matchup_names?: Record<string, string> | null,
    qualification_format_id?: string | null,
  ): Promise<BracketRuleSet | null> => {
    try {
      const { data } = await axios.post<BracketRuleSet>(
        `${API}/admin/bracket-rule-sets`,
        {
          league_id: leagueId,
          name,
          slots,
          round_names: round_names ?? null,
          matchup_names: matchup_names ?? null,
          qualification_format_id: qualification_format_id ?? null,
        },
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
    round_names?: Record<string, string> | null,
    matchup_names?: Record<string, string> | null,
    qualification_format_id?: string | null,
  ): Promise<boolean> => {
    try {
      const ruleSetPayload: {
        name: string;
        round_names: Record<string, string> | null;
        matchup_names: Record<string, string> | null;
        qualification_format_id?: string | null;
      } = {
        name,
        round_names: round_names ?? null,
        matchup_names: matchup_names ?? null,
      };
      if (qualification_format_id !== undefined) {
        ruleSetPayload.qualification_format_id = qualification_format_id;
      }
      await Promise.all([
        axios.patch(
          `${API}/admin/bracket-rule-sets/${id}`,
          ruleSetPayload,
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
