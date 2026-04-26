import Button from '../Button/Button';
import ColorSwatch from '../ColorSwatch/ColorSwatch';
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
      <div className={styles.logoWrapper}>
        {logo ? (
          <img
            src={logo}
            alt={name}
            className={styles.logo}
          />
        ) : (
          <span
            className={styles.logoPlaceholder}
            style={{ background: primaryColor, color: textColor }}
          >
            {code.slice(0, 3)}
          </span>
        )}
      </div>

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
