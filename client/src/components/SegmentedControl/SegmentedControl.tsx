import { Fragment, type ReactNode } from 'react';
import Divider from '../Divider/Divider';
import Tooltip from '../Tooltip/Tooltip';
import styles from './SegmentedControl.module.scss';

export interface SegmentedControlOption {
  value: string;
  label: ReactNode;
  /** Accessible label for icon-only or otherwise non-text labels. */
  ariaLabel?: string;
  /** Keeps icon-only buttons compact and close to square. Defaults to true when ariaLabel is provided. */
  iconOnly?: boolean;
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
      const isActive = value === opt.value;
      const isIconOnly = opt.iconOnly ?? Boolean(opt.ariaLabel);
      const btn = (
        <button
          type="button"
          className={[
            styles.option,
            isActive ? (opt.activeClassName ?? styles.active) : '',
          ]
            .filter(Boolean)
            .join(' ')}
          data-active={isActive ? 'true' : undefined}
          data-icon-only={isIconOnly ? 'true' : undefined}
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          aria-label={opt.ariaLabel}
          autoFocus={autoFocus && i === 0}
        >
          {opt.label}
        </button>
      );
      return (
        <Fragment key={opt.value}>
          {i > 0 && (
            <Divider
              variant="vertical"
              className={styles.divider}
            />
          )}
          {opt.tooltip ? (
            <Tooltip
              text={opt.tooltip}
              className={styles.optionWrapper}
            >
              {btn}
            </Tooltip>
          ) : (
            btn
          )}
        </Fragment>
      );
    })}
  </div>
);

export default SegmentedControl;
