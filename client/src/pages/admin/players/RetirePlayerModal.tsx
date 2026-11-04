import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { ControlledDatePickerField } from '@/components/form/ControlledFields';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import useBackgroundModalAction from '@/hooks/useBackgroundModalAction';
import styles from '../leagues/PlayerFormModal.module.scss';

interface Props {
  open: boolean;
  playerName: string;
  busy?: boolean;
  onClose: () => void;
  onRetire: (retirementDate: string) => Promise<boolean>;
}

interface FormValues {
  retirement_date: string;
}

const FORM_ID = 'retire-player-form';

const easternToday = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  return `${year}-${month}-${day}`;
};

const RetirePlayerModal = ({ open, playerName, busy = false, onClose, onRetire }: Props) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { retirement_date: easternToday() },
    mode: 'onChange',
  });
  const saving = busy || isSubmitting;

  useEffect(() => {
    if (open) reset({ retirement_date: easternToday() });
  }, [open, reset]);

  // The modal hides while the player is retired behind a progress toast, and reappears with the
  // date entered if it fails.
  const { hidden, runSettled } = useBackgroundModalAction({
    target: open ? 'retire' : null,
    onDone: onClose,
  });

  const onSubmit = handleSubmit(({ retirement_date }) => {
    void runSettled(() => onRetire(retirement_date), { pending: `Retiring ${playerName}…` });
  });

  return (
    <Modal
      open={open && !hidden}
      title="Retire Player"
      onClose={onClose}
      confirmLabel={saving ? 'Retiring...' : 'Retire Player'}
      confirmIcon="event_busy"
      confirmIntent="danger"
      confirmForm={FORM_ID}
      confirmDisabled={saving}
      busy={saving}
    >
      <form
        id={FORM_ID}
        className={styles.form}
        onSubmit={onSubmit}
      >
        <p>Choose the retirement date for {playerName}.</p>
        <ControlledDatePickerField
          label="Retirement Date"
          control={control}
          name="retirement_date"
          disabled={saving}
          required
          rules={{ required: 'Retirement date is required' }}
          autoFocus
        />
      </form>
    </Modal>
  );
};

export default RetirePlayerModal;
