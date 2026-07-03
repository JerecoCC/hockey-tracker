interface PlayoffScoreMetaGame {
  playoff_round?: number | null;
  playoff_round_names?: Record<string, string> | null;
  playoff_matchup_names?: Record<string, string> | null;
  bracket_slot_key?: string | null;
  game_number_in_series?: number | null;
}

export const getPlayoffScoreMetaLabel = (game: PlayoffScoreMetaGame): string | null => {
  if (game.playoff_round == null) return null;

  const matchupLabel = game.bracket_slot_key
    ? game.playoff_matchup_names?.[game.bracket_slot_key]?.trim()
    : null;
  const roundLabel =
    matchupLabel ||
    game.playoff_round_names?.[game.playoff_round] ||
    `Round ${game.playoff_round}`;

  return game.game_number_in_series != null
    ? `${roundLabel} · Game ${game.game_number_in_series}`
    : roundLabel;
};
