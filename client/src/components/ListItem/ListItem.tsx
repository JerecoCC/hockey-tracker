import type { KeyboardEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import ActionOverlay from '../ActionOverlay/ActionOverlay';
import Chip, { type ChipSize } from '../Chip/Chip';
import Tag, { type TagIntent } from '../Tag/Tag';
import Button, { type ButtonIntent } from '../Button/Button';
import PlayerAvatar from '../PlayerAvatar/PlayerAvatar';
import TeamLogo from '../TeamLogo/TeamLogo';
import styles from './ListItem.module.scss';

export interface ListItemAction {
  icon: string;
  intent?: ButtonIntent;
  tooltip?: string;
  ariaLabel?: string;
  tooltipIntent?: 'default' | 'error';
  disabled?: boolean;
  onClick: () => void;
}

export interface RightContentTag {
  type: 'tag';
  label: string;
  intent?: TagIntent;
}

export interface RightContentCode {
  type: 'code';
  value: string;
}

export type ListItemRightContent = RightContentTag | RightContentCode;
export type ListItemRightSlot = ListItemRightContent | ReactNode;

export interface ListItemChip {
  label: ReactNode;
  size?: ChipSize;
  primaryColor?: string | null;
  textColor?: string | null;
}

const isListItemRightContent = (
  content: ListItemRightSlot | undefined,
): content is ListItemRightContent =>
  Boolean(
    content &&
      typeof content === 'object' &&
      'type' in content &&
      (content.type === 'tag' || content.type === 'code'),
  );

interface Props {
  /**
   * Optional small square image shown to the left of the main image (e.g. team logo
   * displayed alongside a circular player photo).
   */
  leadingImage?: string | null;
  leadingImageDark?: string | null;
  leadingImageLight?: string | null;
  /** Text shown in the leading placeholder when no leadingImage is provided (e.g. team code). */
  leadingImagePlaceholder?: string;
  /** Overrides the default leading image size in pixels. */
  leadingImageSize?: number;
  /** Background color for the leading placeholder. */
  leadingImagePrimaryColor?: string | null;
  /** Text color for the leading placeholder. */
  leadingImageTextColor?: string | null;
  image?: string | null;
  imageDark?: string | null;
  imageLight?: string | null;
  /** Overrides the default main image size in pixels. */
  imageSize?: number;
  /** Optional custom node that replaces the built-in image / placeholder block. */
  imageNode?: ReactNode;
  /** Controls the shape of the image and placeholder. Defaults to 'square'. */
  image_shape?: 'square' | 'circle';
  name: string;
  /** Overrides the text shown inside the image placeholder (e.g. initials). Defaults to rightContent.value or name slice. */
  placeholder?: string;
  /** Optional content rendered before the main text. */
  preTextContent?: ReactNode;
  /** Optional right-side content: a Tag pill, a plain code badge, or custom node. */
  rightContent?: ListItemRightSlot;
  /** Team primary color — used as placeholder background when no image is set. */
  primaryColor?: string | null;
  /** Team text color — used as placeholder text color when no image is set. */
  textColor?: string | null;
  /** Optional line shown above the name (e.g. jersey number + position). */
  eyebrow?: string;
  /** Optional chip rendered between the photo and name column. */
  chip?: ListItemChip | null;
  /** Optional secondary line shown below the name (e.g. season label + recorded date). */
  subtitle?: string;
  /** Optional third line shown below the subtitle (e.g. a version note). */
  note?: string;
  /** When true, renders the name in italic (e.g. to mark a player as a starter). */
  nameItalic?: boolean;
  /** When true, suppresses the image and placeholder entirely. */
  hideImage?: boolean;
  /** Visual treatment. 'plain' removes the static row frame/background. */
  variant?: 'framed' | 'plain';
  /** Row density. 'compact' tightens the padding to 0.5rem. Defaults to 'default'. */
  size?: 'default' | 'compact';
  /**
   * Hover-revealed action buttons. Pass an array of action descriptors; falsy
   * entries (false | null | undefined) are ignored, enabling conditional buttons.
   */
  actions?: (ListItemAction | false | null | undefined)[];
  /** When provided, the entire row becomes a stretched link (z-index 0) so action buttons (z-index 1) still intercept their own clicks. */
  href?: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onFocus?: () => void;
  ariaLabel?: string;
  className?: string;
  /** Optional custom content rendered below the built-in text lines. */
  children?: ReactNode;
}

const ListItem = ({
  leadingImage,
  leadingImageDark,
  leadingImageLight,
  leadingImagePlaceholder,
  leadingImageSize = 34,
  leadingImagePrimaryColor,
  leadingImageTextColor,
  image,
  imageDark,
  imageLight,
  imageSize = 48,
  imageNode,
  image_shape = 'square',
  hideImage = false,
  variant = 'framed',
  size = 'default',
  name,
  nameItalic = false,
  placeholder,
  preTextContent,
  rightContent,
  primaryColor,
  textColor,
  eyebrow,
  chip,
  subtitle,
  note,
  actions,
  href,
  onClick,
  onMouseEnter,
  onFocus,
  ariaLabel,
  className,
  children,
}: Props) => {
  const isCompact = size === 'compact';
  const hasExtra = !isCompact && (!!subtitle || !!note);
  const visibleActions = actions?.filter((a): a is ListItemAction => Boolean(a)) ?? [];
  const isCircle = image_shape === 'circle';
  const rightContentDescriptor = isListItemRightContent(rightContent)
    ? rightContent
    : undefined;
  const codeValue = rightContentDescriptor?.type === 'code' ? rightContentDescriptor.value : null;
  const hasRightContent = rightContent !== undefined && rightContent !== null && rightContent !== false;
  const isButtonRow = Boolean(onClick) && !href;
  const imageLabel = placeholder ?? (codeValue ?? name ?? '').slice(0, 3);
  const imageClassName = image
    ? [styles.logo, isCircle && styles.logoCircle].filter(Boolean).join(' ')
    : [styles.logoPlaceholder, isCircle && styles.logoPlaceholderCircle].filter(Boolean).join(' ');
  const defaultImageNode = isCircle ? (
    <PlayerAvatar
      photo={image}
      initials={imageLabel}
      primaryColor={primaryColor}
      textColor={textColor}
      size={imageSize}
      className={imageClassName}
    />
  ) : (
    <TeamLogo
      logo={image}
      logoDark={imageDark}
      logoLight={imageLight}
      code={imageLabel}
      alt=""
      primaryColor={primaryColor}
      textColor={textColor}
      size={imageSize}
      className={imageClassName}
    />
  );
  const handleKeyDown = (event: KeyboardEvent<HTMLLIElement>) => {
    if (!isButtonRow) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onClick?.();
  };
  const renderedPreTextContent =
    preTextContent ??
    (chip ? (
      <Chip
        size={chip.size}
        primaryColor={chip.primaryColor ?? primaryColor}
        textColor={chip.textColor ?? textColor}
      >
        {chip.label}
      </Chip>
    ) : null);

  return (
    <li
      className={[
        styles.item,
        variant === 'plain' ? styles.itemPlain : '',
        size === 'compact' ? styles.itemCompact : '',
        href || isButtonRow ? styles.itemClickable : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role={isButtonRow ? 'button' : undefined}
      tabIndex={isButtonRow ? 0 : undefined}
      aria-label={ariaLabel}
      onClick={isButtonRow ? onClick : undefined}
      onKeyDown={handleKeyDown}
      onMouseEnter={onMouseEnter}
      onFocus={onFocus}
    >
      {/* Leading image (e.g. team logo shown to the left of a player photo) */}
      {!isCompact && (leadingImage || leadingImagePlaceholder) && (
        <TeamLogo
          logo={leadingImage}
          logoDark={leadingImageDark}
          logoLight={leadingImageLight}
          code={leadingImagePlaceholder ?? ''}
          alt=""
          size={leadingImageSize}
          shape="square"
          primaryColor={leadingImagePrimaryColor}
          textColor={leadingImageTextColor}
          className={leadingImage ? styles.leadingLogo : styles.leadingLogoPlaceholder}
        />
      )}

      {/* Image or color-branded placeholder */}
      {!isCompact && !hideImage && (imageNode ?? defaultImageNode)}

      {renderedPreTextContent}

      {/* Info column — always rendered so flex:1 pushes code/actions right */}
      <div className={styles.info}>
        {!isCompact && eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
        <span className={[styles.name, nameItalic && styles.nameItalic].filter(Boolean).join(' ')}>
          {name}
        </span>
        {hasExtra && (
          <>
            {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
            {note && <span className={styles.note}>{note}</span>}
          </>
        )}
        {!isCompact && children}
      </div>

      {/* Right content */}
      {hasRightContent ? (
        rightContentDescriptor ? (
          rightContentDescriptor.type === 'tag' ? (
            <Tag
              label={rightContentDescriptor.label}
              intent={rightContentDescriptor.intent}
            />
          ) : (
            <span className={styles.code}>{rightContentDescriptor.value}</span>
          )
        ) : (
          rightContent
        )
      ) : null}

      {/* Stretched link — sits at z-index 0 so action buttons (z-index 1) intercept their own clicks */}
      {href && (
        <Link
          to={href}
          className={styles.itemLink}
          tabIndex={-1}
          aria-hidden="true"
        />
      )}

      {/* Actions (fade in on hover via ActionOverlay) */}
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
              tooltipIntent={action.tooltipIntent}
              aria-label={action.ariaLabel ?? action.tooltip}
              disabled={action.disabled}
              onClick={(event) => {
                event.stopPropagation();
                action.onClick();
              }}
            />
          ))}
        </ActionOverlay>
      )}
    </li>
  );
};

export default ListItem;
