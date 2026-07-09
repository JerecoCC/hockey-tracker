export type AwardWinnerMode = 'single' | 'multiple' | 'team_selection';
export type AwardSelectionSource = 'manual' | 'voted' | 'automatic';
export type AwardCompetitionScope = 'regular_season' | 'playoffs' | 'full_season';
export type AwardRecordingGate = 'anytime' | 'after_playoffs_start';
export type AwardPlayerPositionGroup = 'forward' | 'defender' | 'goalie';

export interface AwardPlayerEligibility {
  position_groups?: AwardPlayerPositionGroup[];
  rookies_only?: boolean;
}

export interface AwardTeamEligibility {
  conference_names?: string[];
  conference_keys?: string[];
}

export interface AwardDefinitionMetadata {
  recipient_type?: string;
  selection_method: string;
  competition_scope?: AwardCompetitionScope | null;
  stat_key: string | null;
  awarded_after_playoffs: boolean;
  uses_team_selection: boolean;
  allow_multiple_winners: boolean;
  player_eligibility?: AwardPlayerEligibility | null;
  team_eligibility?: AwardTeamEligibility | null;
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

export const AWARD_PLAYER_POSITION_GROUP_LABELS: Record<AwardPlayerPositionGroup, string> = {
  forward: 'Forwards',
  defender: 'Defenders',
  goalie: 'Goalies',
};

const AWARD_PLAYER_POSITION_GROUPS: AwardPlayerPositionGroup[] = [
  'forward',
  'defender',
  'goalie',
];

export const normalizeAwardPlayerEligibility = (
  eligibility?: AwardPlayerEligibility | null,
): Required<AwardPlayerEligibility> => {
  const seen = new Set<AwardPlayerPositionGroup>();
  const positionGroups = (eligibility?.position_groups ?? []).filter(
    (group): group is AwardPlayerPositionGroup =>
      AWARD_PLAYER_POSITION_GROUPS.includes(group) && !seen.has(group) && !!seen.add(group),
  );

  return {
    position_groups: positionGroups,
    rookies_only: Boolean(eligibility?.rookies_only),
  };
};

const normalizeStringList = (values?: string[] | null) => {
  const seen = new Set<string>();
  return (values ?? [])
    .map((value) => value.trim())
    .filter((value) => {
      if (!value) return false;
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export const normalizeAwardTeamEligibility = (
  eligibility?: AwardTeamEligibility | null,
): Required<AwardTeamEligibility> => ({
  conference_names: normalizeStringList(eligibility?.conference_names),
  conference_keys: normalizeStringList(eligibility?.conference_keys),
});

export const awardPlayerPositionGroup = (
  position?: string | null,
): AwardPlayerPositionGroup | null => {
  switch (position?.trim().toUpperCase()) {
    case 'G':
      return 'goalie';
    case 'D':
    case 'LD':
    case 'RD':
      return 'defender';
    case 'F':
    case 'C':
    case 'LW':
    case 'RW':
      return 'forward';
    default:
      return null;
  }
};

export const playerMatchesAwardEligibility = (
  award: Pick<AwardDefinitionMetadata, 'recipient_type' | 'player_eligibility'>,
  player: { position?: string | null; rookie_season_id?: string | null },
  seasonId?: string | null,
) => {
  if (award.recipient_type === 'team') return true;

  const eligibility = normalizeAwardPlayerEligibility(award.player_eligibility);
  if (eligibility.rookies_only && (!seasonId || player.rookie_season_id !== seasonId)) {
    return false;
  }

  if (eligibility.position_groups.length === 0) return true;

  const group = awardPlayerPositionGroup(player.position);
  return group ? eligibility.position_groups.includes(group) : false;
};

export const teamMatchesAwardEligibility = (
  award: Pick<AwardDefinitionMetadata, 'recipient_type' | 'team_eligibility'>,
  team: { conference_names?: string[] | null; conference_keys?: string[] | null },
) => {
  if (award.recipient_type !== 'team') return true;

  const eligibility = normalizeAwardTeamEligibility(award.team_eligibility);
  if (eligibility.conference_names.length === 0 && eligibility.conference_keys.length === 0) {
    return true;
  }

  const eligibleNames = new Set(eligibility.conference_names.map((name) => name.toLowerCase()));
  const eligibleKeys = new Set(eligibility.conference_keys.map((key) => key.toLowerCase()));
  const teamNames = (team.conference_names ?? []).map((name) => name.toLowerCase());
  const teamKeys = (team.conference_keys ?? []).map((key) => key.toLowerCase());

  return teamNames.some((name) => eligibleNames.has(name)) || teamKeys.some((key) => eligibleKeys.has(key));
};

export const awardPlayerEligibilityLabel = (
  award: Pick<AwardDefinitionMetadata, 'recipient_type' | 'player_eligibility'>,
) => {
  if (award.recipient_type === 'team') return null;

  const eligibility = normalizeAwardPlayerEligibility(award.player_eligibility);
  const parts = [
    eligibility.position_groups.length === 0
      ? 'All positions'
      : eligibility.position_groups
          .map((group) => AWARD_PLAYER_POSITION_GROUP_LABELS[group])
          .join(', '),
    eligibility.rookies_only ? 'Rookies' : null,
  ].filter(Boolean);

  return parts.join(' | ');
};

export const awardTeamEligibilityLabel = (
  award: Pick<AwardDefinitionMetadata, 'recipient_type' | 'team_eligibility'>,
) => {
  if (award.recipient_type !== 'team') return null;

  const eligibility = normalizeAwardTeamEligibility(award.team_eligibility);
  if (eligibility.conference_names.length === 0 && eligibility.conference_keys.length === 0) {
    return null;
  }

  const conferences =
    eligibility.conference_names.length > 0
      ? eligibility.conference_names
      : eligibility.conference_keys;
  return `Conferences: ${conferences.join(', ')}`;
};

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
  award: Pick<AwardDefinitionMetadata, 'selection_method' | 'competition_scope' | 'stat_key'>,
): AwardCompetitionScope => {
  if (award.stat_key === 'playoff_champion') {
    return 'playoffs';
  }
  if (award.stat_key && REGULAR_SEASON_RESOLVERS.has(award.stat_key)) {
    return 'regular_season';
  }
  if (
    award.competition_scope === 'regular_season' ||
    award.competition_scope === 'playoffs' ||
    award.competition_scope === 'full_season'
  ) {
    return award.competition_scope;
  }
  if (award.selection_method === 'playoff' || award.stat_key === 'playoff_champion') {
    return 'playoffs';
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

export const awardCompetitionScopeLabel = (scope: AwardCompetitionScope) => {
  switch (scope) {
    case 'regular_season':
      return 'Regular season';
    case 'playoffs':
      return 'Playoffs';
    default:
      return 'Full season';
  }
};
