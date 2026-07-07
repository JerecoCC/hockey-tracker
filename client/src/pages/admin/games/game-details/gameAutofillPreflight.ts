import type { GameRecord, GameType } from '@/hooks/useGames';

type AutofillGameNumber = number | null | undefined;

export interface AutofillOfficialGameMeta {
  leagueLabel: string;
  gameType?: GameType | null;
  regularGameNumber?: AutofillGameNumber;
  playoffRound?: AutofillGameNumber;
  playoffGameNumberInSeries?: AutofillGameNumber;
}

const GAME_TYPE_LABEL: Record<GameType, string> = {
  preseason: 'preseason',
  regular: 'regular season',
  playoff: 'playoff',
};

export function validateAutofillGamePreflight(
  game: GameRecord,
  seasonGames: GameRecord[],
  official: AutofillOfficialGameMeta,
) {
  const allGames = mergeCurrentGame(game, seasonGames);
  const currentGame = allGames.find((row) => row.id === game.id) ?? game;

  assertOfficialGameMatchesLocalGame(currentGame, official);

  if (currentGame.game_type === 'playoff') {
    assertPlayoffGameIsValid(currentGame, allGames);
  }

  if (currentGame.game_type === 'regular' || currentGame.game_type === 'playoff') {
    assertNoEarlierNonFinalGames(currentGame, allGames);
  }
}

function mergeCurrentGame(game: GameRecord, seasonGames: GameRecord[]) {
  const rows = new Map<string, GameRecord>();
  seasonGames.forEach((row) => rows.set(row.id, row));
  const existing = rows.get(game.id);
  rows.set(game.id, existing ? { ...existing, ...game } : game);
  return Array.from(rows.values());
}

function assertOfficialGameMatchesLocalGame(
  game: GameRecord,
  official: AutofillOfficialGameMeta,
) {
  if (official.gameType && official.gameType !== game.game_type) {
    throw new Error(
      `${official.leagueLabel} game is a ${GAME_TYPE_LABEL[official.gameType]} game, but this page is a ${GAME_TYPE_LABEL[game.game_type]} game.`,
    );
  }

  if (
    game.game_type === 'regular' &&
    official.regularGameNumber != null &&
    game.game_number != null &&
    game.game_number !== official.regularGameNumber
  ) {
    throw new Error(
      `${official.leagueLabel} game number ${official.regularGameNumber} does not match local regular season game ${game.game_number}.`,
    );
  }

  if (game.game_type !== 'playoff') return;

  if (!game.playoff_series_id) {
    throw new Error('This playoff game is not linked to a playoff series, so it cannot be auto-filled.');
  }

  if (game.playoff_round == null) {
    throw new Error('This playoff game is missing its playoff round, so it cannot be auto-filled.');
  }

  if (game.game_number_in_series == null) {
    throw new Error('This playoff game is missing its game number in the series, so it cannot be auto-filled.');
  }

  if (
    official.playoffRound != null &&
    game.playoff_round !== official.playoffRound
  ) {
    throw new Error(
      `${official.leagueLabel} playoff game is from round ${official.playoffRound}, but this page is round ${game.playoff_round}.`,
    );
  }

  if (
    official.playoffGameNumberInSeries != null &&
    game.game_number_in_series !== official.playoffGameNumberInSeries
  ) {
    throw new Error(
      `${official.leagueLabel} playoff game is Game ${official.playoffGameNumberInSeries}, but this page is Game ${game.game_number_in_series}.`,
    );
  }
}

function assertPlayoffGameIsValid(game: GameRecord, seasonGames: GameRecord[]) {
  const seriesGames = seasonGames.filter(
    (row) => row.playoff_series_id === game.playoff_series_id,
  );
  const gameNumber = game.game_number_in_series;

  if (gameNumber == null) return;

  const duplicate = seriesGames.find(
    (row) => row.id !== game.id && row.game_number_in_series === gameNumber,
  );
  if (duplicate) {
    throw new Error(`Another playoff game in this series is already marked as Game ${gameNumber}.`);
  }

  if (
    game.series_games_to_win != null &&
    gameNumber > game.series_games_to_win * 2 - 1
  ) {
    throw new Error(
      `This playoff series can have at most Game ${game.series_games_to_win * 2 - 1}, but this page is Game ${gameNumber}.`,
    );
  }

  for (let expected = 1; expected < gameNumber; expected += 1) {
    if (!seriesGames.some((row) => row.game_number_in_series === expected)) {
      throw new Error(
        `Cannot auto-fill playoff Game ${gameNumber} because Game ${expected} is missing from this series.`,
      );
    }
  }
}

function assertNoEarlierNonFinalGames(game: GameRecord, seasonGames: GameRecord[]) {
  const teams = new Set([game.home_team.id, game.away_team.id]);
  const blocker = seasonGames.find((row) => (
    row.id !== game.id &&
    row.season_id === game.season_id &&
    row.game_type === game.game_type &&
    row.status !== 'final' &&
    gameIncludesAnyTeam(row, teams) &&
    isBeforeCurrentGame(row, game)
  ));

  if (!blocker) return;

  throw new Error(
    `Cannot auto-fill this game yet because ${gameLabel(blocker)} is not final. Finish earlier games for these teams first.`,
  );
}

function gameIncludesAnyTeam(game: GameRecord, teamIds: Set<string>) {
  return teamIds.has(game.home_team.id) || teamIds.has(game.away_team.id);
}

function isBeforeCurrentGame(candidate: GameRecord, current: GameRecord) {
  if (current.game_type === 'playoff') {
    const candidateRound = positiveNumber(candidate.playoff_round);
    const currentRound = positiveNumber(current.playoff_round);
    if (candidateRound != null && currentRound != null && candidateRound !== currentRound) {
      return candidateRound < currentRound;
    }

    if (
      candidate.playoff_series_id &&
      candidate.playoff_series_id === current.playoff_series_id
    ) {
      const candidateSeriesGame = positiveNumber(candidate.game_number_in_series);
      const currentSeriesGame = positiveNumber(current.game_number_in_series);
      if (candidateSeriesGame != null && currentSeriesGame != null) {
        return candidateSeriesGame < currentSeriesGame;
      }
    }
  }

  if (current.game_type === 'regular') {
    const candidateNumber = positiveNumber(candidate.game_number);
    const currentNumber = positiveNumber(current.game_number);
    if (candidateNumber != null && currentNumber != null) {
      return candidateNumber < currentNumber;
    }
  }

  const candidateTime = gameTime(candidate);
  const currentTime = gameTime(current);
  return candidateTime != null && currentTime != null && candidateTime < currentTime;
}

function gameTime(game: GameRecord) {
  if (!game.scheduled_at) return null;
  const time = Date.parse(game.scheduled_at);
  return Number.isFinite(time) ? time : null;
}

function positiveNumber(value: AutofillGameNumber) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function gameLabel(game: GameRecord) {
  const matchup = `${game.away_team.code} @ ${game.home_team.code}`;
  const date = game.scheduled_at?.slice(0, 10);

  if (game.game_type === 'playoff') {
    const round = game.playoff_round != null ? `Round ${game.playoff_round}` : 'playoff';
    const gameNumber = game.game_number_in_series != null
      ? `Game ${game.game_number_in_series}`
      : 'game';
    return [date, round, gameNumber, matchup].filter(Boolean).join(' ');
  }

  const gameNumber = game.game_number != null ? `Game ${game.game_number}` : null;
  return [date, gameNumber, matchup].filter(Boolean).join(' ');
}
