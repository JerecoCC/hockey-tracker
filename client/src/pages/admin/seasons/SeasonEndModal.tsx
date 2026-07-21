import { useCallback, useLayoutEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { ControlledDatePickerField } from '@/components/form/ControlledFields';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
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
  const formValues = useMemo<FormValues>(
    () => ({ end_date: currentEndDate?.slice(0, 10) ?? '' }),
    [currentEndDate],
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
    const ok = await onConfirm(data.end_date);
    if (ok) handleClose();
  });

  return (
    <Modal
      open={open}
      title="End Season"
      onClose={handleClose}
      confirmLabel={isSubmitting || busy ? 'Saving…' : 'End Season'}
      confirmForm="season-end-form"
      confirmIntent="danger"
      confirmDisabled={isSubmitting || busy || !isDirty || !isValid}
      busy={isSubmitting || busy}
    >
      <form
        id="season-end-form"
        className={styles.form}
        onSubmit={onSubmit}
      >
        <ControlledDatePickerField
          label="End Date"
          control={control}
          name="end_date"
          rules={{ required: 'End date is required' }}
          placeholder="Select end date…"
          required
          autoFocus
        />
      </form>
    </Modal>
  );
};

export default SeasonEndModal;
