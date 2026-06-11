import { NhlGoalieSwitchTeamReport } from '../../nhlGoalieSwitchChecker';
import styles from '../../GameDetailsPage.module.scss';
import StintRow from './StintRow';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
import { TeamInfo } from '@/hooks/useGames';

type Props = {
  report: NhlGoalieSwitchTeamReport;
  team: TeamInfo;
};

const TeamResult = (props: Props) => {
  const { report, team } = props;

  return (
    <section className={styles.nhlGoalieCheckerTeam}>
      <div className={styles.nhlGoalieCheckerTeamHeader}>
        <span className={styles.nhlGoalieCheckerTeamInfo}>
          <TeamLogo
            logo={team.logo}
            code={report.abbrev}
            primaryColor={team.primary_color}
            textColor={team.text_color}
            size={24}
            shape="square"
          />
          <strong>{report.abbrev}</strong>
        </span>
        <span
          className={
            report.switchDetected
              ? styles.nhlGoalieCheckerSwitchDetected
              : styles.nhlGoalieCheckerNoSwitch
          }
        >
          {report.switchDetected ? 'Goalie switch detected' : 'No goalie switch'}
        </span>
      </div>

      {report.trueGoalies.length === 0 ? (
        <p className={styles.nhlGoalieCheckerStatus}>No goalie appearances found.</p>
      ) : report.stints.length === 0 ? (
        <p className={styles.nhlGoalieCheckerStatus}>
          Exact switch timing unavailable from this response.
        </p>
      ) : (
        <>
          {report.timingUnavailable && (
            <p className={styles.nhlGoalieCheckerStatus}>
              Exact switch timing unavailable from this response.
            </p>
          )}
          <div className={styles.nhlGoalieCheckerStints}>
            {report.stints.map((stint) => (
              <StintRow
                key={`${stint.teamSide}-${stint.goalieId}-${stint.enteredPeriod}-${stint.enteredTime}`}
                stint={stint}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export default TeamResult;
