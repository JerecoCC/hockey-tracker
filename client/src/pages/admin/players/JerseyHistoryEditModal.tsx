import { useCallback, useLayoutEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import {
  ControlledDatePickerField,
  ControlledInputField,
} from '@/components/form/ControlledFields';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import { type JerseyHistoryEntry, type UpdateJerseyHistoryEntryData } from '@/hooks/useTeamPlayers';
import styles from '../leagues/PlayerFormModal.module.scss';

interface FormValues {
  jersey_number: string;
  effective_from: string;
}

interface Props {
  open: boolean;
  entry: JerseyHistoryEntry | null;
  onClose: () => void;
  updateJerseyHistoryEntry: (
    entryId: string,
    data: UpdateJerseyHistoryEntryData,
  ) => Promise<boolean>;
}

const JerseyHistoryEditModal = ({ open, entry, onClose, updateJerseyHistoryEntry }: Props) => {
  const formValues = useMemo<FormValues>(
    () => ({
      jersey_number: entry?.jersey_number != null ? String(entry.jersey_number) : '',
      effective_from: entry?.effective_from ?? '',
    }),
    [entry],
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
    if (!entry) return;
    const ok = await updateJerseyHistoryEntry(entry.id, {
      jersey_number: Number(data.jersey_number),
      effective_from: data.effective_from,
    });
    if (ok) handleClose();
  });

  return (
    <Modal
      open={open}
      title="Edit Jersey Number Change"
      onClose={handleClose}
      confirmLabel={isSubmitting ? 'Saving...' : 'Save'}
      confirmForm="edit-jersey-history-form"
      confirmDisabled={isSubmitting || !isDirty || !isValid}
      busy={isSubmitting}
    >
      <form
        id="edit-jersey-history-form"
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
            name="effective_from"
            required
            rules={{ required: true }}
            disabled={isSubmitting}
          />
        </div>
      </form>
    </Modal>
  );
};

export default JerseyHistoryEditModal;
