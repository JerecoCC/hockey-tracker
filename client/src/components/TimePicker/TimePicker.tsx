import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import Icon from '../Icon/Icon';
import styles from './TimePicker.module.scss';

interface Props {
  value: string; // HH:MM or ''
  onChange: (val: string) => void;
  placeholder?: string;
}

type Segment = 'hour' | 'minute';

const SEGMENT_INFO: Record<Segment, { start: number; end: number; placeholder: string; maxLen: number }> = {
  hour:   { start: 0, end: 2, placeholder: 'HH', maxLen: 2 },
  minute: { start: 3, end: 5, placeholder: 'MM', maxLen: 2 },
};
const SEGMENT_ORDER: Segment[] = ['hour', 'minute'];

const parseTime = (val: string) => {
  if (!val) return null;
  const [h, m] = val.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return { h, m };
};

const toHHMM = (h: number, m: number) =>
  `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

const buildDisplay = (
  cHour: number | null,
  cMinute: number | null,
  activeSeg: Segment | null,
  buf: string,
): string => {
  const seg = (s: Segment, committed: number | null): string => {
    const info = SEGMENT_INFO[s];
    if (s === activeSeg && buf.length > 0) return buf + info.placeholder.slice(buf.length);
    return committed !== null ? String(committed).padStart(info.maxLen, '0') : info.placeholder;
  };
  return `${seg('hour', cHour)}:${seg('minute', cMinute)}`;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

const TimePicker = ({ value, onChange, placeholder }: Props) => {
  const parsed = parseTime(value);
  const [cHour, setCHour] = useState<number | null>(parsed?.h ?? null);
  const [cMinute, setCMinute] = useState<number | null>(parsed?.m ?? null);
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
    if (p) { setCHour(p.h); setCMinute(p.m); }
    else { setCHour(null); setCMinute(null); }
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
    if (cHour != null && hourColRef.current) {
      const btn = hourColRef.current.querySelector(`[data-val="${cHour}"]`) as HTMLElement | null;
      btn?.scrollIntoView({ block: 'center' });
    }
    if (cMinute != null && minColRef.current) {
      const rounded = MINUTES.includes(cMinute) ? cMinute : 0;
      const btn = minColRef.current.querySelector(`[data-val="${rounded}"]`) as HTMLElement | null;
      btn?.scrollIntoView({ block: 'center' });
    }
  }, [open, cHour, cMinute]);

  const measureDropdown = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setDropdownStyle({ top: r.bottom + 6, left: r.left });
  };

  const emitChange = (h: number | null, m: number | null) => {
    if (h !== null && m !== null) {
      const hhmm = toHHMM(h, m);
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
    setCHour(null);
    setCMinute(null);
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
    activateSegment(pos <= 2 ? 'hour' : 'minute');
  };

  const handleFocus = () => { if (!activeSeg) activateSegment('hour'); };
  const handleBlur = () => { setBuf(''); setActiveSeg(null); };

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

    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      const newBuf = buf + e.key;
      let shouldCommit = newBuf.length === info.maxLen;
      if (!shouldCommit) {
        const v = parseInt(newBuf, 10);
        // hour: first digit > 2 means can't be valid 2-digit 24h (30+)
        if (seg === 'hour' && v > 2) shouldCommit = true;
        // minute: first digit > 5 means can't be valid (60+)
        if (seg === 'minute' && v > 5) shouldCommit = true;
      }
      if (shouldCommit) {
        const v = parseInt(newBuf.padStart(info.maxLen, '0'), 10);
        let valid = true;
        if (seg === 'hour' && (v < 0 || v > 23)) valid = false;
        if (seg === 'minute' && (v < 0 || v > 59)) valid = false;
        if (!valid) { setBuf(''); pendingSelRef.current = [info.start, info.end]; return; }
        let newH = cHour, newM = cMinute;
        if (seg === 'hour') { setCHour(v); newH = v; }
        else { setCMinute(v); newM = v; }
        setBuf('');
        emitChange(newH, newM);
        const nextSeg = SEGMENT_ORDER[segIdx + 1];
        if (nextSeg) { setActiveSeg(nextSeg); pendingSelRef.current = [SEGMENT_INFO[nextSeg].start, SEGMENT_INFO[nextSeg].end]; }
        else setActiveSeg(null);
      } else {
        setBuf(newBuf);
        pendingSelRef.current = [info.start, info.end];
      }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const delta = e.key === 'ArrowUp' ? 1 : -1;
      if (seg === 'hour') {
        const next = ((cHour ?? 0) + delta + 24) % 24;
        setCHour(next); emitChange(next, cMinute);
      } else {
        const next = ((cMinute ?? 0) + delta + 60) % 60;
        setCMinute(next); emitChange(cHour, next);
      }
      pendingSelRef.current = [info.start, info.end];
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      if (buf.length > 0) { setBuf(buf.slice(0, -1)); }
      else {
        if (seg === 'hour') { setCHour(null); emitChange(null, cMinute); }
        else { setCMinute(null); emitChange(cHour, null); }
      }
      pendingSelRef.current = [info.start, info.end];
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault(); setBuf('');
      const prev = SEGMENT_ORDER[segIdx - 1];
      if (prev) goToSeg(prev);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault(); setBuf('');
      const next = SEGMENT_ORDER[segIdx + 1];
      if (next) goToSeg(next);
    } else if (e.key === 'Tab') {
      if (!e.shiftKey) {
        const next = SEGMENT_ORDER[segIdx + 1];
        if (next) { e.preventDefault(); goToSeg(next); }
      } else {
        const prev = SEGMENT_ORDER[segIdx - 1];
        if (prev) { e.preventDefault(); goToSeg(prev); }
      }
    } else {
      e.preventDefault();
    }
  };

  const selectHour = (h: number) => {
    setCHour(h);
    emitChange(h, cMinute);
    if (cMinute === null) activateSegment('minute');
  };

  const selectMinute = (m: number) => {
    setCMinute(m);
    emitChange(cHour, m);
    setOpen(false);
  };

  const displayValue = buildDisplay(cHour, cMinute, activeSeg, buf);
  const isEmpty = cHour === null && cMinute === null;

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <div ref={triggerRef} className={styles.trigger}>
        <button
          type="button"
          className={styles.clockIconBtn}
          onClick={openPicker}
          tabIndex={-1}
          aria-label="Open time picker"
        >
          <Icon name="schedule" size="0.875rem" className={styles.clockIcon} />
        </button>
        <input
          ref={inputRef}
          type="text"
          className={styles.textInput}
          value={displayValue}
          data-empty={isEmpty}
          placeholder={placeholder}
          onChange={() => {}}
          onClick={handleInputClick}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        {value && (
          <span className={styles.clear} onClick={clearTime} role="button" aria-label="Clear">
            ×
          </span>
        )}
      </div>

      {open && (
        <div className={styles.dropdown} style={dropdownStyle}>
          <div className={styles.columns}>
            <div className={styles.columnWrap}>
              <div className={styles.columnLabel}>Hour</div>
              <div ref={hourColRef} className={styles.column}>
                {HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    data-val={h}
                    className={`${styles.timeBtn}${cHour === h ? ` ${styles.selected}` : ''}`}
                    onMouseDown={(e) => { e.preventDefault(); selectHour(h); }}
                  >
                    {String(h).padStart(2, '0')}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.columnDivider} />
            <div className={styles.columnWrap}>
              <div className={styles.columnLabel}>Min</div>
              <div ref={minColRef} className={styles.column}>
                {MINUTES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    data-val={m}
                    className={`${styles.timeBtn}${cMinute === m ? ` ${styles.selected}` : ''}`}
                    onMouseDown={(e) => { e.preventDefault(); selectMinute(m); }}
                  >
                    {String(m).padStart(2, '0')}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className={styles.footer}>
            <button
              type="button"
              className={styles.footerBtn}
              onMouseDown={(e) => { e.preventDefault(); const now = new Date(); selectMinute(0); selectHour(now.getHours()); onChange(toHHMM(now.getHours(), now.getMinutes())); setCHour(now.getHours()); setCMinute(now.getMinutes()); setOpen(false); }}
            >
              Now
            </button>
            {value && (
              <button
                type="button"
                className={`${styles.footerBtn} ${styles.footerBtnClear}`}
                onMouseDown={(e) => { e.preventDefault(); clearTime(); setOpen(false); }}
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
