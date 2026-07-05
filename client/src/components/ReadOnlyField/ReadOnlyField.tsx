import { useId, type ReactNode } from 'react';
import styles from './ReadOnlyField.module.scss';

interface ReadOnlyFieldProps {
  label: ReactNode;
  value: ReactNode;
  title?: string;
  className?: string;
}

const ReadOnlyField = ({ label, value, title, className }: ReadOnlyFieldProps) => {
  const labelId = useId();

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <span
        id={labelId}
        className={styles.label}
      >
        {label}
      </span>
      <div
        className={styles.box}
        aria-disabled="true"
        aria-labelledby={labelId}
        title={title}
      >
        <span className={styles.value}>{value}</span>
      </div>
    </div>
  );
};

export default ReadOnlyField;
