import { useEffect, useRef, useState, type ChangeEvent } from 'react';
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
/** Convert display input (YYYY/MM/DD) back to the ISO value (YYYY-MM-DD). */
const fromDisplay = (display: string) => display.replace(/\//g, '-');

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
    const raw = e.target.value;
    setInputText(raw);
    if (raw === '') {
      onChange('');
      return;
    }
    // Auto-commit when the user finishes typing a full YYYY/MM/DD
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(raw)) {
      const iso = fromDisplay(raw);
      const p = parseISO(iso);
      if (p && isValidDate(p.y, p.m, p.d)) {
        onChange(iso);
      }
    }
  };

  const handleTextBlur = () => {
    // Revert to the last committed value if input is incomplete or invalid
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(inputText)) {
      const p = parseISO(fromDisplay(inputText));
      if (p && isValidDate(p.y, p.m, p.d)) return;
    }
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
