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
  /** When true the image/avatar block is not rendered at all. */
  hideImage?: boolean;
  /** Team primary color — used as placeholder background when no image is set. */
  imagePrimaryColor?: string | null;
  /** Team text color — used as placeholder text color when no image is set. */
  imageTextColor?: string | null;
  /** Optional line shown above the name (e.g. jersey number + position). */
  eyebrow?: string;
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
  hideImage = false,
  imagePrimaryColor,
  imageTextColor,
  eyebrow,
  name,
  subtitle,
  rightContent,
}: SelectableListItemProps) => (
  <li
    className={[styles.item, checked ? styles.checked : ''].filter(Boolean).join(' ')}
    onClick={onToggle}
  >
    <Checkbox
      checked={checked}
      onChange={onToggle}
    />

    {!hideImage && (
      <div
        className={[styles.image, styles[imageShape]].join(' ')}
        style={
          !image && imagePrimaryColor
            ? { background: imagePrimaryColor, color: imageTextColor ?? undefined }
            : undefined
        }
      >
        {image ? (
          <img
            src={image}
            alt=""
          />
        ) : (
          imagePlaceholder
        )}
      </div>
    )}

    <div className={styles.info}>
      {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
      <div className={styles.name}>{name}</div>
      {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
    </div>

    {rightContent}
  </li>
);

export default SelectableListItem;
