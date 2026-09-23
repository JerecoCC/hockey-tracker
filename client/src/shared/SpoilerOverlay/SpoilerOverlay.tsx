import type { ReactNode } from 'react';
import Icon from '@jerecocc/tracker-ui/components/Icon/Icon';
import styles from './SpoilerOverlay.module.scss';

interface Props {
  /**
   * Placeholder content shown under the veil. Only ever pass filler here: the
   * point of the overlay is that the real result never reaches the page.
   */
  children: ReactNode;
  label?: string;
  className?: string;
}

const SpoilerOverlay = ({
  children,
  label = 'Mark as watched to reveal',
  className,
}: Props) => (
  <div className={[styles.spoiler, className].filter(Boolean).join(' ')}>
    <div
      className={styles.filler}
      aria-hidden="true"
    >
      {children}
    </div>
    <div className={styles.veil}>
      <Icon
        name="visibility_off"
        size="1.1rem"
        className={styles.veilIcon}
      />
      <span>{label}</span>
    </div>
  </div>
);

export default SpoilerOverlay;
