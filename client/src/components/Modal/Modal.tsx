import { ReactNode, useEffect, useState } from 'react';
import Button from '../Button/Button';
import type { ButtonIntent } from '../Button/Button';
import Divider from '../Divider/Divider';
import { lockBackgroundScroll, unlockBackgroundScroll } from './backgroundScrollLock';
import styles from './Modal.module.scss';

// Must match the CSS animation duration for slideDownSheet
const SHEET_DURATION_MS = 220;

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'md' | 'lg' | 'xl';
  className?: string;
  bodyClassName?: string;
  footerClassName?: string;
  footerDividerClassName?: string;
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
    className,
    bodyClassName,
    footerClassName,
    footerDividerClassName,
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
    const shouldLock = open || isClosing;
    if (!shouldLock) return;
    lockBackgroundScroll();
    return () => unlockBackgroundScroll();
  }, [open, isClosing]);

  if (!open && !isClosing) return null;

  const handleClose = () => {
    if (isClosing) return;
    const isMobile =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 768px)').matches;
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
        className={`${styles.modal}${modalSizeClass} ${className ?? ''} ${
          isClosing ? styles.closing : ''
        }`}
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
        <div className={`${styles.body} ${bodyClassName ?? ''}`}>{children}</div>
        {!hideFooter && (
          <div className={[styles.footer, footerClassName].filter(Boolean).join(' ')}>
            <Divider
              className={[styles.footerDivider, footerDividerClassName].filter(Boolean).join(' ')}
            />
            {footer ?? builtInFooter}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
