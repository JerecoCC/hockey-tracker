import styles from './Tag.module.scss';

export type TagIntent = 'success' | 'neutral' | 'danger' | 'warning';

interface Props {
  label: string;
  intent?: TagIntent;
  className?: string;
}

const Tag = ({ label, intent = 'neutral', className }: Props) => (
  <span className={[styles.tag, styles[intent], className].filter(Boolean).join(' ')}>
    {label}
  </span>
);

export default Tag;
