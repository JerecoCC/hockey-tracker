import Button, { type ButtonIntent, type ButtonSize } from '../Button/Button';
import Icon from '../Icon/Icon';
import Tooltip from '../Tooltip/Tooltip';
import styles from './ToggleButton.module.scss';

interface Props {
  /** Whether the button is in its active/on state. */
  active: boolean;
  /** Toggles the active state. */
  onClick: () => void;
  /** Visual variant. Default keeps the existing outlined button style. */
  variant?: 'button' | 'switch';
  /** Icon name (Material Icons ligature). */
  icon?: string;
  /** Icon shown when active for the switch variant. Falls back to icon. */
  activeIcon?: string;
  /** Icon shown when inactive for the switch variant. Falls back to icon. */
  inactiveIcon?: string;
  /** Size preset. Default: 'md'. */
  size?: ButtonSize;
  /**
   * Controls the height of an icon-only button.
   * - undefined / 'default' → compact square
   * - 'button'              → same height as a labelled button
   * - 'field'               → fixed 42px to match input/field height
   */
  iconHeight?: 'default' | 'button' | 'field';
  /** Intent used when active. Default: 'accent'. */
  activeIntent?: ButtonIntent;
  /** Intent used when inactive. Default: 'neutral'. */
  inactiveIntent?: ButtonIntent;
  /** Tooltip shown when active. */
  activeTooltip?: string;
  /** Tooltip shown when inactive. */
  inactiveTooltip?: string;
  /** Optional label. Omit for icon-only mode. */
  children?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * A togglable outlined button whose intent and tooltip flip based on `active`.
 *
 * Usage:
 *   <ToggleButton
 *     active={filtersVisible}
 *     onClick={() => setFiltersVisible(v => !v)}
 *     icon="filter_list"
 *     iconHeight="button"
 *     activeTooltip="Hide filters"
 *     inactiveTooltip="Show filters"
 *   />
 */
const ToggleButton = ({
  active,
  onClick,
  variant = 'button',
  icon,
  activeIcon,
  inactiveIcon,
  size,
  iconHeight,
  activeIntent = 'accent',
  inactiveIntent = 'neutral',
  activeTooltip,
  inactiveTooltip,
  children,
  disabled,
  className,
}: Props) => {
  if (variant === 'switch') {
    const switchIcon = active ? (activeIcon ?? icon) : (inactiveIcon ?? icon);
    const tooltip = active ? activeTooltip : inactiveTooltip;

    const switchButton = (
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label={tooltip}
        onClick={onClick}
        disabled={disabled}
        className={[
          styles.switchToggle,
          active ? styles.switchToggleActive : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span className={styles.switchThumb}>
          {switchIcon && (
            <Icon
              name={switchIcon}
              size="1rem"
            />
          )}
        </span>
      </button>
    );

    if (tooltip) {
      return (
        <Tooltip
          text={tooltip}
          className={className}
        >
          {switchButton}
        </Tooltip>
      );
    }

    return switchButton;
  }

  return (
    <Button
      variant="outlined"
      intent={active ? activeIntent : inactiveIntent}
      icon={icon}
      size={size}
      iconHeight={iconHeight}
      tooltip={active ? activeTooltip : inactiveTooltip}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={[active ? styles.active : styles.inactive, className].filter(Boolean).join(' ')}
    >
      {children}
    </Button>
  );
};

export default ToggleButton;
