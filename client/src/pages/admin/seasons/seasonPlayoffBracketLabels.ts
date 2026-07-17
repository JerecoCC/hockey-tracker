import { getMatchupLabel, getRoundLabel } from './bracketRules';

interface BracketSlotHeaderLabelArgs {
  slotIndex: number;
  slotKey: string;
  round: number;
  totalRounds: number;
  roundNames?: Record<string, string> | null;
  matchupNames?: Record<string, string> | null;
}

export const getBracketSlotHeaderLabel = ({
  slotIndex,
  slotKey,
  round,
  totalRounds,
  roundNames,
  matchupNames,
}: BracketSlotHeaderLabelArgs): string | null => {
  const matchupLabel = getMatchupLabel(slotKey, matchupNames);
  if (matchupLabel) return matchupLabel;
  if (slotIndex === 0) return getRoundLabel(round, totalRounds, roundNames);
  return null;
};

interface BracketSlotFooterLabelArgs {
  slotIndex: number;
  seriesCount: number;
  round: number;
  totalRounds: number;
  roundNames?: Record<string, string> | null;
}

export const getBracketSlotFooterLabel = ({
  slotIndex,
  seriesCount,
  round,
  totalRounds,
  roundNames,
}: BracketSlotFooterLabelArgs): string | null => {
  if (seriesCount <= 2 || slotIndex !== seriesCount - 1) return null;
  return getRoundLabel(round, totalRounds, roundNames);
};
