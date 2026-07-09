import { useForm } from 'react-hook-form';
import Field from '@jerecocc/tracker-ui/components/Field/Field';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import styles from './GameDetailsPage.module.scss';
import { etHHMMtoISO } from './formatUtils';

interface Props {
  open: boolean;
  scheduledAt?: string | null;
  /** True when the game-start action is in progress (external busy). */
  isStarting: boolean;
  /** True when any other action is in progress — disables the button. */
  disabled: boolean;
  onClose: () => void;
  onStart: (isoTime: string) => Promise<boolean>;
}

const StartGameModal = ({ open, scheduledAt, isStarting, disabled, onClose, onStart }: Props) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, isDirty, isValid },
  } = useForm<{ start_time: string }>({
    defaultValues: { start_time: '' },
    mode: 'onChange',
  });

  const handleClose = () => {
    reset({ start_time: '' });
    onClose();
  };

  const onSubmit = handleSubmit(async (data) => {
    const ok = await onStart(etHHMMtoISO(data.start_time, scheduledAt));
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
      confirmDisabled={isSubmitting || disabled || !isDirty || !isValid}
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
          disabled={isStarting}
          placeholder="Select time…"
          rules={{ required: 'Start time is required' }}
          required
          autoFocus
        />
      </form>
    </Modal>
  );
};

export default StartGameModal;
