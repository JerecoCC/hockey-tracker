import { ReactNode } from 'react';
import styles from './Tooltip.module.scss';

interface TooltipProps {
  text: string;
  children: ReactNode;
  className?: string;
}

const Tooltip = ({ text, children, className = '' }: TooltipProps) => (
  <span className={`${styles.wrapper} ${className}`.trim()}>
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
