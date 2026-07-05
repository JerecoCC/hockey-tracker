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
  onClose: () => void;
  closeLabel?: string;
  className?: string;
}

const Banner = ({
  intent = 'info',
  icon,
  title,
  children,
  onClose,
  closeLabel = 'Dismiss banner',
  className,
}: BannerProps) => (
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
    <Button
      variant="ghost"
      intent="neutral"
      icon="close"
      size="sm"
      tooltip={closeLabel}
      aria-label={closeLabel}
      className={styles.close}
      onClick={onClose}
    />
  </Card>
);

export default Banner;
