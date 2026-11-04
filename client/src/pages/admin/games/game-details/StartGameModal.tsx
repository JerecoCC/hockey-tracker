import { useForm } from 'react-hook-form';
import { ControlledTimePickerField } from '@/components/form/ControlledFields';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import useBackgroundModalAction from '@/hooks/useBackgroundModalAction';
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

  // The modal hides while the game starts behind a progress toast, and reappears with the start
  // time entered if it fails.
  const { hidden, runSettled } = useBackgroundModalAction({
    target: open ? 'start' : null,
    onDone: handleClose,
  });

  const onSubmit = handleSubmit((data) => {
    void runSettled(() => onStart(etHHMMtoISO(data.start_time, scheduledAt)), {
      pending: 'Starting game…',
    });
  });

  return (
    <Modal
      open={open && !hidden}
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
        <ControlledTimePickerField
          label="Start Time"
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
