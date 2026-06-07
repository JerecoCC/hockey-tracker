import Card from '@/components/Card/Card';
import TeamResult from './TeamResult';
import { NhlGoalieSwitchReport } from '../../nhlGoalieSwitchChecker';
import NhlGoalieSwitchCheckerModal from '../../NhlGoalieSwitchCheckerModal';
import { useEffect, useState } from 'react';
import Button from '@/components/Button/Button';
import styles from '../../GameDetailsPage.module.scss';

type Props = {
  gameId: string;
};

const GoalieSwitchReportCard = ({ gameId }: Props) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [report, setReport] = useState<NhlGoalieSwitchReport | null>(null);
  const gspCode: string = `${gameId}-gsp`;

  useEffect(() => {
    const sessionData = sessionStorage.getItem(gspCode);
    if (sessionData) {
      setReport(JSON.parse(sessionData));
    }
  }, [gspCode]);

  const handleSetReport = (data: NhlGoalieSwitchReport | null) => {
    setReport(data);
    sessionStorage.setItem(gspCode, JSON.stringify(data));
    setModalOpen(false);
  };

  return (
    <>
      <Card
        title="API Data"
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
        {report ? (
          <div className={styles.nhlGoalieCheckerResults}>
            <div className={styles.nhlGoalieCheckerSummary}>
              <span>Game {report.gameId}</span>
              <strong>{report.scheduledStart ?? 'Unavailable'}</strong>
            </div>

            <div className={styles.nhlGoalieCheckerTeams}>
              <TeamResult team={report.away} />
              <TeamResult team={report.home} />
            </div>
          </div>
        ) : (
          <span className={styles.emptyAPIData}>No data fetched.</span>
        )}
      </Card>
      <NhlGoalieSwitchCheckerModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        setReportData={handleSetReport}
      />
    </>
  );
};

export default GoalieSwitchReportCard;
