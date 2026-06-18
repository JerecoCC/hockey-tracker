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
} from './nhlGameAutofill';
import type { GameRecord } from '@/hooks/useGames';
import styles from './GameDetailsPage.module.scss';

interface Props {
  open: boolean;
  game: GameRecord;
  onClose: () => void;
  setReportData: (data: NhlGoalieSwitchReport | null) => void;
  onLoadingChange?: (loading: boolean) => void;
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
  const [error, setError] = useState<string | null>(null);
  const gameNumber = watch('game_number');
  const busy = checking || filling;
  const canUseGameNumber = isValid && !!String(gameNumber ?? '').trim();

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setReportData(null);
    setChecking(true);
    onLoadingChange?.(true);

    try {
      setReportData(
        await fetchNhlGoalieSwitchReport(String(values.game_number ?? '').trim(), {
          seasonName: game.season_name,
          scheduledAt: game.scheduled_at,
          gameType: game.game_type,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to check NHL goalie switches.');
    } finally {
      setChecking(false);
      onLoadingChange?.(false);
    }
  });

  const handleAutofill = async () => {
    const input = String(gameNumber ?? '').trim();
    if (!input) return;
    setError(null);
    setFilling(true);
    onLoadingChange?.(true);

    try {
      const result = await autofillGameFromNhlGamecenter(game, input);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['games', game.id] }),
        queryClient.invalidateQueries({ queryKey: ['games'] }),
        queryClient.invalidateQueries({ queryKey: ['game-goals', game.id] }),
        queryClient.invalidateQueries({ queryKey: ['game-roster', game.id] }),
        queryClient.invalidateQueries({ queryKey: ['game-lineup', game.id] }),
        queryClient.invalidateQueries({ queryKey: ['game-goalie-stats', game.id] }),
        queryClient.invalidateQueries({ queryKey: ['shootout-attempts', game.id] }),
      ]);
      toast.success(
        `Filled NHL game ${result.summary.gameId}: ${result.summary.goalsCreated} goals, ${result.summary.rosterPlayers} roster players.`,
      );
      if (result.warnings.length > 0) {
        setError(result.warnings.join(' '));
      }
    } catch (err) {
      setError(nhlAutofillApiError(err, 'Unable to auto-fill game from NHL data.'));
    } finally {
      setFilling(false);
      onLoadingChange?.(false);
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

        {error && (
          <p
            className={`${styles.nhlGoalieCheckerStatus} ${styles.nhlGoalieCheckerError}`}
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
};

export default NhlGoalieSwitchCheckerModal;
