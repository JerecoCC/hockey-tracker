import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Field from '../../../components/Field/Field';
import Modal from '../../../components/Modal/Modal';
import styles from './SeasonFormModal.module.scss';

interface FormValues {
  end_date: string;
}

interface Props {
  open: boolean;
  currentEndDate: string | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (endDate: string) => Promise<boolean>;
}

const SeasonEndModal = ({ open, currentEndDate, busy, onClose, onConfirm }: Props) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { end_date: '' },
  });

  useEffect(() => {
    if (!open) return;
    reset({ end_date: currentEndDate?.slice(0, 10) ?? '' });
  }, [open, currentEndDate, reset]);

  const onSubmit = handleSubmit(async (data) => {
    const ok = await onConfirm(data.end_date);
    if (ok) onClose();
  });

  return (
    <Modal
      open={open}
      title="End Season"
      onClose={onClose}
      confirmLabel={isSubmitting || busy ? 'Saving…' : 'End Season'}
      confirmForm="season-end-form"
      confirmIntent="danger"
      confirmDisabled={isSubmitting || busy}
      busy={isSubmitting || busy}
    >
      <form
        id="season-end-form"
        className={styles.form}
        onSubmit={onSubmit}
      >
        <Field
          label="End Date"
          type="datepicker"
          control={control}
          name="end_date"
          rules={{ required: 'End date is required' }}
          placeholder="Select end date…"
          autoFocus
        />
      </form>
    </Modal>
  );
};

export default SeasonEndModal;
