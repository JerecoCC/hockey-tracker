import type { CurrentPeriod, GameType, LastFiveGame } from '@/hooks/useGames';

// ── Formatters ────────────────────────────────────────────────────────────────

export const DATE_FMT_SHORT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

/** Formats an ISO timestamp as "7:05 PM" (ET). */
export const TIME_FMT = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/New_York',
});

/** Converts a stored "HH:MM" 24-hour string to "h:mm AM/PM". */
export const formatScheduledTime = (t: string): string => {
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${suffix}`;
};

/**
 * Format a player name for goal/assist display.
 * Result: "C. McDavid"  (or "McDavid" when no first name)
 */
export const formatPlayerName = (firstName: string | null, lastName: string | null): string => {
  if (!lastName) return '';
  const initial = firstName ? `${firstName.charAt(0)}. ` : '';
  return `${initial}${lastName}`;
};

/**
 * Compute W-OTW-OTL-L form record counts from a last-five array.
 * Wins/losses in overtime or shootout count as OTW/OTL; all others are regulation W/L.
 */
export const buildFormRecord = (games: LastFiveGame[]) => {
  let w = 0,
    otw = 0,
    otl = 0,
    l = 0;
  for (const g of games) {
    const isExtra = (g.overtime_periods != null && g.overtime_periods > 0) || g.shootout;
    if (g.result === 'W') {
      isExtra ? otw++ : w++;
    } else if (g.result === 'L') {
      isExtra ? otl++ : l++;
    }
  }
  return { w, otw, otl, l };
};

// ── Period config ─────────────────────────────────────────────────────────────

export const PERIOD_IDS = ['1', '2', '3'] as const;

export const PERIODS: { num: number; label: string; periodId: CurrentPeriod }[] = [
  { num: 1, label: '1st Period', periodId: '1' },
  { num: 2, label: '2nd Period', periodId: '2' },
  { num: 3, label: '3rd Period', periodId: '3' },
];

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
  D: 'Defense',
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
  own: { label: 'OG', tooltip: 'Own Goal', intent: 'danger' },
};
