import {
  type CSSProperties,
  type KeyboardEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import cn from 'classnames';
import Icon from '../Icon/Icon';
import Tooltip from '../Tooltip/Tooltip';
import styles from './MultiSelect.module.scss';

// Keep in sync with `.menu { max-height }` in MultiSelect.module.scss.
const MENU_MAX_HEIGHT = 220;

export type MultiSelectOption = {
  value: string;
  label: string;
  logo?: string | null;
  code?: string;
};

interface Props {
  value: string[];
  options: MultiSelectOption[];
  placeholder?: string;
  /** Message shown inside the dropdown when options is empty. */
  emptyMessage?: string;
  onChange: (values: string[]) => void;
  disabled?: boolean;
  /** When true the trigger renders with a red error border. */
  error?: boolean;
  /** When true, an inline text input filters options as the user types. */
  searchable?: boolean;
  /** Moves focus to the trigger on mount. */
  autoFocus?: boolean;
}

const MultiSelect = ({
  value,
  options,
  placeholder = '— Select —',
  emptyMessage = 'No options available',
  onChange,
  disabled = false,
  error = false,
  searchable = false,
  autoFocus = false,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const menuId = useId();
  // The menu is portaled to <body> and positioned `fixed` so it overlays
  // without expanding/clipping inside an overflow card or modal. Measure the
  // trigger to place it (flipping above when there's little room below), and
  // keep it aligned while open as the page scrolls/resizes.
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      const r = wrapperRef.current?.getBoundingClientRect();
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

  useEffect(() => {
    if (autoFocus) triggerRef.current?.focus();
  }, [autoFocus]);

  // Scroll the keyboard-focused option into view on arrow-key navigation.
  useEffect(() => {
    if (!open || focusedIdx < 0 || !menuRef.current) return;
    const items = menuRef.current.querySelectorAll<HTMLElement>('[role="option"]');
    items[focusedIdx]?.scrollIntoView?.({ block: 'nearest' });
  }, [focusedIdx, open]);

  const closeMenu = () => {
    setOpen(false);
    setQuery('');
    setFocusedIdx(-1);
  };

  const openMenu = () => {
    if (disabled) return;
    setOpen(true);
    if (searchable) setTimeout(() => searchRef.current?.focus(), 0);
  };

  const toggle = (optValue: string) => {
    onChange(value.includes(optValue) ? value.filter((v) => v !== optValue) : [...value, optValue]);
  };

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
        openMenu();
        return;
      }
      setFocusedIdx((i) =>
        e.key === 'ArrowDown' ? Math.min(i + 1, visibleOptions.length - 1) : Math.max(i - 1, 0),
      );
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!open) {
        openMenu();
      } else if (focusedIdx >= 0 && visibleOptions[focusedIdx]) {
        toggle(visibleOptions[focusedIdx].value);
      }
    } else if (e.key === 'Backspace' && searchable && !query && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const selectedOptions = value
    .map((v) => options.find((o) => o.value === v))
    .filter(Boolean) as MultiSelectOption[];

  return (
    <div
      className={styles.wrapper}
      ref={wrapperRef}
      onBlur={(e) => {
        const nextTarget = e.relatedTarget as Node | null;
        if (
          !wrapperRef.current?.contains(nextTarget) &&
          !menuRef.current?.contains(nextTarget)
        ) {
          closeMenu();
        }
      }}
    >
      <div
        ref={triggerRef}
        className={cn(
          styles.trigger,
          open && styles.triggerOpen,
          disabled && styles.triggerDisabled,
          error && !open && styles.triggerError,
        )}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.pills}>
          {selectedOptions.map((opt) => (
            <Tooltip
              key={opt.value}
              text={opt.label}
              className={styles.pillTooltip}
            >
              <span className={styles.pill}>
                {opt.logo ? (
                  <img
                    src={opt.logo}
                    alt=""
                    className={styles.pillLogo}
                  />
                ) : opt.code ? (
                  <span className={styles.pillNoLogo}>{opt.code.slice(0, 1)}</span>
                ) : null}
                <span className={styles.pillLabel}>{opt.code ?? opt.label}</span>
                <button
                  type="button"
                  className={styles.pillRemove}
                  tabIndex={-1}
                  disabled={disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(opt.value);
                  }}
                  aria-label={`Remove ${opt.label}`}
                >
                  <Icon
                    name="close"
                    size="0.75em"
                  />
                </button>
              </span>
            </Tooltip>
          ))}
          {searchable && open ? (
            <input
              ref={searchRef}
              type="text"
              className={styles.searchInput}
              value={query}
              placeholder={selectedOptions.length === 0 ? placeholder : 'Search…'}
              onChange={(e) => {
                setQuery(e.target.value);
                setFocusedIdx(-1);
              }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={handleKeyDown}
              disabled={disabled}
            />
          ) : selectedOptions.length === 0 ? (
            <span className={styles.placeholder}>{placeholder}</span>
          ) : null}
        </div>
        <Icon
          name="expand_more"
          size="1em"
          className={cn(styles.caret, open && styles.caretOpen)}
        />
      </div>

      {open &&
        createPortal(
          <ul
            ref={menuRef}
            id={menuId}
            role="listbox"
            aria-multiselectable="true"
            className={styles.menu}
            style={menuStyle}
          >
          {visibleOptions.length === 0 ? (
            <li className={styles.emptyMessage}>
              {searchable && query ? `No results for "${query}"` : emptyMessage}
            </li>
          ) : (
            visibleOptions.map((opt, idx) => {
              const isSelected = value.includes(opt.value);
              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    className={cn(
                      styles.option,
                      isSelected && styles.optionSelected,
                      focusedIdx === idx && styles.optionFocused,
                    )}
                    onClick={() => toggle(opt.value)}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setFocusedIdx(idx)}
                  >
                    <span
                      className={cn(styles.optionCheck, isSelected && styles.optionCheckSelected)}
                    >
                      {isSelected && (
                        <Icon
                          name="check"
                          size="0.7em"
                        />
                      )}
                    </span>
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
              );
            })
          )}
          </ul>,
          document.body,
        )}
    </div>
  );
};

export default MultiSelect;
