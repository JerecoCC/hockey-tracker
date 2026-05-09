import type { CSSProperties, ReactNode } from 'react';
import styles from './Card.module.scss';

interface CardProps {
  /** Visual theme. 'admin' = dark bg + border. 'light' = white bg + shadow. */
  variant?: 'admin' | 'light';
  /** Renders a header row with a title at the start. Accepts a string or any ReactNode. */
  title?: ReactNode;
  /** Optional element placed at the end of the header row (e.g. an Add button). */
  action?: ReactNode;
  /** Extra CSS class for layout/sizing concerns (max-width, grid column, margin, etc.). */
  className?: string;
  style?: CSSProperties;
  /** When true, removes the bottom margin from the card header row. */
  noHeaderMargin?: boolean;
  children: ReactNode;
}

const Card = (props: CardProps) => {
  const { variant = 'admin', title, action, className, style, noHeaderMargin, children } = props;
  const classes = [styles.card, variant === 'light' ? styles.light : styles.admin, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      style={style}
    >
      {(title || action) && (
        <div
          className={[styles.cardHeader, noHeaderMargin && styles.cardHeaderNoMargin]
            .filter(Boolean)
            .join(' ')}
        >
          {title && <h3 className={styles.cardTitle}>{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
};

export default Card;
