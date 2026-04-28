import { useForm } from 'react-hook-form';
import Field from '@/components/Field/Field';
import Modal from '@/components/Modal/Modal';
import styles from '@/pages/admin/games/game-details/GameDetailsPage.module.scss';

/** Treats an "HH:mm" string as Eastern Time and returns a UTC ISO string. */
const etHHMMtoISO = (hhmm: string): string => {
  const etDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(
    new Date(),
  );
  const probe = new Date(`${etDate}T${hhmm}:00-05:00`);
  const tzName =
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      timeZoneName: 'short',
    })
      .formatToParts(probe)
      .find((p) => p.type === 'timeZoneName')?.value ?? 'EST';
  const offset = tzName === 'EDT' ? '-04:00' : '-05:00';
  return new Date(`${etDate}T${hhmm}:00${offset}`).toISOString();
};

interface Props {
  open: boolean;
  /** True when the game-start action is in progress (external busy). */
  isStarting: boolean;
  /** True when any other action is in progress — disables the button. */
  disabled: boolean;
  onClose: () => void;
  onStart: (isoTime: string) => Promise<boolean>;
}

const StartGameModal = ({ open, isStarting, disabled, onClose, onStart }: Props) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<{ start_time: string }>({ defaultValues: { start_time: '' } });

  const handleClose = () => {
    reset({ start_time: '' });
    onClose();
  };

  const onSubmit = handleSubmit(async (data) => {
    const ok = await onStart(etHHMMtoISO(data.start_time));
    if (ok) handleClose();
  });

  return (
    <Modal
      open={open}
      title="Start Game"
      onClose={handleClose}
      confirmLabel={isSubmitting || isStarting ? 'Starting…' : 'Start Game'}
      confirmIcon="play_arrow"
      confirmIntent="success"
      confirmForm="start-game-form"
      confirmDisabled={isSubmitting || disabled}
      busy={isSubmitting || isStarting}
    >
      <form
        id="start-game-form"
        className={styles.goalForm}
        onSubmit={onSubmit}
      >
        <Field
          label="Start Time"
          type="timepicker"
          control={control}
          name="start_time"
          placeholder="Select time…"
          autoFocus
        />
      </form>
    </Modal>
  );
};

export default StartGameModal;
