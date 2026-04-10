import type { ReactNode } from 'react';
import styles from './TitleRow.module.scss';

interface TitleRowProps {
  /** Content on the left side (e.g. a back button or primary action). */
  left?: ReactNode;
  /** Content on the right side (e.g. breadcrumbs or a secondary action). */
  right?: ReactNode;
  /** Extra CSS class for overrides. */
  className?: string;
}

const TitleRow = ({ left, right, className }: TitleRowProps) => {
  const classes = [styles.titleRow, className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {left}
      {right}
    </div>
  );
};

export default TitleRow;
