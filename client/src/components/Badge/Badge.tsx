import type { HTMLAttributes } from 'react';
import styles from './Badge.module.scss';

export interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  label?: string;
  value: number;
}

const Badge = ({ label, value, className, ...rest }: BadgeProps) => (
  <span
    className={[styles.badge, className].filter(Boolean).join(' ')}
    {...rest}
  >
    {label && <span className={styles.label}>{label}</span>}
    <span className={styles.value}>{value}</span>
  </span>
);

export default Badge;
