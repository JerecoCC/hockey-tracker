import Skeleton from '@jerecocc/tracker-ui/Skeleton';
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

export const LeagueListRowSkeleton = () => (
  <Skeleton
    as="li"
    type="card"
    className={styles.tabSkeletonRow}
  />
);
