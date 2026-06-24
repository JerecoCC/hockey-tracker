import type { ReactNode } from 'react';
import Tooltip from '../Tooltip/Tooltip';
import styles from './SegmentedControl.module.scss';

export interface SegmentedControlOption {
  value: string;
  label: ReactNode;
  /** Accessible label for icon-only or otherwise non-text labels. */
  ariaLabel?: string;
  /** When provided, replaces the default `.active` class when this option is selected. */
  activeClassName?: string;
  /** When provided, wraps the button in a Tooltip with this text. */
  tooltip?: string;
}

interface SegmentedControlProps {
  /** Currently selected value. Pass `null` to render with no option selected. */
  value: string | null;
  /** Called with the new value when the user selects an option. */
  onChange: (value: string) => void;
  /** The options to render. Supports any number of items. */
  options: SegmentedControlOption[];
  /** Disables all option buttons. */
  disabled?: boolean;
  /** Moves focus to the first option button on mount. */
  autoFocus?: boolean;
  /** Field treatment for usage inside labeled form controls. */
  variant?: 'default' | 'field';
  /** Extra CSS class applied to the root wrapper (e.g. for width overrides). */
  className?: string;
}

/**
 * Segmented control — a connected button group that acts like a radio input.
 * Supports any number of options and accepts arbitrary ReactNode labels so
 * callers can include icons, logos, or plain text.
 */
const SegmentedControl = ({
  value,
  onChange,
  options,
  disabled = false,
  autoFocus = false,
  variant = 'default',
  className,
}: SegmentedControlProps) => (
  <div
    className={[styles.segmentedControl, variant === 'field' ? styles.field : '', className]
      .filter(Boolean)
      .join(' ')}
  >
    {options.map((opt, i) => {
      const btn = (
        <button
          key={opt.value}
          type="button"
          className={[
            styles.option,
            value === opt.value ? (opt.activeClassName ?? styles.active) : '',
            i === 0 ? styles.firstOption : '',
            i === options.length - 1 ? styles.lastOption : '',
          ]
            .filter(Boolean)
            .join(' ')}
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          aria-label={opt.ariaLabel}
          autoFocus={autoFocus && i === 0}
        >
          {opt.label}
        </button>
      );
      return opt.tooltip ? (
        <Tooltip
          key={opt.value}
          text={opt.tooltip}
          className={styles.optionWrapper}
        >
          {btn}
        </Tooltip>
      ) : (
        btn
      );
    })}
  </div>
);

export default SegmentedControl;
