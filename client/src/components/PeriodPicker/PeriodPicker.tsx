import DatePicker from '@/components/DatePicker/DatePicker';
import Icon from '@/components/Icon/Icon';
import styles from './PeriodPicker.module.scss';

interface PeriodPickerProps {
  kind?: 'week' | 'month';
  value: string;
  label: string;
  onChange: (value: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  ariaLabel?: string;
  previousAriaLabel?: string;
  nextAriaLabel?: string;
  disabled?: boolean;
  className?: string;
}

const PeriodPicker = ({
  kind = 'week',
  value,
  label,
  onChange,
  onPrevious,
  onNext,
  ariaLabel,
  previousAriaLabel,
  nextAriaLabel,
  disabled,
  className,
}: PeriodPickerProps) => {
  const unitLabel = kind === 'month' ? 'month' : 'week';

  return (
    <span className={[styles.periodPicker, className].filter(Boolean).join(' ')}>
      <button
        type="button"
        className={styles.navButton}
        aria-label={previousAriaLabel ?? `Previous ${unitLabel}`}
        onClick={onPrevious}
        disabled={disabled}
      >
        <Icon
          name="chevron_left"
          size="1rem"
        />
      </button>
      <DatePicker
        value={value}
        onChange={onChange}
        granularity={kind === 'month' ? 'month' : 'day'}
        triggerLabel={label}
        triggerAriaLabel={ariaLabel ?? `Select ${unitLabel}: ${label}`}
        hideTriggerIcon
        disabled={disabled}
        className={styles.datePicker}
        triggerWrapClassName={styles.triggerWrap}
        triggerButtonClassName={styles.triggerButton}
      />
      <button
        type="button"
        className={styles.navButton}
        aria-label={nextAriaLabel ?? `Next ${unitLabel}`}
        onClick={onNext}
        disabled={disabled}
      >
        <Icon
          name="chevron_right"
          size="1rem"
        />
      </button>
    </span>
  );
};

export default PeriodPicker;
