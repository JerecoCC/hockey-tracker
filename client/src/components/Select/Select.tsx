import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import cn from 'classnames';
import Divider from '../Divider/Divider';
import Icon from '../Icon/Icon';
import TeamLogo from '../TeamLogo/TeamLogo';
import styles from './Select.module.scss';

// Keep in sync with `.menu { max-height }` in Select.module.scss.
const MENU_MAX_HEIGHT = 220;

export type SelectOption =
  | {
      value: string;
      label: string;
      logo?: string | null;
      logoDark?: string | null;
      logoLight?: string | null;
      code?: string;
      indicator?: ReactNode;
    }
  | { divider: true };
export type SelectWidth = 'full' | 'content';

/** Type guard — true for selectable options, false for dividers. */
const isOption = (
  o: SelectOption,
): o is {
  value: string;
  label: string;
  logo?: string | null;
  logoDark?: string | null;
  logoLight?: string | null;
  code?: string;
  indicator?: ReactNode;
} =>
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
  width?: SelectWidth;
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
    width = 'full',
  } = props;
  const contentWidth = width === 'content';
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const suppressNextFocusOpenRef = useRef(false);
  const menuId = useId();
  // The menu is portaled to <body> and positioned `fixed` so it overlays
  // without expanding/clipping inside an overflow card or modal. Measure the
  // trigger to place it (flipping above when there's little room below), and
  // keep it aligned while open as the page scrolls/resizes.
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      const r = (triggerRef.current ?? ref.current)?.getBoundingClientRect();
      if (!r) return;
      const gap = 4;
      const spaceBelow = window.innerHeight - r.bottom;
      const spaceAbove = r.top;
      const flip = spaceBelow < MENU_MAX_HEIGHT && spaceAbove > spaceBelow;
      setMenuStyle(
        flip
          ? { bottom: window.innerHeight - r.top + gap, left: r.left, width: r.width }
          : { top: r.bottom + gap, left: r.left, width: r.width },
      );
    };
    position();
    window.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);
    return () => {
      window.removeEventListener('scroll', position, true);
      window.removeEventListener('resize', position);
    };
  }, [open]);

  const closeMenu = () => {
    setOpen(false);
    setQuery('');
  };

  const openSearchMenu = () => {
    if (disabled) return;
    if (!open) {
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
      className={cn(styles.wrapper, contentWidth && styles.wrapperContent)}
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
            contentWidth && styles.triggerContentWidth,
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
                setOpen(true);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            disabled={disabled}
            aria-labelledby={ariaLabelledBy}
          />
          <Divider
            variant="vertical"
            className={styles.triggerDivider}
          />
          <span
            className={styles.caretButton}
            aria-hidden="true"
          >
            <Icon
              name="expand_more"
              size="1em"
              className={cn(styles.caret, open && styles.caretOpen)}
            />
          </span>
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
            contentWidth && styles.triggerContentWidth,
            open && styles.triggerOpen,
            disabled && styles.triggerDisabled,
            error && !open && styles.triggerError,
          )}
          onClick={() => {
            if (disabled) return;
            setOpen((o) => !o);
          }}
          disabled={disabled}
        >
          {selected ? (
            <span className={styles.optionInner}>
              {selected.logo || selected.logoDark || selected.logoLight ? (
                <TeamLogo
                  logo={selected.logo}
                  logoDark={selected.logoDark}
                  logoLight={selected.logoLight}
                  code={selected.code ?? ''}
                  alt=""
                  size={20}
                  shape="square"
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
          <Divider
            variant="vertical"
            className={styles.triggerDivider}
          />
          <span
            className={styles.caretButton}
            aria-hidden="true"
          >
            <Icon
              name="expand_more"
              size="1em"
              className={cn(styles.caret, open && styles.caretOpen)}
            />
          </span>
        </button>
      )}

      {open &&
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
                  className={styles.dividerItem}
                >
                  <Divider className={styles.divider} />
                </li>
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
                    {opt.logo || opt.logoDark || opt.logoLight ? (
                      <TeamLogo
                        logo={opt.logo}
                        logoDark={opt.logoDark}
                        logoLight={opt.logoLight}
                        code={opt.code ?? ''}
                        alt=""
                        size={20}
                        shape="square"
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
