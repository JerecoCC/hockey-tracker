import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import Button from '@/components/Button/Button';
import Field from '@/components/Field/Field';
import Modal from '@/components/Modal/Modal';
import { fetchNhlGoalieSwitchReport, type NhlGoalieSwitchReport } from './nhlGoalieSwitchChecker';
import {
  autofillGameFromNhlGamecenter,
  nhlAutofillApiError,
  type NhlAutofillProgress,
} from './nhlGameAutofill';
import type { GameRecord } from '@/hooks/useGames';
import styles from './GameDetailsPage.module.scss';

interface Props {
  open: boolean;
  game: GameRecord;
  onClose: () => void;
  setReportData: (data: NhlGoalieSwitchReport | null) => void;
  onLoadingChange?: (loading: boolean) => void;
  onAutofillChange?: (progress: NhlAutofillProgress | null) => void;
}

type FormValues = {
  game_number: string;
};

const FORM_ID = 'nhl-goalie-switch-checker-form';

const NhlGoalieSwitchCheckerModal = ({
  open,
  game,
  onClose,
  setReportData,
  onLoadingChange,
  onAutofillChange,
}: Props) => {
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    watch,
    formState: { isValid },
  } = useForm<FormValues>({
    defaultValues: {
      game_number: game.game_number ? String(game.game_number) : '',
    },
    mode: 'onChange',
  });
  const [checking, setChecking] = useState(false);
  const [filling, setFilling] = useState(false);
  const gameNumber = watch('game_number');
  const busy = checking || filling;
  const canUseGameNumber = isValid && !!String(gameNumber ?? '').trim();
  const canAutofillGame = game.status !== 'final';

  const invalidateGameDetailQueries = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['games', game.id] }),
      queryClient.invalidateQueries({ queryKey: ['game-goals', game.id] }),
      queryClient.invalidateQueries({ queryKey: ['game-roster', game.id] }),
      queryClient.invalidateQueries({ queryKey: ['game-lineup', game.id] }),
      queryClient.invalidateQueries({ queryKey: ['game-goalie-stats', game.id] }),
      queryClient.invalidateQueries({ queryKey: ['shootout-attempts', game.id] }),
    ]);

  const handleAutofillProgress = async (progress: NhlAutofillProgress) => {
    onAutofillChange?.(progress);
    if (progress.refresh) {
      await invalidateGameDetailQueries();
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setReportData(null);
    setChecking(true);
    onLoadingChange?.(true);

    try {
      const report = await fetchNhlGoalieSwitchReport(String(values.game_number ?? '').trim(), {
        seasonName: game.season_name,
        scheduledAt: game.scheduled_at,
        gameType: game.game_type,
      });
      setReportData(report);
      toast.success('NHL goalie switch report loaded.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to check NHL goalie switches.');
    } finally {
      setChecking(false);
      onLoadingChange?.(false);
    }
  });

  const handleAutofill = async () => {
    const input = String(gameNumber ?? '').trim();
    if (!input || !canAutofillGame) return;
    setReportData(null);
    setFilling(true);
    onLoadingChange?.(true);
    onAutofillChange?.({
      step: 'start',
      message: 'Starting NHL auto-fill...',
    });
    onClose();

    const goalieSwitchReportPromise = fetchNhlGoalieSwitchReport(input, {
      seasonName: game.season_name,
      scheduledAt: game.scheduled_at,
      gameType: game.game_type,
    }).then(
      (report) => ({ report, error: null }),
      (reportError) => ({ report: null, error: reportError }),
    );

    try {
      const result = await autofillGameFromNhlGamecenter(game, input, {
        onProgress: handleAutofillProgress,
      });
      const goalieSwitchReportResult = await goalieSwitchReportPromise;
      const reportWarning = goalieSwitchReportResult.error
        ? nhlAutofillApiError(
            goalieSwitchReportResult.error,
            'Game was auto-filled, but goalie switch report could not be fetched.',
          )
        : null;

      if (goalieSwitchReportResult.report) {
        setReportData(goalieSwitchReportResult.report);
      }

      await invalidateGameDetailQueries();
      await queryClient.invalidateQueries({ queryKey: ['games'] });
      toast.success(
        `Filled NHL game ${result.summary.gameId}: ${result.summary.goalsCreated} goals, ${result.summary.rosterPlayers} roster players.`,
      );
      const warnings = reportWarning ? [...result.warnings, reportWarning] : result.warnings;
      if (warnings.length > 0) {
        toast.error(warnings.join(' '));
      }
    } catch (err) {
      const message = nhlAutofillApiError(err, 'Unable to auto-fill game from NHL data.');
      toast.error(message);
    } finally {
      setFilling(false);
      onLoadingChange?.(false);
      onAutofillChange?.(null);
    }
  };

  return (
    <Modal
      open={open}
      title="Check NHL Goalie Switches"
      onClose={onClose}
      confirmLabel={checking ? 'Checking...' : 'Check'}
      confirmIcon="search"
      confirmForm={FORM_ID}
      confirmDisabled={busy || !canUseGameNumber}
      busy={busy}
      footerStart={
        canAutofillGame ? (
          <Button
            variant="outlined"
            intent="info"
            icon="sports_hockey"
            onClick={handleAutofill}
            disabled={busy || !canUseGameNumber}
            type="button"
          >
            {filling ? 'Filling...' : 'Auto-fill Game'}
          </Button>
        ) : undefined
      }
    >
      <div className={styles.nhlGoalieChecker}>
        <form
          id={FORM_ID}
          className={styles.nhlGoalieCheckerForm}
          onSubmit={onSubmit}
        >
          <Field
            label="NHL game number"
            type="number"
            control={control}
            name="game_number"
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="Put game number here"
            disabled={busy}
            autoFocus
            required
            rules={{ required: 'NHL game number is required' }}
          />
        </form>

        {busy && (
          <p className={styles.nhlGoalieCheckerStatus}>
            {filling ? 'Filling game from NHL GameCenter data...' : 'Fetching NHL GameCenter data...'}
          </p>
        )}
      </div>
    </Modal>
  );
};

export default NhlGoalieSwitchCheckerModal;
