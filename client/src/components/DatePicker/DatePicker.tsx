import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Icon from '../Icon/Icon';
import styles from './DatePicker.module.scss';

interface Props {
  value: string; // YYYY-MM-DD or ''
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

type CalView = 'day' | 'month' | 'year';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/** Returns year/month/day for the current date in US Eastern time. */
const todayParts = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  return {
    y: Number(parts.find((p) => p.type === 'year')!.value),
    m: Number(parts.find((p) => p.type === 'month')!.value),
    d: Number(parts.find((p) => p.type === 'day')!.value),
  };
};

const parseISO = (iso: string) => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
};

const isValidDate = (y: number, m: number, d: number) => {
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= daysInMonth(y, m);
};

const toISO = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
const firstDayOfWeek = (y: number, m: number) => new Date(y, m - 1, 1).getDay();

// ── Segment types & constants ────────────────────────────────────────────────
type Segment = 'year' | 'month' | 'day';

const SEGMENT_INFO: Record<
  Segment,
  { start: number; end: number; placeholder: string; maxLen: number }
> = {
  year: { start: 0, end: 4, placeholder: 'YYYY', maxLen: 4 },
  month: { start: 5, end: 7, placeholder: 'MM', maxLen: 2 },
  day: { start: 8, end: 10, placeholder: 'DD', maxLen: 2 },
};

const SEGMENT_ORDER: Segment[] = ['year', 'month', 'day'];

/**
 * Build the 10-char display string (e.g. "2024/01/DD") from committed segment
 * values and the digit buffer being typed into the active segment.
 */
const buildDisplay = (
  cYear: number | null,
  cMonth: number | null,
  cDay: number | null,
  activeSeg: Segment | null,
  buf: string,
): string => {
  const seg = (s: Segment, committed: number | null): string => {
    const info = SEGMENT_INFO[s];
    if (s === activeSeg && buf.length > 0) {
      return buf + info.placeholder.slice(buf.length);
    }
    return committed !== null ? String(committed).padStart(info.maxLen, '0') : info.placeholder;
  };
  return `${seg('year', cYear)}/${seg('month', cMonth)}/${seg('day', cDay)}`;
};

const DatePicker = (props: Props) => {
  const { value, onChange, disabled } = props;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<CalView>('day');
  const parsed = parseISO(value);
  const t = todayParts();
  const [viewYear, setViewYear] = useState(parsed?.y ?? t.y);
  const [viewMonth, setViewMonth] = useState(parsed?.m ?? t.m);
  const [yearBase, setYearBase] = useState(() => Math.floor((parsed?.y ?? t.y) / 12) * 12);

  // Segment state: independently committed values + the active editing buffer
  const [cYear, setCYear] = useState<number | null>(parsed?.y ?? null);
  const [cMonth, setCMonth] = useState<number | null>(parsed?.m ?? null);
  const [cDay, setCDay] = useState<number | null>(parsed?.d ?? null);
  const [activeSeg, setActiveSeg] = useState<Segment | null>(null);
  const [buf, setBuf] = useState('');

  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});

  const measureDropdown = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setDropdownStyle({ top: r.bottom + 6, left: r.left });
  };
  /** Selection range [start, end] to restore after the next render. */
  const pendingSelRef = useRef<[number, number] | null>(null);

  // Restore the segment highlight after renders triggered by user interaction
  useLayoutEffect(() => {
    if (pendingSelRef.current && inputRef.current) {
      const [s, e] = pendingSelRef.current;
      inputRef.current.setSelectionRange(s, e);
      pendingSelRef.current = null;
    }
  });

  // Derive display value from committed segments + active digit buffer
  const displayValue = buildDisplay(cYear, cMonth, cDay, activeSeg, buf);

  // Emit ISO date or '' to parent whenever segments change
  const emitChange = (y: number | null, m: number | null, d: number | null) => {
    if (y !== null && m !== null && d !== null && isValidDate(y, m, d)) {
      const iso = toISO(y, m, d);
      if (iso !== value) onChange(iso);
    } else if (value !== '') {
      onChange('');
    }
  };

  // Sync segment state when value changes externally (calendar pick, reset, etc.)
  useEffect(() => {
    const p = parseISO(value);
    if (p) {
      setCYear(p.y);
      setCMonth(p.m);
      setCDay(p.d);
      setViewYear(p.y);
      setViewMonth(p.m);
      setYearBase(Math.floor(p.y / 12) * 12);
    } else {
      setCYear(null);
      setCMonth(null);
      setCDay(null);
    }
    setActiveSeg(null);
    setBuf('');
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const openPicker = () => {
    setView('day');
    if (!open) measureDropdown();
    setOpen((o) => !o);
  };
  const prevMonth = () => {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else setViewMonth((m) => m + 1);
  };
  const selectDay = (day: number) => {
    onChange(toISO(viewYear, viewMonth, day));
    setOpen(false);
  };
  const selectToday = () => {
    onChange(toISO(t.y, t.m, t.d));
    setOpen(false);
  };
  const clearDate = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange('');
    setCYear(null);
    setCMonth(null);
    setCDay(null);
    setBuf('');
    setActiveSeg(null);
  };

  // ── Segment keyboard & mouse interaction ────────────────────────────────────
  const activateSegment = (seg: Segment) => {
    setActiveSeg(seg);
    setBuf('');
    pendingSelRef.current = [SEGMENT_INFO[seg].start, SEGMENT_INFO[seg].end];
  };

  const handleInputClick = () => {
    const pos = inputRef.current?.selectionStart ?? 0;
    activateSegment(pos <= 4 ? 'year' : pos <= 7 ? 'month' : 'day');
  };

  const handleFocus = () => {
    if (!activeSeg) activateSegment('year');
  };

  const handleBlur = () => {
    setBuf('');
    setActiveSeg(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow browser / OS shortcuts (copy, paste, etc.)
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

    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      const newBuf = buf + e.key;

      // Determine whether to commit this segment immediately
      let shouldCommit = newBuf.length === info.maxLen;
      if (!shouldCommit && info.maxLen === 2) {
        const v = parseInt(newBuf, 10);
        // Month: first digit > 1 can never be a valid two-digit month (13–19…)
        if (seg === 'month' && v > 1) shouldCommit = true;
        // Day: first digit > 3 can never be a valid two-digit day (40+)
        if (seg === 'day' && v > 3) shouldCommit = true;
      }

      if (shouldCommit) {
        const v = parseInt(newBuf.padStart(info.maxLen, '0'), 10);

        // Validate before committing
        let valid = true;
        if (seg === 'month' && (v < 1 || v > 12)) valid = false;
        if (seg === 'day') {
          const maxD = cYear && cMonth ? daysInMonth(cYear, cMonth) : 31;
          if (v < 1 || v > maxD) valid = false;
        }
        if (!valid) {
          setBuf('');
          pendingSelRef.current = [info.start, info.end];
          return;
        }

        // Commit and advance
        let newY = cYear,
          newM = cMonth,
          newD = cDay;
        if (seg === 'year') {
          setCYear(v);
          newY = v;
        } else if (seg === 'month') {
          setCMonth(v);
          newM = v;
        } else {
          setCDay(v);
          newD = v;
        }
        setBuf('');
        emitChange(newY, newM, newD);

        const nextSeg = SEGMENT_ORDER[segIdx + 1];
        if (nextSeg) {
          setActiveSeg(nextSeg);
          pendingSelRef.current = [SEGMENT_INFO[nextSeg].start, SEGMENT_INFO[nextSeg].end];
        } else {
          setActiveSeg(null);
        }
      } else {
        setBuf(newBuf);
        pendingSelRef.current = [info.start, info.end];
      }
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      if (buf.length > 0) {
        setBuf(buf.slice(0, -1));
      } else {
        if (seg === 'year') {
          setCYear(null);
          emitChange(null, cMonth, cDay);
        } else if (seg === 'month') {
          setCMonth(null);
          emitChange(cYear, null, cDay);
        } else {
          setCDay(null);
          emitChange(cYear, cMonth, null);
        }
      }
      pendingSelRef.current = [info.start, info.end];
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setBuf('');
      const prevSeg = SEGMENT_ORDER[segIdx - 1];
      if (prevSeg) goToSeg(prevSeg);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setBuf('');
      const nextSeg = SEGMENT_ORDER[segIdx + 1];
      if (nextSeg) goToSeg(nextSeg);
    } else if (e.key === 'Tab') {
      if (!e.shiftKey) {
        const nextSeg = SEGMENT_ORDER[segIdx + 1];
        if (nextSeg) {
          e.preventDefault();
          goToSeg(nextSeg);
        }
        // else: let Tab move focus naturally to the next form element
      } else {
        const prevSeg = SEGMENT_ORDER[segIdx - 1];
        if (prevSeg) {
          e.preventDefault();
          goToSeg(prevSeg);
        }
        // else: let Shift+Tab move focus naturally
      }
    } else {
      // Block all other printable keys
      e.preventDefault();
    }
  };
  const selectMonth = (m: number) => {
    setViewMonth(m);
    setView('day');
  };
  const selectYear = (y: number) => {
    setViewYear(y);
    setYearBase(Math.floor(y / 12) * 12);
    setView('month');
  };
  const goToYearView = () => {
    setYearBase(Math.floor(viewYear / 12) * 12);
    setView('year');
  };

  // Build calendar grid cells
  const total = daysInMonth(viewYear, viewMonth);
  const startDow = firstDayOfWeek(viewYear, viewMonth);
  const cells: (number | null)[] = Array(startDow).fill(null);
  for (let i = 1; i <= total; i++) cells.push(i);
  while (cells.length % 7 !== 0) cells.push(null);
  const years = Array.from({ length: 12 }, (_, i) => yearBase + i);

  return (
    <div
      ref={wrapperRef}
      className={styles.wrapper}
    >
      {/* ── Trigger ── */}
      <div
        ref={triggerRef}
        className={[styles.trigger, disabled && styles.triggerDisabled].filter(Boolean).join(' ')}
      >
        <button
          type="button"
          className={styles.calIconBtn}
          onClick={openPicker}
          tabIndex={-1}
          aria-label="Open calendar"
          disabled={disabled}
        >
          <Icon
            name="calendar_today"
            size="0.875rem"
            className={styles.calIcon}
          />
        </button>
        <input
          ref={inputRef}
          type="text"
          className={styles.textInput}
          value={displayValue}
          data-empty={!cYear && !cMonth && !cDay}
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
            onClick={clearDate}
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
          {/* ── Day view ── */}
          {view === 'day' && (
            <>
              <div className={styles.calHeader}>
                <button
                  type="button"
                  className={styles.navBtn}
                  onClick={prevMonth}
                >
                  <Icon
                    name="chevron_left"
                    size="0.75rem"
                  />
                </button>
                <button
                  type="button"
                  className={styles.headerLabel}
                  onClick={() => setView('month')}
                >
                  {MONTHS[viewMonth - 1]} {viewYear}
                </button>
                <button
                  type="button"
                  className={styles.navBtn}
                  onClick={nextMonth}
                >
                  <Icon
                    name="chevron_right"
                    size="0.75rem"
                  />
                </button>
              </div>
              <div className={styles.grid}>
                {DAY_LABELS.map((dl) => (
                  <span
                    key={dl}
                    className={styles.dayName}
                  >
                    {dl}
                  </span>
                ))}
                {cells.map((day, i) => {
                  if (day === null) return <span key={`e${i}`} />;
                  const isSel =
                    parsed?.y === viewYear && parsed?.m === viewMonth && parsed?.d === day;
                  const isToday = t.y === viewYear && t.m === viewMonth && t.d === day;
                  return (
                    <button
                      key={day}
                      type="button"
                      className={`${styles.day}${isSel ? ` ${styles.selected}` : ''}${isToday && !isSel ? ` ${styles.today}` : ''}`}
                      onClick={() => selectDay(day)}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
              <div className={styles.footer}>
                <button
                  type="button"
                  className={styles.footerBtn}
                  onClick={selectToday}
                >
                  Today
                </button>
                {value && (
                  <button
                    type="button"
                    className={`${styles.footerBtn} ${styles.footerBtnClear}`}
                    onClick={() => clearDate()}
                  >
                    Clear
                  </button>
                )}
              </div>
            </>
          )}

          {/* ── Month view ── */}
          {view === 'month' && (
            <>
              <div className={styles.calHeader}>
                <button
                  type="button"
                  className={styles.navBtn}
                  onClick={() => setViewYear((y) => y - 1)}
                >
                  <Icon
                    name="chevron_left"
                    size="0.75rem"
                  />
                </button>
                <button
                  type="button"
                  className={styles.headerLabel}
                  onClick={goToYearView}
                >
                  {viewYear}
                </button>
                <button
                  type="button"
                  className={styles.navBtn}
                  onClick={() => setViewYear((y) => y + 1)}
                >
                  <Icon
                    name="chevron_right"
                    size="0.75rem"
                  />
                </button>
              </div>
              <div className={styles.monthGrid}>
                {MONTHS_SHORT.map((name, i) => {
                  const m = i + 1;
                  const isSel = parsed?.y === viewYear && parsed?.m === m;
                  const isThis = t.y === viewYear && t.m === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      className={`${styles.monthBtn}${isSel ? ` ${styles.selected}` : ''}${isThis && !isSel ? ` ${styles.today}` : ''}`}
                      onClick={() => selectMonth(m)}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Year view ── */}
          {view === 'year' && (
            <>
              <div className={styles.calHeader}>
                <button
                  type="button"
                  className={styles.navBtn}
                  onClick={() => setYearBase((b) => b - 12)}
                >
                  <Icon
                    name="chevron_left"
                    size="0.75rem"
                  />
                </button>
                <span
                  className={styles.headerLabel}
                  style={{ cursor: 'default' }}
                >
                  {yearBase} – {yearBase + 11}
                </span>
                <button
                  type="button"
                  className={styles.navBtn}
                  onClick={() => setYearBase((b) => b + 12)}
                >
                  <Icon
                    name="chevron_right"
                    size="0.75rem"
                  />
                </button>
              </div>
              <div className={styles.yearGrid}>
                {years.map((y) => {
                  const isSel = parsed?.y === y;
                  const isThis = t.y === y;
                  return (
                    <button
                      key={y}
                      type="button"
                      className={`${styles.yearBtn}${isSel ? ` ${styles.selected}` : ''}${isThis && !isSel ? ` ${styles.today}` : ''}`}
                      onClick={() => selectYear(y)}
                    >
                      {y}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DatePicker;
