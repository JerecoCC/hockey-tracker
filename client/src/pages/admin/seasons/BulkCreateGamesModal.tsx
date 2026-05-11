import { useEffect, useState } from 'react';
import { type Control, type UseFormSetValue, useFieldArray, useForm } from 'react-hook-form';
import AddRowBar from '@/components/AddRowBar/AddRowBar';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import Field from '@/components/Field/Field';
import Icon from '@/components/Icon/Icon';
import Modal from '@/components/Modal/Modal';
import type { SelectOption } from '@/components/Select/Select';
import { type CreateGameData } from '@/hooks/useGames';
import { type SeasonTeam } from '@/hooks/useSeasonDetails';
import styles from './BulkCreateGamesModal.module.scss';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RowValues {
  away_team_id: string | null;
  home_team_id: string | null;
  scheduled_date: string;
  scheduled_time: string;
  venue: string;
}

interface FormValues {
  games: RowValues[];
}

const EMPTY_ROW: RowValues = {
  away_team_id: null,
  home_team_id: null,
  scheduled_date: '',
  scheduled_time: '',
  venue: '',
};

const fmtModalDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
};

// ── Per-row sub-component ─────────────────────────────────────────────────────

interface GameRowProps {
  index: number;
  control: Control<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  seasonTeams: SeasonTeam[];
  teamOptions: SelectOption[];
  isSubmitting: boolean;
  dateDisabled?: boolean;
  autoFocus?: boolean;
  canDelete: boolean;
  onDelete: () => void;
}

const GameRow = ({
  index,
  control,
  setValue,
  seasonTeams,
  teamOptions,
  isSubmitting,
  dateDisabled,
  autoFocus,
  canDelete,
  onDelete,
}: GameRowProps) => {
  const handleHomeTeamChange = (teamId: string | null) => {
    const team = seasonTeams.find((t) => t.id === teamId);
    setValue(`games.${index}.venue`, team?.home_arena ?? '');
  };

  return (
    <div className={styles.gameRow}>
      <Field
        type="datepicker"
        control={control}
        name={`games.${index}.scheduled_date`}
        required
        rules={{ required: 'Date is required' }}
        placeholder="Date…"
        disabled={isSubmitting || dateDisabled}
        autoFocus={autoFocus && !dateDisabled}
      />
      <Field
        type="timepicker"
        control={control}
        name={`games.${index}.scheduled_time`}
        disabled={isSubmitting}
        autoFocus={autoFocus && !!dateDisabled}
      />
      <Field
        type="select"
        control={control}
        name={`games.${index}.away_team_id`}
        required
        rules={{ required: 'Away team is required' }}
        options={teamOptions}
        placeholder="— Select away team —"
        disabled={isSubmitting}
        searchable
      />
      <Field
        type="select"
        control={control}
        name={`games.${index}.home_team_id`}
        required
        rules={{ required: 'Home team is required' }}
        options={teamOptions}
        placeholder="— Select home team —"
        disabled={isSubmitting}
        searchable
        onChange={handleHomeTeamChange}
      />
      <Field
        control={control}
        name={`games.${index}.venue`}
        placeholder="Arena"
        disabled={isSubmitting}
      />
      {canDelete ? (
        <button
          type="button"
          className={styles.deleteBtn}
          onClick={onDelete}
          disabled={isSubmitting}
          aria-label="Remove game"
        >
          <Icon
            name="delete"
            size="1em"
          />
        </button>
      ) : (
        <span />
      )}
    </div>
  );
};

// ── Modal ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  seasonId: string;
  seasonTeams: SeasonTeam[];
  teamOptions: SelectOption[];
  bulkCreateGames: (data: CreateGameData[]) => Promise<boolean>;
  onClose: () => void;
  /** When provided, pre-fills and locks the date field on every row. */
  defaultDate?: string;
}

const BulkCreateGamesModal = ({
  open,
  seasonId,
  seasonTeams,
  teamOptions,
  bulkCreateGames,
  onClose,
  defaultDate,
}: Props) => {
  const [confirmRemoveIndex, setConfirmRemoveIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoFocusIndex, setAutoFocusIndex] = useState(0);

  const { control, handleSubmit, reset, setValue } = useForm<FormValues>({
    defaultValues: { games: [{ ...EMPTY_ROW }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'games' });

  // Reset form every time the modal opens so useFieldArray's internal mutable
  // ref is re-synced in a fresh render cycle. Without this, append() after a
  // previous bulk-create reads a stale internal ref and restores the old list.
  useEffect(() => {
    if (open) {
      reset({ games: [{ ...EMPTY_ROW, scheduled_date: defaultDate ?? '' }] });
      setAutoFocusIndex(0);
    }
  }, [open, defaultDate, reset]);

  const handleClose = () => {
    onClose();
  };

  const handleDeleteClick = (index: number) => {
    if (fields.length === 1) return; // keep at least one row
    setConfirmRemoveIndex(index);
  };

  const onSubmit = handleSubmit(async (data) => {
    setIsSubmitting(true);
    const payload: CreateGameData[] = data.games.map((row) => ({
      season_id: seasonId,
      home_team_id: row.home_team_id!,
      away_team_id: row.away_team_id!,
      game_type: 'regular',
      status: 'scheduled',
      scheduled_at: row.scheduled_date || null,
      scheduled_time: row.scheduled_time || null,
      venue: row.venue || null,
    }));
    const ok = await bulkCreateGames(payload);
    setIsSubmitting(false);
    if (ok) handleClose();
  });

  return (
    <>
      <Modal
        open={open}
        title={defaultDate ? `Bulk Create — ${fmtModalDate(defaultDate)}` : 'Bulk Create Games'}
        size="xl"
        onClose={handleClose}
        confirmForm="bulk-create-games-form"
        confirmLabel={
          isSubmitting
            ? 'Creating…'
            : `Create ${fields.length} Game${fields.length !== 1 ? 's' : ''}`
        }
        confirmDisabled={isSubmitting}
        busy={isSubmitting}
      >
        <form
          id="bulk-create-games-form"
          onSubmit={onSubmit}
        >
          <div className={styles.headerRow}>
            <span className={styles.headerCell}>
              Date<span className={styles.required}>*</span>
            </span>
            <span className={styles.headerCell}>Time</span>
            <span className={styles.headerCell}>
              Away Team<span className={styles.required}>*</span>
            </span>
            <span className={styles.headerCell}>
              Home Team<span className={styles.required}>*</span>
            </span>
            <span className={styles.headerCell}>Venue</span>
            <span />
          </div>

          <div className={styles.gameList}>
            {fields.map((field, index) => (
              <GameRow
                key={field.id}
                index={index}
                control={control}
                setValue={setValue}
                seasonTeams={seasonTeams}
                teamOptions={teamOptions}
                isSubmitting={isSubmitting}
                dateDisabled={!!defaultDate}
                autoFocus={index === autoFocusIndex}
                canDelete={fields.length > 1}
                onDelete={() => handleDeleteClick(index)}
              />
            ))}
          </div>

          <AddRowBar
            label="Add Game"
            disabled={isSubmitting}
            onClick={() => {
              setAutoFocusIndex(fields.length);
              append({ ...EMPTY_ROW, scheduled_date: defaultDate ?? '' });
            }}
          />
        </form>
      </Modal>

      <ConfirmModal
        open={confirmRemoveIndex !== null}
        title="Remove Row"
        body="Remove this game from the list?"
        confirmLabel="Remove"
        confirmIcon="delete"
        variant="danger"
        onCancel={() => setConfirmRemoveIndex(null)}
        onConfirm={() => {
          if (confirmRemoveIndex !== null) remove(confirmRemoveIndex);
          setConfirmRemoveIndex(null);
        }}
      />
    </>
  );
};

export default BulkCreateGamesModal;
