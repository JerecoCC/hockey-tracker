import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Button from '../../../components/Button/Button';
import Field from '../../../components/Field/Field';
import Modal from '../../../components/Modal/Modal';
import { type SelectOption } from '../../../components/Select/Select';
import { type CreateSeasonData, type SeasonRecord } from '../../../hooks/useSeasons';
import styles from './Seasons.module.scss';

interface FormValues {
  name: string;
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
}

const SeasonFormModal = ({ open, editTarget, leagueOptions, onClose, addSeason, updateSeason }: Props) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { name: '', league_id: null, start_date: '', end_date: '' },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      name: editTarget?.name ?? '',
      league_id: editTarget?.league_id ?? null,
      start_date: editTarget?.start_date?.slice(0, 10) ?? '',
      end_date: editTarget?.end_date?.slice(0, 10) ?? '',
    });
  }, [open, editTarget, reset]);

  const onSubmit = handleSubmit(async (data) => {
    const payload: CreateSeasonData = {
      name: data.name,
      league_id: data.league_id!,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
    };
    const ok = editTarget
      ? await updateSeason(editTarget.id, payload)
      : await addSeason(payload);
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
          label="Name"
          required
          control={control}
          name="name"
          rules={{ required: true }}
          placeholder="e.g. 2024–25 Regular Season"
          autoFocus
        />
        <Field
          label="League"
          required
          type="select"
          control={control}
          name="league_id"
          rules={{ required: true }}
          options={leagueOptions}
          placeholder="— Select a league —"
        />
        <div className={styles.dateRow}>
          <Field
            label="Start Date"
            type="date"
            control={control}
            name="start_date"
          />
          <Field
            label="End Date"
            type="date"
            control={control}
            name="end_date"
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

