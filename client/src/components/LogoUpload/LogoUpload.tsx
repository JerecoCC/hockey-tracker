import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useController, type Control, type RegisterOptions } from 'react-hook-form';
import Button from '@/components/Button/Button';
import Icon from '@/components/Icon/Icon';
import styles from '@/components/LogoUpload/LogoUpload.module.scss';

interface Props {
  label?: string;
  // typed as unknown so any Control<TFieldValues> can be passed without variance errors
  control: unknown;
  name: string;
  rules?: RegisterOptions;
  disabled?: boolean;
}

const LogoUpload = (props: Props) => {
  const { label = 'Add Logo', control, name, rules, disabled } = props;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctrl = control as Control<any>;
  const { field } = useController({ control: ctrl, name, rules });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState('');

  // When the field value is reset externally to null or a string URL, clear the local blob preview
  useEffect(() => {
    if (!(field.value instanceof File)) {
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return '';
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [field.value]);

  const displayUrl = preview || (typeof field.value === 'string' ? field.value : '');

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    field.onChange(file);
  };

  const handleClear = () => {
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
    field.onChange(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className={styles.logoSection}>
      {displayUrl ? (
        <div className={styles.previewWrapper}>
          <img
            src={displayUrl}
            alt="Preview"
            className={styles.logoPreview}
          />
          {!disabled && (
            <Button
              type="button"
              variant="ghost"
              intent="neutral"
              icon="close"
              iconSize="0.9em"
              className={styles.clearBtn}
              onClick={handleClear}
            />
          )}
        </div>
      ) : (
        <label className={`${styles.fileLabel} ${disabled ? styles.fileLabelDisabled : ''}`}>
          <Icon
            name="upload"
            size="1.5em"
          />
          {label}
          <input
            ref={fileInputRef}
            className={styles.fileInput}
            type="file"
            accept="image/*,image/svg+xml,.svg"
            disabled={disabled}
            onChange={handleFileChange}
          />
        </label>
      )}
    </div>
  );
};

export default LogoUpload;
