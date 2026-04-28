import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Field from '@/components/Field/Field';
import Modal from '@/components/Modal/Modal';
import { type GameRecord, type GameType } from '@/hooks/useGames';
import styles from './GameDetailsPage.module.scss';

const GAME_TYPE_OPTIONS: { value: GameType; label: string }[] = [
  { value: 'preseason', label: 'Preseason' },
  { value: 'regular', label: 'Regular Season' },
  { value: 'playoff', label: 'Playoffs' },
];

/** Converts an ISO timestamp to "HH:mm" in Eastern Time. */
const isoToETHHMM = (iso: string): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  return `${parts.find((p) => p.type === 'hour')!.value}:${parts.find((p) => p.type === 'minute')!.value}`;
};

/** Treats an "HH:mm" string as Eastern Time and returns a UTC ISO string. */
const etHHMMtoISO = (hhmm: string): string => {
  const etDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(
    new Date(),
  );
  const probe = new Date(`${etDate}T${hhmm}:00-05:00`);
  const tzName =
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' })
      .formatToParts(probe)
      .find((p) => p.type === 'timeZoneName')?.value ?? 'EST';
  const offset = tzName === 'EDT' ? '-04:00' : '-05:00';
  return new Date(`${etDate}T${hhmm}:00${offset}`).toISOString();
};

type FormValues = {
  venue: string;
  scheduled_date: string;
  scheduled_time: string;
  game_type: GameType;
  time_start: string;
  time_end: string;
};

interface SavePayload {
  venue?: string | null;
  scheduled_at?: string | null;
  scheduled_time?: string | null;
  game_type?: GameType;
  time_start?: string | null;
  time_end?: string | null;
}

interface Props {
  open: boolean;
  game: GameRecord;
  isSaving: boolean;
  disabled: boolean;
  onClose: () => void;
  onSave: (payload: SavePayload) => Promise<boolean>;
}

const GameInfoEditModal = ({ open, game, isSaving, disabled, onClose, onSave }: Props) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      venue: '',
      scheduled_date: '',
      scheduled_time: '',
      game_type: 'regular',
      time_start: '',
      time_end: '',
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        venue: game.venue ?? '',
        scheduled_date: game.scheduled_at ? game.scheduled_at.slice(0, 10) : '',
        scheduled_time: game.scheduled_time ?? '',
        game_type: game.game_type,
        time_start: game.time_start ? isoToETHHMM(game.time_start) : '',
        time_end: game.time_end ? isoToETHHMM(game.time_end) : '',
      });
    }
  }, [open, game, reset]);

  const onSubmit = handleSubmit(async (data) => {
    const ok = await onSave({
      venue: data.venue || null,
      scheduled_at: data.scheduled_date || null,
      scheduled_time: data.scheduled_time || null,
      game_type: data.game_type,
      time_start: data.time_start ? etHHMMtoISO(data.time_start) : null,
      time_end: data.time_end ? etHHMMtoISO(data.time_end) : null,
    });
    if (ok) onClose();
  });

  return (
    <Modal
      open={open}
      title="Edit Game Info"
      onClose={onClose}
      confirmLabel={isSubmitting || isSaving ? 'Saving…' : 'Save'}
      confirmForm="game-info-edit-form"
      confirmDisabled={isSubmitting || disabled}
      busy={isSubmitting || isSaving}
    >
      <form
        id="game-info-edit-form"
        className={styles.formGrid}
        onSubmit={onSubmit}
      >
        <div className={styles.formFieldFull}>
          <Field
            label="Game Type"
            type="select"
            control={control}
            name="game_type"
            options={GAME_TYPE_OPTIONS}
            disabled={isSubmitting}
          />
        </div>
        <Field
          label="Date"
          type="datepicker"
          control={control}
          name="scheduled_date"
          placeholder="Select date…"
          autoFocus
        />
        <Field
          label="Scheduled Time"
          type="timepicker"
          control={control}
          name="scheduled_time"
        />
        <Field
          label="Start Time"
          type="timepicker"
          control={control}
          name="time_start"
          disabled={isSubmitting || game.status === 'scheduled'}
        />
        <Field
          label="End Time"
          type="timepicker"
          control={control}
          name="time_end"
          disabled={isSubmitting || game.status !== 'final'}
        />
        <div className={styles.formFieldFull}>
          <Field
            label="Venue"
            control={control}
            name="venue"
            placeholder="e.g. Scotiabank Arena"
            disabled={isSubmitting}
          />
        </div>
      </form>
    </Modal>
  );
};

export default GameInfoEditModal;
