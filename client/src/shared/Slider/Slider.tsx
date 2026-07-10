import type { CSSProperties, InputHTMLAttributes, ReactNode } from 'react';
import styles from './Slider.module.scss';

type NativeRangeProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'min' | 'max' | 'step' | 'onChange'
>;

interface SliderCommonProps extends NativeRangeProps {
  label?: string;
  valueLabel?: string;
  min: number;
  max: number;
  step?: number;
  className?: string;
  inputClassName?: string;
  showStops?: boolean;
  formatStopLabel?: (value: number) => ReactNode;
}

interface SingleSliderProps extends SliderCommonProps {
  variant?: 'single';
  value: number;
  onChange: (value: number) => void;
}

interface RangeSliderProps extends SliderCommonProps {
  variant: 'range';
  value: [number, number];
  onChange: (value: [number, number]) => void;
  disabledStart?: boolean;
  disabledEnd?: boolean;
  startAriaLabel?: string;
  endAriaLabel?: string;
}

type SliderProps = SingleSliderProps | RangeSliderProps;

const toRatio = (value: number, min: number, max: number) => {
  const range = Math.max(max - min, 1);
  return Math.min(Math.max((value - min) / range, 0), 1);
};

const trackPosition = (ratio: number) =>
  `calc(var(--slider-native-track-offset) + ((100% - (var(--slider-native-track-offset) * 2)) * ${ratio}))`;

const sliderStyle = (value: number | [number, number], min: number, max: number) => {
  const [startValue, endValue] = Array.isArray(value) ? value : [min, value];
  const startRatio = toRatio(startValue, min, max);
  const endRatio = toRatio(endValue, min, max);
  const fillLeft = startRatio <= 0 ? 'var(--slider-inset)' : trackPosition(startRatio);
  const fillEnd = trackPosition(endRatio);
  const fillRight = `calc(100% - ${fillEnd})`;

  return {
    '--slider-start-progress': `${startRatio * 100}%`,
    '--slider-end-progress': `${endRatio * 100}%`,
    '--slider-fill-left': fillLeft,
    '--slider-fill-right': fillRight,
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
  variant = 'single',
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
  disabledStart,
  disabledEnd,
  startAriaLabel,
  endAriaLabel,
  ...inputProps
}: SliderProps & Partial<RangeSliderProps>) => {
  const isRange = variant === 'range';
  const stops = showStops ? buildStops(min, max, step) : [];
  const startValue = Array.isArray(value) ? value[0] : min;
  const endValue = Array.isArray(value) ? value[1] : value;
  const startDisabled = isRange ? disabled || disabledStart : disabled;
  const endDisabled = isRange ? disabled || disabledEnd : disabled;
  const controlDisabled = disabled || (isRange && startDisabled && endDisabled);
  const rangeLabel = typeof label === 'string' ? label : 'Range';
  const singleOnChange = onChange as SingleSliderProps['onChange'];
  const rangeOnChange = onChange as RangeSliderProps['onChange'];
  const Root = isRange ? 'div' : 'label';

  return (
    <Root className={[styles.slider, className].filter(Boolean).join(' ')}>
      {(label || valueLabel) && (
        <span className={styles.header}>
          {label && <span className={styles.label}>{label}</span>}
          {valueLabel && <span className={styles.valueLabel}>{valueLabel}</span>}
        </span>
      )}
      <span
        className={[styles.control, controlDisabled ? styles.disabled : ''].filter(Boolean).join(' ')}
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
          {isRange && (
            <span className={[styles.thumb, styles.thumbStart].filter(Boolean).join(' ')} />
          )}
          <span className={[styles.thumb, styles.thumbEnd].filter(Boolean).join(' ')} />
        </span>
        {isRange ? (
          <>
            <input
              className={[
                styles.input,
                styles.rangeInput,
                styles.inputStart,
                inputClassName,
              ].filter(Boolean).join(' ')}
              type="range"
              min={min}
              max={max}
              step={step}
              value={startValue}
              disabled={startDisabled}
              aria-label={startAriaLabel ?? `${rangeLabel} start`}
              onChange={(event) => {
                const nextStart = Math.min(Number(event.target.value), endValue);
                rangeOnChange([nextStart, endValue]);
              }}
            />
            <input
              className={[
                styles.input,
                styles.rangeInput,
                styles.inputEnd,
                inputClassName,
              ].filter(Boolean).join(' ')}
              type="range"
              min={min}
              max={max}
              step={step}
              value={endValue}
              disabled={endDisabled}
              aria-label={endAriaLabel ?? `${rangeLabel} end`}
              onChange={(event) => {
                const nextEnd = Math.max(Number(event.target.value), startValue);
                rangeOnChange([startValue, nextEnd]);
              }}
            />
          </>
        ) : (
          <input
            {...inputProps}
            className={[styles.input, inputClassName].filter(Boolean).join(' ')}
            type="range"
            min={min}
            max={max}
            step={step}
            value={endValue}
            disabled={disabled}
            onChange={(event) => singleOnChange(Number(event.target.value))}
          />
        )}
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
    </Root>
  );
};

export default Slider;
