import { FormEvent, useState } from 'react';
import Button from '@/components/Button/Button';
import Modal from '@/components/Modal/Modal';
import { fetchNhlGoalieSwitchReport, type NhlGoalieSwitchReport } from './nhlGoalieSwitchChecker';
import styles from './GameDetailsPage.module.scss';

interface Props {
  open: boolean;
  onClose: () => void;
  setReportData: (data: NhlGoalieSwitchReport | null) => void;
}

const NhlGoalieSwitchCheckerModal = ({ open, onClose, setReportData }: Props) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // useEffect(() => {
  //   if (!open) {
  //     setError(null);
  //     setReportData(null);
  //     setLoading(false);
  //   }
  // }, [open, setReportData]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setReportData(null);
    setLoading(true);

    try {
      setReportData(await fetchNhlGoalieSwitchReport(url.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to check NHL goalie switches.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Check NHL Goalie Switches"
      onClose={onClose}
      size="lg"
      hideFooter
    >
      <div className={styles.nhlGoalieChecker}>
        <form
          className={styles.nhlGoalieCheckerForm}
          onSubmit={handleSubmit}
        >
          <label className={styles.nhlGoalieCheckerField}>
            <span>NHL API URL</span>
            <input
              type="url"
              value={url}
              placeholder="https://api-web.nhle.com/v1/gamecenter/2025020237/landing"
              className={styles.nhlGoalieCheckerInput}
              disabled={loading}
              onChange={(event) => setUrl(event.target.value)}
            />
          </label>
          <Button
            type="submit"
            icon="search"
            disabled={loading || !url.trim()}
          >
            {loading ? 'Checking...' : 'Check'}
          </Button>
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
