import Card from '../../../components/Card/Card';
import DescriptionEditor from '../../../components/DescriptionEditor/DescriptionEditor';
import EntityHeader from '../../../components/EntityHeader/EntityHeader';
import { type LeagueFullRecord } from '../../../hooks/useLeagueDetails';
import { type CreateLeagueData } from '../../../hooks/useLeagues';
import styles from './LeagueDetails.module.scss';

interface Props {
  league: LeagueFullRecord;
  busy: string | null;
  uploadLogo: (file: File) => Promise<string | null>;
  updateLeague: (id: string, payload: Partial<CreateLeagueData>) => Promise<boolean>;
  onEditLeague: () => void;
  className?: string;
}

const LeagueInfoCard = (props: Props) => {
  const { league, busy, uploadLogo, updateLeague, onEditLeague, className } = props;
  const isBusy = busy === league.id;

  return (
    <Card className={className}>
      <EntityHeader
        logo={league.logo}
        name={league.name}
        code={league.code}
        primaryColor={league.primary_color}
        textColor={league.text_color}
        isBusy={isBusy}
        onLogoChange={async (file) => {
          const url = await uploadLogo(file);
          if (url) await updateLeague(league.id, { logo: url });
        }}
        onEdit={onEditLeague}
        editTooltip="Edit League"
        logoEditTooltip="Edit League Icon"
        swatches={[
          { label: 'Primary', color: league.primary_color },
          { label: 'Text', color: league.text_color },
        ]}
      />

      <div className={styles.infoGrid}>
        <div className={`${styles.infoItem} ${styles.infoItemFull}`}>
          <span className={styles.infoLabel}>Description</span>
          <DescriptionEditor
            description={league.description}
            onSave={(html) => updateLeague(league.id, { description: html })}
          />
        </div>
      </div>
    </Card>
  );
};

export default LeagueInfoCard;
