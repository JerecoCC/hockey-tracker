export type PlayerStatus = 'active' | 'inactive' | 'retired';

export const PLAYER_STATUS_LABELS: Record<PlayerStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  retired: 'Retired',
};

export const getPlayerStatus = (player: {
  status?: PlayerStatus | null;
  is_active: boolean;
}): PlayerStatus => player.status ?? (player.is_active ? 'active' : 'retired');
