import { ReactNode } from 'react';
import Icon from '../Icon/Icon';
import Modal from '../Modal/Modal';
import styles from './ConfirmModal.module.scss';

export type ConfirmVariant = 'danger' | 'accent' | 'info';

interface Props {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  confirmIcon?: string;
  variant?: ConfirmVariant;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const variantClass: Record<ConfirmVariant, string> = {
  danger: styles.confirmDanger,
  accent: styles.confirmAccent,
  info:   styles.confirmInfo,
};

const ConfirmModal = ({
  title,
  body,
  confirmLabel,
  confirmIcon,
  variant = 'danger',
  busy = false,
  onCancel,
  onConfirm,
}: Props) => (
  <Modal title={title} onClose={onCancel}>
    <p className={styles.body}>{body}</p>
    <div className={styles.actions}>
      <button className={styles.cancelBtn} onClick={onCancel} type="button" disabled={busy}>
        Cancel
      </button>
      <button className={variantClass[variant]} onClick={onConfirm} type="button" disabled={busy}>
        {confirmIcon && <Icon name={confirmIcon} size="1em" />}
        {confirmLabel}
      </button>
    </div>
  </Modal>
);

export default ConfirmModal;

