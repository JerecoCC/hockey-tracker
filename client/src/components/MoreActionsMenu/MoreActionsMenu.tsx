import { useEffect, useRef, useState } from 'react';
import Button from '../Button/Button';
import Icon from '../Icon/Icon';
import styles from './MoreActionsMenu.module.scss';

export interface MoreActionsMenuItem {
  label: string;
  icon?: string;
  intent?: 'neutral' | 'danger';
  disabled?: boolean;
  onClick: () => void;
}

interface Props {
  items: MoreActionsMenuItem[];
  /** Disables the trigger button (e.g. while a mutation is in flight). */
  disabled?: boolean;
  /** Size of the trigger button. Defaults to 'sm'. */
  size?: 'sm' | 'md';
}

const MoreActionsMenu = ({ items, disabled = false, size = 'sm' }: Props) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <Button
        variant="outlined"
        intent="neutral"
        icon="more_vert"
        size={size}
        tooltip="More actions"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      />

      {open && (
        <div className={styles.menu}>
          {items.map((item, i) => (
            <button
              key={i}
              className={[
                styles.menuItem,
                item.intent === 'danger' ? styles.menuItemDanger : '',
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={item.disabled ?? disabled}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
            >
              {item.icon && <Icon name={item.icon} />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MoreActionsMenu;
