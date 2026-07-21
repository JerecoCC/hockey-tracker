import { useCallback, useLayoutEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import {
  ControlledDatePickerField,
  ControlledInputField,
  ControlledSelectField,
  ControlledTimePickerField,
} from '@/components/form/ControlledFields';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import { type GameRecord, type GameType, type UpdateGameInfoData } from '@/hooks/useGames';
import styles from './GameDetailsPage.module.scss';
import { etHHMMtoISO, isoToETHHMM, scheduledDateInputValue } from './formatUtils';

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
  league_game_number: string;
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
  const formValues = useMemo<FormValues>(
    () => ({
      venue: game.venue ?? '',
      scheduled_date: scheduledDateInputValue(game.scheduled_at),
      scheduled_time: game.scheduled_time ?? '',
      game_type: game.game_type,
      playoff_round: game.playoff_round != null ? String(game.playoff_round) : '',
      game_number_in_series:
        game.game_number_in_series != null ? String(game.game_number_in_series) : '',
      league_game_number: game.league_game_number ?? '',
      time_start: game.time_start ? isoToETHHMM(game.time_start) : '',
      time_end: game.time_end ? isoToETHHMM(game.time_end) : '',
    }),
    [game],
  );
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, isDirty, isValid },
    watch,
  } = useForm<FormValues>({
    defaultValues: formValues,
    mode: 'onChange',
  });

  const gameType = watch('game_type');

  useLayoutEffect(() => {
    reset(formValues);
  }, [formValues, reset]);

  const handleClose = useCallback(() => {
    reset(formValues);
    onClose();
  }, [formValues, onClose, reset]);

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
      league_game_number: data.league_game_number.trim() || null,
      time_start: startISO,
      time_end: endISO,
    });
    if (ok) handleClose();
  });

  return (
    <Modal
      open={open}
      title="Edit Game Info"
      onClose={handleClose}
      confirmLabel={isSubmitting || isSaving ? 'Saving…' : 'Save'}
      confirmForm="game-info-edit-form"
      confirmDisabled={isSubmitting || disabled || !isDirty || !isValid}
      busy={isSubmitting || isSaving}
    >
      <form
        id="game-info-edit-form"
        className={styles.formGrid}
        onSubmit={onSubmit}
      >
        <div className={styles.formFieldFull}>
          <ControlledSelectField
            label="Game Type"
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
            <ControlledInputField
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
            <ControlledInputField
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
        <ControlledDatePickerField
          label="Scheduled Date"
          control={control}
          name="scheduled_date"
          placeholder="Select date…"
          disabled={isSubmitting || disabled}
        />
        <ControlledTimePickerField
          label="Scheduled Time"
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
            <ControlledTimePickerField
              label="Start Time"
              control={control}
              name="time_start"
              disabled={isSubmitting || disabled}
            />
            <ControlledTimePickerField
              label="End Time"
              control={control}
              name="time_end"
              disabled={isSubmitting || disabled}
            />
          </>
        )}
        <div className={styles.formFieldFull}>
          <ControlledInputField
            label="Venue"
            control={control}
            name="venue"
            placeholder="e.g. Scotiabank Arena"
            disabled={isSubmitting || disabled}
          />
        </div>
        <div className={styles.formFieldFull}>
          <ControlledInputField
            label="League Game Number"
            control={control}
            name="league_game_number"
            placeholder="e.g. 210"
            disabled={isSubmitting || disabled}
          />
        </div>
      </form>
    </Modal>
  );
};

export default GameInfoEditModal;
