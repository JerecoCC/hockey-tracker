import { type ReactNode } from 'react';
import Checkbox from '../Checkbox/Checkbox';
import styles from './SelectableListItem.module.scss';

export interface SelectableListItemProps {
  checked: boolean;
  onToggle: () => void;
  /** URL for the image. Falls back to imagePlaceholder when absent. */
  image?: string | null;
  /** Text shown in the avatar when no image is available (e.g. initials or code). */
  imagePlaceholder?: string;
  /** Shape of the image/placeholder. Defaults to 'square'. */
  imageShape?: 'square' | 'circle';
  name: string;
  subtitle?: string;
  /** Optional node rendered at the trailing edge of the row (e.g. a code badge or jersey input). */
  rightContent?: ReactNode;
}

const SelectableListItem = ({
  checked,
  onToggle,
  image,
  imagePlaceholder,
  imageShape = 'square',
  name,
  subtitle,
  rightContent,
}: SelectableListItemProps) => (
  <li
    className={[styles.item, checked ? styles.checked : ''].filter(Boolean).join(' ')}
    onClick={onToggle}
  >
    <Checkbox checked={checked} />

    <div className={[styles.image, styles[imageShape]].join(' ')}>
      {image ? <img src={image} alt="" /> : imagePlaceholder}
    </div>

    <div className={styles.info}>
      <div className={styles.name}>{name}</div>
      {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
    </div>

    {rightContent}
  </li>
);

export default SelectableListItem;
