import Icon from '../Icon/Icon';
import styles from './Tag.module.scss';

export type TagIntent = 'accent' | 'info' | 'success' | 'neutral' | 'danger' | 'warning';

interface Props {
  label: string;
  intent?: TagIntent;
  /** Optional Material Icons name rendered before the label. */
  icon?: string;
  className?: string;
}

const Tag = ({ label, intent = 'neutral', icon, className }: Props) => (
  <span className={[styles.tag, styles[intent], className].filter(Boolean).join(' ')}>
    {icon && (
      <Icon
        name={icon}
        size="0.75em"
      />
    )}
    {label}
  </span>
);

export default Tag;
