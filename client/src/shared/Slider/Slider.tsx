import type { CSSProperties, InputHTMLAttributes, ReactNode } from 'react';
import styles from './Slider.module.scss';

type NativeRangeProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'min' | 'max' | 'step' | 'onChange'
>;

interface SliderProps extends NativeRangeProps {
  label?: string;
  valueLabel?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  className?: string;
  inputClassName?: string;
  showStops?: boolean;
  formatStopLabel?: (value: number) => ReactNode;
}

const sliderStyle = (value: number, min: number, max: number) => {
  const range = Math.max(max - min, 1);
  const progressRatio = Math.min(Math.max((value - min) / range, 0), 1);
  return {
    '--slider-progress': `${progressRatio * 100}%`,
    '--slider-progress-ratio': String(progressRatio),
  } as CSSProperties;
};

const sliderStopStyle = (position: number) =>
  ({ '--slider-stop-position': `${position}%` }) as CSSProperties;

const buildStops = (min: number, max: number, step: number) => {
  const range = max - min;
  const safeStep = Number.isFinite(step) && step > 0 ? step : 1;

  if (!Number.isFinite(min) || !Number.isFinite(max) || range <= 0) {
    return [{ value: min, position: 0 }];
  }

  const steps = Math.floor(range / safeStep);
  const stops = Array.from({ length: steps + 1 }, (_, index) => {
    const value = Number((min + index * safeStep).toFixed(6));
    return {
      value,
      position: ((value - min) / range) * 100,
    };
  }).filter((stop) => stop.value <= max);

  if (stops[stops.length - 1]?.value !== max) {
    stops.push({ value: max, position: 100 });
  }

  return stops;
};

const Slider = ({
  label,
  valueLabel,
  value,
  min,
  max,
  step = 1,
  onChange,
  className,
  inputClassName,
  showStops = true,
  formatStopLabel = (stopValue) => stopValue,
  disabled,
  ...inputProps
}: SliderProps) => {
  const stops = showStops ? buildStops(min, max, step) : [];

  return (
    <label className={[styles.slider, className].filter(Boolean).join(' ')}>
      {(label || valueLabel) && (
        <span className={styles.header}>
          {label && <span className={styles.label}>{label}</span>}
          {valueLabel && <span className={styles.valueLabel}>{valueLabel}</span>}
        </span>
      )}
      <span
        className={[styles.control, disabled ? styles.disabled : ''].filter(Boolean).join(' ')}
        style={sliderStyle(value, min, max)}
      >
        <span className={styles.fill} aria-hidden="true" />
        {stops.length > 1 && (
          <span className={styles.stops} aria-hidden="true">
            {stops.map((stop) => (
              <span
                key={`divider-${stop.value}`}
                className={styles.stop}
                style={sliderStopStyle(stop.position)}
              />
            ))}
          </span>
        )}
        <span className={styles.thumbTrack} aria-hidden="true">
          <span className={styles.thumb} />
        </span>
        <input
          {...inputProps}
          className={[styles.input, inputClassName].filter(Boolean).join(' ')}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </span>
      {stops.length > 0 && (
        <span className={styles.indicators} aria-hidden="true">
          {stops.map((stop, index) => (
            <span
              key={`indicator-${stop.value}`}
              className={[
                styles.indicator,
                index === 0 ? styles.indicatorFirst : '',
                index === stops.length - 1 ? styles.indicatorLast : '',
              ].filter(Boolean).join(' ')}
              style={sliderStopStyle(stop.position)}
            >
              {formatStopLabel(stop.value)}
            </span>
          ))}
        </span>
      )}
    </label>
  );
};

export default Slider;
