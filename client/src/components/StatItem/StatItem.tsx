import type { ReactNode } from 'react';
import cn from 'classnames';
import Tooltip from '../Tooltip/Tooltip';
import styles from './StatItem.module.scss';

type StatItemElement = 'div' | 'span';

interface StatItemProps {
  as?: StatItemElement;
  className?: string;
  label: ReactNode;
  value: ReactNode;
  tooltip?: string;
  muted?: boolean;
}

const isMutedValue = (value: ReactNode) =>
  typeof value === 'string' && (value === '--' || value === '\u2014');

const StatItem = ({
  as = 'div',
  className,
  label,
  value,
  tooltip,
  muted,
}: StatItemProps) => {
  const labelContent = <span className={styles.label}>{label}</span>;
  const valueClassName = (muted ?? isMutedValue(value)) ? styles.muted : styles.value;
  const content = (
    <>
      {tooltip ? <Tooltip text={tooltip}>{labelContent}</Tooltip> : labelContent}
      <span className={valueClassName}>{value}</span>
    </>
  );
  const itemClassName = cn(styles.item, className);

  return as === 'span' ? (
    <span className={itemClassName}>{content}</span>
  ) : (
    <div className={itemClassName}>{content}</div>
  );
};

export default StatItem;
