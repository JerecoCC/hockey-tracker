import Section from '@jerecocc/tracker-ui/components/Section/Section';
import { useLeagueDetailsContext } from './leagueDetailsState';
import LeagueSeasonsCard from './LeagueSeasonsCard';
import { LeagueListRowSkeleton, TabActionSkeleton } from './LeagueTabSkeletonHelpers';
import ResponsiveList from '@/shared/ResponsiveList/ResponsiveList';
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
    <Section
      className={styles.col12}
      title="Seasons"
      action={<TabActionSkeleton width="126px" />}
      role="status"
      aria-busy="true"
      aria-label="Loading seasons"
    >
    <ResponsiveList className={styles.tabSkeletonStack}>
        {Array.from({ length: 5 }, (_, index) => (
          <LeagueListRowSkeleton key={index} />
        ))}
    </ResponsiveList>
    </Section>
  </div>
);

export default LeagueSeasonsTab;
