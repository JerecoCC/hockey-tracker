import { type ReactNode } from 'react';
import ActionOverlay from '../ActionOverlay/ActionOverlay';
import Button, { type ButtonIntent } from '../Button/Button';
import Checkbox from '../Checkbox/Checkbox';
import styles from './SelectableListItem.module.scss';

export interface SelectableListItemAction {
  icon: string;
  intent?: ButtonIntent;
  tooltip?: string;
  disabled?: boolean;
  onClick: () => void;
}

export interface SelectableListItemProps {
  checked: boolean;
  onToggle: () => void;
  /** Optional small square image shown to the left of the main image. */
  leadingImage?: string | null;
  /** Text shown in the leading placeholder when no leadingImage is available. */
  leadingImagePlaceholder?: string;
  leadingImagePrimaryColor?: string | null;
  leadingImageTextColor?: string | null;
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
  /** Optional line shown above the name (e.g. position). */
  eyebrow?: string;
  /** Jersey number — rendered as a bordered chip between the avatar and name column. */
  jerseyNumber?: number | null;
  name: string;
  subtitle?: string;
  /** Optional node rendered at the trailing edge of the row (e.g. a code badge or jersey input). */
  rightContent?: ReactNode;
  /** Hover-revealed actions. Button clicks do not toggle the row checkbox. */
  actions?: (SelectableListItemAction | false | null | undefined)[];
  disabled?: boolean;
}

const SelectableListItem = ({
  checked,
  onToggle,
  leadingImage,
  leadingImagePlaceholder,
  leadingImagePrimaryColor,
  leadingImageTextColor,
  image,
  imagePlaceholder,
  imageShape = 'square',
  hideImage = false,
  imagePrimaryColor,
  imageTextColor,
  eyebrow,
  jerseyNumber,
  name,
  subtitle,
  rightContent,
  actions,
  disabled = false,
}: SelectableListItemProps) => {
  const visibleActions = actions?.filter((a): a is SelectableListItemAction => Boolean(a)) ?? [];

  return (
    <li
      className={[styles.item, checked ? styles.checked : '', disabled ? styles.disabled : '']
        .filter(Boolean)
        .join(' ')}
      aria-disabled={disabled}
      onClick={disabled ? undefined : onToggle}
    >
      <Checkbox
        checked={checked}
        onChange={onToggle}
        disabled={disabled}
      />

      {(leadingImage || leadingImagePlaceholder) &&
        (leadingImage ? (
          <img
            src={leadingImage}
            alt=""
            className={styles.leadingLogo}
          />
        ) : (
          <span
            className={styles.leadingLogoPlaceholder}
            style={
              leadingImagePrimaryColor
                ? {
                    background: leadingImagePrimaryColor,
                    color: leadingImageTextColor ?? undefined,
                  }
                : undefined
            }
          >
            {leadingImagePlaceholder}
          </span>
        ))}

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

      {jerseyNumber != null && <span className={styles.jerseyChip}>{jerseyNumber}</span>}

      <div className={styles.info}>
        {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
        <div className={styles.name}>{name}</div>
        {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
      </div>

      {rightContent}

      {visibleActions.length > 0 && (
        <ActionOverlay className={styles.actions}>
          {visibleActions.map((action, i) => (
            <Button
              key={i}
              variant="outlined"
              intent={action.intent ?? 'neutral'}
              icon={action.icon}
              size="sm"
              tooltip={action.tooltip}
              disabled={disabled || action.disabled}
              onClick={(e) => {
                e.stopPropagation();
                if (disabled) return;
                action.onClick();
              }}
            />
          ))}
        </ActionOverlay>
      )}
    </li>
  );
};

export default SelectableListItem;
