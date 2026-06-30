import Skeleton from '@/components/Skeleton/Skeleton';
import styles from './LeagueDetails.module.scss';

export interface TabSkeletonProps {
  className?: string;
}

export const TabActionSkeleton = ({ width = '112px' }: { width?: string }) => (
  <Skeleton
    width={width}
    className={styles.tabSkeletonButton}
  />
);

export const LeagueListRowSkeleton = ({
  bordered = false,
}: {
  image?: boolean;
  code?: boolean;
  tag?: boolean;
  bordered?: boolean;
}) => (
  <Skeleton
    as="li"
    className={[styles.tabSkeletonRow, bordered ? styles.tabSkeletonRowBordered : '']
      .filter(Boolean)
      .join(' ')}
  />
);
