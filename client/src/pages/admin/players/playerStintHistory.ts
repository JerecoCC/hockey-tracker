import type { PlayerStintRecord } from '@/hooks/useTeamPlayers';

export type TeamHistoryStint = PlayerStintRecord & {
  collapsed_stints: PlayerStintRecord[];
};

export const collapseSameTeamStints = (stints: PlayerStintRecord[]): TeamHistoryStint[] => {
  const groups: PlayerStintRecord[][] = [];

  for (const stint of stints) {
    const currentGroup = groups[groups.length - 1];
    if (currentGroup?.[0]?.team_id === stint.team_id) {
      currentGroup.push(stint);
    } else {
      groups.push([stint]);
    }
  }

  return groups.map((group) => {
    const newest = group[0];
    const oldest = group[group.length - 1];

    return {
      ...newest,
      start_date: oldest.start_date ?? newest.start_date,
      end_date: newest.end_date,
      has_stats: group.some((stint) => stint.has_stats),
      can_delete: group.every((stint) => stint.can_delete !== false),
      collapsed_stints: group,
    };
  });
};
