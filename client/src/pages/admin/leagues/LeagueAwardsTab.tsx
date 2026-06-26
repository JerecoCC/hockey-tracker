import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import Button from '@/components/Button/Button';
import Checkbox from '@/components/Checkbox/Checkbox';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import Field from '@/components/Field/Field';
import ListItem, { type ListItemAction } from '@/components/ListItem/ListItem';
import Modal from '@/components/Modal/Modal';
import Section from '@/components/Section/Section';
import Skeleton from '@/components/Skeleton/Skeleton';
import Tag from '@/components/Tag/Tag';
import useLeagueAwards, {
  type LeagueAwardPayload,
  type LeagueAwardRecord,
} from '@/hooks/useLeagueAwards';
import type { AwardRecipientType, AwardSelectionMethod } from '@/hooks/useSeasonAwards';
import {
  awardSelectionSourceLabel,
  getAwardCompetitionScope,
  getAwardRecordingGate,
  getAwardSelectionSource,
  getAwardWinnerMode,
} from '@/lib/awardDefinitions';
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
  uses_nominees: boolean;
  allow_multiple_winners: boolean;
  uses_team_selection: boolean;
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
  uses_nominees: false,
  allow_multiple_winners: false,
  uses_team_selection: false,
  sort_order: '',
};

const statLabel = (statKey: string | null) =>
  statKey ? (STAT_OPTIONS.find((option) => option.value === statKey)?.label ?? statKey) : null;

const recipientTypeLabel = (recipientType: AwardRecipientType) =>
  recipientType === 'player' ? 'Player' : 'Team';

const toPayload = (values: FormValues): LeagueAwardPayload => ({
  name: values.name,
  description: values.description || null,
  recipient_type: values.recipient_type,
  selection_method: values.selection_method,
  stat_key: values.stat_key || null,
  awarded_after_playoffs: values.awarded_after_playoffs,
  uses_nominees: values.uses_nominees,
  allow_multiple_winners: values.allow_multiple_winners,
  uses_team_selection: values.uses_team_selection,
  sort_order: values.sort_order.trim() === '' ? null : Number(values.sort_order),
});

const LeagueAwardsTab = ({ leagueId, className }: Props) => {
  const { awards, loading, createAward, updateAward, deleteAward } = useLeagueAwards(leagueId);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LeagueAwardRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LeagueAwardRecord | null>(null);
  const form = useForm<FormValues>({ defaultValues: emptyValues, mode: 'onChange' });
  const awardedAfterPlayoffsLabelId = useId();
  const usesNomineesLabelId = useId();
  const allowMultipleWinnersLabelId = useId();
  const usesTeamSelectionLabelId = useId();

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
      uses_nominees: award.uses_nominees,
      allow_multiple_winners: award.allow_multiple_winners,
      uses_team_selection: award.uses_team_selection,
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

  const toggleBooleanField = (
    field:
      | 'awarded_after_playoffs'
      | 'uses_nominees'
      | 'allow_multiple_winners'
      | 'uses_team_selection',
  ) => {
    form.setValue(field, !form.getValues(field), {
      shouldDirty: true,
      shouldValidate: true,
    });
  };
  const awardedAfterPlayoffs = form.watch('awarded_after_playoffs');
  const usesNominees = form.watch('uses_nominees');
  const allowMultipleWinners = form.watch('allow_multiple_winners');
  const usesTeamSelection = form.watch('uses_team_selection');

  if (loading) return <LeagueAwardsTabSkeleton className={className} />;

  return (
    <>
      <div className={styles.grid}>
        <Section
          className={[styles.col12, className].filter(Boolean).join(' ')}
          title="Awards"
          action={
            <Button
              icon="add"
              size="sm"
              onClick={openCreate}
            >
              Create Award
            </Button>
          }
        >
          {awards.length === 0 ? (
            <p className={styles.emptyMsg}>
              No award definitions yet. Create one to apply it across seasons.
            </p>
          ) : (
            <ul className={styles.awardDefinitionList}>
              {awards.map((award) => {
                const stat = statLabel(award.stat_key);
                const competitionScope = getAwardCompetitionScope(award);
                const recordingGate = getAwardRecordingGate(award);
                const selectionSource = getAwardSelectionSource(award);
                const winnerMode = getAwardWinnerMode(award);

                return (
                  <ListItem
                    key={award.id}
                    className={styles.awardDefinitionItem}
                    hideImage
                    name={award.name}
                    subtitle={award.description ?? undefined}
                    actions={
                      [
                        {
                          icon: 'edit',
                          intent: 'neutral',
                          tooltip: 'Edit award',
                          onClick: () => openEdit(award),
                        },
                        {
                          icon: 'delete',
                          intent: 'danger',
                          tooltip: 'Remove award',
                          onClick: () => setConfirmDelete(award),
                        },
                      ] satisfies ListItemAction[]
                    }
                  >
                    <div className={styles.awardDefinitionDetails}>
                      <div
                        className={styles.awardDefinitionMeta}
                        aria-label="Award details"
                      >
                        <Tag label={recipientTypeLabel(award.recipient_type)} />
                        <Tag
                          label={awardSelectionSourceLabel(selectionSource)}
                          intent="info"
                        />
                        {stat && (
                          <Tag
                            label={stat}
                            intent="accent"
                          />
                        )}
                        {competitionScope === 'playoffs' && (
                          <Tag
                            label="Playoff award"
                            intent="success"
                          />
                        )}
                        {recordingGate === 'after_playoffs_start' &&
                          competitionScope !== 'playoffs' && (
                            <Tag
                              label="After playoffs start"
                              intent="success"
                            />
                          )}
                        {award.uses_nominees && winnerMode !== 'team_selection' && (
                          <Tag
                            label="Nominees"
                            intent="info"
                          />
                        )}
                        {winnerMode === 'multiple' && (
                          <Tag
                            label="Multiple winners"
                            intent="accent"
                          />
                        )}
                        {winnerMode === 'team_selection' && (
                          <Tag
                            label="Team selection"
                            intent="accent"
                          />
                        )}
                      </div>
                    </div>
                  </ListItem>
                );
              })}
            </ul>
          )}
        </Section>
      </div>

      <Modal
        open={modalOpen}
        title={editTarget ? 'Edit Award Definition' : 'Create Award'}
        onClose={closeModal}
        confirmForm="league-award-form"
        confirmLabel={
          form.formState.isSubmitting ? 'Saving...' : editTarget ? 'Save Changes' : 'Create Award'
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
          <div
            className={styles.awardDefinitionCheckbox}
            onClick={() => toggleBooleanField('awarded_after_playoffs')}
          >
            <Checkbox
              checked={awardedAfterPlayoffs}
              onChange={() => toggleBooleanField('awarded_after_playoffs')}
              ariaLabelledBy={awardedAfterPlayoffsLabelId}
            />
            <span id={awardedAfterPlayoffsLabelId}>Lock until playoffs start</span>
          </div>
          <div className={styles.awardDefinitionCheckboxGrid}>
            <div
              className={styles.awardDefinitionCheckbox}
              onClick={() => toggleBooleanField('uses_nominees')}
            >
              <Checkbox
                checked={usesNominees}
                onChange={() => toggleBooleanField('uses_nominees')}
                ariaLabelledBy={usesNomineesLabelId}
              />
              <span id={usesNomineesLabelId}>Uses nominees</span>
            </div>
            <div
              className={styles.awardDefinitionCheckbox}
              onClick={() => toggleBooleanField('allow_multiple_winners')}
            >
              <Checkbox
                checked={allowMultipleWinners}
                onChange={() => toggleBooleanField('allow_multiple_winners')}
                ariaLabelledBy={allowMultipleWinnersLabelId}
              />
              <span id={allowMultipleWinnersLabelId}>Multiple winners</span>
            </div>
            <div
              className={styles.awardDefinitionCheckbox}
              onClick={() => toggleBooleanField('uses_team_selection')}
            >
              <Checkbox
                checked={usesTeamSelection}
                onChange={() => toggleBooleanField('uses_team_selection')}
                ariaLabelledBy={usesTeamSelectionLabelId}
              />
              <span id={usesTeamSelectionLabelId}>Team selection</span>
            </div>
          </div>
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
        variant="danger"
        onConfirm={async () => {
          if (confirmDelete) await deleteAward(confirmDelete.id);
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
};

export const LeagueAwardsTabSkeleton = ({ className }: TabSkeletonProps) => (
  <div className={styles.grid}>
    <Section
      className={[styles.col12, className].filter(Boolean).join(' ')}
      title="Awards"
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
    </Section>
  </div>
);

export default LeagueAwardsTab;
