import type { CurrentPeriod, GameType } from '@/hooks/useGames';

// ── Period config ─────────────────────────────────────────────────────────────

export const PERIOD = {
  FIRST: '1',
  SECOND: '2',
  THIRD: '3',
  OVERTIME: 'OT',
  SHOOTOUT: 'SO',
} as const;

export const PERIOD_IDS = [PERIOD.FIRST, PERIOD.SECOND, PERIOD.THIRD] as const;
export const PERIOD_ORDER = [
  PERIOD.FIRST,
  PERIOD.SECOND,
  PERIOD.THIRD,
  PERIOD.OVERTIME,
  PERIOD.SHOOTOUT,
] as const;

export const otPeriodId = (periodNumber: number): string => `${PERIOD.OVERTIME}${periodNumber}`;

export const PERIOD_SUFFIX = {
  OVERTIME: `/${PERIOD.OVERTIME}`,
  SHOOTOUT: `/${PERIOD.SHOOTOUT}`,
} as const;

export const PERIOD_PAREN_SUFFIX = {
  OVERTIME: `(${PERIOD.OVERTIME})`,
  SHOOTOUT: `(${PERIOD.SHOOTOUT})`,
} as const;

export const PERIODS: { num: number; label: string; periodId: CurrentPeriod }[] = [
  { num: 1, label: '1st Period', periodId: PERIOD.FIRST },
  { num: 2, label: '2nd Period', periodId: PERIOD.SECOND },
  { num: 3, label: '3rd Period', periodId: PERIOD.THIRD },
];

export const PERIOD_TITLE_LABEL: Record<string, string> = {
  [PERIOD.FIRST]: '1st Period',
  [PERIOD.SECOND]: '2nd Period',
  [PERIOD.THIRD]: '3rd Period',
  [PERIOD.OVERTIME]: 'Overtime',
  [PERIOD.SHOOTOUT]: 'Shootout',
};

// ── Label maps ────────────────────────────────────────────────────────────────

export const GAME_TYPE_LABEL: Record<GameType, string> = {
  preseason: 'Preseason',
  regular: 'Regular Season',
  playoff: 'Playoffs',
};

export const POSITION_LABEL: Record<string, string> = {
  C: 'Center',
  LW: 'Left Wing',
  RW: 'Right Wing',
  F: 'Forward',
  D: 'Defense',
  LD: 'Left Defense',
  RD: 'Right Defense',
  D1: 'Left Defense',
  D2: 'Right Defense',
  G: 'Goalie',
};

/** Goal type → { abbreviation, badge intent }. Even-strength returns null (no badge). */
export const GOAL_TYPE_BADGE: Record<
  string,
  {
    label: string;
    tooltip: string;
    intent: 'info' | 'warning' | 'neutral' | 'success' | 'danger';
  } | null
> = {
  'even-strength': null,
  'power-play': { label: 'PP', tooltip: 'Power Play', intent: 'info' },
  shorthanded: { label: 'SH', tooltip: 'Shorthanded', intent: 'warning' },
  'empty-net': { label: 'EN', tooltip: 'Empty Net', intent: 'neutral' },
  'penalty-shot': { label: 'PS', tooltip: 'Penalty Shot', intent: 'success' },
  'awarded': { label: 'AWD', tooltip: 'Awarded Goal', intent: 'success' },
  own: { label: 'OG', tooltip: 'Own Goal', intent: 'danger' },
};
