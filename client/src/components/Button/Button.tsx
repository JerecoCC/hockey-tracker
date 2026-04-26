import type { ButtonHTMLAttributes } from 'react';
import cn from 'classnames';
import Icon from '../Icon/Icon';
import Tooltip from '../Tooltip/Tooltip';
import styles from './Button.module.scss';

export type ButtonVariant = 'filled' | 'outlined' | 'ghost';
export type ButtonIntent = 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style: filled solid, outlined border, or ghost (no border/bg). Default: 'filled'. */
  variant?: ButtonVariant;
  /** Colour intent. Default: 'accent'. */
  intent?: ButtonIntent;
  /** Size preset. Default: 'md'. */
  size?: ButtonSize;
  /** Material Icons ligature name. Renders an icon; if provided without children → icon-only mode. */
  icon?: string;
  /** Overrides the icon font-size (e.g. "1.25rem"). Defaults to inheriting from button. */
  iconSize?: string;
  /** When provided, wraps the button in a Tooltip. */
  tooltip?: string;
  /** Optional className forwarded to the Tooltip wrapper span. */
  tooltipClassName?: string;
  /** Intent forwarded to the Tooltip. Use 'error' for danger/red styling. */
  tooltipIntent?: 'default' | 'error';
}

const VARIANT_INTENT: Record<ButtonVariant, Record<ButtonIntent, string>> = {
  filled: {
    accent: styles.filledAccent,
    success: styles.filledSuccess,
    warning: styles.filledWarning,
    danger: styles.filledDanger,
    info: styles.filledInfo,
    neutral: styles.filledNeutral,
  },
  outlined: {
    accent: styles.outlinedAccent,
    success: styles.outlinedSuccess,
    warning: styles.outlinedWarning,
    danger: styles.outlinedDanger,
    info: styles.outlinedInfo,
    neutral: styles.outlinedNeutral,
  },
  ghost: {
    accent: styles.ghostAccent,
    success: styles.ghostSuccess,
    warning: styles.ghostWarning,
    danger: styles.ghostDanger,
    info: styles.ghostInfo,
    neutral: styles.ghostNeutral,
  },
};

const SIZE: Record<ButtonSize, string> = {
  sm: styles.sm,
  md: styles.md,
  lg: styles.lg,
};

/**
 * Reusable button with variant/intent/size props and optional Material Icon.
 *
 * Usage examples:
 *   <Button icon="add">Add League</Button>               // filled accent, icon + label
 *   <Button variant="outlined" intent="danger">Cancel</Button> // outlined danger, label only
 *   <Button variant="ghost" intent="neutral" icon="edit" /> // ghost neutral, icon only
 *   <Button variant="filled" intent="danger" icon="delete" size="sm" /> // small icon-only
 */
const Button = (props: ButtonProps) => {
  const {
    variant = 'filled',
    intent = 'accent',
    size = 'md',
    icon,
    iconSize,
    tooltip,
    tooltipClassName,
    tooltipIntent,
    children,
    className = '',
    ...rest
  } = props;
  const isIconOnly = !!icon && !children;

  const cls = cn(
    styles.btn,
    SIZE[size],
    VARIANT_INTENT[variant][intent],
    isIconOnly && styles.iconOnly,
    className,
  );

  const btn = (
    <button
      className={cls}
      {...rest}
    >
      {icon && (
        <Icon
          name={icon}
          size={iconSize}
        />
      )}
      {children}
    </button>
  );

  if (tooltip) {
    return (
      <Tooltip
        text={tooltip}
        className={tooltipClassName}
        intent={tooltipIntent}
      >
        {btn}
      </Tooltip>
    );
  }

  return btn;
};

export default Button;
