import type { ReactNode } from 'react';
import Button from '../Button/Button';
import styles from './AddRowBar.module.scss';

interface Props {
  /** Label for the ghost "add" button. */
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Optional content rendered on the right (e.g. a slot counter). */
  hint?: ReactNode;
}

const AddRowBar = ({ label, onClick, disabled, hint }: Props) => (
  <div className={styles.root}>
    <Button
      type="button"
      variant="ghost"
      intent="neutral"
      icon="add"
      size="sm"
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </Button>
    {hint && <span className={styles.hint}>{hint}</span>}
  </div>
);

export default AddRowBar;
