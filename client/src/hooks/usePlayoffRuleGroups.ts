import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import axios from 'axios';

import { API, authHeaders } from '@/lib/apiClient';
import useGroupAlignmentSets, { type GroupAlignmentSet } from './useGroupAlignmentSets';
import useLeagueGroups from './useLeagueGroups';

export interface PlayoffRuleGroup {
  id: string;
  name: string;
  role: 'conference' | 'division' | null;
}

/**
 * Conferences and divisions a league's bracket rules can target. Seasons resolve groups from
 * their alignment set, so alignment-set groups are offered alongside the league's own groups.
 * Alignment groups migrated from a league group (stable_key "legacy:<id>") are skipped: seasons
 * match them by that legacy id, so the league group already covers them.
 */
const usePlayoffRuleGroups = (leagueId: string | undefined) => {
  const { groups: leagueGroups } = useLeagueGroups(leagueId);
  const { alignmentSets } = useGroupAlignmentSets(leagueId);

  const alignmentSetQueries = useQueries({
    queries: alignmentSets.map((set) => ({
      queryKey: ['group-alignment-set', set.id],
      queryFn: async () => {
        const { data } = await axios.get<GroupAlignmentSet>(
          `${API}/admin/group-alignment-sets/${set.id}`,
          { headers: authHeaders() },
        );
        return data;
      },
    })),
  });
  const alignmentSetDetails = alignmentSetQueries.map((query) => query.data);
  const alignmentSetsLoadedKey = alignmentSetQueries.map((query) => query.dataUpdatedAt).join();

  return useMemo(() => {
    const legacyIds = new Set(leagueGroups.map((group) => group.id));
    const entries: Array<PlayoffRuleGroup & { setName: string | null }> = leagueGroups.map(
      (group) => ({ id: group.id, name: group.name, role: group.role, setName: null }),
    );
    for (const set of alignmentSetDetails) {
      for (const group of set?.groups ?? []) {
        const legacyId = group.stable_key?.startsWith('legacy:')
          ? group.stable_key.slice('legacy:'.length)
          : null;
        if (legacyId && legacyIds.has(legacyId)) continue;
        entries.push({ id: group.id, name: group.name, role: group.role, setName: set!.name });
      }
    }

    const nameCounts = new Map<string, number>();
    entries.forEach((entry) =>
      nameCounts.set(entry.name, (nameCounts.get(entry.name) ?? 0) + 1),
    );
    return entries.map(({ setName, ...group }) => ({
      ...group,
      name:
        setName && (nameCounts.get(group.name) ?? 0) > 1 ? `${group.name} (${setName})` : group.name,
    }));
    // alignmentSetDetails is a new array every render; key the memo on when each set loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueGroups, alignmentSetsLoadedKey]);
};

export default usePlayoffRuleGroups;
