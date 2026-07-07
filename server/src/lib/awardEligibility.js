const PLAYER_POSITION_GROUPS = ['forward', 'defender', 'goalie'];

const DEFAULT_PLAYER_ELIGIBILITY = {
  position_groups: [],
  rookies_only: false,
};

const DEFAULT_TEAM_ELIGIBILITY = {
  conference_names: [],
  conference_keys: [],
};

const normalizeStringList = (value, fieldName) => {
  if (value === undefined || value === null) return { value: [] };
  if (!Array.isArray(value)) {
    return { error: `${fieldName} must be an array` };
  }

  const seen = new Set();
  const normalized = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      return { error: `${fieldName} must contain only strings` };
    }
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      normalized.push(trimmed);
    }
  }
  return { value: normalized };
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

const normalizeAwardTeamEligibility = (input = {}) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { value: { ...DEFAULT_TEAM_ELIGIBILITY } };
  }

  const rawConferenceNames = input.conference_names ?? input.conferences ?? [];
  const conferenceNames = normalizeStringList(
    rawConferenceNames,
    'team_eligibility.conference_names',
  );
  if (conferenceNames.error) return { error: conferenceNames.error };

  const conferenceKeys = normalizeStringList(
    input.conference_keys ?? [],
    'team_eligibility.conference_keys',
  );
  if (conferenceKeys.error) return { error: conferenceKeys.error };

  return {
    value: {
      conference_names: conferenceNames.value,
      conference_keys: conferenceKeys.value,
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

const teamMatchesAwardEligibility = (team, teamEligibility) => {
  const { value: eligibility = DEFAULT_TEAM_ELIGIBILITY } =
    normalizeAwardTeamEligibility(teamEligibility);
  if (eligibility.conference_names.length === 0 && eligibility.conference_keys.length === 0) {
    return true;
  }

  const eligibleNames = new Set(
    eligibility.conference_names.map((name) => name.trim().toLowerCase()),
  );
  const eligibleKeys = new Set(eligibility.conference_keys.map((key) => key.trim().toLowerCase()));
  const teamNames = Array.isArray(team.conference_names) ? team.conference_names : [];
  const teamKeys = Array.isArray(team.conference_keys) ? team.conference_keys : [];

  return (
    teamNames.some((name) => eligibleNames.has(String(name).trim().toLowerCase())) ||
    teamKeys.some((key) => eligibleKeys.has(String(key).trim().toLowerCase()))
  );
};

module.exports = {
  DEFAULT_PLAYER_ELIGIBILITY,
  DEFAULT_TEAM_ELIGIBILITY,
  normalizeAwardPlayerEligibility,
  normalizeAwardTeamEligibility,
  playerMatchesAwardEligibility,
  teamMatchesAwardEligibility,
};
