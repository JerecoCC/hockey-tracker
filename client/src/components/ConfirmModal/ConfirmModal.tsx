import { ReactNode } from 'react';
import Button from '../Button/Button';
import type { ButtonIntent } from '../Button/Button';
import Modal from '../Modal/Modal';
import styles from './ConfirmModal.module.scss';

export type ConfirmVariant = 'danger' | 'accent' | 'info';

interface Props {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  confirmIcon?: string;
  variant?: ConfirmVariant;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const variantIntent: Record<ConfirmVariant, ButtonIntent> = {
  danger: 'danger',
  accent: 'accent',
  info:   'info',
};

const ConfirmModal = ({
  open,
  title,
  body,
  confirmLabel,
  confirmIcon,
  variant = 'danger',
  busy = false,
  onCancel,
  onConfirm,
}: Props) => (
  <Modal open={open} title={title} onClose={onCancel}>
    <p className={styles.body}>{body}</p>
    <div className={styles.actions}>
      <Button variant="outlined" intent="neutral" onClick={onCancel} type="button" disabled={busy}>
        Cancel
      </Button>
      <Button intent={variantIntent[variant]} icon={confirmIcon} onClick={onConfirm} type="button" disabled={busy}>
        {confirmLabel}
      </Button>
    </div>
  </Modal>
);

export default ConfirmModal;

