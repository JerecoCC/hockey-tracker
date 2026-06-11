import styles from './LoadingSpinner.module.scss';

interface Props {
  message?: string;
  layout?: 'inline' | 'block' | 'page';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const LoadingSpinner = ({
  message = 'Loading...',
  layout = 'block',
  size = 'md',
  className,
}: Props) => (
  <div
    className={[styles.root, styles[layout], className].filter(Boolean).join(' ')}
    role="status"
    aria-live="polite"
    aria-label={message}
  >
    <span className={[styles.spinner, styles[size]].join(' ')} />
    {message && <p className={styles.message}>{message}</p>}
  </div>
);

export default LoadingSpinner;
