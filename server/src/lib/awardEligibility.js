const PLAYER_POSITION_GROUPS = ['forward', 'defender', 'goalie'];

const DEFAULT_PLAYER_ELIGIBILITY = {
  position_groups: [],
  rookies_only: false,
};

const normalizeAwardPlayerEligibility = (input = {}) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { value: { ...DEFAULT_PLAYER_ELIGIBILITY } };
  }

  const rawGroups = input.position_groups ?? input.positions ?? [];
  if (!Array.isArray(rawGroups)) {
    return { error: 'player_eligibility.position_groups must be an array' };
  }

  const seen = new Set();
  const positionGroups = [];
  for (const group of rawGroups) {
    if (!PLAYER_POSITION_GROUPS.includes(group)) {
      return { error: 'player_eligibility.position_groups contains an invalid value' };
    }
    if (!seen.has(group)) {
      seen.add(group);
      positionGroups.push(group);
    }
  }

  return {
    value: {
      position_groups: positionGroups,
      rookies_only: Boolean(input.rookies_only),
    },
  };
};

const playerPositionGroup = (position) => {
  switch ((position ?? '').trim().toUpperCase()) {
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

const playerMatchesAwardEligibility = (player, playerEligibility, seasonId) => {
  const { value: eligibility = DEFAULT_PLAYER_ELIGIBILITY } =
    normalizeAwardPlayerEligibility(playerEligibility);
  if (eligibility.rookies_only && player.rookie_season_id !== seasonId) return false;
  if (eligibility.position_groups.length === 0) return true;

  const group = playerPositionGroup(player.position);
  return group ? eligibility.position_groups.includes(group) : false;
};

module.exports = {
  DEFAULT_PLAYER_ELIGIBILITY,
  normalizeAwardPlayerEligibility,
  playerMatchesAwardEligibility,
};
