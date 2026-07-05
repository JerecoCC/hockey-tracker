interface AutofillGame {
  id: string;
}

export const partitionAutofillingGames = <T extends AutofillGame>(
  games: readonly T[],
  autofillingGameIds: ReadonlySet<string>,
) => {
  const revealedGames: T[] = [];
  const loadingGames: T[] = [];

  for (const game of games) {
    if (autofillingGameIds.has(game.id)) {
      loadingGames.push(game);
    } else {
      revealedGames.push(game);
    }
  }

  return { revealedGames, loadingGames };
};
