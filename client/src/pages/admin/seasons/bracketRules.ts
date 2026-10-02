export const SLOT_SCOPE_OPTIONS = [
  { value: 'league', label: 'Whole League' },
  { value: 'specific_conference', label: 'Specific Conference' },
  { value: 'specific_division', label: 'Specific Division' },
];

export const SPECIFIC_SCOPES = new Set(['specific_conference', 'specific_division']);

export interface BracketRound {
  round: number;
  label: string;
  series: number;
}

export interface BracketStructure {
  totalTeams: number;
  bracketSize: number;
  byes: number;
  rounds: BracketRound[];
}

export const getRoundLabel = (
  round: number,
  totalRounds: number,
  roundNames?: Record<string, string> | null,
): string => {
  if (roundNames?.[round]) return roundNames[round];
  if (round === totalRounds) return 'Final';
  return `Round ${round}`;
};

export const getMatchupLabel = (
  matchupKey: string,
  matchupNames?: Record<string, string> | null,
): string | null => {
  const label = matchupNames?.[matchupKey]?.trim();
  return label || null;
};

export const deriveBracketStructureFromSize = (totalTeams: number): BracketStructure => {
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(totalTeams, 2))));
  const numRounds = Math.log2(bracketSize);
  return {
    totalTeams,
    bracketSize,
    byes: bracketSize - totalTeams,
    rounds: Array.from({ length: numRounds }, (_, index) => ({
      round: index + 1,
      label: getRoundLabel(index + 1, numRounds),
      series: bracketSize / Math.pow(2, index + 1),
    })),
  };
};

/**
 * Bracket size implied by a rule set's slots (minimum 4). Blank Round 1 slots aren't saved,
 * but every later round keeps its auto-generated winner slots, so the deepest round counts too.
 */
export const inferBracketSizeFromSlots = (slots: Array<{ slot_key: string }>): number => {
  const round1Matchups = new Set(
    slots
      .map((s) => s.slot_key.match(/^r1m(\d+)/)?.[1])
      .filter((v): v is string => v !== undefined),
  ).size;
  const deepestRound = Math.max(
    0,
    ...slots.map((s) => Number(s.slot_key.match(/^r(\d+)m/)?.[1] ?? 0)),
  );
  return Math.max(4, round1Matchups * 2, 2 ** deepestRound);
};

export const makeSlotKey = (round: number, matchup: number, position: 'team1' | 'team2') =>
  `r${round}m${matchup}${position}`;

export const slotKeyToLabel = (key: string, rounds: BracketRound[]): string => {
  const match = key.match(/^r(\d+)m(\d+)(team1|team2)$/);
  if (!match) return key;
  const roundInfo = rounds.find((round) => round.round === Number(match[1]));
  return `${roundInfo?.label ?? `Round ${match[1]}`} · Matchup ${Number(match[2]) + 1} · Team ${match[3] === 'team1' ? '1' : '2'}`;
};
