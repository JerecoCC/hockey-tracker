import Tooltip from '../Tooltip/Tooltip';
import styles from './ColorSwatch.module.scss';

interface Props {
  label: string;
  color: string;
}

const ColorSwatch = (props: Props) => {
  const { label, color } = props;
  return (
    <div className={styles.item}>
      <span className={styles.label}>{label}</span>
      <Tooltip text={color}>
        <span
          className={styles.dot}
          style={{ background: color }}
        />
      </Tooltip>
    </div>
  );
};

export default ColorSwatch;
