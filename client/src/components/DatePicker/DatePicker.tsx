import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from 'react';
import Icon from '../Icon/Icon';
import styles from './DatePicker.module.scss';

interface Props {
  value: string; // YYYY-MM-DD or ''
  onChange: (val: string) => void;
  placeholder?: string;
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

/** Convert internal ISO value (YYYY-MM-DD) to the display format (YYYY/MM/DD). */
const toDisplay = (iso: string) => iso.replace(/-/g, '/');

/**
 * Build a masked YYYY/MM/DD string from a digit-only string (up to 8 digits).
 * Slashes are inserted automatically and are never user-editable.
 */
const buildMasked = (digits: string): string => {
  const d = digits.slice(0, 8);
  let out = d.slice(0, 4);
  if (d.length > 4) out += '/' + d.slice(4, 6);
  if (d.length > 6) out += '/' + d.slice(6, 8);
  return out;
};

const DatePicker = (props: Props) => {
  const { value, onChange, placeholder = 'YYYY/MM/DD' } = props;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<CalView>('day');
  const [inputText, setInputText] = useState(value ? toDisplay(value) : '');
  const parsed = parseISO(value);
  const t = todayParts();
  const [viewYear, setViewYear] = useState(parsed?.y ?? t.y);
  const [viewMonth, setViewMonth] = useState(parsed?.m ?? t.m);
  const [yearBase, setYearBase] = useState(() => Math.floor((parsed?.y ?? t.y) / 12) * 12);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Cursor position to restore after the next render caused by setInputText. */
  const pendingCursorRef = useRef<number | null>(null);

  // Restore cursor position after each render (triggered by handleTextChange).
  // useLayoutEffect without deps runs after every render — safe because
  // pendingCursorRef is only set during user interaction, not in effects.
  useLayoutEffect(() => {
    if (pendingCursorRef.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(pendingCursorRef.current, pendingCursorRef.current);
      pendingCursorRef.current = null;
    }
  });

  // Sync inputText and calendar view when value changes externally (calendar pick, reset, edit)
  useEffect(() => {
    setInputText(value ? toDisplay(value) : '');
    const p = parseISO(value);
    if (p) {
      setViewYear(p.y);
      setViewMonth(p.m);
      setYearBase(Math.floor(p.y / 12) * 12);
    }
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
    setInputText('');
  };

  const handleTextChange = (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const raw = input.value;
    const selStart = input.selectionStart ?? raw.length;

    // Count digits left of the cursor so we can restore cursor intent after reformatting
    const digitsBeforeCursor = raw.slice(0, selStart).replace(/\D/g, '').length;

    // Keep only digits, cap at 8 (YYYY MM DD)
    const allDigits = raw.replace(/\D/g, '').slice(0, 8);

    if (allDigits.length === 0) {
      setInputText('');
      if (value) onChange('');
      return;
    }

    const formatted = buildMasked(allDigits);
    setInputText(formatted);

    // Find the position in the formatted string that corresponds to
    // digitsBeforeCursor digits (skipping over slash separators).
    let newCursor = formatted.length; // default: end of string
    let dc = 0;
    for (let i = 0; i < formatted.length; i++) {
      if (formatted[i] !== '/') dc++;
      if (dc === digitsBeforeCursor) {
        newCursor = i + 1;
        break;
      }
    }
    pendingCursorRef.current = newCursor;

    // Commit the ISO value when all 8 digits form a valid date
    if (allDigits.length === 8) {
      const iso = `${allDigits.slice(0, 4)}-${allDigits.slice(4, 6)}-${allDigits.slice(6, 8)}`;
      const p = parseISO(iso);
      if (p && isValidDate(p.y, p.m, p.d)) {
        onChange(iso);
        return;
      }
    }
    if (value) onChange('');
  };

  const handleTextBlur = () => {
    // Revert to the last committed value if the input is incomplete / invalid
    setInputText(value ? toDisplay(value) : '');
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
      <div className={styles.trigger}>
        <button
          type="button"
          className={styles.calIconBtn}
          onClick={openPicker}
          tabIndex={-1}
          aria-label="Open calendar"
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
          value={inputText}
          onChange={handleTextChange}
          onBlur={handleTextBlur}
          placeholder={placeholder}
        />
        {value && (
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
        <div className={styles.dropdown}>
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
