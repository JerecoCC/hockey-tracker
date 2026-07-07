import { useId, type ReactNode } from 'react';
import Tooltip from '../Tooltip/Tooltip';
import styles from './ReadOnlyField.module.scss';

interface ReadOnlyFieldProps {
  label: ReactNode;
  value: ReactNode;
  title?: string;
  className?: string;
}

const ReadOnlyField = ({ label, value, title, className }: ReadOnlyFieldProps) => {
  const labelId = useId();
  const box = (
    <div
      className={styles.box}
      aria-disabled="true"
      aria-labelledby={labelId}
    >
      <span className={styles.value}>{value}</span>
    </div>
  );

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <span
        id={labelId}
        className={styles.label}
      >
        {label}
      </span>
      {title ? (
        <Tooltip
          text={title}
          className={styles.tooltip}
        >
          {box}
        </Tooltip>
      ) : (
        box
      )}
    </div>
  );
};

export default ReadOnlyField;
