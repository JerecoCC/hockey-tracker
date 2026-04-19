import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTitleRowContainer } from '../../context/TitleRowContext';
import styles from './TitleRow.module.scss';

interface TitleRowProps {
  /** Content on the left side (e.g. a back button or primary action). */
  left?: ReactNode;
  /** Content on the right side (e.g. breadcrumbs or a secondary action). */
  right?: ReactNode;
  /** Extra CSS class for overrides. */
  className?: string;
}

const TitleRow = (props: TitleRowProps) => {
  const { left, right, className } = props;
  const container = useTitleRowContainer();
  const classes = [styles.titleRow, className].filter(Boolean).join(' ');

  const node = (
    <div className={classes}>
      {left}
      {right}
    </div>
  );

  // When AdminLayout provides a portal target, render there (outside the page's
  // DOM tree but still inside <main>). Falls back to in-place rendering.
  return container ? createPortal(node, container) : node;
};

export default TitleRow;
