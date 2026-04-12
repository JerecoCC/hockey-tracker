import type { ReactNode } from 'react';
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
  /** Called when the Edit button is clicked. If omitted, no button is rendered. */
  onEdit?: () => void;
  /** When true, the Edit button is hidden (page is in edit mode). */
  isEditing?: boolean;
  /** Edit-mode slot: replaces the logo image/placeholder when isEditing=true. */
  logoSlot?: ReactNode;
  /** Edit-mode slot: replaces the name+code text block when isEditing=true. */
  nameSlot?: ReactNode;
  /** Edit-mode slot: replaces the Edit button and swatches when isEditing=true. */
  rightSlot?: ReactNode;
}

const EntityHeader = (props: Props) => {
  const {
    logo,
    name,
    code,
    primaryColor,
    textColor,
    swatches = [],
    onEdit,
    isEditing = false,
    logoSlot,
    nameSlot,
    rightSlot,
  } = props;

  const logoArea =
    isEditing && logoSlot ? (
      logoSlot
    ) : (
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
    );

  const nameArea = (
    <div className={isEditing && nameSlot ? styles.nameBlockEdit : styles.nameBlock}>
      {isEditing && nameSlot ? (
        nameSlot
      ) : (
        <>
          <h3 className={styles.name}>{name}</h3>
          <span className={styles.code}>{code}</span>
        </>
      )}
    </div>
  );

  const rightArea =
    onEdit || swatches.length > 0 || rightSlot ? (
      <div className={styles.rightCol}>
        {isEditing && rightSlot ? (
          rightSlot
        ) : (
          <>
            {!isEditing && onEdit && (
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
          </>
        )}
      </div>
    ) : null;

  return (
    <div className={`${styles.header}${isEditing ? ` ${styles.headerEditMode}` : ''}`}>
      {logoArea}
      {nameArea}
      {rightArea}
    </div>
  );
};

export default EntityHeader;
