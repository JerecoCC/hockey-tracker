import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import Icon from '../Icon/Icon';
import styles from './TimePicker.module.scss';

interface Props {
  value: string; // HH:MM (24-hour) or ''
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
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
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

const TimePicker = ({ value, onChange, placeholder, disabled }: Props) => {
  const parsed = parseTime(value);
  const init12 = parsed ? to12h(parsed.h24) : null;
  const [cHour12, setCHour12] = useState<number | null>(init12?.h12 ?? null);
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

  useEffect(() => {
    const p = parseTime(value);
    if (p) {
      const { h12, ampm } = to12h(p.h24);
      setCHour12(h12);
      setCMinute(p.m);
      setCAmPm(ampm);
    } else {
      setCHour12(null);
      setCMinute(null);
      setCAmPm(null);
    }
    setActiveSeg(null);
    setBuf('');
  }, [value]);

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
      const rounded = MINUTES.includes(cMinute) ? cMinute : 0;
      const btn = minColRef.current.querySelector(`[data-val="${rounded}"]`) as HTMLElement | null;
      btn?.scrollIntoView({ block: 'center' });
    }
  }, [open, cHour12, cMinute]);

  const measureDropdown = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setDropdownStyle({ top: r.bottom + 6, left: r.left });
  };

  const emitChange = (h12: number | null, m: number | null, ap: 'AM' | 'PM' | null) => {
    if (h12 !== null && m !== null && ap !== null) {
      const hhmm = toHHMM(to24h(h12, ap), m);
      if (hhmm !== value) onChange(hhmm);
    } else if (value !== '') {
      onChange('');
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
    else activateSegment('ampm');
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
    const segIdx = SEGMENT_ORDER.indexOf(seg);

    const goToSeg = (s: Segment) => {
      setActiveSeg(s);
      setBuf('');
      pendingSelRef.current = [SEGMENT_INFO[s].start, SEGMENT_INFO[s].end];
    };

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
        // hour (12h): first digit > 1 can't form a valid 2-digit 12h hour (20+)
        if (seg === 'hour' && v > 1) shouldCommit = true;
        // minute: first digit > 5 means can't be valid (60+)
        if (seg === 'minute' && v > 5) shouldCommit = true;
      }
      if (shouldCommit) {
        const v = parseInt(newBuf.padStart(info.maxLen, '0'), 10);
        let valid = true;
        if (seg === 'hour' && (v < 1 || v > 12)) valid = false;
        if (seg === 'minute' && (v < 0 || v > 59)) valid = false;
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
        // cycle 1–12
        const next = (((cHour12 ?? 1) - 1 + delta + 12) % 12) + 1;
        setCHour12(next);
        emitChange(next, cMinute, cAmPm);
      } else {
        const next = ((cMinute ?? 0) + delta + 60) % 60;
        setCMinute(next);
        emitChange(cHour12, next, cAmPm);
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
      const prev = SEGMENT_ORDER[segIdx - 1];
      if (prev) goToSeg(prev);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setBuf('');
      const next = SEGMENT_ORDER[segIdx + 1];
      if (next) goToSeg(next);
    } else if (e.key === 'Tab') {
      if (!e.shiftKey) {
        const next = SEGMENT_ORDER[segIdx + 1];
        if (next) {
          e.preventDefault();
          goToSeg(next);
        }
      } else {
        const prev = SEGMENT_ORDER[segIdx - 1];
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
    emitChange(h, cMinute, cAmPm);
    if (cMinute === null) activateSegment('minute');
  };

  const selectMinute = (m: number) => {
    setCMinute(m);
    emitChange(cHour12, m, cAmPm);
    if (cAmPm === null) activateSegment('ampm');
    else setOpen(false);
  };

  const selectAmPm = (ap: 'AM' | 'PM') => {
    setCAmPm(ap);
    emitChange(cHour12, cMinute, ap);
    setOpen(false);
  };

  const displayValue = buildDisplay(cHour12, cMinute, cAmPm, activeSeg, buf);
  const isEmpty = cHour12 === null && cMinute === null && cAmPm === null;

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
        {value && !disabled && (
          <span
            className={styles.clear}
            onClick={clearTime}
            role="button"
            aria-label="Clear"
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
            <div className={styles.columnWrap}>
              <div className={styles.columnLabel}>Hour</div>
              <div
                ref={hourColRef}
                className={styles.column}
              >
                {HOURS_12.map((h) => (
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
            <div className={styles.columnWrap}>
              <div className={styles.columnLabel}>Min</div>
              <div
                ref={minColRef}
                className={styles.column}
              >
                {MINUTES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    data-val={m}
                    className={`${styles.timeBtn}${cMinute === m ? ` ${styles.selected}` : ''}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectMinute(m);
                    }}
                  >
                    {String(m).padStart(2, '0')}
                  </button>
                ))}
              </div>
            </div>
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
          </div>
          <div className={styles.footer}>
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
