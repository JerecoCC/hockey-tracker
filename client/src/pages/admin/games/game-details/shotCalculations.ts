import type { GoalieStatRecord } from '@/hooks/useGameGoalieStats';
import type { GoalRecord } from '@/hooks/useGameGoals';
import type { GameRosterEntry } from '@/hooks/useGameRoster';
import type { GameRecord } from '@/hooks/useGames';
import { shotPeriodOrdinal } from './shotPeriods';

/** Computes a goalie's expected shots against from periods played. */
export const computeAutoSA = (
  goalie: GameRosterEntry,
  goalieStats: GoalieStatRecord[],
  game: GameRecord,
  periodShots: { period: string; home_shots: number; away_shots: number }[],
  goals: GoalRecord[],
): string => {
  const isAway = goalie.team_id === game.away_team.id;
  const opposingTeamId = isAway ? game.home_team.id : game.away_team.id;
  const thisStat = goalieStats.find((stat) => stat.goalie_id === goalie.player_id);
  const stints = thisStat?.stints;
  let playedPeriod: (period: string) => boolean;

  if (stints && stints.length > 0) {
    playedPeriod = (period) => {
      const periodOrd = shotPeriodOrdinal(period);
      if (periodOrd == null) return false;

      return stints.some((stint) => {
        const enteredOrd = shotPeriodOrdinal(stint.entered_period);
        const exitedOrd =
          stint.exited_period != null ? shotPeriodOrdinal(stint.exited_period) : null;
        if (enteredOrd == null) return false;
        return periodOrd >= enteredOrd && (exitedOrd == null || periodOrd < exitedOrd);
      });
    };
  } else {
    const enteredPeriod = thisStat?.entered_period ?? null;
    const substituteStat = goalieStats.find(
      (stat) =>
        stat.team_id === goalie.team_id &&
        stat.goalie_id !== goalie.player_id &&
        stat.entered_period !== null,
    );
    playedPeriod = (period) => {
      const periodOrd = shotPeriodOrdinal(period);
      if (periodOrd == null) return false;

      if (enteredPeriod !== null) {
        const enteredOrd = shotPeriodOrdinal(enteredPeriod);
        return enteredOrd != null && periodOrd >= enteredOrd;
      }

      if (substituteStat) {
        const substituteOrd = shotPeriodOrdinal(substituteStat.entered_period!);
        return substituteOrd != null && periodOrd < substituteOrd;
      }

      return true;
    };
  }

  const totalOpposingShots = periodShots
    .filter((period) => playedPeriod(period.period))
    .reduce((sum, period) => sum + (isAway ? period.home_shots : period.away_shots), 0);
  const emptyNetGoals = goals.filter(
    (goal) =>
      goal.team_id === opposingTeamId && goal.empty_net && playedPeriod(goal.period),
  ).length;

  return String(Math.max(0, totalOpposingShots - emptyNetGoals));
};
