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
