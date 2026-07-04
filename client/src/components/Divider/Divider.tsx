import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import styles from './Divider.module.scss';

export type DividerVariant = 'horizontal' | 'vertical';

interface DividerProps extends Omit<ComponentPropsWithoutRef<'span'>, 'children'> {
  variant?: DividerVariant;
  /** Optional label rendered between the lines for horizontal dividers. */
  text?: ReactNode;
}

const Divider = ({
  variant = 'horizontal',
  text,
  className,
  'aria-hidden': ariaHidden,
  ...rest
}: DividerProps) => {
  const hasText = variant === 'horizontal' && text != null && text !== false;

  return (
    <span
      className={[
        styles.divider,
        variant === 'vertical' ? styles.vertical : styles.horizontal,
        hasText && styles.horizontalWithText,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden={ariaHidden ?? !hasText}
      {...rest}
    >
      {hasText && <span className={styles.text}>{text}</span>}
    </span>
  );
};

export default Divider;
