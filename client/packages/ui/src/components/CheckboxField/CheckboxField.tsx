import Icon from '../Icon/Icon';
import Divider from '../Divider/Divider';
import styles from './CheckboxField.module.scss';

interface CheckboxFieldProps {
  checked: boolean;
  label: string;
  onChange?: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
  id?: string;
  ariaControls?: string;
  ariaExpanded?: boolean;
}

const CheckboxField = ({
  checked,
  label,
  onChange,
  className,
  disabled = false,
  id,
  ariaControls,
  ariaExpanded,
}: CheckboxFieldProps) => (
  <button
    id={id}
    type="button"
    role="checkbox"
    aria-checked={checked}
    aria-controls={ariaControls}
    aria-expanded={ariaExpanded}
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
