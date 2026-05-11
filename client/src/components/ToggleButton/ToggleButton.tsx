import Button, { type ButtonIntent, type ButtonSize } from '../Button/Button';
import styles from './ToggleButton.module.scss';

interface Props {
  /** Whether the button is in its active/on state. */
  active: boolean;
  /** Toggles the active state. */
  onClick: () => void;
  /** Icon name (Material Icons ligature). */
  icon?: string;
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
  icon,
  size,
  iconHeight,
  activeIntent = 'accent',
  inactiveIntent = 'neutral',
  activeTooltip,
  inactiveTooltip,
  children,
  disabled,
  className,
}: Props) => (
  <Button
    variant="outlined"
    intent={active ? activeIntent : inactiveIntent}
    icon={icon}
    size={size}
    iconHeight={iconHeight}
    tooltip={active ? activeTooltip : inactiveTooltip}
    onClick={onClick}
    disabled={disabled}
    className={[active ? styles.active : '', className].filter(Boolean).join(' ')}
  >
    {children}
  </Button>
);

export default ToggleButton;
