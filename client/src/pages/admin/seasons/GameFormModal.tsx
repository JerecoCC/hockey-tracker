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

const GAME_TYPE_OPTIONS: SelectOption[] = [
  { value: 'regular', label: 'Regular Season' },
  { value: 'preseason', label: 'Preseason' },
  { value: 'playoff', label: 'Playoff' },
];

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'final', label: 'Final' },
  { value: 'postponed', label: 'Postponed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const SHOOTOUT_OPTIONS: SelectOption[] = [
  { value: 'false', label: 'No' },
  { value: 'true', label: 'Yes' },
];

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
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      home_team_id: null,
      away_team_id: null,
      game_type: 'regular',
      status: 'scheduled',
      scheduled_date: '',
      venue: '',
      home_score: '',
      away_score: '',
      overtime_periods: '',
      shootout: 'false',
      notes: '',
    },
  });

  const status = watch('status');
  const showScores = status === 'final';

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
    label: `${t.name} (${t.code})`,
  }));

  const onSubmit = handleSubmit(async (data) => {
    const payload: CreateGameData = {
      season_id: seasonId,
      home_team_id: data.home_team_id!,
      away_team_id: data.away_team_id!,
      game_type: data.game_type,
      status: data.status,
      scheduled_at: data.scheduled_date || null,
      venue: data.venue || null,
      home_score: showScores && data.home_score !== '' ? Number(data.home_score) : null,
      away_score: showScores && data.away_score !== '' ? Number(data.away_score) : null,
      overtime_periods:
        showScores && data.overtime_periods !== '' ? Number(data.overtime_periods) : null,
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
      size="lg"
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
            disabled={isSubmitting}
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
            disabled={isSubmitting}
            onChange={handleHomeTeamChange}
          />
        </div>
        <div className={styles.metaRow}>
          <Field
            label="Date"
            type="datepicker"
            control={control}
            name="scheduled_date"
            placeholder="Select date…"
          />
          <Field
            label="Venue"
            control={control}
            name="venue"
            placeholder="e.g. Scotiabank Arena"
            disabled={isSubmitting}
          />
        </div>
        <div className={styles.typeRow}>
          <Field
            label="Game Type"
            type="select"
            control={control}
            name="game_type"
            options={GAME_TYPE_OPTIONS}
            disabled={isSubmitting}
          />
          <Field
            label="Status"
            type="select"
            control={control}
            name="status"
            options={STATUS_OPTIONS}
            disabled={isSubmitting}
          />
        </div>
        {showScores && (
          <div className={styles.scoreRow}>
            <Field
              label="Away Score"
              type="number"
              control={control}
              name="away_score"
              min={0}
              placeholder="0"
              disabled={isSubmitting}
            />
            <Field
              label="Home Score"
              type="number"
              control={control}
              name="home_score"
              min={0}
              placeholder="0"
              disabled={isSubmitting}
            />
            <Field
              label="OT Periods"
              type="number"
              control={control}
              name="overtime_periods"
              min={0}
              placeholder="0"
              disabled={isSubmitting}
            />
            <Field
              label="Shootout"
              type="select"
              control={control}
              name="shootout"
              options={SHOOTOUT_OPTIONS}
              disabled={isSubmitting}
            />
          </div>
        )}
        <Field
          label="Notes"
          type="textarea"
          control={control}
          name="notes"
          placeholder="Optional game notes…"
          disabled={isSubmitting}
        />
      </form>
    </Modal>
  );
};

export default GameFormModal;
