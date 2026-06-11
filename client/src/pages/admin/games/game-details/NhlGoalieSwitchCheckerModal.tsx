import { useState } from 'react';
import { useForm } from 'react-hook-form';
import Field from '@/components/Field/Field';
import Modal from '@/components/Modal/Modal';
import { fetchNhlGoalieSwitchReport, type NhlGoalieSwitchReport } from './nhlGoalieSwitchChecker';
import type { GameRecord } from '@/hooks/useGames';
import styles from './GameDetailsPage.module.scss';

interface Props {
  open: boolean;
  game: GameRecord;
  onClose: () => void;
  setReportData: (data: NhlGoalieSwitchReport | null) => void;
}

type FormValues = {
  game_number: string;
};

const FORM_ID = 'nhl-goalie-switch-checker-form';

const NhlGoalieSwitchCheckerModal = ({ open, game, onClose, setReportData }: Props) => {
  const { control, handleSubmit, watch } = useForm<FormValues>({
    defaultValues: {
      game_number: game.game_number ? String(game.game_number) : '',
    },
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gameNumber = watch('game_number');

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setReportData(null);
    setLoading(true);

    try {
      setReportData(
        await fetchNhlGoalieSwitchReport(String(values.game_number ?? '').trim(), {
          seasonName: game.season_name,
          scheduledAt: game.scheduled_at,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to check NHL goalie switches.');
    } finally {
      setLoading(false);
    }
  });

  return (
    <Modal
      open={open}
      title="Check NHL Goalie Switches"
      onClose={onClose}
      confirmLabel={loading ? 'Checking...' : 'Check'}
      confirmIcon="search"
      confirmForm={FORM_ID}
      confirmDisabled={loading || !String(gameNumber ?? '').trim()}
      busy={loading}
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
            placeholder="257"
            disabled={loading}
            required
          />
        </form>

        {loading && (
          <p className={styles.nhlGoalieCheckerStatus}>Fetching NHL GameCenter data...</p>
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
