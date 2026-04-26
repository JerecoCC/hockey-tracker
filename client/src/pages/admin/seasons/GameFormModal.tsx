import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Field from '../../../components/Field/Field';
import Modal from '../../../components/Modal/Modal';
import type { SelectOption } from '../../../components/Select/Select';
import useGames, {
  type CreateGameData,
  type GameRecord,
  type GameStatus,
  type GameType,
} from '../../../hooks/useGames';
import { type SeasonTeam } from '../../../hooks/useSeasonDetails';
import styles from './GameFormModal.module.scss';

interface FormValues {
  home_team_id: string | null;
  away_team_id: string | null;
  game_type: GameType;
  status: GameStatus;
  scheduled_date: string;
  scheduled_time: string;
  venue: string;
  home_score: string;
  away_score: string;
  overtime_periods: string;
  shootout: string;
  notes: string;
}

interface Props {
  open: boolean;
  seasonId: string;
  editTarget: GameRecord | null;
  seasonTeams: SeasonTeam[];
  createGame: ReturnType<typeof useGames>['createGame'];
  updateGame: ReturnType<typeof useGames>['updateGame'];
  onClose: () => void;
}

const GameFormModal = ({
  open,
  seasonId,
  editTarget,
  seasonTeams,
  createGame,
  updateGame,
  onClose,
}: Props) => {
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      home_team_id: null,
      away_team_id: null,
      game_type: 'regular',
      status: 'scheduled',
      scheduled_date: '',
      scheduled_time: '',
      venue: '',
      home_score: '',
      away_score: '',
      overtime_periods: '',
      shootout: 'false',
      notes: '',
    },
  });

  // Fields are locked once the game has started — only venue and time remain editable
  const isStarted = editTarget?.status === 'in_progress' || editTarget?.status === 'final';

  const handleHomeTeamChange = (teamId: string | null) => {
    const team = seasonTeams.find((t) => t.id === teamId);
    setValue('venue', team?.home_arena ?? '');
  };

  useEffect(() => {
    if (!open) return;
    if (editTarget) {
      reset({
        home_team_id: editTarget.home_team_id,
        away_team_id: editTarget.away_team_id,
        game_type: editTarget.game_type,
        status: editTarget.status,
        scheduled_date: editTarget.scheduled_at ? editTarget.scheduled_at.slice(0, 10) : '',
        scheduled_time: editTarget.scheduled_time ?? '',
        venue: editTarget.venue ?? '',
        home_score: editTarget.home_score != null ? String(editTarget.home_score) : '',
        away_score: editTarget.away_score != null ? String(editTarget.away_score) : '',
        overtime_periods:
          editTarget.overtime_periods != null ? String(editTarget.overtime_periods) : '',
        shootout: editTarget.shootout ? 'true' : 'false',
        notes: editTarget.notes ?? '',
      });
    } else {
      reset({
        home_team_id: null,
        away_team_id: null,
        game_type: 'regular',
        status: 'scheduled',
        scheduled_date: '',
        scheduled_time: '',
        venue: '',
        home_score: '',
        away_score: '',
        overtime_periods: '',
        shootout: 'false',
        notes: '',
      });
    }
  }, [open, editTarget, reset]);

  const teamOptions: SelectOption[] = seasonTeams.map((t) => ({
    value: t.id,
    label: t.name,
  }));

  const onSubmit = handleSubmit(async (data) => {
    const payload: CreateGameData = {
      season_id: seasonId,
      home_team_id: data.home_team_id!,
      away_team_id: data.away_team_id!,
      game_type: data.game_type,
      status: data.status,
      scheduled_at: data.scheduled_date || null,
      scheduled_time: data.scheduled_time || null,
      venue: data.venue || null,
      home_score: data.home_score !== '' ? Number(data.home_score) : null,
      away_score: data.away_score !== '' ? Number(data.away_score) : null,
      overtime_periods: data.overtime_periods !== '' ? Number(data.overtime_periods) : null,
      shootout: data.shootout === 'true',
      notes: data.notes || null,
    };
    const ok = editTarget
      ? await updateGame(editTarget.id, payload)
      : (await createGame(payload)) !== null;
    if (ok) onClose();
  });

  return (
    <Modal
      open={open}
      title={editTarget ? 'Edit Game' : 'Create Game'}
      size="md"
      onClose={onClose}
      confirmLabel={isSubmitting ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Game'}
      confirmForm="game-form"
      confirmDisabled={isSubmitting}
      busy={isSubmitting}
    >
      <form
        id="game-form"
        className={styles.form}
        onSubmit={onSubmit}
      >
        {/* Row 1: Date | Time */}
        <div className={styles.dateTimeRow}>
          <Field
            label="Date"
            type="datepicker"
            control={control}
            name="scheduled_date"
            placeholder="Select date…"
            disabled={isStarted || isSubmitting}
            autoFocus
          />
          <Field
            label="Time"
            type="timepicker"
            control={control}
            name="scheduled_time"
          />
        </div>

        {/* Row 2: Away team | Home team */}
        <div className={styles.teamRow}>
          <Field
            label="Away Team"
            type="select"
            required
            control={control}
            name="away_team_id"
            rules={{ required: true }}
            options={teamOptions}
            placeholder="— Select away team —"
            disabled={isStarted || isSubmitting}
            searchable
          />
          <Field
            label="Home Team"
            type="select"
            required
            control={control}
            name="home_team_id"
            rules={{ required: true }}
            options={teamOptions}
            placeholder="— Select home team —"
            disabled={isStarted || isSubmitting}
            searchable
            onChange={!isStarted ? handleHomeTeamChange : undefined}
          />
        </div>

        {/* Row 3: Venue — full width */}
        <Field
          label="Venue"
          control={control}
          name="venue"
          placeholder="Arena"
          disabled={isSubmitting}
        />
      </form>
    </Modal>
  );
};

export default GameFormModal;
