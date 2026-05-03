import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Field from '@/components/Field/Field';
import Modal from '@/components/Modal/Modal';
import { type PlayerStintRecord, type JerseyHistoryEntry } from '@/hooks/useTeamPlayers';
import styles from '../leagues/PlayerFormModal.module.scss';

interface FormValues {
  jersey_number: string;
  effective_date: string;
}

interface Props {
  open: boolean;
  stint: PlayerStintRecord | null;
  history: JerseyHistoryEntry[];
  onClose: () => void;
  changeJerseyNumber: (
    stint: PlayerStintRecord,
    jerseyNumber: number,
    effectiveDate?: string | null,
  ) => Promise<boolean>;
}

const dayBefore = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const prev = new Date(y, m - 1, d - 1); // pure local-date arithmetic, no UTC shift
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
};

const ChangeJerseyModal = ({ open, stint, history, onClose, changeJerseyNumber }: Props) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { jersey_number: '', effective_date: '' },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      jersey_number: stint?.jersey_number != null ? String(stint.jersey_number) : '',
      effective_date: '',
    });
  }, [open, stint, reset]);

  const onSubmit = handleSubmit(async (data) => {
    if (!stint) return;
    const ok = await changeJerseyNumber(
      stint,
      Number(data.jersey_number),
      data.effective_date || null,
    );
    if (ok) onClose();
  });

  return (
    <Modal
      open={open}
      title="Change Jersey Number"
      onClose={onClose}
      confirmLabel={isSubmitting ? 'Saving…' : 'Save'}
      confirmForm="change-jersey-form"
      confirmDisabled={isSubmitting}
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
            disabled={isSubmitting}
          />
        </div>

        {history.length > 0 && (
          <>
            <hr className={styles.divider} />
            <div className={styles.historySection}>
              <span className={styles.historyLabel}>History</span>
              <div className={styles.historyList}>
                {[...history].reverse().map((entry, idx, reversed) => {
                  const prevEntry = reversed[idx - 1];
                  const endDateStr =
                    idx === 0 ? (stint?.end_date ?? null) : dayBefore(prevEntry.effective_from);
                  const endLabel = endDateStr ?? 'Present';
                  return (
                    <div
                      key={entry.id}
                      className={styles.historyEntry}
                    >
                      <span className={styles.historyEntryNumber}>#{entry.jersey_number}</span>
                      <span className={styles.historyEntryDates}>
                        {entry.effective_from} – {endLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
};

export default ChangeJerseyModal;
