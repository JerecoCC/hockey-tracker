import { useEffect, useRef, useState } from 'react';
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

const todayParts = () => {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
};

const parseISO = (iso: string) => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
};

const toISO = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
const firstDayOfWeek = (y: number, m: number) => new Date(y, m - 1, 1).getDay();

const DatePicker = (props: Props) => {
  const { value, onChange, placeholder = 'Select date…' } = props;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<CalView>('day');
  const parsed = parseISO(value);
  const t = todayParts();
  const [viewYear, setViewYear] = useState(parsed?.y ?? t.y);
  const [viewMonth, setViewMonth] = useState(parsed?.m ?? t.m);
  const [yearBase, setYearBase] = useState(() => Math.floor((parsed?.y ?? t.y) / 12) * 12);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync calendar view when value changes externally
  useEffect(() => {
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

  const displayValue = parsed ? `${MONTHS[parsed.m - 1]} ${parsed.d}, ${parsed.y}` : '';

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
      <button
        type="button"
        className={styles.trigger}
        onClick={openPicker}
      >
        <Icon
          name="calendar_today"
          size="0.875rem"
          className={styles.calIcon}
        />
        <span className={displayValue ? styles.value : styles.placeholder}>
          {displayValue || placeholder}
        </span>
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
      </button>

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
