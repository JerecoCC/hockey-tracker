import Card from '@/components/Card/Card';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import TeamResult from './TeamResult';
import { NhlGoalieSwitchReport } from '../../nhlGoalieSwitchChecker';
import NhlGoalieSwitchCheckerModal from '../../NhlGoalieSwitchCheckerModal';
import { useEffect, useState } from 'react';
import Button from '@/components/Button/Button';
import styles from '../../GameDetailsPage.module.scss';
import { GameRecord } from '@/hooks/useGames';

type Props = {
  game: GameRecord;
};

const GoalieSwitchReportCard = ({ game }: Props) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [report, setReport] = useState<NhlGoalieSwitchReport | null>(null);
  const [loading, setLoading] = useState(false);
  const gspCode: string = `${game.id}-gsp`;

  useEffect(() => {
    const sessionData = sessionStorage.getItem(gspCode);
    if (sessionData) {
      setReport(JSON.parse(sessionData));
    }
  }, [gspCode]);

  const handleSetReport = (data: NhlGoalieSwitchReport | null) => {
    setReport(data);
    if (data) {
      sessionStorage.setItem(gspCode, JSON.stringify(data));
      setModalOpen(false);
    } else {
      sessionStorage.removeItem(gspCode);
    }
  };

  return (
    <>
      <Card
        title="Goalie Switch Report"
        action={
          <Button
            variant="outlined"
            intent="neutral"
            icon="api_search"
            size="sm"
            tooltip="Check NHL Goalie Switches"
            onClick={() => setModalOpen(true)}
          />
        }
      >
        {loading ? (
          <LoadingSpinner message="Fetching NHL GameCenter data..." />
        ) : report ? (
          <div className={styles.nhlGoalieCheckerResults}>
            <div className={styles.nhlGoalieCheckerSummary}>
              <span>Game {report.gameId}</span>
              <strong>{report.scheduledStart ?? 'Unavailable'}</strong>
            </div>

            <div className={styles.nhlGoalieCheckerTeams}>
              <TeamResult
                report={report.away}
                team={game.away_team}
              />
              <TeamResult
                report={report.home}
                team={game.home_team}
              />
            </div>
          </div>
        ) : (
          <span className={styles.emptyAPIData}>No data fetched.</span>
        )}
      </Card>
      <NhlGoalieSwitchCheckerModal
        open={modalOpen}
        game={game}
        onClose={() => setModalOpen(false)}
        setReportData={handleSetReport}
        onLoadingChange={setLoading}
      />
    </>
  );
};

export default GoalieSwitchReportCard;
