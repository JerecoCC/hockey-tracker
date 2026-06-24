import Icon from '../Icon/Icon';
import styles from './Checkbox.module.scss';

interface CheckboxProps {
  checked: boolean;
  /** Called when the checkbox itself is clicked. The parent <li> handles row-level toggling. */
  onChange?: () => void;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
  ariaLabelledBy?: string;
}

const Checkbox = ({
  checked,
  onChange,
  className,
  disabled = false,
  ariaLabel,
  ariaLabelledBy,
}: CheckboxProps) => (
  <span
    className={[styles.checkbox, checked ? styles.checked : '', className]
      .filter(Boolean)
      .join(' ')}
    role="checkbox"
    aria-checked={checked}
    aria-disabled={disabled}
    aria-label={ariaLabel}
    aria-labelledby={ariaLabelledBy}
    tabIndex={disabled ? undefined : 0}
    onClick={(e) => {
      e.stopPropagation();
      if (disabled) return;
      onChange?.();
    }}
    onKeyDown={(e) => {
      if (disabled) return;
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      e.stopPropagation();
      onChange?.();
    }}
  >
    {checked && <Icon name="check" size="0.875rem" />}
  </span>
);

export default Checkbox;
