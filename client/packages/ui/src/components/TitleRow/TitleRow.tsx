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
  const { rowContainer, mobileLeftContainer } = useTitleRowContainer();
  const hideRowOnMobile = !!left && !!right && !!mobileLeftContainer;
  const classes = [styles.titleRow, hideRowOnMobile && styles.titleRowHiddenMobile, className]
    .filter(Boolean)
    .join(' ');

  const node = (
    <div className={classes}>
      {left}
      {right}
    </div>
  );

  const mobileLeftNode =
    hideRowOnMobile && mobileLeftContainer
      ? createPortal(<div className={styles.mobileHeaderAction}>{left}</div>, mobileLeftContainer)
      : null;

  // When AdminLayout provides a portal target, render there (outside the page's
  // DOM tree but still inside <main>). Falls back to in-place rendering.
  const rowNode = rowContainer ? createPortal(node, rowContainer) : node;
  return (
    <>
      {mobileLeftNode}
      {rowNode}
    </>
  );
};

export default TitleRow;
