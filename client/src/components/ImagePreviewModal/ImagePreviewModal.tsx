import { useEffect } from 'react';
import Button from '../Button/Button';
import { lockBackgroundScroll, unlockBackgroundScroll } from '../Modal/backgroundScrollLock';
import styles from './ImagePreviewModal.module.scss';

interface Props {
  open: boolean;
  src: string | null | undefined;
  alt?: string;
  onClose: () => void;
}

const ImagePreviewModal = ({ open, src, alt = '', onClose }: Props) => {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !src) return;
    lockBackgroundScroll();
    return () => unlockBackgroundScroll();
  }, [open, src]);

  if (!open || !src) return null;

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
    >
      <div
        className={styles.imageWrapper}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          className={styles.img}
        />
        <Button
          variant="ghost"
          intent="neutral"
          icon="close"
          iconSize="1rem"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          type="button"
          className={styles.closeBtnInner}
          tooltipClassName={styles.closeBtn}
          tooltip="Close"
        />
      </div>
    </div>
  );
};

export default ImagePreviewModal;
