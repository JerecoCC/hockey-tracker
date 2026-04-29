import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Field from '@/components/Field/Field';
import Modal from '@/components/Modal/Modal';
import { type SelectOption } from '@/components/Select/Select';
import { type CreateSeasonData, type SeasonRecord } from '@/hooks/useSeasons';
import styles from './SeasonFormModal.module.scss';

interface FormValues {
  league_id: string | null;
  name: string;
  start_date: string;
  end_date: string;
  games_per_season: string;
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
}

const SeasonFormModal = (props: Props) => {
  const { open, editTarget, leagueOptions, onClose, addSeason, updateSeason, lockedLeagueId } =
    props;
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      league_id: null,
      name: '',
      start_date: '',
      end_date: '',
      games_per_season: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      league_id: lockedLeagueId ?? editTarget?.league_id ?? null,
      name: editTarget?.name ?? '',
      start_date: editTarget?.start_date?.slice(0, 10) ?? '',
      end_date: editTarget?.end_date?.slice(0, 10) ?? '',
      games_per_season:
        editTarget?.games_per_season != null ? String(editTarget.games_per_season) : '',
    });
  }, [open, editTarget, reset]);

  const onSubmit = handleSubmit(async (data) => {
    const payload: CreateSeasonData = {
      league_id: data.league_id!,
      name: data.name.trim(),
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      games_per_season: data.games_per_season ? parseInt(data.games_per_season, 10) : null,
    };
    const ok = editTarget ? await updateSeason(editTarget.id, payload) : await addSeason(payload);
    if (ok) onClose();
  });

  return (
    <Modal
      open={open}
      title={editTarget ? 'Edit Season' : 'Create Season'}
      onClose={onClose}
      confirmLabel={isSubmitting ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Season'}
      confirmForm="season-form"
      confirmDisabled={isSubmitting}
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
      </form>
    </Modal>
  );
};

export default SeasonFormModal;
