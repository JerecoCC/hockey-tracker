import type { ReactNode } from 'react';
import type { Control, FieldValues } from 'react-hook-form';
import Card from '../../../components/Card/Card';
import EntityHeader from '../../../components/EntityHeader/EntityHeader';
import { type LeagueFullRecord } from '../../../hooks/useLeagueDetails';
import styles from './LeagueDetails.module.scss';

const normalizeDescription = (html: string | null | undefined): string | null => {
  if (!html || html === '<p></p>') return null;
  return html;
};

interface Props<T extends FieldValues = FieldValues> {
  league: LeagueFullRecord;
  onEdit: () => void;
  isEditing?: boolean;
  control?: Control<T>;
  formId?: string;
  onCancel?: () => void;
  isSubmitting?: boolean;
  /** Rendered below the header when isEditing=true (description editor form). */
  editForm?: ReactNode;
  className?: string;
}

function LeagueInfoCard<T extends FieldValues = FieldValues>(props: Props<T>) {
  const {
    league,
    onEdit,
    isEditing = false,
    control,
    formId,
    onCancel,
    isSubmitting,
    editForm,
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
        control={control}
        formId={formId}
        onCancel={onCancel}
        isSubmitting={isSubmitting}
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
}

export default LeagueInfoCard;
