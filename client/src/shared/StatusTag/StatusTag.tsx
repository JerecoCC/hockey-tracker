import type { HTMLAttributes } from 'react';
import { PLAYER_STATUS_LABELS, type PlayerStatus } from '@/lib/playerStatus';
import styles from './StatusTag.module.scss';

export type StatusTagStatus = PlayerStatus | 'admin' | 'user';

const STATUS_TAG_LABELS: Record<StatusTagStatus, string> = {
  ...PLAYER_STATUS_LABELS,
  admin: 'Admin',
  user: 'User',
};

export interface StatusTagProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  status: StatusTagStatus;
}

const StatusTag = ({ status, className, ...rest }: StatusTagProps) => {
  const label = STATUS_TAG_LABELS[status];

  return (
    <span
      className={[styles.tag, styles[status], className].filter(Boolean).join(' ')}
      role="status"
      aria-label={label}
      {...rest}
    >
      <span className={styles.label}>{label.toUpperCase()}</span>
    </span>
  );
};

export default StatusTag;
