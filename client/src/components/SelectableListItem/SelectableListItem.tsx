import { useId, type ReactNode } from 'react';
import ActionOverlay from '../ActionOverlay/ActionOverlay';
import Button, { type ButtonIntent } from '../Button/Button';
import Checkbox from '../Checkbox/Checkbox';
import Chip, { type ChipSize } from '../Chip/Chip';
import Divider from '../Divider/Divider';
import PlayerAvatar from '../PlayerAvatar/PlayerAvatar';
import TeamLogo from '../TeamLogo/TeamLogo';
import styles from './SelectableListItem.module.scss';

export interface SelectableListItemAction {
  icon: string;
  intent?: ButtonIntent;
  tooltip?: string;
  disabled?: boolean;
  onClick: () => void;
}

export interface SelectableListItemChip {
  label: ReactNode;
  size?: ChipSize;
  primaryColor?: string | null;
  textColor?: string | null;
}

export interface SelectableListItemProps {
  checked: boolean;
  onToggle: () => void;
  /** Optional small square image shown to the left of the main image. */
  leadingImage?: string | null;
  leadingImageDark?: string | null;
  leadingImageLight?: string | null;
  /** Text shown in the leading placeholder when no leadingImage is available. */
  leadingImagePlaceholder?: string;
  leadingImagePrimaryColor?: string | null;
  leadingImageTextColor?: string | null;
  /** URL for the image. Falls back to imagePlaceholder when absent. */
  image?: string | null;
  imageDark?: string | null;
  imageLight?: string | null;
  /** Text shown in the avatar when no image is available (e.g. initials or code). */
  imagePlaceholder?: string;
  /** Shape of the image/placeholder. Defaults to 'square'. */
  imageShape?: 'square' | 'circle';
  /** When false, real images render without the default image well background. */
  imageBackground?: boolean;
  /** When true the image/avatar block is not rendered at all. */
  hideImage?: boolean;
  /** Team primary color — used as placeholder background when no image is set. */
  imagePrimaryColor?: string | null;
  /** Team text color — used as placeholder text color when no image is set. */
  imageTextColor?: string | null;
  /** Optional line shown above the name (e.g. position). */
  eyebrow?: string;
  /** Optional chip rendered between the avatar and name column. */
  chip?: SelectableListItemChip | null;
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
  leadingImageDark,
  leadingImageLight,
  leadingImagePlaceholder,
  leadingImagePrimaryColor,
  leadingImageTextColor,
  image,
  imageDark,
  imageLight,
  imagePlaceholder,
  imageShape = 'square',
  imageBackground = true,
  hideImage = false,
  imagePrimaryColor,
  imageTextColor,
  eyebrow,
  chip,
  name,
  subtitle,
  rightContent,
  actions,
  disabled = false,
}: SelectableListItemProps) => {
  const visibleActions = actions?.filter((a): a is SelectableListItemAction => Boolean(a)) ?? [];
  const labelId = useId();

  return (
    <li
      className={[
        styles.item,
        checked ? styles.checked : '',
        disabled ? styles.disabled : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-disabled={disabled}
      onClick={disabled ? undefined : onToggle}
    >
      <span className={styles.selectionRegion}>
        <span className={styles.checkRegion}>
          <Checkbox
            checked={checked}
            onChange={onToggle}
            disabled={disabled}
            ariaLabelledBy={labelId}
          />
        </span>
        <Divider
          variant="vertical"
          className={styles.divider}
        />
      </span>

      {(leadingImage || leadingImagePlaceholder) &&
        (leadingImage ? (
          <TeamLogo
            logo={leadingImage}
            logoDark={leadingImageDark}
            logoLight={leadingImageLight}
            code={leadingImagePlaceholder ?? ''}
            alt=""
            size={34}
            shape="square"
            primaryColor={leadingImagePrimaryColor}
            textColor={leadingImageTextColor}
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

      {!hideImage && imageShape !== 'circle' && (
        <TeamLogo
          logo={image}
          logoDark={imageDark}
          logoLight={imageLight}
          code={imagePlaceholder ?? ''}
          alt=""
          size={32}
          shape="square"
          primaryColor={imagePrimaryColor}
          textColor={imageTextColor}
          className={[
            styles.image,
            styles.square,
            image && !imageBackground ? styles.imageTransparent : '',
          ]
            .filter(Boolean)
            .join(' ')}
        />
      )}

      {!hideImage && imageShape === 'circle' && (
        <PlayerAvatar
          photo={image}
          initials={imagePlaceholder ?? ''}
          primaryColor={!image || imageBackground ? imagePrimaryColor : null}
          textColor={imageTextColor}
          size={48}
          className={styles.playerAvatar}
        />
      )}

      {chip && (
        <Chip
          size={chip.size}
          primaryColor={chip.primaryColor}
          textColor={chip.textColor}
        >
          {chip.label}
        </Chip>
      )}

      <div className={styles.info}>
        {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
        <div
          id={labelId}
          className={styles.name}
        >
          {name}
        </div>
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
