import Tooltip from '../Tooltip/Tooltip';
import styles from './GroupTeamCount.module.scss';

interface Props {
  count: number;
  label?: string;
}

const GroupTeamCount = ({ count, label = 'team' }: Props) => {
  const text = `${count} ${count === 1 ? label : `${label}s`}`;

  return (
    <Tooltip text={text}>
      <span
        className={styles.count}
        aria-label={text}
      >
        {count}
      </span>
    </Tooltip>
  );
};

export default GroupTeamCount;
