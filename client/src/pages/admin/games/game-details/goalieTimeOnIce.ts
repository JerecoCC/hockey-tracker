import { type GameRecord } from '@/hooks/useGames';
import { type GoalieStintRecord } from '@/hooks/useGameGoalieStats';
import { PERIOD } from './constants';

// Elapsed-game-seconds offset at the start of each period.
const PERIOD_OFFSET: Record<string, number> = {
  [PERIOD.FIRST]: 0,
  [PERIOD.SECOND]: 1200,
  [PERIOD.THIRD]: 2400,
  [PERIOD.OVERTIME]: 3600,
  [PERIOD.SHOOTOUT]: 6000,
};

export const mmssToSeconds = (t?: string | null): number => {
  if (!t) return 0;
  const [m, s] = t.split(':').map((n) => parseInt(n, 10));
  return (Number.isFinite(m) ? m : 0) * 60 + (Number.isFinite(s) ? s : 0);
};

export const secondsToMMSS = (sec: number): string =>
  `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

export const TOI_RE = /^\d{1,3}:[0-5]\d$/;

/** Parse an MM:SS string to seconds, or null if not a valid MM:SS value. */
export const parseToiInput = (value: string): number | null => {
  const v = value.trim();
  if (!TOI_RE.test(v)) return null;
  const [m, s] = v.split(':').map((n) => parseInt(n, 10));
  return m * 60 + s;
};

/**
 * Default ice time for a stint when none has been entered: derive it from the
 * stint's enter/exit clock. An open stint (no exit) defaults to the full game —
 * 65:00 if it reached a shootout, otherwise 60:00 (admin adjusts for pulls).
 */
export const defaultStintToi = (st: GoalieStintRecord, game: GameRecord): number => {
  const start = (PERIOD_OFFSET[st.entered_period] ?? 0) + mmssToSeconds(st.entered_time);
  const end =
    st.exited_period != null
      ? (PERIOD_OFFSET[st.exited_period] ?? 0) + mmssToSeconds(st.exited_time)
      : game.shootout
        ? 3900
        : 3600;
  return Math.max(end - start, 0);
};
