import styles from './RadioButton.module.scss';

interface RadioButtonProps {
  checked: boolean;
  /** Called only when selecting an unchecked radio button. */
  onChange?: () => void;
  className?: string;
  disabled?: boolean;
  ariaLabelledBy: string;
}

const RadioButton = ({
  checked,
  onChange,
  className,
  disabled = false,
  ariaLabelledBy,
}: RadioButtonProps) => {
  const select = () => {
    if (disabled || checked) return;
    onChange?.();
  };

  return (
    <span
      className={[styles.radio, checked ? styles.checked : '', className].filter(Boolean).join(' ')}
      role="radio"
      aria-checked={checked}
      aria-disabled={disabled}
      aria-labelledby={ariaLabelledBy}
      tabIndex={disabled ? undefined : 0}
      onClick={(e) => {
        e.stopPropagation();
        select();
      }}
      onKeyDown={(e) => {
        if (e.key !== ' ' && e.key !== 'Enter') return;
        e.preventDefault();
        e.stopPropagation();
        select();
      }}
    >
      {checked && (
        <span
          className={styles.inner}
          aria-hidden="true"
        />
      )}
    </span>
  );
};

export default RadioButton;
