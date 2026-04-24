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
  } = props;
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  /** Measure the trigger and compute fixed-position coordinates for the menu. */
  const measureMenu = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setMenuStyle({ top: r.bottom + 4, left: r.left, width: r.width });
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const currentIndex = options.findIndex((o) => o.value === value);
      const next =
        e.key === 'ArrowDown'
          ? Math.min(currentIndex + 1, options.length - 1)
          : Math.max(currentIndex - 1, 0);
      onChange(options[next].value);
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (!open) setOpen(true);
    }
  };

  const selected = options.find((o) => o.value === value) ?? null;

  return (
    <div
      className={styles.wrapper}
      ref={ref}
      onKeyDown={handleKeyDown}
    >
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

      {open && (
        <ul
          id={menuId}
          role="listbox"
          className={styles.menu}
          style={menuStyle}
        >
          {options.length === 0 ? (
            <li className={styles.emptyMessage}>{emptyMessage}</li>
          ) : (
            options.map((opt) => (
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
                    setOpen(false);
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
