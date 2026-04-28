import Card from '@/components/Card/Card';
import EntityHeader from '@/components/EntityHeader/EntityHeader';
import { type LeagueFullRecord } from '@/hooks/useLeagueDetails';
import styles from '@/pages/admin/leagues/LeagueDetails.module.scss';

const normalizeDescription = (html: string | null | undefined): string | null => {
  if (!html || html === '<p></p>') return null;
  return html;
};

interface Props {
  league: LeagueFullRecord;
  onEdit: () => void;
  className?: string;
}

const LeagueInfoCard = ({ league, onEdit, className }: Props) => (
  <Card className={className}>
    <EntityHeader
      logo={league.logo}
      name={league.name}
      code={league.code}
      primaryColor={league.primary_color}
      textColor={league.text_color}
      onEdit={onEdit}
      swatches={[
        { label: 'Primary', color: league.primary_color },
        { label: 'Text', color: league.text_color },
      ]}
    />

    <div className={styles.infoGrid}>
      <div className={styles.infoItem}>
        <span className={styles.infoLabel}>Playoff Series Format</span>
        <span className={styles.infoValue}>Best of {league.best_of_playoff}</span>
      </div>
      <div className={styles.infoItem}>
        <span className={styles.infoLabel}>Shootout Rounds</span>
        <span className={styles.infoValue}>{league.best_of_shootout} rounds</span>
      </div>
      <div className={`${styles.infoItem} ${styles.infoItemFull}`}>
        <span className={styles.infoLabel}>Description</span>
        {normalizeDescription(league.description) ? (
          <div
            className={styles.infoValue}
            dangerouslySetInnerHTML={{ __html: league.description! }}
          />
        ) : (
          <span className={styles.infoValueMuted}>No description</span>
        )}
      </div>
    </div>
  </Card>
);

export default LeagueInfoCard;
