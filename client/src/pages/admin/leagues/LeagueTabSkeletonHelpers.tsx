import Skeleton from '@/components/Skeleton/Skeleton';
import styles from './LeagueDetails.module.scss';

export interface TabSkeletonProps {
  className?: string;
}

export const TabTitleSkeleton = ({ width }: { width: string }) => (
  <Skeleton
    type="text"
    width={width}
    className={styles.tabSkeletonTitle}
  />
);

export const TabActionSkeleton = ({ width = '112px' }: { width?: string }) => (
  <Skeleton
    width={width}
    className={styles.tabSkeletonButton}
  />
);

export const LeagueListRowSkeleton = ({
  image = false,
  code = false,
  tag = false,
  bordered = false,
}: {
  image?: boolean;
  code?: boolean;
  tag?: boolean;
  bordered?: boolean;
}) => (
  <li
    className={[styles.tabSkeletonRow, bordered ? styles.tabSkeletonRowBordered : '']
      .filter(Boolean)
      .join(' ')}
  >
    {image && <Skeleton type="picture" />}
    <span className={styles.tabSkeletonTextStack}>
      <Skeleton
        type="subtitle"
        className={styles.tabSkeletonEyebrow}
      />
      <Skeleton
        type="text"
        className={styles.tabSkeletonName}
      />
    </span>
    {code && <Skeleton type="code" />}
    {tag && (
      <Skeleton
        type="text"
        className={styles.tabSkeletonTag}
      />
    )}
  </li>
);
