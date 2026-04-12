import { useRef, type ChangeEvent } from 'react';
import ColorSwatch from '../ColorSwatch/ColorSwatch';
import Icon from '../Icon/Icon';
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
  isBusy: boolean;
  onLogoChange: (file: File) => Promise<void>;
  onEdit: () => void;
  editTooltip?: string;
  logoEditTooltip?: string;
  swatches?: Swatch[];
}

const EntityHeader = ({
  logo,
  name,
  code,
  primaryColor,
  textColor,
  isBusy,
  onLogoChange,
  onEdit,
  editTooltip = 'Edit',
  logoEditTooltip = 'Edit logo',
  swatches = [],
}: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    await onLogoChange(file);
  };

  return (
    <div className={styles.header}>
      {/* ── Logo ──────────────────────────────────────────── */}
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

        {isBusy ? (
          <div className={styles.logoSpinnerOverlay}>
            <span className={styles.logoSpinner} />
          </div>
        ) : (
          <button
            className={styles.logoEditOverlay}
            onClick={() => fileInputRef.current?.click()}
          >
            <Icon
              name="edit"
              size="1.25em"
            />
            <span className={styles.logoEditTooltip}>{logoEditTooltip}</span>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,image/svg+xml,.svg"
          className={styles.fileInput}
          onChange={handleFileChange}
        />
      </div>

      {/* ── Name + code ────────────────────────────────────── */}
      <div className={styles.nameBlock}>
        <div className={styles.nameRow}>
          <h3 className={styles.name}>{name}</h3>
          <button
            className={styles.nameEditBtn}
            onClick={onEdit}
            disabled={isBusy}
          >
            <Icon
              name="edit"
              size="0.9em"
            />
            <span className={styles.nameEditTooltip}>{editTooltip}</span>
          </button>
        </div>
        <span className={styles.code}>{code}</span>
      </div>

      {/* ── Color swatches ─────────────────────────────────── */}
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
  );
};

export default EntityHeader;
