import Icon from '@/components/Icon/Icon';
import styles from '@/components/Badge/Badge.module.scss';

export type BadgeIntent = 'accent' | 'info' | 'success' | 'neutral' | 'danger' | 'warning';

interface Props {
  label: string;
  intent?: BadgeIntent;
  /** Optional Material Icons name rendered before the label. */
  icon?: string;
  className?: string;
}

const Badge = ({ label, intent = 'neutral', icon, className }: Props) => (
  <span className={[styles.badge, styles[intent], className].filter(Boolean).join(' ')}>
    {icon && <Icon name={icon} size="0.75em" />}
    {label}
  </span>
);

export default Badge;
