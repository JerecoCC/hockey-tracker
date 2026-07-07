import type { ReactNode } from 'react';
import Button from '../Button/Button';
import Card from '../Card/Card';
import Icon from '../Icon/Icon';
import styles from './Banner.module.scss';

export type BannerIntent = 'accent' | 'info' | 'success' | 'warning' | 'danger' | 'neutral';

interface BannerProps {
  intent?: BannerIntent;
  icon: string;
  title?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  closeable?: boolean;
  onClose?: () => void;
  closeLabel?: string;
  cancelLabel?: string;
  className?: string;
}

const Banner = ({
  intent = 'info',
  icon,
  title,
  children,
  actions,
  closeable,
  onClose,
  closeLabel = 'Dismiss banner',
  cancelLabel = 'Cancel',
  className,
}: BannerProps) => {
  const canClose = closeable ?? !!onClose;
  const hasActions = !!actions;
  const showCloseControl = canClose && !!onClose;

  return (
    <Card
      variant="border"
      className={[styles.root, styles[intent], className].filter(Boolean).join(' ')}
    >
      <span className={styles.icon}>
        <Icon
          name={icon}
          size="1.125rem"
        />
      </span>
      <span className={styles.divider} />
      <span className={styles.content}>
        {title && <strong className={styles.title}>{title}</strong>}
        <span className={styles.message}>{children}</span>
      </span>
      {(hasActions || showCloseControl) && (
        <div className={styles.actions}>
          {actions}
          {showCloseControl &&
            (hasActions ? (
              <Button
                type="button"
                variant="ghost"
                intent="neutral"
                onClick={onClose}
              >
                {cancelLabel}
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                intent="neutral"
                icon="close"
                tooltip={closeLabel}
                aria-label={closeLabel}
                className={styles.close}
                onClick={onClose}
              />
            ))}
        </div>
      )}
    </Card>
  );
};

export default Banner;
