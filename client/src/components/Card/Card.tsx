import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from 'react';
import styles from './Card.module.scss';

interface CardProps extends ComponentPropsWithoutRef<'div'> {
  /** Visual theme. 'filled' = card bg + border. 'border' = transparent bg + border. 'light' = soft light bg + shadow. */
  variant?: 'filled' | 'border' | 'light';
  /** Extra CSS class for layout/sizing concerns (max-width, grid column, margin, etc.). */
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * A plain surface container (background, border, radius, padding). Has no header
 * of its own — compose a titled section with the Section component, or use Card
 * directly anywhere a card-like surface is needed (e.g. list items).
 */
const Card = forwardRef<HTMLDivElement, CardProps>((props, ref) => {
  const { variant = 'filled', className, style, children, ...rest } = props;
  const classes = [
    styles.card,
    variant === 'light' ? styles.light : variant === 'border' ? styles.border : styles.filled,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={ref}
      {...rest}
      className={classes}
      style={style}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';

export default Card;
