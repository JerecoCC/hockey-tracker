import { useCallback, useLayoutEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import Field from '@jerecocc/tracker-ui/Field';
import Modal from '@jerecocc/tracker-ui/Modal';
import { type PlayerStintRecord } from '@/hooks/useTeamPlayers';
import styles from '../leagues/PlayerFormModal.module.scss';

interface FormValues {
  jersey_number: string;
  effective_date: string;
}

interface Props {
  open: boolean;
  stint: PlayerStintRecord | null;
  onClose: () => void;
  changeJerseyNumber: (
    stint: PlayerStintRecord,
    jerseyNumber: number,
    effectiveDate?: string | null,
  ) => Promise<boolean>;
}

const ChangeJerseyModal = ({ open, stint, onClose, changeJerseyNumber }: Props) => {
  const formValues = useMemo<FormValues>(
    () => ({
      jersey_number: stint?.jersey_number != null ? String(stint.jersey_number) : '',
      effective_date: '',
    }),
    [stint],
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
    if (!stint) return;
    if (!data.effective_date) return;
    const ok = await changeJerseyNumber(
      stint,
      Number(data.jersey_number),
      data.effective_date,
    );
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
          <Field
            type="number"
            label="Jersey #"
            control={control}
            name="jersey_number"
            placeholder="e.g. 97"
            min={0}
            max={99}
            required
            rules={{
              required: true,
              validate: (v) =>
                !!v && Number(v) >= 0 && Number(v) <= 99 && Number.isInteger(Number(v)),
            }}
            disabled={isSubmitting}
          />
          <Field
            type="datepicker"
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
