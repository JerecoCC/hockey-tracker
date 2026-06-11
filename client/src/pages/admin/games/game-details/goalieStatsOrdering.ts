import type { GoalieStatRecord } from '@/hooks/useGameGoalieStats';
import type { GameRosterEntry } from '@/hooks/useGameRoster';
import { PERIOD } from './constants';

const PERIOD_SORT: Record<string, number> = {
  [PERIOD.FIRST]: 1,
  [PERIOD.SECOND]: 2,
  [PERIOD.THIRD]: 3,
  [PERIOD.OVERTIME]: 4,
  [PERIOD.SHOOTOUT]: 5,
};

const isGameStart = (period: string | null | undefined, time: string | null | undefined) =>
  period === PERIOD.FIRST && (!time || time === '00:00');

const clockSeconds = (time: string | null | undefined) => {
  const [minutes, seconds] = String(time ?? '00:00').split(':').map(Number);
  return (minutes || 0) * 60 + (seconds || 0);
};

const periodSort = (period: string | null | undefined) =>
  period ? (PERIOD_SORT[period] ?? Number.MAX_SAFE_INTEGER - 1) : 0;

const hasGoalieAppearance = (stat: GoalieStatRecord) =>
  !!stat.stints?.length ||
  !!stat.entered_period ||
  stat.shots_against > 0 ||
  stat.saves > 0 ||
  stat.goals_against > 0;

export const goalieStatIsStarter = (stat: GoalieStatRecord) => {
  if (stat.stints?.length) {
    return stat.stints.some((stint) => isGameStart(stint.entered_period, stint.entered_time));
  }
  return (
    hasGoalieAppearance(stat) &&
    (!stat.entered_period || isGameStart(stat.entered_period, stat.sub_time))
  );
};

const firstEntrySort = (stat: GoalieStatRecord) => {
  if (stat.stints?.length) {
    return Math.min(
      ...stat.stints.map(
        (stint) => periodSort(stint.entered_period) * 100000 + clockSeconds(stint.entered_time),
      ),
    );
  }

  if (!hasGoalieAppearance(stat)) return Number.MAX_SAFE_INTEGER;

  return periodSort(stat.entered_period) * 100000 + clockSeconds(stat.sub_time);
};

export const teamHasGoalieSwitch = (stats: GoalieStatRecord[], teamId: string) =>
  stats.filter((stat) => stat.team_id === teamId && hasGoalieAppearance(stat)).length > 1;

export const gameHasGoalieSwitch = (stats: GoalieStatRecord[]) => {
  const teamIds = new Set(stats.map((stat) => stat.team_id));
  return [...teamIds].some((teamId) => teamHasGoalieSwitch(stats, teamId));
};

export const compareGoalieStats = (
  aStat: GoalieStatRecord,
  aRoster: GameRosterEntry,
  bStat: GoalieStatRecord,
  bRoster: GameRosterEntry,
  awayTeamId: string,
) => {
  const aTeam = aRoster.team_id === awayTeamId ? 0 : 1;
  const bTeam = bRoster.team_id === awayTeamId ? 0 : 1;
  if (aTeam !== bTeam) return aTeam - bTeam;

  const aStarter = goalieStatIsStarter(aStat) ? 0 : 1;
  const bStarter = goalieStatIsStarter(bStat) ? 0 : 1;
  if (aStarter !== bStarter) return aStarter - bStarter;

  const entryDiff = firstEntrySort(aStat) - firstEntrySort(bStat);
  if (entryDiff !== 0) return entryDiff;

  return (aRoster.last_name ?? '').localeCompare(bRoster.last_name ?? '');
};
