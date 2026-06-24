export type AwardWinnerMode = 'single' | 'multiple' | 'team_selection';
export type AwardSelectionSource = 'manual' | 'voted' | 'automatic';
export type AwardCompetitionScope = 'regular_season' | 'playoffs' | 'full_season';
export type AwardRecordingGate = 'anytime' | 'after_playoffs_start';

export interface AwardDefinitionMetadata {
  selection_method: string;
  stat_key: string | null;
  awarded_after_playoffs: boolean;
  uses_team_selection: boolean;
  allow_multiple_winners: boolean;
}

const REGULAR_SEASON_RESOLVERS = new Set([
  'points',
  'goals',
  'assists',
  'save_pct',
  'gaa',
  'shutouts',
  'standings_points',
  'wins',
]);

export const getAwardWinnerMode = (award: AwardDefinitionMetadata): AwardWinnerMode => {
  if (award.uses_team_selection) return 'team_selection';
  return award.allow_multiple_winners ? 'multiple' : 'single';
};

export const getAwardSelectionSource = (
  award: Pick<AwardDefinitionMetadata, 'selection_method' | 'stat_key'>,
): AwardSelectionSource => {
  if (award.selection_method === 'automatic' || award.stat_key === 'playoff_champion') {
    return 'automatic';
  }
  if (award.selection_method === 'voted') return 'voted';
  return 'manual';
};

export const getAwardCompetitionScope = (
  award: Pick<AwardDefinitionMetadata, 'selection_method' | 'stat_key'>,
): AwardCompetitionScope => {
  if (award.selection_method === 'playoff' || award.stat_key === 'playoff_champion') {
    return 'playoffs';
  }
  if (award.stat_key && REGULAR_SEASON_RESOLVERS.has(award.stat_key)) {
    return 'regular_season';
  }
  return 'full_season';
};

export const getAwardRecordingGate = (
  award: Pick<AwardDefinitionMetadata, 'awarded_after_playoffs'>,
): AwardRecordingGate => (award.awarded_after_playoffs ? 'after_playoffs_start' : 'anytime');

export const awardSelectionSourceLabel = (source: AwardSelectionSource) => {
  switch (source) {
    case 'automatic':
      return 'Automatic';
    case 'voted':
      return 'Voted';
    default:
      return 'Manual';
  }
};
