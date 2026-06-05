import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { useController, type Control, type RegisterOptions } from 'react-hook-form';
import Button from '../Button/Button';
import Icon from '../Icon/Icon';
import styles from './LogoUpload.module.scss';

interface Props {
  label?: string;
  // typed as unknown so any Control<TFieldValues> can be passed without variance errors
  control: unknown;
  name: string;
  rules?: RegisterOptions;
  disabled?: boolean;
  autoFocus?: boolean;
  /** `'square'` (default) for logos; `'circle'` for player photos. */
  shape?: 'square' | 'circle';
  accept?: string;
  hint?: string;
}

const LogoUpload = (props: Props) => {
  const {
    label = 'Add Logo',
    control,
    name,
    rules,
    disabled,
    autoFocus,
    shape = 'square',
    accept = 'image/*,image/svg+xml,.svg',
    hint = 'Click to browse · or paste from clipboard',
  } = props;
  const isCircle = shape === 'circle';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctrl = control as Control<any>;
  const { field } = useController({ control: ctrl, name, rules });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLLabelElement>(null);
  const [preview, setPreview] = useState('');
  const [previewFailed, setPreviewFailed] = useState(false);

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
  const displayName =
    field.value instanceof File
      ? field.value.name
      : typeof field.value === 'string'
        ? (field.value.split('/').pop()?.split('?')[0] ?? label)
        : label;
  const displayIsIcon =
    accept.includes('.ico') ||
    displayName.toLowerCase().endsWith('.ico') ||
    displayUrl.toLowerCase().split('?')[0].endsWith('.ico');

  useEffect(() => {
    setPreviewFailed(false);
  }, [displayUrl]);

  const applyFile = (file: File) => {
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    field.onChange(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file) applyFile(file);
  };

  const handleClear = () => {
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
    field.onChange(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Auto-focus the label element when requested (e.g. when the modal opens).
  useEffect(() => {
    if (autoFocus && !disabled) {
      labelRef.current?.focus();
    }
    // Run once on mount; intentionally omitting autoFocus/disabled since they don't change after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clipboard paste support — active while the component is mounted and not disabled
  useEffect(() => {
    if (disabled) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            applyFile(file);
            e.preventDefault();
          }
          break;
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  return (
    <div className={styles.logoSection}>
      {displayUrl ? (
        <div className={styles.previewWrapper}>
          {previewFailed || displayIsIcon ? (
            <div className={`${styles.logoPreview} ${styles.filePreview}`}>
              <Icon
                name="image"
                size="1.4em"
              />
              <span className={styles.filePreviewLabel}>{displayName}</span>
            </div>
          ) : (
            <img
              src={displayUrl}
              alt="Preview"
              className={`${styles.logoPreview} ${isCircle ? styles.logoPreviewCircle : ''}`}
              onError={() => setPreviewFailed(true)}
            />
          )}
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
        <label
          ref={labelRef}
          tabIndex={disabled ? -1 : 0}
          className={`${styles.fileLabel} ${isCircle ? styles.fileLabelCircle : ''} ${disabled ? styles.fileLabelDisabled : ''}`}
          onKeyDown={(e: KeyboardEvent<HTMLLabelElement>) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
        >
          <Icon
            name="upload"
            size="1.5em"
          />
          {label}
          <span className={styles.fileLabelHint}>{hint}</span>
          <input
            ref={fileInputRef}
            className={styles.fileInput}
            type="file"
            accept={accept}
            disabled={disabled}
            onChange={handleFileChange}
          />
        </label>
      )}
    </div>
  );
};

export default LogoUpload;
