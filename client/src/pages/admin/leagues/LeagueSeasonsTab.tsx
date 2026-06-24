import Card from '@/components/Card/Card';
import { useLeagueDetailsContext } from './LeagueDetailsContext';
import LeagueSeasonsCard from './LeagueSeasonsCard';
import { LeagueListRowSkeleton, TabActionSkeleton } from './LeagueTabSkeletonHelpers';
import styles from './LeagueDetails.module.scss';

const LeagueSeasonsTab = () => {
  const { loading } = useLeagueDetailsContext();

  if (loading) return <LeagueSeasonsTabSkeleton />;

  return (
    <div className={styles.grid}>
      <LeagueSeasonsCard className={styles.col12} />
    </div>
  );
};

export const LeagueSeasonsTabSkeleton = () => (
  <div className={styles.grid}>
    <Card
      className={styles.col12}
      title="Seasons"
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
