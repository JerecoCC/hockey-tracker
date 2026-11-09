import Skeleton from '@jerecocc/tracker-ui/components/Skeleton/Skeleton';
import useScreenSize from '@/hooks/useScreenSize';
import styles from './LeagueDetails.module.scss';

export interface TabSkeletonProps {
  className?: string;
}

// Section actions are icon buttons on phones (see SectionActionButton), this size square.
const MOBILE_ICON_BUTTON_SIZE = '42px';

export const TabActionSkeleton = ({ width = '112px' }: { width?: string }) => {
  const isMobileView = useScreenSize() === 'mobile';
  return (
    <Skeleton
      width={isMobileView ? MOBILE_ICON_BUTTON_SIZE : width}
      height={isMobileView ? MOBILE_ICON_BUTTON_SIZE : undefined}
      className={styles.tabSkeletonButton}
    />
  );
};

export const LeagueListRowSkeleton = () => (
  <Skeleton
    as="li"
    variant="card"
    className={styles.tabSkeletonRow}
  />
);
