import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import Field from '@jerecocc/tracker-ui/components/Field/Field';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import { fetchNhlGoalieSwitchReport, type NhlGoalieSwitchReport } from './nhlGoalieSwitchChecker';
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
  const gameNumber = watch('game_number');
  const busy = checking;
  const canUseGameNumber = isValid && !!String(gameNumber ?? '').trim();

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
            Fetching NHL GameCenter data...
          </p>
        )}
      </div>
    </Modal>
  );
};

export default NhlGoalieSwitchCheckerModal;
