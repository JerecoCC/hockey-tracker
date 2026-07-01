import { useContext, useState } from 'react';
import type { ReactNode } from 'react';
import Button from '../Button/Button';
import ColorSwatch from '../ColorSwatch/ColorSwatch';
import Divider from '../Divider/Divider';
import ImagePreviewModal from '../ImagePreviewModal/ImagePreviewModal';
import TeamLogo from '../TeamLogo/TeamLogo';
import { ThemeContext } from '../../context/ThemeContext';
import styles from './EntityHeader.module.scss';

interface Swatch {
  label: string;
  color: string;
}

interface Props {
  logo: string | null;
  logoDark?: string | null;
  logoLight?: string | null;
  name: string;
  code: string;
  subtitle?: ReactNode;
  nameAccessory?: ReactNode;
  actions?: ReactNode;
  primaryColor: string;
  textColor: string;
  swatches?: Swatch[];
  onEdit?: () => void;
  editIconOnly?: boolean;
}

const EntityHeader = ({
  logo,
  logoDark,
  logoLight,
  name,
  code,
  subtitle,
  nameAccessory,
  actions,
  primaryColor,
  textColor,
  swatches = [],
  onEdit,
  editIconOnly = false,
}: Props) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const themeContext = useContext(ThemeContext);
  const previewLogo =
    themeContext?.theme === 'light'
      ? (logoLight ?? logo ?? logoDark)
      : (logo ?? logoDark ?? logoLight);

  const logoEl = (
    <TeamLogo
      logo={logo}
      logoDark={logoDark}
      logoLight={logoLight}
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
        {previewLogo ? (
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
                    tooltip={editIconOnly ? 'Edit' : undefined}
                    aria-label={editIconOnly ? 'Edit' : undefined}
                    onClick={onEdit}
                  >
                    {editIconOnly ? undefined : 'Edit'}
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
        src={previewLogo}
        alt={name}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  );
};

export default EntityHeader;
