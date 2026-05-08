import Button from '../Button/Button';
import ColorSwatch from '../ColorSwatch/ColorSwatch';
import TeamLogo from '../TeamLogo/TeamLogo';
import styles from './EntityHeader.module.scss';

interface Swatch {
  label: string;
  color: string;
}

interface Props {
  logo: string | null;
  name: string;
  code: string;
  primaryColor: string;
  textColor: string;
  swatches?: Swatch[];
  onEdit?: () => void;
}

const EntityHeader = ({
  logo,
  name,
  code,
  primaryColor,
  textColor,
  swatches = [],
  onEdit,
}: Props) => {
  return (
    <div className={styles.header}>
      <TeamLogo
        logo={logo}
        code={code}
        primaryColor={primaryColor}
        textColor={textColor}
        size={80}
        shape="square"
      />

      <div className={styles.nameBlock}>
        <h3 className={styles.name}>{name}</h3>
        <span className={styles.code}>{code}</span>
      </div>

      {(onEdit || swatches.length > 0) && (
        <div className={styles.rightCol}>
          {onEdit && (
            <Button
              variant="outlined"
              intent="neutral"
              icon="edit"
              onClick={onEdit}
            >
              Edit
            </Button>
          )}
          {swatches.length > 0 && (
            <div className={styles.swatches}>
              {swatches.map((s) => (
                <ColorSwatch
                  key={s.label}
                  label={s.label}
                  color={s.color}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EntityHeader;
