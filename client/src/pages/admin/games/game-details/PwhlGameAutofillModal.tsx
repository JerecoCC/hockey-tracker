import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import Field from '@/components/Field/Field';
import Modal from '@/components/Modal/Modal';
import type { GameRecord } from '@/hooks/useGames';
import {
  isManualPlayerMovementRequiredError,
  type GameAutofillManualMoveReport,
  type GameAutofillProgress,
} from './gameAutofillTypes';
import {
  autofillGameFromPwhlGamecenter,
  pwhlAutofillApiError,
} from './pwhlGameAutofill';
import styles from './GameDetailsPage.module.scss';

interface Props {
  open: boolean;
  game: GameRecord;
  onClose: () => void;
  onAutofillChange?: (progress: GameAutofillProgress | null) => void;
  onManualMoveReport?: (report: GameAutofillManualMoveReport) => void;
}

type FormValues = {
  game_id: string;
};

const FORM_ID = 'pwhl-game-autofill-form';
const AUTOFILL_FAILURE_TOAST_MS = 12000;
const AUTOFILL_REFRESH_DEBOUNCE_MS = 300;

const PwhlGameAutofillModal = ({
  open,
  game,
  onClose,
  onAutofillChange,
  onManualMoveReport,
}: Props) => {
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    watch,
    formState: { isValid },
  } = useForm<FormValues>({
    defaultValues: {
      game_id: game.league_game_number ?? (game.game_number ? String(game.game_number) : ''),
    },
    mode: 'onChange',
  });
  const [filling, setFilling] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const refreshQueuedRef = useRef(false);
  const gameId = watch('game_id');
  const canUseGameId = isValid && !!String(gameId ?? '').trim();

  const invalidateGameDetailQueries = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['games', game.id] }),
      queryClient.invalidateQueries({ queryKey: ['game-goals', game.id] }),
      queryClient.invalidateQueries({ queryKey: ['game-roster', game.id] }),
      queryClient.invalidateQueries({ queryKey: ['game-lineup', game.id] }),
      queryClient.invalidateQueries({ queryKey: ['game-goalie-stats', game.id] }),
      queryClient.invalidateQueries({ queryKey: ['shootout-attempts', game.id] }),
    ]);

  const runQueuedGameDetailRefresh = () => {
    refreshTimerRef.current = null;
    if (refreshInFlightRef.current) {
      refreshQueuedRef.current = true;
      return;
    }
    refreshInFlightRef.current = invalidateGameDetailQueries()
      .then(() => undefined)
      .finally(() => {
        refreshInFlightRef.current = null;
        if (refreshQueuedRef.current) {
          refreshQueuedRef.current = false;
          queueGameDetailRefresh();
        }
      });
  };

  const queueGameDetailRefresh = () => {
    if (refreshTimerRef.current) return;
    refreshTimerRef.current = setTimeout(runQueuedGameDetailRefresh, AUTOFILL_REFRESH_DEBOUNCE_MS);
  };

  const flushGameDetailRefresh = async () => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    refreshQueuedRef.current = false;
    if (refreshInFlightRef.current) {
      await refreshInFlightRef.current;
    }
    await invalidateGameDetailQueries();
  };

  const handleAutofillProgress = (progress: GameAutofillProgress) => {
    onAutofillChange?.({ leagueLabel: 'PWHL', ...progress });
    if (progress.refresh) queueGameDetailRefresh();
  };

  const onSubmit = handleSubmit(async (values) => {
    const input = String(values.game_id ?? '').trim();
    if (!input || game.status === 'final') return;

    setFilling(true);
    onAutofillChange?.({
      step: 'start',
      message: 'Starting PWHL auto-fill...',
      leagueLabel: 'PWHL',
    });
    onClose();

    try {
      const result = await autofillGameFromPwhlGamecenter(game, input, {
        onProgress: handleAutofillProgress,
      });
      await flushGameDetailRefresh();
      await queryClient.invalidateQueries({ queryKey: ['games'] });
      toast.success(
        `Filled PWHL game ${result.summary.gameId}: ${result.summary.goalsCreated} goals, ${result.summary.rosterPlayers} roster players.`,
      );
      if (result.warnings.length > 0) {
        toast.error(result.warnings.join(' '), { autoClose: AUTOFILL_FAILURE_TOAST_MS });
      }
    } catch (err) {
      if (isManualPlayerMovementRequiredError(err)) {
        onManualMoveReport?.(err.report);
        toast.error(
          'Auto-fill needs manual player updates before it can continue. Review the report modal.',
          { autoClose: AUTOFILL_FAILURE_TOAST_MS },
        );
        return;
      }
      const message = pwhlAutofillApiError(err, 'Unable to auto-fill game from PWHL data.');
      toast.error(message, { autoClose: AUTOFILL_FAILURE_TOAST_MS });
    } finally {
      setFilling(false);
      onAutofillChange?.(null);
    }
  });

  return (
    <Modal
      open={open}
      title="Auto-fill PWHL Game"
      onClose={onClose}
      confirmLabel={filling ? 'Filling...' : 'Auto-fill'}
      confirmIcon="sports_hockey"
      confirmForm={FORM_ID}
      confirmIntent="info"
      confirmDisabled={filling || !canUseGameId || game.status === 'final'}
      busy={filling}
    >
      <div className={styles.nhlGoalieChecker}>
        <form
          id={FORM_ID}
          className={styles.nhlGoalieCheckerForm}
          onSubmit={onSubmit}
        >
          <Field
            label="PWHL game ID"
            type="number"
            control={control}
            name="game_id"
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="Put game ID here"
            disabled={filling}
            autoFocus
            required
            rules={{ required: 'PWHL game ID is required' }}
          />
        </form>

        {filling && (
          <p className={styles.nhlGoalieCheckerStatus}>
            Filling game from PWHL HockeyTech data...
          </p>
        )}
      </div>
    </Modal>
  );
};

export default PwhlGameAutofillModal;
