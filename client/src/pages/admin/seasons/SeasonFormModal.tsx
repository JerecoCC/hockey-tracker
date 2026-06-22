import { useCallback, useLayoutEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import Field from '@/components/Field/Field';
import Modal from '@/components/Modal/Modal';
import { type SelectOption } from '@/components/Select/Select';
import { type CreateSeasonData, type SeasonRecord } from '@/hooks/useSeasons';
import styles from './SeasonFormModal.module.scss';

const SHOOTOUT_OPTIONS = (leagueDefault?: number) => [
  {
    value: '',
    label:
      leagueDefault != null ? `Use league default (${leagueDefault} rounds)` : 'Use league default',
  },
  { value: '3', label: '3 rounds' },
  { value: '5', label: '5 rounds' },
  { value: '7', label: '7 rounds' },
];

const SCORING_SYSTEM_OPTIONS = (leagueDefault?: string) => [
  {
    value: '',
    label: leagueDefault != null ? `Use league default (${leagueDefault})` : 'Use league default',
  },
  { value: '2-1-0', label: '2-1-0 (W / OT Loss / Loss)' },
  { value: '3-2-1-0', label: '3-2-1-0 (W / OT W / OT Loss / Loss)' },
];

interface FormValues {
  league_id: string | null;
  name: string;
  start_date: string;
  end_date: string;
  games_per_season: string;
  best_of_shootout: string;
  scoring_system: string;
}

interface Props {
  open: boolean;
  editTarget: SeasonRecord | null;
  leagueOptions: SelectOption[];
  onClose: () => void;
  addSeason: (data: CreateSeasonData) => Promise<boolean>;
  updateSeason: (id: string, data: Partial<CreateSeasonData>) => Promise<boolean>;
  /** When set, the league field is pre-filled with this ID and locked. */
  lockedLeagueId?: string;
  /** Shows regular-season override fields when the full season details record is available. */
  showRegularSeasonSettings?: boolean;
  leagueBestOfShootout?: number;
  leagueScoringSystem?: '3-2-1-0' | '2-1-0';
}

const SeasonFormModal = (props: Props) => {
  const {
    open,
    editTarget,
    leagueOptions,
    onClose,
    addSeason,
    updateSeason,
    lockedLeagueId,
    showRegularSeasonSettings = false,
    leagueBestOfShootout,
    leagueScoringSystem,
  } = props;
  const formValues = useMemo<FormValues>(
    () => ({
      league_id: lockedLeagueId ?? editTarget?.league_id ?? null,
      name: editTarget?.name ?? '',
      start_date: editTarget?.start_date?.slice(0, 10) ?? '',
      end_date: editTarget?.end_date?.slice(0, 10) ?? '',
      games_per_season:
        editTarget?.games_per_season != null ? String(editTarget.games_per_season) : '',
      best_of_shootout:
        editTarget?.best_of_shootout != null ? String(editTarget.best_of_shootout) : '',
      scoring_system: editTarget?.scoring_system ?? '',
    }),
    [editTarget, lockedLeagueId],
  );
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, isDirty, isValid },
  } = useForm<FormValues>({
    defaultValues: formValues,
    mode: 'onChange',
  });

  useLayoutEffect(() => {
    reset(formValues);
  }, [formValues, reset]);

  const handleClose = useCallback(() => {
    reset(formValues);
    onClose();
  }, [formValues, onClose, reset]);

  const onSubmit = handleSubmit(async (data) => {
    const payload: CreateSeasonData = {
      league_id: data.league_id!,
      name: data.name.trim(),
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      games_per_season: data.games_per_season ? parseInt(data.games_per_season, 10) : null,
    };
    if (showRegularSeasonSettings) {
      payload.best_of_shootout = data.best_of_shootout
        ? parseInt(data.best_of_shootout, 10)
        : null;
      payload.scoring_system = (data.scoring_system as '2-1-0' | '3-2-1-0') || null;
    }
    const ok = editTarget ? await updateSeason(editTarget.id, payload) : await addSeason(payload);
    if (ok) handleClose();
  });

  return (
    <Modal
      open={open}
      title={editTarget ? 'Edit Season' : 'Create Season'}
      onClose={handleClose}
      confirmLabel={isSubmitting ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Season'}
      confirmForm="season-form"
      confirmDisabled={isSubmitting || !isDirty || !isValid}
      busy={isSubmitting}
    >
      <form
        id="season-form"
        className={styles.form}
        onSubmit={onSubmit}
      >
        <Field
          label="League"
          required
          type="select"
          control={control}
          name="league_id"
          rules={{ required: true }}
          options={leagueOptions}
          placeholder="— Select a league —"
          disabled={!!editTarget || !!lockedLeagueId}
        />
        <Field
          label="Name"
          required
          type="text"
          control={control}
          name="name"
          rules={{ required: 'Name is required' }}
          placeholder="e.g. NHL 2024–25"
          autoFocus
        />
        <div className={styles.dateRow}>
          <Field
            label="Start Date"
            type="datepicker"
            control={control}
            name="start_date"
            placeholder="Select start date…"
          />
          <Field
            label="End Date"
            type="datepicker"
            control={control}
            name="end_date"
            placeholder="Select end date…"
          />
        </div>
        <Field
          label="Games Per Season"
          type="number"
          control={control}
          name="games_per_season"
          placeholder="e.g. 82"
          rules={{
            min: { value: 1, message: 'Must be at least 1' },
            max: { value: 9999, message: 'Too many games' },
          }}
        />
        {showRegularSeasonSettings && (
          <div className={styles.settingsGrid}>
            <Field
              label="Shootout Rounds"
              type="select"
              control={control}
              name="best_of_shootout"
              options={SHOOTOUT_OPTIONS(leagueBestOfShootout)}
              disabled={isSubmitting}
            />
            <Field
              label="Scoring System"
              type="select"
              control={control}
              name="scoring_system"
              options={SCORING_SYSTEM_OPTIONS(leagueScoringSystem)}
              disabled={isSubmitting}
            />
          </div>
        )}
      </form>
    </Modal>
  );
};

export default SeasonFormModal;
