import { useState } from 'react';
import { useForm } from 'react-hook-form';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import Field from '@/components/Field/Field';
import Modal from '@/components/Modal/Modal';
import Skeleton from '@/components/Skeleton/Skeleton';
import useLeagueAwards, {
  type LeagueAwardPayload,
  type LeagueAwardRecord,
} from '@/hooks/useLeagueAwards';
import type { AwardRecipientType, AwardSelectionMethod } from '@/hooks/useSeasonAwards';
import { TabActionSkeleton, type TabSkeletonProps } from './LeagueTabSkeletonHelpers';
import styles from './LeagueDetails.module.scss';

const METHOD_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'voted', label: 'Voted' },
  { value: 'automatic', label: 'Automatic' },
  { value: 'playoff', label: 'Playoff' },
];

const RECIPIENT_TYPE_OPTIONS = [
  { value: 'player', label: 'Player' },
  { value: 'team', label: 'Team' },
];

const STAT_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'points', label: 'Player Points' },
  { value: 'goals', label: 'Player Goals' },
  { value: 'assists', label: 'Player Assists' },
  { value: 'save_pct', label: 'Goalie Save %' },
  { value: 'gaa', label: 'Goalie GAA' },
  { value: 'shutouts', label: 'Goalie Shutouts' },
  { value: 'standings_points', label: 'Team Points' },
  { value: 'wins', label: 'Team Wins' },
  { value: 'playoff_champion', label: 'Playoff Champion' },
];

interface FormValues {
  name: string;
  description: string;
  recipient_type: AwardRecipientType;
  selection_method: AwardSelectionMethod;
  stat_key: string;
  awarded_after_playoffs: boolean;
  sort_order: string;
}

interface Props {
  leagueId: string;
  className?: string;
}

const emptyValues: FormValues = {
  name: '',
  description: '',
  recipient_type: 'player',
  selection_method: 'manual',
  stat_key: '',
  awarded_after_playoffs: true,
  sort_order: '',
};

const methodLabel = (method: string) =>
  METHOD_OPTIONS.find((option) => option.value === method)?.label ?? method;

const statLabel = (statKey: string | null) =>
  statKey ? (STAT_OPTIONS.find((option) => option.value === statKey)?.label ?? statKey) : null;

const toPayload = (values: FormValues): LeagueAwardPayload => ({
  name: values.name,
  description: values.description || null,
  recipient_type: values.recipient_type,
  selection_method: values.selection_method,
  stat_key: values.stat_key || null,
  awarded_after_playoffs: values.awarded_after_playoffs,
  sort_order: values.sort_order.trim() === '' ? null : Number(values.sort_order),
});

const LeagueAwardsTab = ({ leagueId, className }: Props) => {
  const { awards, loading, createAward, updateAward, deleteAward } = useLeagueAwards(leagueId);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LeagueAwardRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LeagueAwardRecord | null>(null);
  const form = useForm<FormValues>({ defaultValues: emptyValues, mode: 'onChange' });

  const openCreate = () => {
    setEditTarget(null);
    form.reset(emptyValues);
    setModalOpen(true);
  };

  const openEdit = (award: LeagueAwardRecord) => {
    setEditTarget(award);
    form.reset({
      name: award.name,
      description: award.description ?? '',
      recipient_type: award.recipient_type,
      selection_method: award.selection_method,
      stat_key: award.stat_key ?? '',
      awarded_after_playoffs: award.awarded_after_playoffs,
      sort_order: award.sort_order ? String(award.sort_order) : '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditTarget(null);
    form.reset(emptyValues);
  };

  const submit = form.handleSubmit(async (values) => {
    const payload = toPayload(values);
    const ok = editTarget ? await updateAward(editTarget.id, payload) : await createAward(payload);
    if (ok) closeModal();
  });

  if (loading) return <LeagueAwardsTabSkeleton className={className} />;

  return (
    <>
      <div className={styles.grid}>
        <Card
          className={[styles.col12, className].filter(Boolean).join(' ')}
          title="Award Definitions"
          action={
            <Button
              icon="add"
              size="sm"
              onClick={openCreate}
            >
              New Award
            </Button>
          }
        >
          {awards.length === 0 ? (
            <p className={styles.emptyMsg}>
              No award definitions yet. Create one to apply it across seasons.
            </p>
          ) : (
            <ul className={styles.awardDefinitionList}>
              {awards.map((award) => (
                <li
                  key={award.id}
                  className={styles.awardDefinitionItem}
                >
                  <div className={styles.awardDefinitionMain}>
                    <span className={styles.awardDefinitionName}>{award.name}</span>
                    <div className={styles.awardDefinitionMeta}>
                      <span>{award.recipient_type}</span>
                      <span>{methodLabel(award.selection_method)}</span>
                      {statLabel(award.stat_key) && <span>{statLabel(award.stat_key)}</span>}
                      <span>
                        {award.awarded_after_playoffs ? 'After playoffs' : 'Regular season'}
                      </span>
                    </div>
                    {award.description && (
                      <p className={styles.awardDefinitionDescription}>{award.description}</p>
                    )}
                  </div>
                  <div className={styles.ruleSetActions}>
                    <Button
                      variant="outlined"
                      intent="neutral"
                      icon="edit"
                      size="sm"
                      tooltip="Edit award"
                      onClick={() => openEdit(award)}
                    />
                    <Button
                      variant="outlined"
                      intent="danger"
                      icon="delete"
                      size="sm"
                      tooltip="Remove award"
                      onClick={() => setConfirmDelete(award)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Modal
        open={modalOpen}
        title={editTarget ? 'Edit Award Definition' : 'New Award Definition'}
        onClose={closeModal}
        confirmForm="league-award-form"
        confirmLabel={
          form.formState.isSubmitting ? 'Savingâ€¦' : editTarget ? 'Save Changes' : 'Create Award'
        }
        confirmIcon="save"
        confirmDisabled={
          form.formState.isSubmitting || !form.formState.isDirty || !form.formState.isValid
        }
        busy={form.formState.isSubmitting}
      >
        <form
          id="league-award-form"
          className={styles.awardDefinitionForm}
          onSubmit={submit}
        >
          <Field
            control={form.control}
            name="name"
            label="Award Name"
            required
            rules={{ required: 'Award name is required' }}
          />
          <div className={styles.awardDefinitionFormGrid}>
            <Field
              control={form.control}
              name="recipient_type"
              type="select"
              label="Recipient"
              options={RECIPIENT_TYPE_OPTIONS}
            />
            <Field
              control={form.control}
              name="selection_method"
              type="select"
              label="Selection"
              options={METHOD_OPTIONS}
            />
          </div>
          <div className={styles.awardDefinitionFormGrid}>
            <Field
              control={form.control}
              name="stat_key"
              type="select"
              label="Stat"
              options={STAT_OPTIONS}
            />
            <Field
              control={form.control}
              name="sort_order"
              type="number"
              label="Sort Order"
              min={0}
            />
          </div>
          <Field
            control={form.control}
            name="description"
            type="textarea"
            label="Description"
            rows={3}
          />
          <label className={styles.awardDefinitionCheckbox}>
            <input
              type="checkbox"
              checked={form.watch('awarded_after_playoffs')}
              onChange={(e) =>
                form.setValue('awarded_after_playoffs', e.target.checked, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            />
            <span>Awarded after playoffs</span>
          </label>
        </form>
      </Modal>

      <ConfirmModal
        open={confirmDelete !== null}
        title="Remove Award Definition"
        body={
          <>
            Remove <strong>{confirmDelete?.name}</strong> from this league&apos;s active award
            definitions? Existing recorded season results will remain in the database.
          </>
        }
        confirmLabel="Remove"
        confirmIntent="danger"
        onConfirm={async () => {
          if (confirmDelete) await deleteAward(confirmDelete.id);
          setConfirmDelete(null);
        }}
        onClose={() => setConfirmDelete(null)}
      />
    </>
  );
};

export const LeagueAwardsTabSkeleton = ({ className }: TabSkeletonProps) => (
  <div className={styles.grid}>
    <Card
      className={[styles.col12, className].filter(Boolean).join(' ')}
      title="Award Definitions"
      action={<TabActionSkeleton width="112px" />}
      role="status"
      aria-busy="true"
      aria-label="Loading awards"
    >
      <ul className={styles.awardDefinitionList}>
        {Array.from({ length: 5 }, (_, index) => (
          <li
            key={index}
            className={styles.awardDefinitionItem}
          >
            <div className={styles.awardDefinitionMain}>
              <Skeleton
                type="text"
                className={styles.tabSkeletonAwardName}
              />
              <div className={styles.tabSkeletonChipRow}>
                {Array.from({ length: 3 }, (_, chipIndex) => (
                  <Skeleton
                    key={chipIndex}
                    type="tag"
                    className={styles.tabSkeletonChip}
                  />
                ))}
              </div>
              <Skeleton
                type="text"
                className={styles.tabSkeletonDescription}
              />
            </div>
            <span className={styles.tabSkeletonActions}>
              <Skeleton type="circle" />
              <Skeleton type="circle" />
            </span>
          </li>
        ))}
      </ul>
    </Card>
  </div>
);

export default LeagueAwardsTab;
