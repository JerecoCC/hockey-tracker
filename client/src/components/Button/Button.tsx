import type { ButtonHTMLAttributes } from 'react';
import Icon from '../Icon/Icon';
import styles from './Button.module.scss';

export type ButtonVariant = 'filled' | 'outlined' | 'ghost';
export type ButtonIntent  = 'accent' | 'danger' | 'info' | 'neutral';
export type ButtonSize    = 'sm' | 'md' | 'lg';

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
}

const VARIANT_INTENT: Record<ButtonVariant, Record<ButtonIntent, string>> = {
  filled: {
    accent:  styles.filledAccent,
    danger:  styles.filledDanger,
    info:    styles.filledInfo,
    neutral: styles.filledNeutral,
  },
  outlined: {
    accent:  styles.outlinedAccent,
    danger:  styles.outlinedDanger,
    info:    styles.outlinedInfo,
    neutral: styles.outlinedNeutral,
  },
  ghost: {
    accent:  styles.ghostAccent,
    danger:  styles.ghostDanger,
    info:    styles.ghostInfo,
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
const Button = ({
  variant  = 'filled',
  intent   = 'accent',
  size     = 'md',
  icon,
  iconSize,
  children,
  className = '',
  ...rest
}: ButtonProps) => {
  const isIconOnly = !!icon && !children;

  const cls = [
    styles.btn,
    SIZE[size],
    VARIANT_INTENT[variant][intent],
    isIconOnly ? styles.iconOnly : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button className={cls} {...rest}>
      {icon && <Icon name={icon} size={iconSize} />}
      {children}
    </button>
  );
};

export default Button;

