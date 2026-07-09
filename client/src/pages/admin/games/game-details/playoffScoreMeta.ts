interface PlayoffScoreMetaGame {
  playoff_round?: number | null;
  playoff_round_names?: Record<string, string> | null;
  playoff_matchup_names?: Record<string, string> | null;
  bracket_slot_key?: string | null;
  game_number_in_series?: number | null;
}

type PlayoffScoreMetaBaseLabel = {
  label: string;
  isCustom: boolean;
};

export type PlayoffScoreMetaDisplay = {
  label: string;
  tooltip: string | null;
};

const labelWithGameNumber = (label: string, gameNumber?: number | null) =>
  gameNumber != null ? `${label} · Game ${gameNumber}` : label;

const initialsForLabel = (label: string) => {
  const initials = label.match(/[A-Za-z0-9]+/g)?.map((part) => part[0]?.toUpperCase()).join('');
  return initials || label;
};

const getPlayoffScoreMetaBaseLabelInfo = (
  game: PlayoffScoreMetaGame,
): PlayoffScoreMetaBaseLabel | null => {
  if (game.playoff_round == null) return null;

  const matchupLabel = game.bracket_slot_key
    ? game.playoff_matchup_names?.[game.bracket_slot_key]?.trim()
    : null;
  if (matchupLabel) return { label: matchupLabel, isCustom: true };

  const roundLabel = game.playoff_round_names?.[game.playoff_round]?.trim();
  if (roundLabel) return { label: roundLabel, isCustom: true };

  return { label: `Round ${game.playoff_round}`, isCustom: false };
};

export const getPlayoffScoreMetaBaseLabel = (game: PlayoffScoreMetaGame): string | null => {
  return getPlayoffScoreMetaBaseLabelInfo(game)?.label ?? null;
};

export const getPlayoffScoreMetaLabel = (game: PlayoffScoreMetaGame): string | null => {
  const roundLabel = getPlayoffScoreMetaBaseLabel(game);
  if (!roundLabel) return null;

  return labelWithGameNumber(roundLabel, game.game_number_in_series);
};

export const getPlayoffScoreMetaDisplay = (
  game: PlayoffScoreMetaGame,
): PlayoffScoreMetaDisplay | null => {
  const baseLabel = getPlayoffScoreMetaBaseLabelInfo(game);
  if (!baseLabel) return null;

  const displayBaseLabel = baseLabel.isCustom ? initialsForLabel(baseLabel.label) : baseLabel.label;
  return {
    label: labelWithGameNumber(displayBaseLabel, game.game_number_in_series),
    tooltip: baseLabel.isCustom
      ? labelWithGameNumber(baseLabel.label, game.game_number_in_series)
      : null,
  };
};
