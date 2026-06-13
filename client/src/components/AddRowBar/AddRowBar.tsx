import type { ReactNode } from 'react';
import Button from '../Button/Button';
import styles from './AddRowBar.module.scss';

interface Props {
  /** Label for the add button. */
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Optional content rendered on the right (e.g. a slot counter). */
  hint?: ReactNode;
}

const AddRowBar = ({ label, onClick, disabled, hint }: Props) => (
  <div className={styles.root}>
    {hint ? <span className={styles.hint}>{hint}</span> : <span className="filler"></span>}
    <Button
      type="button"
      variant="outlined"
      intent="accent"
      icon="add"
      size="sm"
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </Button>
  </div>
);

export default AddRowBar;
