import type { TagIntent } from '@jerecocc/tracker-ui/components/Tag/Tag';
import type { GameRecord, GameStatus } from '@/hooks/useGames';

export const GAME_STATUS_TAG_INTENT = {
  scheduled: 'neutral',
  in_progress: 'info',
  final: 'success',
  postponed: 'warning',
} satisfies Record<GameStatus, TagIntent>;

export const getOvertimeSuffix = (game: GameRecord): '' | '/OT' | '/SO' => {
  if (game.shootout || game.period_scores.some((period) => period.period === 'SO')) return '/SO';
  if (
    (game.overtime_periods ?? 0) > 0 ||
    game.period_scores.some((period) => period.period === 'OT')
  ) {
    return '/OT';
  }
  return '';
};

export const getScoreCardGame = (game: GameRecord): GameRecord => ({
  ...game,
  series_home_wins: game.series_home_wins_at_game ?? null,
  series_away_wins: game.series_away_wins_at_game ?? null,
});

export const canMarkGameWatched = (game: GameRecord): boolean => game.status === 'final';

export const getGameMatchupLabel = (game: GameRecord): string =>
  `${game.away_team.code} @ ${game.home_team.code}`;
