import { type LeagueFullRecord } from '@/hooks/useLeagueDetails';
import LeagueInfoCard, { LeagueInfoCardSkeleton } from './LeagueInfoCard';
import styles from './LeagueDetails.module.scss';

interface Props {
  league: LeagueFullRecord;
  onEdit: () => void;
}

const LeagueInfoTab = ({ league, onEdit }: Props) => (
  <div className={styles.grid}>
    <LeagueInfoCard
      className={styles.col12}
      league={league}
      onEdit={onEdit}
    />
  </div>
);

export const LeagueInfoTabSkeleton = () => (
  <div className={styles.grid}>
    <LeagueInfoCardSkeleton className={styles.col12} />
  </div>
);

export default LeagueInfoTab;
