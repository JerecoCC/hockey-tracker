import type { Control, FieldValues } from 'react-hook-form';
import Button from '../Button/Button';
import ColorSwatch from '../ColorSwatch/ColorSwatch';
import Field from '../Field/Field';
import LogoUpload from '../LogoUpload/LogoUpload';
import styles from './EntityHeader.module.scss';

interface Swatch {
  label: string;
  color: string;
}

interface Props<T extends FieldValues = FieldValues> {
  logo: string | null;
  name: string;
  code: string;
  primaryColor: string;
  textColor: string;
  swatches?: Swatch[];
  onEdit?: () => void;
  // Edit mode — provide all four together when isEditing=true
  isEditing?: boolean;
  control?: Control<T>;
  formId?: string;
  onCancel?: () => void;
  isSubmitting?: boolean;
  /** When true, renders the Secondary Color picker in edit mode. Default: false. */
  showSecondaryColor?: boolean;
}

function EntityHeader<T extends FieldValues = FieldValues>(props: Props<T>) {
  const {
    logo,
    name,
    code,
    primaryColor,
    textColor,
    swatches = [],
    onEdit,
    isEditing = false,
    control,
    formId,
    onCancel,
    isSubmitting = false,
    showSecondaryColor = false,
  } = props;

  if (isEditing) {
    return (
      <div className={styles.editHeader}>
        <div className={styles.editLogoCell}>
          <LogoUpload
            control={control!}
            name="logo"
            label="Logo"
            disabled={isSubmitting}
          />
        </div>
        <div className={styles.editTopRow}>
          <div className={styles.editNameSlot}>
            <Field
              label="Name"
              required
              control={control!}
              name="name"
              rules={{ required: true }}
              disabled={isSubmitting}
            />
          </div>
          <div className={styles.editActionsSlot}>
            <Button
              type="button"
              variant="outlined"
              intent="neutral"
              disabled={isSubmitting}
              onClick={onCancel!}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form={formId!}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </div>
        <div className={styles.editBottomRow}>
          <Field
            label="Code"
            required
            control={control!}
            name="code"
            rules={{ required: true }}
            transform={(v: string) => v.toUpperCase()}
            disabled={isSubmitting}
          />
          <div className={styles.editColorsSlot}>
            <Field
              type="color"
              label="Primary Color"
              control={control!}
              name="primary_color"
            />
            {showSecondaryColor && (
              <Field
                type="color"
                label="Secondary Color"
                control={control!}
                name="secondary_color"
              />
            )}
            <Field
              type="color"
              label="Text Color"
              control={control!}
              name="text_color"
            />
          </div>
        </div>
      </div>
    );
  }

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
}

export default EntityHeader;
