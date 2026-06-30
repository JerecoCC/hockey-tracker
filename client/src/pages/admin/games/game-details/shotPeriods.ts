import { PERIOD } from './constants';

type PeriodShotRow = {
  period: string;
  home_shots: number;
  away_shots: number;
};

type VisibleShotPeriod = {
  id: string;
};

type ShotSide = 'away' | 'home';

export const shotPeriodOrdinal = (period: string): number | null => {
  if (period === PERIOD.FIRST) return 1;
  if (period === PERIOD.SECOND) return 2;
  if (period === PERIOD.THIRD) return 3;
  if (period === PERIOD.OVERTIME) return 4;

  const overtimeMatch = /^OT([1-9][0-9]*)$/.exec(period);
  if (overtimeMatch) return 3 + Number(overtimeMatch[1]);

  return null;
};

export const sumVisiblePeriodShots = (
  visiblePeriods: VisibleShotPeriod[],
  periodShots: PeriodShotRow[],
  side: ShotSide,
): number =>
  visiblePeriods.reduce((sum, period) => {
    const shotRow = periodShots.find((row) => row.period === period.id);
    if (!shotRow) return sum;
    return sum + (side === 'away' ? shotRow.away_shots : shotRow.home_shots);
  }, 0);
