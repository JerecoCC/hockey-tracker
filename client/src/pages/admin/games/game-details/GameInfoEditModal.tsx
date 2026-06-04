import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Field from '@/components/Field/Field';
import Modal from '@/components/Modal/Modal';
import { type GameRecord, type GameType, type UpdateGameInfoData } from '@/hooks/useGames';
import styles from './GameDetailsPage.module.scss';
import { etHHMMtoISO, isoToETHHMM } from './formatUtils';

const GAME_TYPE_OPTIONS: { value: GameType; label: string }[] = [
  { value: 'preseason', label: 'Preseason' },
  { value: 'regular', label: 'Regular Season' },
  { value: 'playoff', label: 'Playoffs' },
];

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
  playoff_round: string;
  game_number_in_series: string;
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
    watch,
  } = useForm<FormValues>({
    defaultValues: {
      venue: '',
      scheduled_date: '',
      scheduled_time: '',
      game_type: 'regular',
      playoff_round: '',
      game_number_in_series: '',
      time_start: '',
      time_end: '',
    },
  });

  const gameType = watch('game_type');

  useEffect(() => {
    if (open) {
      reset({
        venue: game.venue ?? '',
        scheduled_date: game.scheduled_at ? game.scheduled_at.slice(0, 10) : '',
        scheduled_time: game.scheduled_time ?? '',
        game_type: game.game_type,
        playoff_round: game.playoff_round != null ? String(game.playoff_round) : '',
        game_number_in_series:
          game.game_number_in_series != null ? String(game.game_number_in_series) : '',
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
      playoff_round:
        data.game_type === 'playoff' && game.playoff_series_id
          ? data.playoff_round !== ''
            ? Number(data.playoff_round)
            : null
          : undefined,
      game_number_in_series:
        data.game_type === 'playoff'
          ? data.game_number_in_series !== ''
            ? Number(data.game_number_in_series)
            : null
          : undefined,
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
        {gameType === 'playoff' && (
          <>
            <Field
              label="Round"
              type="number"
              control={control}
              name="playoff_round"
              min={1}
              max={4}
              disabled={isSubmitting || disabled || !game.playoff_series_id}
              rules={{
                validate: (value) =>
                  !value || (/^[0-9]+$/.test(value) && Number(value) >= 1 && Number(value) <= 4)
                    ? true
                    : 'Round must be between 1 and 4',
              }}
            />
            <Field
              label="Game in Series"
              type="number"
              control={control}
              name="game_number_in_series"
              min={1}
              disabled={isSubmitting || disabled}
              rules={{
                validate: (value) =>
                  !value || (/^[0-9]+$/.test(value) && Number(value) >= 1)
                    ? true
                    : 'Game in series must be 1 or greater',
              }}
            />
          </>
        )}
        <Field
          label="Date"
          type="datepicker"
          control={control}
          name="scheduled_date"
          placeholder="Select date…"
          disabled={isSubmitting || disabled}
        />
        <Field
          label="Scheduled Time"
          type="timepicker"
          control={control}
          name="scheduled_time"
          disabled={isSubmitting || disabled}
          autoFocus
          rules={{
            validate: (value, formValues) =>
              !value || !!formValues.scheduled_date || 'A date is required when time is set',
          }}
        />
        {game.status !== 'scheduled' && (
          <>
            <Field
              label="Start Time"
              type="timepicker"
              control={control}
              name="time_start"
            />
            <Field
              label="End Time"
              type="timepicker"
              control={control}
              name="time_end"
            />
          </>
        )}
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
