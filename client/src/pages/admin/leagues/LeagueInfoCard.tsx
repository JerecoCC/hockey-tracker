import type { ReactNode } from 'react';
import Card from '../../../components/Card/Card';
import EntityHeader from '../../../components/EntityHeader/EntityHeader';
import { type LeagueFullRecord } from '../../../hooks/useLeagueDetails';
import styles from './LeagueDetails.module.scss';

const normalizeDescription = (html: string | null | undefined): string | null => {
  if (!html || html === '<p></p>') return null;
  return html;
};

interface Props {
  league: LeagueFullRecord;
  onEdit: () => void;
  isEditing?: boolean;
  /** Rendered inside the Card when isEditing=true, replacing the read-only description. */
  editForm?: ReactNode;
  /** Edit-mode slot forwarded to EntityHeader: replaces the logo. */
  logoSlot?: ReactNode;
  /** Edit-mode slot forwarded to EntityHeader: replaces the name+code block. */
  nameSlot?: ReactNode;
  /** Edit-mode slot forwarded to EntityHeader: replaces the Edit button and swatches. */
  rightSlot?: ReactNode;
  className?: string;
}

const LeagueInfoCard = (props: Props) => {
  const {
    league,
    onEdit,
    isEditing = false,
    editForm,
    logoSlot,
    nameSlot,
    rightSlot,
    className,
  } = props;

  return (
    <Card className={className}>
      <EntityHeader
        logo={league.logo}
        name={league.name}
        code={league.code}
        primaryColor={league.primary_color}
        textColor={league.text_color}
        isEditing={isEditing}
        onEdit={onEdit}
        swatches={[
          { label: 'Primary', color: league.primary_color },
          { label: 'Text', color: league.text_color },
        ]}
        logoSlot={logoSlot}
        nameSlot={nameSlot}
        rightSlot={rightSlot}
      />

      {isEditing ? (
        editForm
      ) : (
        <div className={styles.infoGrid}>
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
      )}
    </Card>
  );
};

export default LeagueInfoCard;
