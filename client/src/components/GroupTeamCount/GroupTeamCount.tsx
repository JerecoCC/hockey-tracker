import styles from './GroupTeamCount.module.scss';

interface Props {
  count: number;
  label?: string;
}

const GroupTeamCount = ({ count, label = 'team' }: Props) => {
  const text = `${count} ${count === 1 ? label : `${label}s`}`;

  return (
    <span
      className={styles.count}
      title={text}
      aria-label={text}
    >
      {count}
    </span>
  );
};

export default GroupTeamCount;
