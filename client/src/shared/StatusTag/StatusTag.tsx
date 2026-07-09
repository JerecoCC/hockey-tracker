import type { HTMLAttributes } from 'react';
import { PLAYER_STATUS_LABELS, type PlayerStatus } from '@/lib/playerStatus';
import styles from './StatusTag.module.scss';

export interface StatusTagProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  status: PlayerStatus;
}

const StatusTag = ({ status, className, ...rest }: StatusTagProps) => {
  const label = PLAYER_STATUS_LABELS[status];

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
