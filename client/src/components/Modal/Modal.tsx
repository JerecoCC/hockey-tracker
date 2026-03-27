import { ReactNode } from 'react';
import Button from '../Button/Button';
import styles from './Modal.module.scss';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

const Modal = ({ open, title, onClose, children }: Props) => {
  if (!open) return null;
  return (
    <div
      className={styles.overlay}
      onClick={onClose}
    >
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          <Button
            variant="ghost"
            intent="neutral"
            icon="close"
            iconSize="0.8rem"
            onClick={onClose}
            type="button"
            className={styles.closeBtn}
          />
        </div>
        {children}
      </div>
    </div>
  );
};

export default Modal;
