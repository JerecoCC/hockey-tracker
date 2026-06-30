import Icon from '../Icon/Icon';
import Divider from '../Divider/Divider';
import styles from './CheckboxField.module.scss';

interface CheckboxFieldProps {
  checked: boolean;
  label: string;
  onChange?: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
}

const CheckboxField = ({
  checked,
  label,
  onChange,
  className,
  disabled = false,
}: CheckboxFieldProps) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    className={[styles.field, checked ? styles.checked : '', className].filter(Boolean).join(' ')}
    disabled={disabled}
    onClick={() => {
      if (disabled) return;
      onChange?.(!checked);
    }}
  >
    <span
      className={styles.checkRegion}
      aria-hidden="true"
    >
      <span className={styles.checkBox}>{checked && <Icon name="check" size="0.75rem" />}</span>
    </span>
    <Divider
      variant="vertical"
      className={styles.divider}
    />
    <span className={styles.label}>{label}</span>
  </button>
);

export default CheckboxField;
