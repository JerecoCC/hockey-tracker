import { Goalie, GoalieStint } from '../../nhlGoalieSwitchChecker';
import styles from '../../GameDetailsPage.module.scss';

type Props = {
  stint: GoalieStint;
  goalie?: Goalie;
};

const formatStat = (value: number | undefined) => (value == null ? '-' : String(value));

const StintRow = (props: Props) => {
  const { stint, goalie } = props;

  const exitLabel =
    stint.exitedPeriod && stint.exitedTime
      ? `${stint.exitedPeriod} ${stint.exitedTime}`
      : 'End of game';

  return (
    <div className={styles.nhlGoalieCheckerStint}>
      <div className={styles.nhlGoalieCheckerStintInfo}>
        <div className={styles.nhlGoalieCheckerGoalie}>{stint.goalieName}</div>
        <div>
          entered {stint.enteredPeriod} {stint.enteredTime}, exited {exitLabel}
        </div>
      </div>
      <div className={styles.nhlGoalieCheckerStats} aria-label={`${stint.goalieName} goalie stats`}>
        <span>SA {formatStat(goalie?.shotsAgainst)}</span>
        <span>SV {formatStat(goalie?.saves)}</span>
        <span>GA {formatStat(goalie?.goalsAgainst)}</span>
      </div>
    </div>
  );
};

export default StintRow;
