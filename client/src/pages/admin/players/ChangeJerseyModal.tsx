import { useCallback, useLayoutEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  ControlledDatePickerField,
  ControlledInputField,
} from '@/components/form/ControlledFields';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import styles from '../leagues/PlayerFormModal.module.scss';

interface FormValues {
  jersey_number: string;
  effective_date: string;
}

interface Props {
  open: boolean;
  currentJerseyNumber: number | null;
  onClose: () => void;
  changeJerseyNumber: (jerseyNumber: number, effectiveDate?: string | null) => Promise<boolean>;
}

const EMPTY_FORM_VALUES: FormValues = {
  jersey_number: '',
  effective_date: '',
};

const ChangeJerseyModal = ({ open, onClose, changeJerseyNumber }: Props) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, isDirty, isValid },
  } = useForm<FormValues>({
    defaultValues: EMPTY_FORM_VALUES,
    mode: 'onChange',
  });

  useLayoutEffect(() => {
    if (open) reset(EMPTY_FORM_VALUES);
  }, [open, reset]);

  const handleClose = useCallback(() => {
    reset(EMPTY_FORM_VALUES);
    onClose();
  }, [onClose, reset]);

  const onSubmit = handleSubmit(async (data) => {
    if (!data.effective_date) return;
    const ok = await changeJerseyNumber(Number(data.jersey_number), data.effective_date);
    if (ok) handleClose();
  });

  return (
    <Modal
      open={open}
      title="Record Jersey Number Change"
      onClose={handleClose}
      confirmLabel={isSubmitting ? 'Saving...' : 'Save'}
      confirmForm="change-jersey-form"
      confirmDisabled={isSubmitting || !isDirty || !isValid}
      busy={isSubmitting}
    >
      <form
        id="change-jersey-form"
        className={styles.form}
        onSubmit={onSubmit}
      >
        <div className={styles.jerseyDateRow}>
          <ControlledInputField
            type="number"
            label="Jersey #"
            control={control}
            name="jersey_number"
            placeholder="e.g. 97"
            min={0}
            max={99}
            autoFocus
            required
            rules={{
              required: true,
              validate: (v) =>
                !!v && Number(v) >= 0 && Number(v) <= 99 && Number.isInteger(Number(v)),
            }}
            disabled={isSubmitting}
          />
          <ControlledDatePickerField
            label="Effective Date"
            control={control}
            name="effective_date"
            required
            rules={{ required: true }}
            disabled={isSubmitting}
          />
        </div>
      </form>
    </Modal>
  );
};

export default ChangeJerseyModal;
