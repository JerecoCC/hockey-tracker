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
            logoDark={team.logo_dark}
            logoLight={team.logo_light}
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
        <p className={styles.nhlGoalieCheckerStatus}>
          Unable to determine from NHL goalie appearances.
        </p>
      ) : report.switchDetected && report.stints.length === 0 ? (
        <p className={styles.nhlGoalieCheckerStatus}>
          Goalie switch detected, but exact timing was not found in the HTML TOI reports.
        </p>
      ) : report.switchDetected ? (
        <>
          {report.timingUnavailable && (
            <p className={styles.nhlGoalieCheckerStatus}>
              Some switch timing was not found in the HTML TOI reports.
            </p>
          )}
          <div className={styles.nhlGoalieCheckerStints}>
            {report.stints.map((stint) => (
              <StintRow
                key={`${stint.teamSide}-${stint.goalieId}-${stint.enteredPeriod}-${stint.enteredTime}`}
                stint={stint}
                goalie={report.trueGoalies.find((goalie) => goalie.playerId === stint.goalieId)}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
};

export default TeamResult;
