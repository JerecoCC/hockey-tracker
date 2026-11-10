import { type TagIntent } from '@jerecocc/tracker-ui/components/Tag/Tag';
import { type PlayerPosition } from '@/hooks/useLeaguePlayers';

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

export const PLAYER_POSITION_TAG_INTENTS: Record<PlayerPosition, TagIntent> = {
  F: 'accent',
  C: 'accent',
  LW: 'accent',
  RW: 'accent',
  D: 'info',
  LD: 'info',
  RD: 'info',
  G: 'warning',
};

export const isPlayerPosition = (value: string): value is PlayerPosition =>
  Object.prototype.hasOwnProperty.call(PLAYER_POSITION_TAG_INTENTS, value);

export const playerPositionTagIntent = (position?: string | null): TagIntent =>
  position && isPlayerPosition(position) ? PLAYER_POSITION_TAG_INTENTS[position] : 'neutral';
