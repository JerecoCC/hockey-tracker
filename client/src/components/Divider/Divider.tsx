import type { ComponentPropsWithoutRef } from 'react';
import styles from './Divider.module.scss';

export type DividerVariant = 'horizontal' | 'vertical';

interface DividerProps extends ComponentPropsWithoutRef<'span'> {
  variant?: DividerVariant;
}

const Divider = ({
  variant = 'horizontal',
  className,
  'aria-hidden': ariaHidden = true,
  ...rest
}: DividerProps) => (
  <span
    className={[
      styles.divider,
      variant === 'vertical' ? styles.vertical : styles.horizontal,
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    aria-hidden={ariaHidden}
    {...rest}
  />
);

export default Divider;
