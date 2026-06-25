import { useCallback, useLayoutEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import Field from '@/components/Field/Field';
import Modal from '@/components/Modal/Modal';
import SegmentedControl from '@/components/SegmentedControl/SegmentedControl';
import type { SelectOption } from '@/components/Select/Select';
import useGames, {
  type CreateGameData,
  type GameRecord,
  type GameStatus,
  type GameType,
} from '@/hooks/useGames';
import { scheduledDateInputValue } from '@/pages/admin/games/game-details/formatUtils';
import styles from './GameFormModal.module.scss';

export interface GameFormTeam {
  id: string;
  name: string;
  code: string;
  logo: string | null;
  home_arena: string | null;
}

interface FormValues {
  home_team_id: string | null;
  away_team_id: string | null;
  team_side: 'home' | 'away';
  opponent_team_id: string | null;
  game_type: GameType;
  status: GameStatus;
  scheduled_date: string;
  scheduled_time: string;
  venue: string;
  overtime_periods: string;
  shootout: string;
  notes: string;
}

interface Props {
  open: boolean;
  seasonId: string;
  editTarget: GameRecord | null;
  seasonTeams: GameFormTeam[];
  createGame: ReturnType<typeof useGames>['createGame'];
  updateGame: ReturnType<typeof useGames>['updateGame'];
  onClose: () => void;
  /** When provided (create mode only), pre-fills and locks the date field. */
  defaultDate?: string;
  /** Team Details create flow: current team is fixed, user picks home/away plus opponent. */
  teamContext?: { teamId: string };
}

const fmtModalDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
};

const GameFormModal = ({
  open,
  seasonId,
  editTarget,
  seasonTeams,
  createGame,
  updateGame,
  onClose,
  defaultDate,
  teamContext,
}: Props) => {
  const isTeamContextCreate = !!teamContext && !editTarget;
  const formValues = useMemo<FormValues>(() => {
    if (editTarget) {
      const teamSide =
        teamContext?.teamId && editTarget.away_team.id === teamContext.teamId ? 'away' : 'home';
      const opponentTeamId =
        teamContext?.teamId && editTarget.away_team.id === teamContext.teamId
          ? editTarget.home_team.id
          : editTarget.away_team.id;
      return {
        home_team_id: editTarget.home_team.id,
        away_team_id: editTarget.away_team.id,
        team_side: teamSide,
        opponent_team_id: opponentTeamId,
        game_type: editTarget.game_type,
        status: editTarget.status,
        scheduled_date: scheduledDateInputValue(editTarget.scheduled_at),
        scheduled_time: editTarget.scheduled_time ?? '',
        venue: editTarget.venue ?? '',
        overtime_periods:
          editTarget.overtime_periods != null ? String(editTarget.overtime_periods) : '',
        shootout: editTarget.shootout ? 'true' : 'false',
        notes: editTarget.notes ?? '',
      };
    }
    return {
      home_team_id: teamContext?.teamId ?? null,
      away_team_id: null,
      team_side: 'home',
      opponent_team_id: null,
      game_type: 'regular',
      status: 'scheduled',
      scheduled_date: defaultDate ?? '',
      scheduled_time: '',
      venue: '',
      overtime_periods: '',
      shootout: 'false',
      notes: '',
    };
  }, [defaultDate, editTarget, teamContext?.teamId]);
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isDirty, isSubmitting, isValid },
  } = useForm<FormValues>({
    defaultValues: formValues,
    mode: 'onChange',
  });

  // Fields are locked once the game has started — only venue and time remain editable
  const isStarted = editTarget?.status === 'in_progress' || editTarget?.status === 'final';

  const handleHomeTeamChange = (teamId: string | null) => {
    const team = seasonTeams.find((t) => t.id === teamId);
    setValue('venue', team?.home_arena ?? '');
  };

  const applyTeamContextTeams = useCallback(
    (side: 'home' | 'away', nextOpponentTeamId: string | null) => {
      if (!teamContext) return;
      const currentTeamId = teamContext.teamId;
      const homeTeamId = side === 'home' ? currentTeamId : nextOpponentTeamId;
      const awayTeamId = side === 'home' ? nextOpponentTeamId : currentTeamId;
      const venueTeamId = side === 'home' ? currentTeamId : nextOpponentTeamId;
      const venueTeam = seasonTeams.find((team) => team.id === venueTeamId);

      setValue('home_team_id', homeTeamId, { shouldDirty: true, shouldValidate: true });
      setValue('away_team_id', awayTeamId, { shouldDirty: true, shouldValidate: true });
      setValue('venue', venueTeam?.home_arena ?? '', { shouldDirty: true });
    },
    [seasonTeams, setValue, teamContext],
  );

  const teamSide = watch('team_side');
  const opponentTeamId = watch('opponent_team_id');

  const handleTeamSideChange = (side: string) => {
    const nextSide = side as 'home' | 'away';
    setValue('team_side', nextSide, { shouldDirty: true, shouldValidate: true });
    applyTeamContextTeams(nextSide, opponentTeamId);
  };

  const handleOpponentTeamChange = (nextOpponentTeamId: string | null) => {
    setValue('opponent_team_id', nextOpponentTeamId, {
      shouldDirty: true,
      shouldValidate: true,
    });
    applyTeamContextTeams(teamSide, nextOpponentTeamId);
  };

  useLayoutEffect(() => {
    reset(formValues);
  }, [formValues, reset]);

  const handleClose = useCallback(() => {
    reset(formValues);
    onClose();
  }, [formValues, onClose, reset]);

  const teamOptions: SelectOption[] = seasonTeams.map((t) => ({
    value: t.id,
    label: t.name,
    logo: t.logo,
    code: t.code,
  }));
  const opponentOptions = teamContext
    ? teamOptions.filter((option) => 'value' in option && option.value !== teamContext.teamId)
    : teamOptions;

  const onSubmit = handleSubmit(async (data) => {
    const homeTeamId =
      isTeamContextCreate && teamContext
        ? data.team_side === 'home'
          ? teamContext.teamId
          : data.opponent_team_id!
        : data.home_team_id!;
    const awayTeamId =
      isTeamContextCreate && teamContext
        ? data.team_side === 'home'
          ? data.opponent_team_id!
          : teamContext.teamId
        : data.away_team_id!;
    const payload: CreateGameData = {
      season_id: seasonId,
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      game_type: data.game_type,
      status: data.status,
      scheduled_at: data.scheduled_date || null,
      scheduled_time: data.scheduled_time || null,
      venue: data.venue || null,
      overtime_periods: data.overtime_periods !== '' ? Number(data.overtime_periods) : null,
      shootout: data.shootout === 'true',
      notes: data.notes || null,
    };
    const ok = editTarget
      ? await updateGame(editTarget.id, payload)
      : (await createGame(payload)) !== null;
    if (ok) handleClose();
  });

  return (
    <Modal
      open={open}
      title={
        editTarget
          ? 'Edit Game'
          : defaultDate
            ? `Create Game — ${fmtModalDate(defaultDate)}`
            : 'Create Game'
      }
      size="md"
      onClose={handleClose}
      confirmLabel={isSubmitting ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Game'}
      confirmForm="game-form"
      confirmDisabled={isSubmitting || !isDirty || !isValid}
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
            disabled={isStarted || isSubmitting || (!editTarget && !!defaultDate)}
            autoFocus={!defaultDate}
          />
          <Field
            label="Time"
            type="timepicker"
            control={control}
            name="scheduled_time"
            disabled={isStarted || isSubmitting}
            autoFocus={!editTarget && !!defaultDate}
          />
        </div>

        {/* Row 2: Team choices */}
        {isTeamContextCreate ? (
          <div className={styles.teamRow}>
            <Field
              label="Current Team"
              type="custom"
              control={control}
              name="team_side"
            >
              <SegmentedControl
                value={teamSide}
                onChange={handleTeamSideChange}
                variant="field"
                disabled={isSubmitting}
                className={styles.teamSideControl}
                options={[
                  { value: 'away', label: 'Away' },
                  { value: 'home', label: 'Home' },
                ]}
              />
            </Field>
            <Field
              label="Opponent Team"
              type="select"
              required
              control={control}
              name="opponent_team_id"
              rules={{ required: true }}
              options={opponentOptions}
              placeholder="Select opponent"
              disabled={isSubmitting}
              searchable
              onChange={handleOpponentTeamChange}
            />
          </div>
        ) : (
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
        )}

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
