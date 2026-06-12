import { GoalieStint } from '../../nhlGoalieSwitchChecker';
import styles from '../../GameDetailsPage.module.scss';

type Props = {
  stint: GoalieStint;
};

const StintRow = (props: Props) => {
  const { stint } = props;

  const exitLabel =
    stint.exitedPeriod && stint.exitedTime
      ? `${stint.exitedPeriod} ${stint.exitedTime}`
      : 'End of game';

  return (
    <div className={styles.nhlGoalieCheckerStint}>
      <div className={styles.nhlGoalieCheckerGoalie}>{stint.goalieName}</div>
      <div>
        entered {stint.enteredPeriod} {stint.enteredTime}, exited {exitLabel}
      </div>
    </div>
  );
};

export default StintRow;
