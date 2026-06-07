import { NhlGoalieSwitchTeamReport } from '../../nhlGoalieSwitchChecker';
import styles from '../../GameDetailsPage.module.scss';
import StintRow from './StintRow';

type Props = {
  team: NhlGoalieSwitchTeamReport;
};

const TeamResult = (props: Props) => {
  const { team } = props;

  return (
    <section className={styles.nhlGoalieCheckerTeam}>
      <div className={styles.nhlGoalieCheckerTeamHeader}>
        <strong>{team.abbrev}</strong>
        <span
          className={
            team.switchDetected
              ? styles.nhlGoalieCheckerSwitchDetected
              : styles.nhlGoalieCheckerNoSwitch
          }
        >
          {team.switchDetected ? 'Goalie switch detected' : 'No goalie switch'}
        </span>
      </div>

      {team.trueGoalies.length === 0 ? (
        <p className={styles.nhlGoalieCheckerStatus}>No goalie appearances found.</p>
      ) : team.stints.length === 0 ? (
        <p className={styles.nhlGoalieCheckerStatus}>
          Exact switch timing unavailable from this response.
        </p>
      ) : (
        <>
          {team.timingUnavailable && (
            <p className={styles.nhlGoalieCheckerStatus}>
              Exact switch timing unavailable from this response.
            </p>
          )}
          <div className={styles.nhlGoalieCheckerStints}>
            {team.stints.map((stint) => (
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
