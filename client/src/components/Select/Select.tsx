import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import cn from 'classnames';
import Icon from '../Icon/Icon';
import styles from './Select.module.scss';

export type SelectOption =
  | { value: string; label: string; logo?: string | null; code?: string; indicator?: ReactNode }
  | { divider: true };

/** Type guard — true for selectable options, false for dividers. */
const isOption = (
  o: SelectOption,
): o is { value: string; label: string; logo?: string | null; code?: string; indicator?: ReactNode } =>
  !('divider' in o);

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
  ariaLabelledBy?: string;
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
    ariaLabelledBy,
  } = props;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const suppressNextFocusOpenRef = useRef(false);
  const menuId = useId();

  /** Measure the trigger and compute fixed-position coordinates for the menu. */
  const measureMenu = () => {
    // Searchable mode has no button trigger — measure the outer wrapper instead.
    const target = searchable ? ref.current : triggerRef.current;
    if (!target) return;
    const r = target.getBoundingClientRect();
    const gap = 4;
    const maxMenuHeight = 220;
    const minMenuHeight = 120;
    const viewportHeight =
      typeof window === 'undefined' ? Number.POSITIVE_INFINITY : window.innerHeight;
    const availableBelow = viewportHeight - r.bottom - gap;
    const availableAbove = r.top - gap;
    const openAbove = availableBelow < minMenuHeight && availableAbove > availableBelow;

    if (openAbove) {
      setMenuStyle({
        bottom: viewportHeight - r.top + gap,
        left: r.left,
        width: r.width,
        maxHeight: Math.max(minMenuHeight, Math.min(maxMenuHeight, availableAbove)),
      });
      return;
    }

    setMenuStyle({
      top: r.bottom + gap,
      left: r.left,
      width: r.width,
      maxHeight: Math.max(minMenuHeight, Math.min(maxMenuHeight, availableBelow)),
    });
  };

  const closeMenu = () => {
    setOpen(false);
    setQuery('');
  };

  const openSearchMenu = () => {
    if (disabled) return;
    if (!open) {
      measureMenu();
      setOpen(true);
    }
    searchRef.current?.focus();
  };

  // Defer autoFocus until after layout so getBoundingClientRect() returns correct dimensions.
  useEffect(() => {
    if (!autoFocus || !searchable) return;
    const frame = requestAnimationFrame(() => {
      suppressNextFocusOpenRef.current = true;
      searchRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleLayoutChange = () => measureMenu();
    window.addEventListener('resize', handleLayoutChange);
    window.addEventListener('scroll', handleLayoutChange, true);
    return () => {
      window.removeEventListener('resize', handleLayoutChange);
      window.removeEventListener('scroll', handleLayoutChange, true);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll the active option into view when the value changes while the menu
  // is open (arrow-key navigation) or when the menu first opens.
  useEffect(() => {
    if (!open || !menuRef.current) return;
    const active = menuRef.current.querySelector('[aria-selected="true"]') as HTMLElement | null;
    active?.scrollIntoView({ block: 'nearest' });
  }, [value, open]);

  // Options visible in the dropdown — when searching, dividers are stripped and
  // remaining selectable options are filtered by the query text.
  const visibleOptions =
    searchable && query
      ? options.filter((o) => isOption(o) && o.label.toLowerCase().includes(query.toLowerCase()))
      : options;

  // Only selectable (non-divider) entries — used for keyboard navigation.
  const selectableVisible = visibleOptions.filter(isOption);

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
      const currentIndex = selectableVisible.findIndex((o) => o.value === value);
      const next =
        e.key === 'ArrowDown'
          ? Math.min(currentIndex + 1, selectableVisible.length - 1)
          : Math.max(currentIndex - 1, 0);
      if (selectableVisible[next]) onChange(selectableVisible[next].value);
    } else if (e.key === 'Enter' || (!searchable && e.key === ' ')) {
      e.preventDefault();
      if (!open) {
        measureMenu();
        setOpen(true);
      } else if (searchable && selectableVisible.length === 1) {
        // Auto-select the only matching result on Enter.
        onChange(selectableVisible[0].value);
        closeMenu();
      } else {
        // Confirm the current selection and close.
        closeMenu();
      }
    }
  };

  const selected = options.find((o) => isOption(o) && o.value === value) ?? null;

  return (
    <div
      className={styles.wrapper}
      ref={ref}
      onKeyDown={handleKeyDown}
      onBlur={(e) => {
        if (
          !ref.current?.contains(e.relatedTarget as Node) &&
          !menuRef.current?.contains(e.relatedTarget as Node)
        ) {
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
          onClick={openSearchMenu}
        >
          <input
            ref={searchRef}
            type="text"
            className={styles.searchInput}
            value={open ? query : (selected?.label ?? '')}
            placeholder={open && selected ? selected.label : placeholder}
            onChange={(e) => {
              if (!open && !disabled) {
                measureMenu();
                setOpen(true);
              }
              setQuery(e.target.value);
            }}
            onFocus={() => {
              if (suppressNextFocusOpenRef.current) {
                suppressNextFocusOpenRef.current = false;
                return;
              }
              if (!open && !disabled) {
                measureMenu();
                setOpen(true);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            disabled={disabled}
            aria-labelledby={ariaLabelledBy}
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
          aria-labelledby={ariaLabelledBy}
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
              <span className={styles.optionLabel}>{selected.label}</span>
              {selected.indicator ? (
                <span className={styles.optionIndicator}>{selected.indicator}</span>
              ) : null}
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

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
        <ul
          ref={menuRef}
          id={menuId}
          role="listbox"
          className={styles.menu}
          style={menuStyle}
        >
          {selectableVisible.length === 0 ? (
            <li className={styles.emptyMessage}>
              {searchable && query ? `No results for "${query}"` : emptyMessage}
            </li>
          ) : (
            visibleOptions.map((opt, idx) =>
              !isOption(opt) ? (
                <li
                  key={`divider-${idx}`}
                  role="separator"
                  aria-hidden="true"
                  className={styles.divider}
                />
              ) : (
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
                    <span className={styles.optionLabel}>{opt.label}</span>
                    {opt.indicator ? (
                      <span className={styles.optionIndicator}>{opt.indicator}</span>
                    ) : null}
                  </button>
                </li>
              ),
            )
          )}
        </ul>,
        document.body,
      )}
    </div>
  );
};

export default Select;
