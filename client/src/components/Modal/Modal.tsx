import { ReactNode } from 'react';
import Icon from '../Icon/Icon';
import styles from './Modal.module.scss';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

const Modal = ({ title, onClose, children }: Props) => (
  <div className={styles.overlay} onClick={onClose}>
    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <button className={styles.closeBtn} onClick={onClose} type="button">
          <Icon name="close" size="1.2em" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

export default Modal;

