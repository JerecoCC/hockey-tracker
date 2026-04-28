import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import Icon from '../Icon/Icon';
import styles from './TimePicker.module.scss';

interface Props {
  value: string; // HH:MM (24-hour) or '' in clock mode; MM:SS or '' in duration mode
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** 'clock' (default) — wall-clock time in 12h AM/PM format (HH:MM 24h internally).
   *  'duration' — period elapsed time as MM:SS (0–20 min, 0–59 sec). */
  mode?: 'clock' | 'duration';
  /** When true, focuses the text input and activates the hour segment on mount. */
  autoFocus?: boolean;
}

type Segment = 'hour' | 'minute' | 'ampm';

// Display format: "hh:mm AM" (8 chars)
// Positions: hour=0-1, ':' at 2, minute=3-4, ' ' at 5, ampm=6-7
const SEGMENT_INFO: Record<
  Segment,
  { start: number; end: number; placeholder: string; maxLen: number }
> = {
  hour: { start: 0, end: 2, placeholder: '--', maxLen: 2 },
  minute: { start: 3, end: 5, placeholder: '--', maxLen: 2 },
  ampm: { start: 6, end: 8, placeholder: '--', maxLen: 2 },
};
const SEGMENT_ORDER: Segment[] = ['hour', 'minute', 'ampm'];

/** 24-hour → 12-hour + AM/PM. */
const to12h = (h24: number): { h12: number; ampm: 'AM' | 'PM' } => ({
  h12: h24 % 12 === 0 ? 12 : h24 % 12,
  ampm: h24 < 12 ? 'AM' : 'PM',
});

/** 12-hour + AM/PM → 24-hour. */
const to24h = (h12: number, ampm: 'AM' | 'PM'): number => {
  if (ampm === 'AM') return h12 === 12 ? 0 : h12;
  return h12 === 12 ? 12 : h12 + 12;
};

const parseTime = (val: string): { h24: number; m: number } | null => {
  if (!val) return null;
  const [h, m] = val.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return { h24: h, m };
};

const toHHMM = (h24: number, m: number) =>
  `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

const buildDisplay = (
  cHour12: number | null,
  cMinute: number | null,
  cAmPm: 'AM' | 'PM' | null,
  activeSeg: Segment | null,
  buf: string,
): string => {
  const seg = (s: Segment, val: string | null): string => {
    const info = SEGMENT_INFO[s];
    if (s === activeSeg && buf.length > 0) return buf + info.placeholder.slice(buf.length);
    return val !== null ? val : info.placeholder;
  };
  const hourStr = cHour12 !== null ? String(cHour12).padStart(2, '0') : null;
  const minStr = cMinute !== null ? String(cMinute).padStart(2, '0') : null;
  return `${seg('hour', hourStr)}:${seg('minute', minStr)} ${seg('ampm', cAmPm)}`;
};

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1); // 1–12
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 0, 5, …, 55
const PERIOD_MINS = Array.from({ length: 21 }, (_, i) => i); // 0–20
const PERIOD_SECS = Array.from({ length: 12 }, (_, i) => i * 5); // 0, 5, …, 55

/** Display for duration (MM:SS) mode. */
const buildDurationDisplay = (
  cMins: number | null,
  cSecs: number | null,
  activeSeg: Segment | null,
  buf: string,
): string => {
  const seg = (s: Segment, val: string | null): string => {
    const info = SEGMENT_INFO[s];
    if (s === activeSeg && buf.length > 0) return buf + info.placeholder.slice(buf.length);
    return val !== null ? val : info.placeholder;
  };
  const minStr = cMins !== null ? String(cMins).padStart(2, '0') : null;
  const secStr = cSecs !== null ? String(cSecs).padStart(2, '0') : null;
  return `${seg('hour', minStr)}:${seg('minute', secStr)}`;
};

const TimePicker = ({
  value,
  onChange,
  placeholder,
  disabled,
  mode = 'clock',
  autoFocus,
}: Props) => {
  const parsed = parseTime(value);
  const init12 = parsed && mode === 'clock' ? to12h(parsed.h24) : null;
  // In duration mode: cHour12 = elapsed minutes (0–20), cMinute = elapsed seconds (0–59), cAmPm unused.
  const [cHour12, setCHour12] = useState<number | null>(
    mode === 'duration' ? (parsed?.h24 ?? null) : (init12?.h12 ?? null),
  );
  const [cMinute, setCMinute] = useState<number | null>(parsed?.m ?? null);
  const [cAmPm, setCAmPm] = useState<'AM' | 'PM' | null>(init12?.ampm ?? null);
  const [activeSeg, setActiveSeg] = useState<Segment | null>(null);
  const [buf, setBuf] = useState('');
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});

  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingSelRef = useRef<[number, number] | null>(null);
  const hourColRef = useRef<HTMLDivElement>(null);
  const minColRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (pendingSelRef.current && inputRef.current) {
      const [s, e] = pendingSelRef.current;
      inputRef.current.setSelectionRange(s, e);
      pendingSelRef.current = null;
    }
  });

  // Computed segment order — duration has no ampm segment.
  const segmentOrder: Segment[] = mode === 'duration' ? ['hour', 'minute'] : SEGMENT_ORDER;

  useEffect(() => {
    const p = parseTime(value);
    if (p) {
      if (mode === 'duration') {
        setCHour12(p.h24); // reuse slot for elapsed minutes
        setCMinute(p.m); // reuse slot for elapsed seconds
        setCAmPm(null);
      } else {
        const { h12, ampm } = to12h(p.h24);
        setCHour12(h12);
        setCMinute(p.m);
        setCAmPm(ampm);
      }
    } else {
      setCHour12(null);
      setCMinute(null);
      setCAmPm(null);
    }
    setActiveSeg(null);
    setBuf('');
  }, [value, mode]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Scroll selected item into view when dropdown opens
  useEffect(() => {
    if (!open) return;
    if (cHour12 != null && hourColRef.current) {
      const btn = hourColRef.current.querySelector(`[data-val="${cHour12}"]`) as HTMLElement | null;
      btn?.scrollIntoView({ block: 'center' });
    }
    if (cMinute != null && minColRef.current) {
      const steps = mode === 'duration' ? PERIOD_SECS : MINUTES;
      const rounded = steps.includes(cMinute) ? cMinute : 0;
      const btn = minColRef.current.querySelector(`[data-val="${rounded}"]`) as HTMLElement | null;
      btn?.scrollIntoView({ block: 'center' });
    }
  }, [open, cHour12, cMinute, mode]);

  // Auto-focus the text input on mount when requested
  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
      // Explicitly activate the hour segment so handleKeyDown can process
      // keypresses immediately — same race-condition fix as DatePicker.
      activateSegment('hour');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const measureDropdown = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setDropdownStyle({ top: r.bottom + 6, left: r.left });
  };

  const emitChange = (first: number | null, second: number | null, ap: 'AM' | 'PM' | null) => {
    if (mode === 'duration') {
      if (first !== null && second !== null) {
        const mmss = `${String(first).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
        if (mmss !== value) onChange(mmss);
      } else if (value !== '') {
        onChange('');
      }
    } else {
      if (first !== null && second !== null && ap !== null) {
        const hhmm = toHHMM(to24h(first, ap), second);
        if (hhmm !== value) onChange(hhmm);
      } else if (value !== '') {
        onChange('');
      }
    }
  };

  const openPicker = () => {
    if (!open) measureDropdown();
    setOpen((o) => !o);
  };

  const clearTime = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange('');
    setCHour12(null);
    setCMinute(null);
    setCAmPm(null);
    setBuf('');
    setActiveSeg(null);
  };

  const activateSegment = (seg: Segment) => {
    setActiveSeg(seg);
    setBuf('');
    pendingSelRef.current = [SEGMENT_INFO[seg].start, SEGMENT_INFO[seg].end];
  };

  const handleInputClick = () => {
    const pos = inputRef.current?.selectionStart ?? 0;
    if (pos <= 2) activateSegment('hour');
    else if (pos <= 5) activateSegment('minute');
    else if (mode === 'clock') activateSegment('ampm');
    // duration: clicking after "MM:SS" (len=5) stays in minute/second segment
  };

  const handleFocus = () => {
    if (!activeSeg) activateSegment('hour');
  };
  const handleBlur = () => {
    setBuf('');
    setActiveSeg(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey || e.metaKey) return;
    const seg = activeSeg;
    if (!seg) return;
    const info = SEGMENT_INFO[seg];
    const segIdx = segmentOrder.indexOf(seg);

    const goToSeg = (s: Segment) => {
      setActiveSeg(s);
      setBuf('');
      pendingSelRef.current = [SEGMENT_INFO[s].start, SEGMENT_INFO[s].end];
    };

    // Duration mode has no ampm segment — skip that entire branch.

    // AM/PM segment: letter keys + arrow toggle, no digit buffering
    if (seg === 'ampm') {
      if (e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setCAmPm('AM');
        emitChange(cHour12, cMinute, 'AM');
      } else if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setCAmPm('PM');
        emitChange(cHour12, cMinute, 'PM');
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = cAmPm === 'AM' ? 'PM' : 'AM';
        setCAmPm(next);
        emitChange(cHour12, cMinute, next);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        setCAmPm(null);
        if (value !== '') onChange('');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToSeg('minute');
      } else if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        goToSeg('minute');
      }
      pendingSelRef.current = [info.start, info.end];
      return;
    }

    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      const newBuf = buf + e.key;
      let shouldCommit = newBuf.length === info.maxLen;
      if (!shouldCommit) {
        const v = parseInt(newBuf, 10);
        if (seg === 'hour') {
          // clock: first digit > 1 → can't form valid 12h hour
          // duration: first digit > 2 → can't form valid minute 0-20
          if (mode === 'clock' ? v > 1 : v > 2) shouldCommit = true;
        }
        // minute/second: first digit > 5 means can't be valid (60+)
        if (seg === 'minute' && v > 5) shouldCommit = true;
      }
      if (shouldCommit) {
        const v = parseInt(newBuf.padStart(info.maxLen, '0'), 10);
        let valid = true;
        if (seg === 'hour') {
          if (mode === 'clock' ? v < 1 || v > 12 : v > 20) valid = false;
        }
        if (seg === 'minute' && (v < 0 || v > 59)) valid = false;
        // duration cap: seconds must be 0 when minutes = 20
        if (mode === 'duration' && seg === 'minute' && cHour12 === 20 && v > 0) valid = false;
        if (!valid) {
          setBuf('');
          pendingSelRef.current = [info.start, info.end];
          return;
        }
        let newH = cHour12,
          newM = cMinute;
        if (seg === 'hour') {
          setCHour12(v);
          newH = v;
          // entering minutes=20 clamps existing seconds to 0
          if (mode === 'duration' && v === 20 && (cMinute ?? 0) > 0) {
            setCMinute(0);
            newM = 0;
          }
        } else {
          setCMinute(v);
          newM = v;
        }
        setBuf('');
        emitChange(newH, newM, cAmPm);
        const nextSeg = SEGMENT_ORDER[segIdx + 1];
        if (nextSeg) {
          setActiveSeg(nextSeg);
          pendingSelRef.current = [SEGMENT_INFO[nextSeg].start, SEGMENT_INFO[nextSeg].end];
        } else setActiveSeg(null);
      } else {
        setBuf(newBuf);
        pendingSelRef.current = [info.start, info.end];
      }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const delta = e.key === 'ArrowUp' ? 1 : -1;
      if (seg === 'hour') {
        if (mode === 'duration') {
          // cycle 0–20
          const next = ((cHour12 ?? 0) + delta + 21) % 21;
          // cycling to 20 clamps seconds to 0
          const newSecs = next === 20 && (cMinute ?? 0) > 0 ? 0 : cMinute;
          setCHour12(next);
          if (newSecs !== cMinute) setCMinute(newSecs ?? 0);
          emitChange(next, newSecs ?? cMinute, null);
        } else {
          // cycle 1–12
          const next = (((cHour12 ?? 1) - 1 + delta + 12) % 12) + 1;
          setCHour12(next);
          emitChange(next, cMinute, cAmPm);
        }
      } else {
        // seconds/minutes — clamp seconds to 0 when minutes = 20
        const raw = ((cMinute ?? 0) + delta + 60) % 60;
        const next = mode === 'duration' && cHour12 === 20 ? 0 : raw;
        setCMinute(next);
        emitChange(cHour12, next, mode === 'clock' ? cAmPm : null);
      }
      pendingSelRef.current = [info.start, info.end];
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      if (buf.length > 0) {
        setBuf(buf.slice(0, -1));
      } else {
        if (seg === 'hour') {
          setCHour12(null);
          emitChange(null, cMinute, cAmPm);
        } else {
          setCMinute(null);
          emitChange(cHour12, null, cAmPm);
        }
      }
      pendingSelRef.current = [info.start, info.end];
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setBuf('');
      const prev = segmentOrder[segIdx - 1];
      if (prev) goToSeg(prev);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setBuf('');
      const next = segmentOrder[segIdx + 1];
      if (next) goToSeg(next);
    } else if (e.key === 'Tab') {
      if (!e.shiftKey) {
        const next = segmentOrder[segIdx + 1];
        if (next) {
          e.preventDefault();
          goToSeg(next);
        }
      } else {
        const prev = segmentOrder[segIdx - 1];
        if (prev) {
          e.preventDefault();
          goToSeg(prev);
        }
      }
    } else {
      e.preventDefault();
    }
  };

  const selectHour = (h: number) => {
    setCHour12(h);
    // duration cap: selecting 20 min clamps existing seconds to 0
    const newSecs = mode === 'duration' && h === 20 && (cMinute ?? 0) > 0 ? 0 : cMinute;
    if (mode === 'duration' && newSecs !== cMinute) setCMinute(newSecs ?? 0);
    emitChange(
      h,
      mode === 'duration' ? (newSecs ?? cMinute) : cMinute,
      mode === 'clock' ? cAmPm : null,
    );
    if ((mode === 'duration' ? (newSecs ?? cMinute) : cMinute) === null) activateSegment('minute');
    else if (mode === 'duration') setOpen(false);
  };

  const selectMinute = (m: number) => {
    // duration cap: disallow seconds > 0 when minutes = 20
    const clamped = mode === 'duration' && cHour12 === 20 ? 0 : m;
    setCMinute(clamped);
    emitChange(cHour12, clamped, mode === 'clock' ? cAmPm : null);
    if (mode === 'duration') {
      setOpen(false);
    } else if (cAmPm === null) {
      activateSegment('ampm');
    } else {
      setOpen(false);
    }
  };

  const selectAmPm = (ap: 'AM' | 'PM') => {
    setCAmPm(ap);
    emitChange(cHour12, cMinute, ap);
    setOpen(false);
  };

  const displayValue =
    mode === 'duration'
      ? buildDurationDisplay(cHour12, cMinute, activeSeg, buf)
      : buildDisplay(cHour12, cMinute, cAmPm, activeSeg, buf);
  const isEmpty = cHour12 === null && cMinute === null && (mode === 'duration' || cAmPm === null);

  return (
    <div
      ref={wrapperRef}
      className={styles.wrapper}
    >
      <div
        ref={triggerRef}
        className={[styles.trigger, disabled && styles.triggerDisabled].filter(Boolean).join(' ')}
      >
        <button
          type="button"
          className={styles.clockIconBtn}
          onClick={openPicker}
          tabIndex={-1}
          aria-label="Open time picker"
          disabled={disabled}
        >
          <Icon
            name="schedule"
            size="0.875rem"
            className={styles.clockIcon}
          />
        </button>
        <input
          ref={inputRef}
          type="text"
          className={styles.textInput}
          value={displayValue}
          data-empty={isEmpty}
          placeholder={placeholder}
          onChange={() => {}}
          onClick={!disabled ? handleInputClick : undefined}
          onKeyDown={!disabled ? handleKeyDown : undefined}
          onFocus={!disabled ? handleFocus : undefined}
          onBlur={!disabled ? handleBlur : undefined}
          readOnly={disabled}
        />
        {!disabled && (
          <span
            className={[styles.clear, !value && styles.clearHidden].filter(Boolean).join(' ')}
            onClick={value ? clearTime : undefined}
            role={value ? 'button' : undefined}
            aria-label={value ? 'Clear' : undefined}
          >
            ×
          </span>
        )}
      </div>

      {open && (
        <div
          className={styles.dropdown}
          style={dropdownStyle}
        >
          <div className={styles.columns}>
            {/* ── Column 1: Hour (clock) or Minute (duration) ── */}
            <div className={styles.columnWrap}>
              <div className={styles.columnLabel}>{mode === 'duration' ? 'Min' : 'Hour'}</div>
              <div
                ref={hourColRef}
                className={styles.column}
              >
                {(mode === 'duration' ? PERIOD_MINS : HOURS_12).map((h) => (
                  <button
                    key={h}
                    type="button"
                    data-val={h}
                    className={`${styles.timeBtn}${cHour12 === h ? ` ${styles.selected}` : ''}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectHour(h);
                    }}
                  >
                    {String(h).padStart(2, '0')}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.columnDivider} />
            {/* ── Column 2: Minute (clock) or Second (duration) ── */}
            <div className={styles.columnWrap}>
              <div className={styles.columnLabel}>{mode === 'duration' ? 'Sec' : 'Min'}</div>
              <div
                ref={minColRef}
                className={styles.column}
              >
                {(mode === 'duration' ? PERIOD_SECS : MINUTES).map((m) => {
                  // duration cap: seconds > 0 are unavailable when minutes = 20
                  const disabledSec = mode === 'duration' && cHour12 === 20 && m > 0;
                  return (
                    <button
                      key={m}
                      type="button"
                      data-val={m}
                      disabled={disabledSec}
                      className={`${styles.timeBtn}${cMinute === m ? ` ${styles.selected}` : ''}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectMinute(m);
                      }}
                    >
                      {String(m).padStart(2, '0')}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* ── Column 3: AM/PM — clock mode only ── */}
            {mode === 'clock' && (
              <>
                <div className={styles.columnDivider} />
                <div className={styles.columnWrap}>
                  <div className={styles.columnLabel}>AM/PM</div>
                  <div className={styles.column}>
                    {(['AM', 'PM'] as const).map((ap) => (
                      <button
                        key={ap}
                        type="button"
                        data-val={ap}
                        className={`${styles.timeBtn}${cAmPm === ap ? ` ${styles.selected}` : ''}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectAmPm(ap);
                        }}
                      >
                        {ap}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <div className={styles.footer}>
            {mode === 'clock' && (
              <button
                type="button"
                className={styles.footerBtn}
                onMouseDown={(e) => {
                  e.preventDefault();
                  const now = new Date();
                  const { h12, ampm } = to12h(now.getHours());
                  setCHour12(h12);
                  setCMinute(now.getMinutes());
                  setCAmPm(ampm);
                  onChange(toHHMM(now.getHours(), now.getMinutes()));
                  setOpen(false);
                }}
              >
                Now
              </button>
            )}
            {value && (
              <button
                type="button"
                className={`${styles.footerBtn} ${styles.footerBtnClear}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  clearTime();
                  setOpen(false);
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TimePicker;
