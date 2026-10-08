import { useEffect, useRef, useState } from 'react';
import { type RegisterOptions, useForm, useWatch } from 'react-hook-form';
import Button from '@jerecocc/tracker-ui/components/Button/Button';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import {
  ControlledDatePickerField,
  ControlledInputField,
  ControlledSelectField,
  ControlledTimePickerField,
} from '@/components/form/ControlledFields';
import type { GameRecord, GameType } from '@/hooks/useGames';
import usePersonalGames, {
  type PersonalGameInput,
  type PersonalGameResultType,
} from '@/hooks/usePersonalGames';
import { toLocalDateKey } from '@/lib/gameSchedule';
import styles from './PersonalGameModal.module.scss';
import usePersonalGameOptions from './usePersonalGameOptions';

const GAME_TYPE_OPTIONS: { value: GameType; label: string }[] = [
  { value: 'preseason', label: 'Preseason' },
  { value: 'regular', label: 'Regular Season' },
  { value: 'playoff', label: 'Playoffs' },
];

const RESULT_OPTIONS: { value: PersonalGameResultType; label: string }[] = [
  { value: 'regulation', label: 'Regulation' },
  { value: 'overtime', label: 'Overtime' },
  { value: 'shootout', label: 'Shootout' },
];

interface FormValues {
  league_id: string;
  season_id: string;
  away_team_id: string;
  home_team_id: string;
  game_type: GameType;
  scheduled_at: string;
  scheduled_time: string;
  away_score: string;
  home_score: string;
  result_type: PersonalGameResultType;
  scheduled_for: string;
}

const SCORE_RE = /^\d{1,2}$/;

const toFormValues = (game: GameRecord | null, defaultDate?: string): FormValues => {
  const recorded = game?.status === 'final';
  return {
    league_id: game?.league_id ?? '',
    season_id: game?.season_id ?? '',
    away_team_id: game?.away_team.id ?? '',
    home_team_id: game?.home_team.id ?? '',
    game_type: game?.game_type ?? 'regular',
    scheduled_at: game?.scheduled_at?.slice(0, 10) ?? defaultDate ?? '',
    scheduled_time: game?.scheduled_time ?? '',
    away_score: recorded && game?.away_score != null ? String(game.away_score) : '',
    home_score: recorded && game?.home_score != null ? String(game.home_score) : '',
    result_type: game?.result_type ?? 'regulation',
    scheduled_for: game?.scheduled_for?.slice(0, 10) ?? '',
  };
};

interface Props {
  open: boolean;
  /** The personal game to edit, or null to add a new one. */
  game: GameRecord | null;
  /** Prefills the game date when adding (YYYY-MM-DD). */
  defaultDate?: string;
  onClose: () => void;
}

/**
 * Adds or edits a personal game: one the user tracks on their own schedule (and Google
 * Calendar) with a score they record themselves. Only the scoreboard, game type, schedule
 * and postponed watch date are kept.
 */
const PersonalGameModal = ({ open, game, defaultDate, onClose }: Props) => {
  const { createPersonalGame, updatePersonalGame, deletePersonalGame } = usePersonalGames();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { isSubmitting, isDirty, isValid },
  } = useForm<FormValues>({ defaultValues: toFormValues(game, defaultDate), mode: 'onChange' });
  const [leagueId, seasonId, awayTeamId, homeTeamId] = useWatch({
    control,
    name: ['league_id', 'season_id', 'away_team_id', 'home_team_id'],
  });
  // Pick the league's current season when adding a game or after the league changes, but
  // leave an edited game's saved season (or lack of one) alone.
  const autoPickSeason = useRef(!game);
  const {
    leagueOptions,
    seasonOptions,
    teamOptions,
    teamsLoading,
    seasonPlaceholder,
    teamPlaceholder,
  } = usePersonalGameOptions({
    open,
    leagueId,
    seasonId,
    autoPickSeason: autoPickSeason.current,
    onPickSeason: (pickedSeasonId) => {
      autoPickSeason.current = false;
      setValue('season_id', pickedSeasonId, { shouldDirty: true, shouldValidate: true });
    },
  });

  useEffect(() => {
    if (!open) return;
    reset(toFormValues(game, defaultDate));
    autoPickSeason.current = !game;
    setConfirmingDelete(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, game?.id]);

  // Teams outside the chosen league or season no longer apply once its team list loads.
  useEffect(() => {
    if (teamsLoading || !leagueId) return;
    const available = new Set(teamOptions.map((option) => option.value));
    if (awayTeamId && !available.has(awayTeamId)) {
      setValue('away_team_id', '', { shouldDirty: true, shouldValidate: true });
    }
    if (homeTeamId && !available.has(homeTeamId)) {
      setValue('home_team_id', '', { shouldDirty: true, shouldValidate: true });
    }
  }, [awayTeamId, homeTeamId, leagueId, setValue, teamOptions, teamsLoading]);

  const handleLeagueChange = () => {
    setValue('season_id', '', { shouldDirty: true });
    autoPickSeason.current = true;
  };

  const [awayScore, homeScore] = useWatch({ control, name: ['away_score', 'home_score'] });
  const hasScore = awayScore !== '' || homeScore !== '';

  const onSubmit = handleSubmit(async (values) => {
    const scored = values.away_score !== '' && values.home_score !== '';
    const input: PersonalGameInput = {
      season_id: values.season_id || null,
      away_team_id: values.away_team_id,
      home_team_id: values.home_team_id,
      game_type: values.game_type,
      scheduled_at: values.scheduled_at,
      scheduled_time: values.scheduled_time || null,
      away_score: scored ? Number(values.away_score) : null,
      home_score: scored ? Number(values.home_score) : null,
      result_type: scored ? values.result_type : 'regulation',
      scheduled_for: values.scheduled_for || null,
      // A score means the game was watched; the server marks it watched on this date.
      watched_on: scored ? toLocalDateKey(new Date()) : null,
    };
    const saved = game
      ? await updatePersonalGame(game.id, input)
      : await createPersonalGame(input);
    if (saved) onClose();
  });

  const handleDelete = async () => {
    if (!game) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setDeleting(true);
    const ok = await deletePersonalGame(game.id);
    setDeleting(false);
    if (ok) onClose();
  };

  const busy = isSubmitting || deleting;
  const scoreRules: RegisterOptions = {
    validate: (value: string, values) => {
      if (value !== '' && !SCORE_RE.test(value)) return 'Enter a whole number';
      if ((values.away_score === '') !== (values.home_score === '')) {
        return 'Enter both scores, or neither';
      }
      return true;
    },
  };

  return (
    <Modal
      open={open}
      title={game ? 'Edit Personal Game' : 'Add Personal Game'}
      onClose={onClose}
      confirmLabel={busy ? 'Saving…' : game ? 'Save' : 'Add Personal Game'}
      confirmIcon={game ? 'save' : 'add'}
      confirmForm="personal-game-form"
      confirmDisabled={busy || !isValid || (!!game && !isDirty)}
      busy={busy}
      footerStart={
        game ? (
          <Button
            type="button"
            variant={confirmingDelete ? 'filled' : 'ghost'}
            intent="danger"
            icon="delete"
            disabled={busy}
            onClick={() => void handleDelete()}
          >
            {confirmingDelete ? 'Confirm delete' : 'Delete'}
          </Button>
        ) : undefined
      }
    >
      <form
        id="personal-game-form"
        className={styles.form}
        onSubmit={onSubmit}
      >

        {/* League and season narrow the team lists */}
        <div className={styles.full}>
          <ControlledSelectField
            label="League"
            control={control}
            name="league_id"
            options={leagueOptions}
            searchable
            placeholder="Select league…"
            disabled={busy}
            required
            rules={{ required: 'League is required' }}
            onChange={handleLeagueChange}
          />
        </div>
        <div className={styles.full}>
          <ControlledSelectField
            label="Season"
            control={control}
            name="season_id"
            options={seasonOptions}
            placeholder={seasonPlaceholder}
            disabled={busy || !leagueId || seasonOptions.length === 0}
            rules={{
              validate: (value) => !!value || seasonOptions.length === 0 || 'Season is required',
            }}
          />
        </div>

        {/* Scoreboard */}
        <ControlledSelectField
          label="Away Team"
          control={control}
          name="away_team_id"
          options={teamOptions}
          searchable
          placeholder={teamPlaceholder}
          disabled={busy || !leagueId}
          required
          rules={{ required: 'Away team is required' }}
        />
        <ControlledInputField
          label="Away Score"
          control={control}
          name="away_score"
          type="number"
          min={0}
          max={99}
          placeholder="—"
          disabled={busy}
          rules={scoreRules}
        />
        <ControlledSelectField
          label="Home Team"
          control={control}
          name="home_team_id"
          options={teamOptions}
          searchable
          placeholder={teamPlaceholder}
          disabled={busy || !leagueId}
          required
          rules={{
            required: 'Home team is required',
            validate: (value, values) =>
              value !== values.away_team_id || 'Pick two different teams',
          }}
        />
        <ControlledInputField
          label="Home Score"
          control={control}
          name="home_score"
          type="number"
          min={0}
          max={99}
          placeholder="—"
          disabled={busy}
          rules={scoreRules}
        />
        <div className={styles.full}>
          <ControlledSelectField
            label="Result"
            control={control}
            name="result_type"
            options={RESULT_OPTIONS}
            disabled={busy || !hasScore}
            rules={{
              validate: (value, values) =>
                value === 'regulation' ||
                values.away_score === '' ||
                values.away_score !== values.home_score ||
                'Overtime and shootouts need a winner',
            }}
          />
        </div>

        {/* Game type and schedule */}
        <div className={styles.full}>
          <ControlledSelectField
            label="Game Type"
            control={control}
            name="game_type"
            options={GAME_TYPE_OPTIONS}
            disabled={busy}
            required
          />
        </div>
        <div className={`${styles.full} ${styles.scheduleRow}`}>
          <ControlledDatePickerField
            label="Game Date (ET)"
            control={control}
            name="scheduled_at"
            placeholder="Select date…"
            disabled={busy}
            required
            rules={{ required: 'Game date is required' }}
          />
          <ControlledTimePickerField
            label="Start Time (ET)"
            control={control}
            name="scheduled_time"
            disabled={busy}
          />
        </div>

        {/* Postponed watch date */}
        <div className={styles.full}>
          <ControlledDatePickerField
            label="Postpone Watch To"
            control={control}
            name="scheduled_for"
            placeholder="Watch on the game date"
            disabled={busy}
            rules={{
              validate: (value, values) =>
                !value ||
                !values.scheduled_at ||
                value > values.scheduled_at ||
                'Choose a watch date after the game date',
            }}
          />
        </div>
      </form>
    </Modal>
  );
};

export default PersonalGameModal;
