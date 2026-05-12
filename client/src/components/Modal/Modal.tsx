import { ReactNode, useEffect, useState } from 'react';
import Button from '../Button/Button';
import type { ButtonIntent } from '../Button/Button';
import styles from './Modal.module.scss';

// Must match the CSS animation duration for slideDownSheet
const SHEET_DURATION_MS = 220;

let mobileScrollLockCount = 0;
let lockedScrollY = 0;
const scrollLockTargets = new WeakMap<
  HTMLElement,
  { overflow: string; touchAction: string; overscrollBehavior: string }
>();

const getAppScrollLockTargets = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-app-scroll-lock-target="true"]'));

const lockMobileBackgroundScroll = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (mobileScrollLockCount === 0) {
    lockedScrollY = window.scrollY;
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.body.style.overscrollBehavior = 'none';

    for (const el of getAppScrollLockTargets()) {
      scrollLockTargets.set(el, {
        overflow: el.style.overflow,
        touchAction: el.style.touchAction,
        overscrollBehavior: el.style.overscrollBehavior,
      });
      el.style.overflow = 'hidden';
      el.style.touchAction = 'none';
      el.style.overscrollBehavior = 'none';
    }
  }
  mobileScrollLockCount += 1;
};

const unlockMobileBackgroundScroll = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (mobileScrollLockCount === 0) return;
  mobileScrollLockCount -= 1;
  if (mobileScrollLockCount === 0) {
    document.documentElement.style.overflow = '';
    document.documentElement.style.overscrollBehavior = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
    document.body.style.overscrollBehavior = '';

    for (const el of getAppScrollLockTargets()) {
      const prev = scrollLockTargets.get(el);
      el.style.overflow = prev?.overflow ?? '';
      el.style.touchAction = prev?.touchAction ?? '';
      el.style.overscrollBehavior = prev?.overscrollBehavior ?? '';
      scrollLockTargets.delete(el);
    }

    window.scrollTo(0, lockedScrollY);
  }
};

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'md' | 'lg' | 'xl';
  /** When true, clicking the backdrop overlay does not close the modal. */
  disableBackdropClose?: boolean;

  // ── Built-in footer ──────────────────────────────────────────────
  /** Called when the confirm button is clicked (non-form usage). */
  onConfirm?: () => void;
  /** Label for the confirm button. Defaults to "Save". */
  confirmLabel?: string;
  /** Optional icon for the confirm button. */
  confirmIcon?: string;
  /** Intent (colour) for the confirm button. Defaults to "accent". */
  confirmIntent?: ButtonIntent;
  /** Disables the confirm button independently of `busy`. */
  confirmDisabled?: boolean;
  /** Links the confirm button to a form via the HTML `form` attribute. */
  confirmForm?: string;
  /** Label for the cancel button. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Disables all footer buttons (e.g. while a request is in flight). */
  busy?: boolean;
  /** Content rendered on the left side of the footer row. */
  footerStart?: ReactNode;

  // ── Escape hatches ───────────────────────────────────────────────
  /** Full override: render arbitrary content in place of the built-in footer. */
  footer?: ReactNode;
  /** Suppress the footer entirely (no Cancel button either). */
  hideFooter?: boolean;
}

const Modal = (props: Props) => {
  const {
    open,
    title,
    onClose,
    children,
    size = 'md',
    disableBackdropClose = false,
    onConfirm,
    confirmLabel = 'Save',
    confirmIcon,
    confirmIntent = 'accent',
    confirmDisabled,
    confirmForm,
    cancelLabel = 'Cancel',
    busy,
    footerStart,
    footer,
    hideFooter,
  } = props;

  // isClosing stays true for the duration of the slide-down animation before
  // the parent's onClose is called and the component fully unmounts.
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const shouldLock = (open || isClosing) && window.matchMedia('(max-width: 768px)').matches;
    if (!shouldLock) return;
    lockMobileBackgroundScroll();
    return () => unlockMobileBackgroundScroll();
  }, [open, isClosing]);

  if (!open && !isClosing) return null;

  const handleClose = () => {
    if (isClosing) return;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile) {
      setIsClosing(true);
      setTimeout(() => {
        setIsClosing(false);
        onClose();
      }, SHEET_DURATION_MS);
    } else {
      onClose();
    }
  };

  const showConfirm = !!(onConfirm || confirmForm);

  const builtInFooter = (
    <div className={styles.footerRow}>
      {footerStart && <div className={styles.footerStart}>{footerStart}</div>}
      <div className={styles.footerActions}>
        <Button
          variant="outlined"
          intent="neutral"
          onClick={handleClose}
          type="button"
          disabled={busy}
        >
          {cancelLabel}
        </Button>
        {showConfirm && (
          <Button
            intent={confirmIntent}
            icon={confirmIcon}
            onClick={onConfirm}
            form={confirmForm}
            type={confirmForm ? 'submit' : 'button'}
            disabled={confirmDisabled || busy}
          >
            {confirmLabel}
          </Button>
        )}
      </div>
    </div>
  );

  const modalSizeClass =
    size === 'lg' ? ` ${styles.modalLg}` : size === 'xl' ? ` ${styles.modalXl}` : '';

  return (
    <div
      className={`${styles.overlay} ${isClosing ? styles.closingOverlay : ''}`}
      onClick={disableBackdropClose ? undefined : handleClose}
    >
      <div
        className={`${styles.modal}${modalSizeClass} ${isClosing ? styles.closing : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          <Button
            variant="ghost"
            intent="neutral"
            icon="close"
            iconSize="0.8rem"
            onClick={handleClose}
            type="button"
            className={styles.closeBtn}
          />
        </div>
        <div className={styles.body}>{children}</div>
        {!hideFooter && <div className={styles.footer}>{footer ?? builtInFooter}</div>}
      </div>
    </div>
  );
};

export default Modal;
