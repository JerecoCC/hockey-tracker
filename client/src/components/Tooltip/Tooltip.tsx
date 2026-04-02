import { ReactNode } from 'react';
import styles from './Tooltip.module.scss';

interface TooltipProps {
  text: string;
  children: ReactNode;
}

const Tooltip = ({ text, children }: TooltipProps) => (
  <span className={styles.wrapper}>
    {children}
    <span
      className={styles.tip}
      role="tooltip"
    >
      {text}
    </span>
  </span>
);

export default Tooltip;

