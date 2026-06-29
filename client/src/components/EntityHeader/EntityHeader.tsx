import { useState } from 'react';
import type { ReactNode } from 'react';
import Button from '../Button/Button';
import ColorSwatch from '../ColorSwatch/ColorSwatch';
import Divider from '../Divider/Divider';
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
  subtitle?: ReactNode;
  nameAccessory?: ReactNode;
  actions?: ReactNode;
  primaryColor: string;
  textColor: string;
  swatches?: Swatch[];
  onEdit?: () => void;
}

const EntityHeader = ({
  logo,
  name,
  code,
  subtitle,
  nameAccessory,
  actions,
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
    <>
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
          <div className={styles.nameRow}>
            <h3 className={styles.name}>{name}</h3>
            {nameAccessory}
          </div>
          <span className={styles.code}>{subtitle ?? code}</span>
        </div>

        {(onEdit || actions || swatches.length > 0) && (
          <div className={styles.rightCol}>
            {(onEdit || actions) && (
              <div className={styles.actions}>
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
                {actions}
              </div>
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

      <Divider className={styles.divider} />

      <ImagePreviewModal
        open={previewOpen}
        src={logo}
        alt={name}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  );
};

export default EntityHeader;
