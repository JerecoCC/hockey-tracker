import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  /** Visual style of the trigger button. Defaults to 'ghost'. */
  variant?: 'filled' | 'outlined' | 'ghost';
  /** Extra className forwarded to the trigger Button (e.g. to override border-radius). */
  buttonClassName?: string;
}

interface MenuPosition {
  top: number;
  left: number;
}

const MENU_GAP = 6;
const VIEWPORT_MARGIN = 8;

const MoreActionsMenu = ({
  items,
  disabled = false,
  size = 'sm',
  variant = 'ghost',
  buttonClassName,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPosition = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const menuWidth = menuRef.current?.getBoundingClientRect().width ?? 168;
    const menuHeight = menuRef.current?.getBoundingClientRect().height ?? 0;
    const belowTop = rect.bottom + MENU_GAP;
    const aboveTop = rect.top - menuHeight - MENU_GAP;
    const wouldClipBottom =
      menuHeight > 0 && belowTop + menuHeight > window.innerHeight - VIEWPORT_MARGIN;
    const top = wouldClipBottom ? Math.max(VIEWPORT_MARGIN, aboveTop) : belowTop;
    const maxLeft = window.innerWidth - menuWidth - VIEWPORT_MARGIN;
    const preferredLeft = rect.right - menuWidth;

    setMenuPosition({
      top,
      left: Math.max(VIEWPORT_MARGIN, Math.min(preferredLeft, maxLeft)),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        wrapperRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }

      if (wrapperRef.current) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  const handleTriggerClick = () => {
    if (open) {
      setOpen(false);
      return;
    }

    updateMenuPosition();
    setOpen(true);
  };

  const menu = open
    ? createPortal(
        <div
          ref={menuRef}
          className={styles.menu}
          style={
            menuPosition
              ? {
                  top: menuPosition.top,
                  left: menuPosition.left,
                }
              : undefined
          }
        >
          {items.map((item, i) => (
            <button
              key={i}
              className={[styles.menuItem, item.intent === 'danger' ? styles.menuItemDanger : '']
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
        </div>,
        document.body,
      )
    : null;

  return (
    <div
      className={styles.wrapper}
      data-size={size}
      ref={wrapperRef}
    >
      <Button
        variant={variant}
        intent="neutral"
        icon="more_vert"
        size={size}
        tooltip="More actions"
        disabled={disabled}
        className={[styles.trigger, buttonClassName].filter(Boolean).join(' ')}
        onClick={handleTriggerClick}
      />

      {menu}
    </div>
  );
};

export default MoreActionsMenu;
