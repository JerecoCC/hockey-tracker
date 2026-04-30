import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Field from '@/components/Field/Field';
import LogoUpload from '@/components/LogoUpload/LogoUpload';
import Modal from '@/components/Modal/Modal';
import { type PlayerStintRecord, type UpdateStintData } from '@/hooks/useTeamPlayers';
import styles from '../leagues/PlayerFormModal.module.scss';

interface FormValues {
  photo: File | string | null;
  jersey_number: string;
  start_date: string;
  end_date: string;
}

interface Props {
  open: boolean;
  stint: PlayerStintRecord | null;
  onClose: () => void;
  updateStint: (stintId: string, data: UpdateStintData) => Promise<boolean>;
  uploadStintPhoto: (file: File) => Promise<string | null>;
}

const StintEditModal = ({ open, stint, onClose, updateStint, uploadStintPhoto }: Props) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { photo: null, jersey_number: '', start_date: '', end_date: '' },
  });

  useEffect(() => {
    if (!open || !stint) return;
    reset({
      photo: stint.photo ?? null,
      jersey_number: stint.jersey_number != null ? String(stint.jersey_number) : '',
      start_date: stint.start_date?.slice(0, 10) ?? '',
      end_date: stint.end_date?.slice(0, 10) ?? '',
    });
  }, [open, stint, reset]);

  const onSubmit = handleSubmit(async (data) => {
    if (!stint) return;

    let photoUrl: string | null = typeof data.photo === 'string' ? data.photo : null;
    if (data.photo instanceof File) {
      const url = await uploadStintPhoto(data.photo);
      if (!url) return;
      photoUrl = url;
    }

    const ok = await updateStint(stint.id, {
      photo: photoUrl,
      jersey_number: data.jersey_number ? Number(data.jersey_number) : null,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
    });

    if (ok) onClose();
  });

  const teamLabel = stint?.team_name ?? 'Stint';

  return (
    <Modal
      open={open}
      title={`Edit Stint — ${teamLabel}`}
      onClose={onClose}
      confirmLabel={isSubmitting ? 'Saving…' : 'Save Changes'}
      confirmForm="stint-edit-form"
      confirmDisabled={isSubmitting}
      busy={isSubmitting}
    >
      <form
        id="stint-edit-form"
        className={styles.form}
        onSubmit={onSubmit}
      >
        <LogoUpload
          control={control}
          name="photo"
          label="Player Photo (this team)"
          disabled={isSubmitting}
        />
        <Field
          type="number"
          label="Jersey #"
          control={control}
          name="jersey_number"
          placeholder="e.g. 97"
          min={0}
          max={99}
          disabled={isSubmitting}
          rules={{
            validate: (v) =>
              !v || (Number(v) >= 0 && Number(v) <= 99 && Number.isInteger(Number(v))),
          }}
        />
        <div className={styles.row}>
          <Field
            type="datepicker"
            label="Start Date"
            control={control}
            name="start_date"
            placeholder="YYYY-MM-DD"
            disabled={isSubmitting}
          />
          <Field
            type="datepicker"
            label="End Date"
            control={control}
            name="end_date"
            placeholder="YYYY-MM-DD (leave blank if current)"
            disabled={isSubmitting}
          />
        </div>
      </form>
    </Modal>
  );
};

export default StintEditModal;
