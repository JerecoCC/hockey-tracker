import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Field from '@/components/Field/Field';
import Modal from '@/components/Modal/Modal';
import { type GameRecord, type GameType, type UpdateGameInfoData } from '@/hooks/useGames';
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

/**
 * Treats an "HH:mm" string as Eastern Time on the given ET calendar date and
 * returns a UTC ISO string.
 *
 * @param hhmm      - 24-hour time string, e.g. "22:12" or "00:49"
 * @param etDateStr - ET calendar date as "YYYY-MM-DD". Defaults to today in ET
 *                    when omitted. Always pass the game's scheduled date so that
 *                    times are anchored to the correct day regardless of when
 *                    the edit modal is opened.
 */
const etHHMMtoISO = (hhmm: string, etDateStr?: string): string => {
  const etDate =
    etDateStr ??
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  const probe = new Date(`${etDate}T${hhmm}:00-05:00`);
  const tzName =
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' })
      .formatToParts(probe)
      .find((p) => p.type === 'timeZoneName')?.value ?? 'EST';
  const offset = tzName === 'EDT' ? '-04:00' : '-05:00';
  return new Date(`${etDate}T${hhmm}:00${offset}`).toISOString();
};

/** Advances a "YYYY-MM-DD" string by one calendar day. */
const nextETDate = (etDateStr: string): string => {
  const [y, m, d] = etDateStr.split('-').map(Number);
  const next = new Date(y, m - 1, d + 1); // local Date arithmetic — no timezone ambiguity
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
};

type FormValues = {
  venue: string;
  scheduled_date: string;
  scheduled_time: string;
  game_type: GameType;
  time_start: string;
  time_end: string;
};

interface Props {
  open: boolean;
  game: GameRecord;
  isSaving: boolean;
  disabled: boolean;
  onClose: () => void;
  onSave: (payload: UpdateGameInfoData) => Promise<boolean>;
}

const GameInfoEditModal = ({ open, game, isSaving, disabled, onClose, onSave }: Props) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, isDirty },
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
    // Anchor all times to the game's scheduled ET date so edits made on a
    // different day don't corrupt the stored timestamps.
    const etBase = data.scheduled_date || undefined;

    const startISO = data.time_start ? etHHMMtoISO(data.time_start, etBase) : null;

    // If the end time HH:mm is earlier than the start time HH:mm, the game ran
    // past midnight — compute end time on the next ET calendar day.
    let endISO: string | null = null;
    if (data.time_end) {
      const isPastMidnight = !!data.time_start && data.time_end < data.time_start;
      if (isPastMidnight) {
        // Use the ET date string directly to avoid browser-timezone issues with
        // Date.setDate() / Date.getDate() operating in local time.
        endISO = etHHMMtoISO(data.time_end, etBase ? nextETDate(etBase) : undefined);
      } else {
        endISO = etHHMMtoISO(data.time_end, etBase);
      }
    }

    const ok = await onSave({
      venue: data.venue || null,
      scheduled_at: data.scheduled_date || null,
      scheduled_time: data.scheduled_time || null,
      game_type: data.game_type,
      time_start: startISO,
      time_end: endISO,
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
      confirmDisabled={isSubmitting || disabled || !isDirty}
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
            disabled={isSubmitting || disabled}
            rules={{ required: 'Game type is required' }}
            required
          />
        </div>
        <Field
          label="Date"
          type="datepicker"
          control={control}
          name="scheduled_date"
          placeholder="Select date…"
          disabled={isSubmitting || disabled}
          autoFocus
        />
        <Field
          label="Scheduled Time"
          type="timepicker"
          control={control}
          name="scheduled_time"
          disabled={isSubmitting || disabled}
          rules={{
            validate: (value, formValues) =>
              !value || !!formValues.scheduled_date || 'A date is required when time is set',
          }}
        />
        <Field
          label="Start Time"
          type="timepicker"
          control={control}
          name="time_start"
          disabled={isSubmitting || disabled || game.status === 'scheduled'}
        />
        <Field
          label="End Time"
          type="timepicker"
          control={control}
          name="time_end"
          disabled={isSubmitting || disabled || game.status !== 'final'}
        />
        <div className={styles.formFieldFull}>
          <Field
            label="Venue"
            control={control}
            name="venue"
            placeholder="e.g. Scotiabank Arena"
            disabled={isSubmitting || disabled}
          />
        </div>
      </form>
    </Modal>
  );
};

export default GameInfoEditModal;
