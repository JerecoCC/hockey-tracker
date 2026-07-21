import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ControlledInputField } from '@/components/form/ControlledFields';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import type { GameRecord } from '@/hooks/useGames';
import {
  GAME_AUTOFILL_ACTION_ICON,
  isManualPlayerMovementRequiredError,
  type GameAutofillManualMoveReport,
  type GameAutofillProgress,
} from './gameAutofillTypes';
import { startGameAutofillProgressToast } from './gameAutofillToast';
import styles from './GameDetailsPage.module.scss';

interface GameAutofillResult {
  summary: {
    gameId: string;
    goalsCreated: number;
    rosterPlayers: number;
  };
  warnings: string[];
}

interface GameAutofillOptions {
  onProgress?: (progress: GameAutofillProgress) => void | Promise<void>;
}

export interface GameAutofillProvider {
  leagueLabel: string;
  formId: string;
  inputLabel: string;
  inputPlaceholder: string;
  inputRequiredMessage: string;
  statusMessage: string;
  startMessage: string;
  failureMessage: string;
  defaultInput: (game: GameRecord) => string;
  autofill: (
    game: GameRecord,
    input: string,
    options: GameAutofillOptions,
  ) => Promise<GameAutofillResult>;
  errorMessage: (error: unknown, fallback: string) => string;
  normalizeProgress?: (progress: GameAutofillProgress) => GameAutofillProgress;
  startProgress?: GameAutofillProgress;
}

interface Props {
  open: boolean;
  game: GameRecord;
  provider: GameAutofillProvider;
  onClose: () => void;
  onAutofillChange?: (progress: GameAutofillProgress | null) => void;
  onManualMoveReport?: (report: GameAutofillManualMoveReport) => void;
}

const AUTOFILL_REFRESH_DEBOUNCE_MS = 300;

const GameAutofillProviderModal = ({
  open,
  game,
  provider,
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
  } = useForm<{ input: string }>({
    defaultValues: { input: provider.defaultInput(game) },
    mode: 'onChange',
  });
  const [filling, setFilling] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const refreshQueuedRef = useRef(false);
  const input = watch('input');
  const canUseInput = isValid && !!String(input ?? '').trim();

  const invalidateGameDetailQueries = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['games', game.id] }),
      queryClient.invalidateQueries({ queryKey: ['game-goals', game.id] }),
      queryClient.invalidateQueries({ queryKey: ['game-roster', game.id] }),
      queryClient.invalidateQueries({ queryKey: ['game-lineup', game.id] }),
      queryClient.invalidateQueries({ queryKey: ['game-goalie-stats', game.id] }),
      queryClient.invalidateQueries({ queryKey: ['shootout-attempts', game.id] }),
    ]);

  const queueGameDetailRefresh = () => {
    if (refreshTimerRef.current) return;
    refreshTimerRef.current = setTimeout(runQueuedGameDetailRefresh, AUTOFILL_REFRESH_DEBOUNCE_MS);
  };

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

  useEffect(
    () => () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    },
    [],
  );

  const flushGameDetailRefresh = async () => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    refreshQueuedRef.current = false;
    if (refreshInFlightRef.current) await refreshInFlightRef.current;
    await invalidateGameDetailQueries();
  };

  const handleAutofillProgress = (progress: GameAutofillProgress) => {
    const normalized = provider.normalizeProgress?.(progress) ?? progress;
    onAutofillChange?.(normalized);
    if (progress.refresh) queueGameDetailRefresh();
  };

  const onSubmit = handleSubmit(async (values) => {
    const normalizedInput = String(values.input ?? '').trim();
    if (!normalizedInput || game.status === 'final') return;

    setFilling(true);
    const progressToast = startGameAutofillProgressToast({
      leagueLabel: provider.leagueLabel,
      progressClassName: styles.gameAutofillProgressBar,
    });
    onAutofillChange?.(
      provider.startProgress ?? {
        step: 'start',
        message: provider.startMessage,
      },
    );
    onClose();

    try {
      const result = await provider.autofill(game, normalizedInput, {
        onProgress: (progress) => {
          progressToast.update(progress);
          handleAutofillProgress(progress);
        },
      });
      await flushGameDetailRefresh();
      await queryClient.invalidateQueries({ queryKey: ['games'] });
      const successMessage = `Filled ${provider.leagueLabel} game ${result.summary.gameId}: ${result.summary.goalsCreated} goals, ${result.summary.rosterPlayers} roster players.`;
      progressToast.finish(
        result.warnings.length > 0 ? 'warning' : 'success',
        result.warnings.length > 0
          ? `${successMessage} ${result.warnings.join(' ')}`
          : successMessage,
      );
    } catch (error) {
      if (isManualPlayerMovementRequiredError(error)) {
        onManualMoveReport?.(error.report);
        progressToast.finish(
          'error',
          'Auto-fill needs manual player updates before it can continue. Review the report modal.',
        );
        return;
      }
      progressToast.finish('error', provider.errorMessage(error, provider.failureMessage));
    } finally {
      setFilling(false);
      onAutofillChange?.(null);
    }
  });

  return (
    <Modal
      open={open}
      title={`Auto-fill ${provider.leagueLabel} Game`}
      onClose={onClose}
      confirmLabel={filling ? 'Filling...' : 'Auto-fill'}
      confirmIcon={GAME_AUTOFILL_ACTION_ICON}
      confirmForm={provider.formId}
      confirmIntent="info"
      confirmDisabled={filling || !canUseInput || game.status === 'final'}
      busy={filling}
    >
      <div className={styles.nhlGoalieChecker}>
        <form
          id={provider.formId}
          className={styles.nhlGoalieCheckerForm}
          onSubmit={onSubmit}
        >
          <ControlledInputField
            label={provider.inputLabel}
            type="number"
            control={control}
            name="input"
            min={1}
            step={1}
            inputMode="numeric"
            placeholder={provider.inputPlaceholder}
            disabled={filling}
            autoFocus
            required
            rules={{ required: provider.inputRequiredMessage }}
          />
        </form>

        {filling && <p className={styles.nhlGoalieCheckerStatus}>{provider.statusMessage}</p>}
      </div>
    </Modal>
  );
};

export default GameAutofillProviderModal;
