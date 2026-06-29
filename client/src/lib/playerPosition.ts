export const PLAYER_POSITION_LABELS: Record<string, string> = {
  F: 'Forward',
  C: 'Center',
  LW: 'Left Wing',
  RW: 'Right Wing',
  D: 'Defense',
  LD: 'Left Defense',
  RD: 'Right Defense',
  G: 'Goalie',
};

export const formatPlayerPosition = (position?: string | null) =>
  position ? (PLAYER_POSITION_LABELS[position] ?? position) : null;
