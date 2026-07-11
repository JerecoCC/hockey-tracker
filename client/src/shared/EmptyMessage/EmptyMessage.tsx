import type { HTMLAttributes } from 'react';
import styles from './EmptyMessage.module.scss';

export type EmptyMessageProps = HTMLAttributes<HTMLParagraphElement>;

const EmptyMessage = ({ className, ...rest }: EmptyMessageProps) => (
  <p
    className={[styles.message, className].filter(Boolean).join(' ')}
    {...rest}
  />
);

export default EmptyMessage;
