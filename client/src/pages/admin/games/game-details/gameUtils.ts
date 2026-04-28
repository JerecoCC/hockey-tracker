import type { LastFiveGame } from '@/hooks/useGames';

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
