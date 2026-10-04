import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import Button from '@jerecocc/tracker-ui/components/Button/Button';
import DatePicker from '@jerecocc/tracker-ui/components/DatePicker/DatePicker';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import type { GameRecord } from '@/hooks/useGames';
import {
  getOriginalGameDateKey,
  getScheduledWatchDateKey,
  isInvalidWatchScheduleDate,
} from '@/lib/gameSchedule';
import styles from './ScheduleWatchModal.module.scss';

interface Props {
  open: boolean;
  game: GameRecord | null;
  value: string;
  busy: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

const ScheduleWatchModal = ({ open, game, value, busy, onChange, onClose, onSave }: Props) => {
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isDirty, isValid },
  } = useForm<{ scheduled_for: string }>({
    defaultValues: { scheduled_for: value },
    mode: 'onChange',
  });
  const pickedDate = watch('scheduled_for');
  // The picker starts on the game's own date when the watch isn't postponed. Picking that date
  // means "not postponed", so it's reported to the caller as an empty value.
  const gameDateKey = game ? getOriginalGameDateKey(game, 'local') : null;
  const postponedTo = pickedDate && pickedDate !== gameDateKey ? pickedDate : '';

  // Initialise the form only when the modal opens (or the target game changes).
  // Depending on `value` here would reset the form on every date pick, clearing
  // `isDirty` and keeping the Save button permanently disabled.
  useEffect(() => {
    if (open) reset({ scheduled_for: getScheduledWatchDateKey(value) ?? gameDateKey ?? '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, game?.id, reset]);

  const scheduleDateInvalid = game ? isInvalidWatchScheduleDate(game, postponedTo, 'local') : false;
  const submit = handleSubmit(() => onSave());

  if (!game) return null;

  return (
    <Modal
      open={open}
      title="Postpone watch"
      onClose={onClose}
      onConfirm={submit}
      confirmLabel={busy ? 'Saving…' : 'Save date'}
      confirmDisabled={busy || !isDirty || !isValid || scheduleDateInvalid}
      busy={busy}
      footerStart={
        postponedTo ? (
          <Button
            type="button"
            variant="ghost"
            intent="danger"
            onClick={() => {
              setValue('scheduled_for', gameDateKey ?? '', {
                shouldDirty: true,
                shouldValidate: true,
              });
              onChange('');
            }}
            disabled={busy}
          >
            Reset
          </Button>
        ) : undefined
      }
    >
      <div className={styles.body}>
        <p className={styles.copy}>
          Choose a later date to watch {game.away_team.code} @ {game.home_team.code}. Dates use your
          local timezone.
        </p>
        <Controller
          control={control}
          name="scheduled_for"
          render={({ field }) => (
            <DatePicker
              value={field.value}
              onChange={(next) => {
                field.onChange(next);
                onChange(next && next !== gameDateKey ? next : '');
              }}
              placeholder="Watch date"
            />
          )}
        />
        {scheduleDateInvalid && (
          <p className={styles.error}>Choose a watch date after the game date.</p>
        )}
      </div>
    </Modal>
  );
};

export default ScheduleWatchModal;
