import ActionOverlay from '../ActionOverlay/ActionOverlay';
import Button, { type ButtonIntent } from '../Button/Button';
import Tag, { type TagIntent } from '../Tag/Tag';
import styles from './ListItem.module.scss';

export interface ListItemAction {
  icon: string;
  intent?: ButtonIntent;
  tooltip?: string;
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

interface Props {
  image?: string | null;
  /** Controls the shape of the image and placeholder. Defaults to 'square'. */
  image_shape?: 'square' | 'circle';
  name: string;
  /** Overrides the text shown inside the image placeholder (e.g. initials). Defaults to rightContent.value or name slice. */
  placeholder?: string;
  /** Optional right-side content: a Tag pill or a plain code badge. */
  rightContent?: ListItemRightContent;
  /** Team primary color — used as placeholder background when no image is set. */
  primaryColor?: string | null;
  /** Team text color — used as placeholder text color when no image is set. */
  textColor?: string | null;
  /** Optional secondary line shown below the name (e.g. season label + recorded date). */
  subtitle?: string;
  /** Optional third line shown below the subtitle (e.g. a version note). */
  note?: string;
  /** When true, suppresses the image and placeholder entirely. */
  hideImage?: boolean;
  /**
   * Hover-revealed action buttons. Pass an array of action descriptors; falsy
   * entries (false | null | undefined) are ignored, enabling conditional buttons.
   */
  actions?: (ListItemAction | false | null | undefined)[];
  className?: string;
}

const ListItem = ({
  image,
  image_shape = 'square',
  hideImage = false,
  name,
  placeholder,
  rightContent,
  primaryColor,
  textColor,
  subtitle,
  note,
  actions,
  className,
}: Props) => {
  const hasExtra = !!subtitle || !!note;
  const visibleActions = actions?.filter((a): a is ListItemAction => Boolean(a)) ?? [];
  const isCircle = image_shape === 'circle';
  const codeValue = rightContent?.type === 'code' ? rightContent.value : null;

  return (
    <li className={[styles.item, className].filter(Boolean).join(' ')}>
      {/* Image or color-branded placeholder */}
      {!hideImage &&
        (image ? (
          <img
            src={image}
            alt=""
            className={[styles.logo, isCircle && styles.logoCircle].filter(Boolean).join(' ')}
          />
        ) : (
          <span
            className={[styles.logoPlaceholder, isCircle && styles.logoPlaceholderCircle]
              .filter(Boolean)
              .join(' ')}
            style={
              primaryColor ? { background: primaryColor, color: textColor ?? undefined } : undefined
            }
          >
            {placeholder ?? (codeValue ?? name).slice(0, 3)}
          </span>
        ))}

      {/* Info column — always rendered so flex:1 pushes code/actions right */}
      <div className={styles.info}>
        <span className={styles.name}>{name}</span>
        {hasExtra && (
          <>
            {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
            {note && <span className={styles.note}>{note}</span>}
          </>
        )}
      </div>

      {/* Right content — Tag pill or code badge */}
      {rightContent ? (
        rightContent.type === 'tag' ? (
          <Tag
            label={rightContent.label}
            intent={rightContent.intent}
          />
        ) : (
          <span className={styles.code}>{rightContent.value}</span>
        )
      ) : null}

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
              disabled={action.disabled}
              onClick={action.onClick}
            />
          ))}
        </ActionOverlay>
      )}
    </li>
  );
};

export default ListItem;
