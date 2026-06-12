/* eslint-disable @typescript-eslint/no-unused-expressions */
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

export const lastFiveOpponentLogo = (
  game: Pick<
    LastFiveGame,
    'is_home' | 'opponent_logo' | 'opponent_logo_dark' | 'opponent_logo_light'
  >,
) => {
  if (!game.is_home) {
    return game.opponent_logo_light ?? game.opponent_logo ?? game.opponent_logo_dark ?? null;
  }
  return game.opponent_logo ?? game.opponent_logo_dark ?? game.opponent_logo_light ?? null;
};

export const playerDataComplete = (
  dateOfBirth: string | null,
  startDate: string | null,
  acquisitionType: string | null,
  isAdmin: boolean,
) => {
  if (!isAdmin) return '';

  let emoji: string = '';
  if (dateOfBirth && startDate && acquisitionType) {
    emoji = ' ✅';
  } else {
    if (dateOfBirth) {
      emoji += ' 📝';
    }
    if (startDate) {
      emoji += ' 🕰️';
    }
    if (acquisitionType) {
      emoji += ' 🤝🏼';
    }
  }
  return emoji;
};
