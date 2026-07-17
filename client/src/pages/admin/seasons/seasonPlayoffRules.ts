import type { BracketSlotRule } from '@/hooks/useBracketRuleSets';
import type { SeasonGroupRecord } from '@/hooks/useSeasonDetails';

export const canonicalSlotKey = (key: string | null | undefined): string | null => {
  if (!key) return null;
  return key.replace(/away$/, 'team1').replace(/home$/, 'team2');
};

export const normalizeBracketSlotRule = (slot: BracketSlotRule): BracketSlotRule => ({
  ...slot,
  slot_key: canonicalSlotKey(slot.slot_key) ?? slot.slot_key,
  choice_ref: canonicalSlotKey(slot.choice_ref),
  matchup_ref: slot.matchup_ref
    ? (canonicalSlotKey(slot.matchup_ref) ?? slot.matchup_ref)
    : null,
});

export const getSeasonGroupTeamIds = (
  groups: SeasonGroupRecord[],
  groupId: string,
): Set<string> => {
  const ids = new Set<string>();
  const groupMatches = (group: SeasonGroupRecord, id: string) =>
    group.id === id || group.stable_key === `legacy:${id}`;
  const collect = (id: string) => {
    const group = groups.find((candidate) => groupMatches(candidate, id));
    if (!group) return;
    group.teams.forEach((team) => ids.add(team.id));
    groups
      .filter((candidate) => candidate.parent_id === group.id)
      .forEach((child) => collect(child.id));
  };
  collect(groupId);
  return ids;
};
