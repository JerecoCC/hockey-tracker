import type { HTMLAttributes, ReactNode } from 'react';
import styles from './ActionOverlay.module.scss';

interface Props extends HTMLAttributes<HTMLSpanElement> {
  /** Class from the consumer's module — used by the parent's hover selector to reveal the overlay */
  className?: string;
  children: ReactNode;
}

const ActionOverlay = (props: Props) => {
  const { className, children, ...spanProps } = props;
  return (
    <span
      {...spanProps}
      className={`${styles.root} ${className ?? ''}`.trim()}
    >
      {children}
    </span>
  );
};

export default ActionOverlay;
