import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from 'react';
import Card from '../Card/Card';
import styles from './Section.module.scss';

interface SectionProps extends Omit<ComponentPropsWithoutRef<'div'>, 'title'> {
  /** Visual theme of the underlying Card. 'filled' = card bg + border. 'border' = transparent bg + border. 'light' = soft light bg + shadow. */
  variant?: 'filled' | 'border' | 'light';
  /** Section title at the start of the header row. Accepts a string or any ReactNode. */
  title?: ReactNode;
  /** Optional element rendered beside the title, before the right-side action. */
  titleAccessory?: ReactNode;
  /** Optional element placed at the end of the header row (e.g. an Add button or control). */
  action?: ReactNode;
  /** Extra CSS class for layout/sizing concerns (max-width, grid column, margin, etc.). */
  className?: string;
  style?: CSSProperties;
  /** When true, removes the bottom margin from the header row. */
  noHeaderMargin?: boolean;
  children: ReactNode;
}

/**
 * A titled content section: a Card container with a header row (title + optional
 * right-side action) above its body. Use Card directly when you only need the
 * surface with no header.
 */
const Section = forwardRef<HTMLDivElement, SectionProps>((props, ref) => {
  const {
    variant = 'filled',
    title,
    titleAccessory,
    action,
    className,
    style,
    noHeaderMargin,
    children,
    ...rest
  } = props;

  return (
    <Card
      ref={ref}
      variant={variant}
      className={className}
      style={style}
      {...rest}
    >
      {(title || titleAccessory || action) && (
        <div
          className={[styles.sectionHeader, noHeaderMargin && styles.sectionHeaderNoMargin]
            .filter(Boolean)
            .join(' ')}
        >
          {(title || titleAccessory) && (
            <div className={styles.sectionTitleGroup}>
              {title && <h3 className={styles.sectionTitle}>{title}</h3>}
              {titleAccessory}
            </div>
          )}
          {action}
        </div>
      )}
      {children}
    </Card>
  );
});

Section.displayName = 'Section';

export default Section;
