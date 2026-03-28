import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
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
  onChange: (value: string) => void;
}

const Select = ({ value, options, placeholder = '— Select —', onChange }: Props) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

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
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        className={cn(styles.trigger, open && styles.triggerOpen)}
        onClick={() => setOpen((o) => !o)}
      >
        {selected ? (
          <span className={styles.optionInner}>
            {selected.logo ? (
              <img
                src={selected.logo}
                alt=""
                className={styles.optionLogo}
              />
            ) : (
              <span className={styles.optionNoLogo}>
                {(selected.code ?? selected.label).slice(0, 1)}
              </span>
            )}
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
        >
          {options.map((opt) => (
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
                ) : (
                  <span className={styles.optionNoLogo}>{(opt.code ?? opt.label).slice(0, 1)}</span>
                )}
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Select;
