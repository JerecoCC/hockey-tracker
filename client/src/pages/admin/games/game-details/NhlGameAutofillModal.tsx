import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import Field from '@/components/Field/Field';
import Modal from '@/components/Modal/Modal';
import type { GameRecord } from '@/hooks/useGames';
import {
  autofillGameFromNhlGamecenter,
  nhlAutofillApiError,
  type NhlAutofillProgress,
} from './nhlGameAutofill';
import styles from './GameDetailsPage.module.scss';

interface Props {
  open: boolean;
  game: GameRecord;
  onClose: () => void;
  onAutofillChange?: (progress: NhlAutofillProgress | null) => void;
}

type FormValues = {
  game_number: string;
};

const FORM_ID = 'nhl-game-autofill-form';

const NhlGameAutofillModal = ({ open, game, onClose, onAutofillChange }: Props) => {
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
  const [filling, setFilling] = useState(false);
  const gameNumber = watch('game_number');
  const canUseGameNumber = isValid && !!String(gameNumber ?? '').trim();

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
    const input = String(values.game_number ?? '').trim();
    if (!input || game.status === 'final') return;

    setFilling(true);
    onAutofillChange?.({
      step: 'start',
      message: 'Starting NHL auto-fill...',
    });
    onClose();

    try {
      const result = await autofillGameFromNhlGamecenter(game, input, {
        onProgress: handleAutofillProgress,
      });
      await invalidateGameDetailQueries();
      await queryClient.invalidateQueries({ queryKey: ['games'] });
      toast.success(
        `Filled NHL game ${result.summary.gameId}: ${result.summary.goalsCreated} goals, ${result.summary.rosterPlayers} roster players.`,
      );
      if (result.warnings.length > 0) {
        toast.error(result.warnings.join(' '));
      }
    } catch (err) {
      const message = nhlAutofillApiError(err, 'Unable to auto-fill game from NHL data.');
      toast.error(message);
    } finally {
      setFilling(false);
      onAutofillChange?.(null);
    }
  });

  return (
    <Modal
      open={open}
      title="Auto-fill NHL Game"
      onClose={onClose}
      confirmLabel={filling ? 'Filling...' : 'Auto-fill'}
      confirmIcon="sports_hockey"
      confirmForm={FORM_ID}
      confirmIntent="info"
      confirmDisabled={filling || !canUseGameNumber || game.status === 'final'}
      busy={filling}
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
            disabled={filling}
            autoFocus
            required
            rules={{ required: 'NHL game number is required' }}
          />
        </form>

        {filling && (
          <p className={styles.nhlGoalieCheckerStatus}>
            Filling game from NHL GameCenter data...
          </p>
        )}
      </div>
    </Modal>
  );
};

export default NhlGameAutofillModal;
