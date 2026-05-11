import { useState } from 'react';
import Button from '../Button/Button';
import ColorSwatch from '../ColorSwatch/ColorSwatch';
import ImagePreviewModal from '../ImagePreviewModal/ImagePreviewModal';
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
  const [previewOpen, setPreviewOpen] = useState(false);

  const logoEl = (
    <TeamLogo
      logo={logo}
      code={code}
      primaryColor={primaryColor}
      textColor={textColor}
      size={80}
      shape="square"
    />
  );

  return (
    <div className={styles.header}>
      {logo ? (
        <button
          type="button"
          className={styles.logoButton}
          onClick={() => setPreviewOpen(true)}
          aria-label={`View ${name} logo`}
        >
          {logoEl}
        </button>
      ) : (
        logoEl
      )}

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

      <ImagePreviewModal
        open={previewOpen}
        src={logo}
        alt={name}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
};

export default EntityHeader;
