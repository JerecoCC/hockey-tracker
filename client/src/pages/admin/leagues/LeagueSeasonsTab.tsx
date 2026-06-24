import Card from '@/components/Card/Card';
import LeagueSeasonsCard from './LeagueSeasonsCard';
import {
  LeagueListRowSkeleton,
  TabActionSkeleton,
  TabTitleSkeleton,
} from './LeagueTabSkeletonHelpers';
import styles from './LeagueDetails.module.scss';

const LeagueSeasonsTab = () => (
  <div className={styles.grid}>
    <LeagueSeasonsCard className={styles.col12} />
  </div>
);

export const LeagueSeasonsTabSkeleton = () => (
  <div className={styles.grid}>
    <Card
      className={styles.col12}
      title={<TabTitleSkeleton width="88px" />}
      action={<TabActionSkeleton width="126px" />}
      role="status"
      aria-busy="true"
      aria-label="Loading seasons"
    >
      <ul className={styles.tabSkeletonStack}>
        {Array.from({ length: 5 }, (_, index) => (
          <LeagueListRowSkeleton
            key={index}
            tag={index === 0}
            bordered
          />
        ))}
      </ul>
    </Card>
  </div>
);

export default LeagueSeasonsTab;
