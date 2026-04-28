import { type CSSProperties, type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import cn from 'classnames';
import Icon from '../Icon/Icon';
import styles from './Select.module.scss';

export interface SelectOption {
  value: string;
  label: string;
  logo?: string | null;
  code?: string;
}

interface Props {
  value: string | null;
  options: SelectOption[];
  placeholder?: string;
  /** Message shown inside the dropdown when options is empty. */
  emptyMessage?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** When true the trigger renders with a red error border. */
  error?: boolean;
  /** When true, the trigger becomes a text input that filters options as the user types. */
  searchable?: boolean;
  /** Moves focus to the trigger on mount. */
  autoFocus?: boolean;
}

const Select = (props: Props) => {
  const {
    value,
    options,
    placeholder = '— Select —',
    emptyMessage = 'No options available',
    onChange,
    disabled = false,
    error = false,
    searchable = false,
    autoFocus = false,
  } = props;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuId = useId();

  /** Measure the trigger and compute fixed-position coordinates for the menu. */
  const measureMenu = () => {
    // Searchable mode has no button trigger — measure the outer wrapper instead.
    const target = searchable ? ref.current : triggerRef.current;
    if (!target) return;
    const r = target.getBoundingClientRect();
    setMenuStyle({ top: r.bottom + 4, left: r.left, width: r.width });
  };

  const closeMenu = () => {
    setOpen(false);
    setQuery('');
  };

  // Defer autoFocus until after layout so getBoundingClientRect() returns correct dimensions.
  useEffect(() => {
    if (!autoFocus || !searchable) return;
    const frame = requestAnimationFrame(() => {
      searchRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Options visible in the dropdown — filtered by query when searchable.
  const visibleOptions =
    searchable && query
      ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
      : options;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeMenu();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        measureMenu();
        setOpen(true);
        return;
      }
      const currentIndex = visibleOptions.findIndex((o) => o.value === value);
      const next =
        e.key === 'ArrowDown'
          ? Math.min(currentIndex + 1, visibleOptions.length - 1)
          : Math.max(currentIndex - 1, 0);
      if (visibleOptions[next]) onChange(visibleOptions[next].value);
    } else if (e.key === 'Enter' || (!searchable && e.key === ' ')) {
      e.preventDefault();
      if (!open) {
        measureMenu();
        setOpen(true);
      } else if (searchable && visibleOptions.length === 1) {
        // Auto-select the only matching result on Enter.
        onChange(visibleOptions[0].value);
        closeMenu();
      } else {
        // Confirm the current selection and close.
        closeMenu();
      }
    }
  };

  const selected = options.find((o) => o.value === value) ?? null;

  return (
    <div
      className={styles.wrapper}
      ref={ref}
      onKeyDown={handleKeyDown}
      onBlur={(e) => {
        if (!ref.current?.contains(e.relatedTarget as Node)) {
          closeMenu();
        }
      }}
    >
      {searchable ? (
        /* ── Searchable trigger: styled div wrapping a text input ── */
        <div
          className={cn(
            styles.trigger,
            styles.searchTrigger,
            open && styles.triggerOpen,
            disabled && styles.triggerDisabled,
            error && !open && styles.triggerError,
          )}
          onClick={() => {
            if (disabled) return;
            if (!open) {
              measureMenu();
              setOpen(true);
            }
          }}
        >
          <input
            ref={searchRef}
            type="text"
            className={styles.searchInput}
            value={open ? query : (selected?.label ?? '')}
            placeholder={open && selected ? selected.label : placeholder}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (!open && !disabled) {
                measureMenu();
                setOpen(true);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            disabled={disabled}
          />
          <Icon
            name="expand_more"
            size="1em"
            className={cn(styles.caret, open && styles.caretOpen)}
          />
        </div>
      ) : (
        /* ── Standard trigger: button ── */
        <button
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={menuId}
          className={cn(
            styles.trigger,
            open && styles.triggerOpen,
            disabled && styles.triggerDisabled,
            error && !open && styles.triggerError,
          )}
          onClick={() => {
            if (disabled) return;
            if (!open) measureMenu();
            setOpen((o) => !o);
          }}
          disabled={disabled}
        >
          {selected ? (
            <span className={styles.optionInner}>
              {selected.logo ? (
                <img
                  src={selected.logo}
                  alt=""
                  className={styles.optionLogo}
                />
              ) : selected.code ? (
                <span className={styles.optionNoLogo}>{selected.code.slice(0, 1)}</span>
              ) : null}
              {selected.label}
            </span>
          ) : (
            <span className={styles.placeholder}>{placeholder}</span>
          )}
          <Icon
            name="expand_more"
            size="1em"
            className={cn(styles.caret, open && styles.caretOpen)}
          />
        </button>
      )}

      {open && (
        <ul
          id={menuId}
          role="listbox"
          className={styles.menu}
          style={menuStyle}
        >
          {visibleOptions.length === 0 ? (
            <li className={styles.emptyMessage}>
              {searchable && query ? `No results for "${query}"` : emptyMessage}
            </li>
          ) : (
            visibleOptions.map((opt) => (
              <li
                key={opt.value}
                role="option"
                aria-selected={value === opt.value}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  className={cn(styles.option, value === opt.value && styles.optionActive)}
                  onClick={() => {
                    onChange(opt.value);
                    closeMenu();
                  }}
                >
                  {opt.logo ? (
                    <img
                      src={opt.logo}
                      alt=""
                      className={styles.optionLogo}
                    />
                  ) : opt.code ? (
                    <span className={styles.optionNoLogo}>{opt.code.slice(0, 1)}</span>
                  ) : null}
                  {opt.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default Select;
