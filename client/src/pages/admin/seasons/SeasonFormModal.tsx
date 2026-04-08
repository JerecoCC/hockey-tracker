import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Button from '../../../components/Button/Button';
import Field from '../../../components/Field/Field';
import Modal from '../../../components/Modal/Modal';
import { type SelectOption } from '../../../components/Select/Select';
import { type CreateSeasonData, type SeasonRecord } from '../../../hooks/useSeasons';
import styles from './Seasons.module.scss';

interface FormValues {
  league_id: string | null;
  start_date: string;
  end_date: string;
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

const SeasonFormModal = ({
  open,
  editTarget,
  leagueOptions,
  onClose,
  addSeason,
  updateSeason,
  lockedLeagueId,
}: Props) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { league_id: null, start_date: '', end_date: '' },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      league_id: lockedLeagueId ?? editTarget?.league_id ?? null,
      start_date: editTarget?.start_date?.slice(0, 10) ?? '',
      end_date: editTarget?.end_date?.slice(0, 10) ?? '',
    });
  }, [open, editTarget, reset]);

  const onSubmit = handleSubmit(async (data) => {
    const payload: CreateSeasonData = {
      league_id: data.league_id!,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
    };
    const ok = editTarget ? await updateSeason(editTarget.id, payload) : await addSeason(payload);
    if (ok) onClose();
  });

  return (
    <Modal
      open={open}
      title={editTarget ? 'Edit Season' : 'Add Season'}
      onClose={onClose}
    >
      <form
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
        <div className={styles.formActions}>
          <Button
            type="button"
            variant="outlined"
            intent="neutral"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Season'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default SeasonFormModal;
