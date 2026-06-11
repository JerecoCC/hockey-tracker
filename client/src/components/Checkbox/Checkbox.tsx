import Icon from '../Icon/Icon';
import styles from './Checkbox.module.scss';

interface CheckboxProps {
  checked: boolean;
  /** Called when the checkbox itself is clicked. The parent <li> handles row-level toggling. */
  onChange?: () => void;
  className?: string;
  disabled?: boolean;
}

const Checkbox = ({ checked, onChange, className, disabled = false }: CheckboxProps) => (
  <span
    className={[styles.checkbox, checked ? styles.checked : '', className]
      .filter(Boolean)
      .join(' ')}
    role="checkbox"
    aria-checked={checked}
    aria-disabled={disabled}
    onClick={(e) => {
      e.stopPropagation();
      if (disabled) return;
      onChange?.();
    }}
  >
    {checked && <Icon name="check" size="0.7em" />}
  </span>
);

export default Checkbox;
