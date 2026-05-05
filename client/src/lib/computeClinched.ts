import type { PlayoffFormatRule } from '@/hooks/useLeagues';
import type { TeamStandingRecord } from '@/hooks/useSeasonStandings';
import type { SeasonGroupRecord } from '@/hooks/useSeasonDetails';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Recursively collect all team IDs in a group and its descendant groups. */
function getGroupTeamIds(groupId: string, groups: SeasonGroupRecord[]): Set<string> {
  const ids = new Set<string>();
  const collect = (gid: string) => {
    const group = groups.find((g) => g.id === gid);
    if (!group) return;
    group.teams.forEach((t) => ids.add(t.id));
    groups.filter((g) => g.parent_id === gid).forEach((child) => collect(child.id));
  };
  collect(groupId);
  return ids;
}

/** Maximum possible points a team can still earn (pessimistic: assumes they win everything). */
function maxPossible(team: TeamStandingRecord, maxPtsPerGame: number): number {
  return team.points + (team.games_remaining ?? 0) * maxPtsPerGame;
}

// ── Main function ──────────────────────────────────────────────────────────────

/**
 * Returns the set of team IDs that have mathematically clinched a playoff spot.
 *
 * Uses the magic-number approach: a team has clinched when its current points
 * exceed the maximum points the first team outside the bubble can possibly reach,
 * even if that team wins every remaining game in the most favourable way.
 *
 * This is a conservative check — clinching is always correct but may lag the
 * earliest possible clinching moment by a game or two in complex wildcard races.
 *
 * @param standings     Season standings sorted by points desc (as returned by the API).
 * @param playoffFormat Ordered list of qualification rules from the league/season config.
 * @param groups        Season groups (conferences and divisions with their team lists).
 * @param scoringSystem Active scoring system: '2-1-0' or '3-2-1-0'.
 */
export function computeClinched(
  standings: TeamStandingRecord[],
  playoffFormat: PlayoffFormatRule[] | null,
  groups: SeasonGroupRecord[],
  scoringSystem: '2-1-0' | '3-2-1-0',
): Set<string> {
  if (!playoffFormat || playoffFormat.length === 0) return new Set();
  if (standings.length === 0) return new Set();

  const maxPts = scoringSystem === '3-2-1-0' ? 3 : 2;
  const clinched = new Set<string>();
  // Tracks teams already claimed by an earlier rule so later rules (wildcards) skip them.
  const claimed = new Set<string>();

  for (const rule of playoffFormat) {
    if (rule.scope === 'league') {
      // ── Whole-league pool ──────────────────────────────────────────────────
      const eligible = standings.filter((t) => !claimed.has(t.team_id));
      const qualifiers = eligible.slice(0, rule.count);
      const firstOut = eligible[rule.count] ?? null;

      for (const team of qualifiers) {
        if (firstOut === null || team.points > maxPossible(firstOut, maxPts)) {
          clinched.add(team.team_id);
        }
        claimed.add(team.team_id);
      }
    } else if (rule.scope === 'division') {
      // ── Per-division pool ──────────────────────────────────────────────────
      const divisionGroups = groups.filter((g) => g.role === 'division');
      for (const div of divisionGroups) {
        const divIds = getGroupTeamIds(div.id, groups);
        const eligible = standings.filter(
          (t) => divIds.has(t.team_id) && !claimed.has(t.team_id),
        );
        const qualifiers = eligible.slice(0, rule.count);
        const firstOut = eligible[rule.count] ?? null;

        for (const team of qualifiers) {
          if (firstOut === null || team.points > maxPossible(firstOut, maxPts)) {
            clinched.add(team.team_id);
          }
          claimed.add(team.team_id);
        }
      }
    } else if (rule.scope === 'conference') {
      // ── Per-conference pool ────────────────────────────────────────────────
      const conferenceGroups = groups.filter((g) => g.role === 'conference');
      for (const conf of conferenceGroups) {
        const confIds = getGroupTeamIds(conf.id, groups);
        const eligible = standings.filter(
          (t) => confIds.has(t.team_id) && !claimed.has(t.team_id),
        );
        const qualifiers = eligible.slice(0, rule.count);
        const firstOut = eligible[rule.count] ?? null;

        for (const team of qualifiers) {
          if (firstOut === null || team.points > maxPossible(firstOut, maxPts)) {
            clinched.add(team.team_id);
          }
          claimed.add(team.team_id);
        }
      }
    }
  }

  return clinched;
}
