import Icon from '@/components/Icon/Icon';
import styles from '@/components/Checkbox/Checkbox.module.scss';

interface CheckboxProps {
  checked: boolean;
  /** Called when the checkbox itself is clicked. The parent <li> handles row-level toggling. */
  onChange?: () => void;
  className?: string;
}

const Checkbox = ({ checked, onChange, className }: CheckboxProps) => (
  <span
    className={[styles.checkbox, checked ? styles.checked : '', className]
      .filter(Boolean)
      .join(' ')}
    role="checkbox"
    aria-checked={checked}
    onClick={(e) => {
      e.stopPropagation();
      onChange?.();
    }}
  >
    {checked && <Icon name="check" size="0.7em" />}
  </span>
);

export default Checkbox;
