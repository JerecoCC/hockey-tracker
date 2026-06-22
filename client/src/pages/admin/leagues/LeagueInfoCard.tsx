import Card from '@/components/Card/Card';
import EntityHeader from '@/components/EntityHeader/EntityHeader';
import InfoItem from '@/components/InfoItem/InfoItem';
import { type LeagueFullRecord } from '@/hooks/useLeagueDetails';
import styles from './LeagueDetails.module.scss';

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
      <InfoItem
        label="Playoff Series Format"
        data={`Best of ${league.best_of_playoff}`}
      />
      <InfoItem
        label="Shootout Rounds"
        data={`${league.best_of_shootout} rounds`}
      />
      <InfoItem
        label="Scoring System"
        data={league.scoring_system}
      />
      <InfoItem
        type="html"
        label="Description"
        data={league.description}
        muted="No description"
        full
      />
    </div>
  </Card>
);

export default LeagueInfoCard;
