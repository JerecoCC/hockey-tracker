import ActionOverlay from '../ActionOverlay/ActionOverlay';
import Button, { type ButtonIntent } from '../Button/Button';
import styles from './ListItem.module.scss';

export interface ListItemAction {
  icon: string;
  intent?: ButtonIntent;
  tooltip?: string;
  disabled?: boolean;
  onClick: () => void;
}

interface Props {
  logo?: string | null;
  name: string;
  code?: string | null;
  /** Team primary color — used as placeholder background when no logo is set. */
  primaryColor?: string | null;
  /** Team text color — used as placeholder text color when no logo is set. */
  textColor?: string | null;
  /** Optional secondary line shown below the name (e.g. season label + recorded date). */
  subtitle?: string;
  /** Optional third line shown below the subtitle (e.g. a version note). */
  note?: string;
  /**
   * Hover-revealed action buttons. Pass an array of action descriptors; falsy
   * entries (false | null | undefined) are ignored, enabling conditional buttons.
   */
  actions?: (ListItemAction | false | null | undefined)[];
  className?: string;
}

const ListItem = ({
  logo,
  name,
  code,
  primaryColor,
  textColor,
  subtitle,
  note,
  actions,
  className,
}: Props) => {
  const hasExtra = !!subtitle || !!note;
  const visibleActions = actions?.filter((a): a is ListItemAction => Boolean(a)) ?? [];

  return (
    <li className={[styles.item, className].filter(Boolean).join(' ')}>
      {/* Logo or color-branded placeholder */}
      {logo ? (
        <img
          src={logo}
          alt=""
          className={styles.logo}
        />
      ) : (
        <span
          className={styles.logoPlaceholder}
          style={
            primaryColor ? { background: primaryColor, color: textColor ?? undefined } : undefined
          }
        >
          {(code ?? name).slice(0, 3)}
        </span>
      )}

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

      {/* Code */}
      {code && <span className={styles.code}>{code}</span>}

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
