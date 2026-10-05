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

interface StatusGame {
  status: string;
}

// Day auto-fill only fills games that aren't final yet; final games keep their recorded result.
export const isDayAutofillStatus = (status: string) =>
  status === 'scheduled' || status === 'in_progress';

// Hiding a day's scores is only offered, and only applies, when the day has a final game.
export const hasFinalGame = (games: readonly StatusGame[]) =>
  games.some((game) => game.status === 'final');
