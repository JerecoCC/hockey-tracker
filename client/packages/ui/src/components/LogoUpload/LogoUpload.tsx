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
  align?: 'center' | 'start';
  full?: boolean;
  previewSize?: 'default' | 'icon';
  accept?: string;
  hint?: string;
  pasteMode?: 'document' | 'focus' | 'none';
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
    align = 'center',
    full = false,
    previewSize = 'default',
    accept = 'image/*,image/svg+xml,.svg',
    hint = 'Click to browse · or paste from clipboard',
    pasteMode = 'document',
  } = props;
  const isCircle = shape === 'circle';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctrl = control as Control<any>;
  const { field } = useController({ control: ctrl, name, rules });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLLabelElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
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
  const displayNameLower = displayName.toLowerCase();
  const displayUrlPath = displayUrl.split('?')[0].toLowerCase();
  const displayIsIco =
    displayNameLower.endsWith('.ico') ||
    displayUrlPath.endsWith('.ico') ||
    (field.value instanceof File &&
      ['image/x-icon', 'image/vnd.microsoft.icon'].includes(field.value.type));

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
    if (disabled || pasteMode === 'none') return;
    const handlePaste = (e: ClipboardEvent) => {
      if (pasteMode === 'focus' && !sectionRef.current?.contains(document.activeElement)) {
        return;
      }
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
  }, [disabled, pasteMode]);

  return (
    <div
      ref={sectionRef}
      className={`${styles.logoSection} ${align === 'start' ? styles.logoSectionStart : ''} ${full ? styles.logoSectionFull : ''} ${previewSize === 'icon' ? styles.logoSectionIcon : ''}`}
    >
      {label && <span className={styles.labelText}>{label}</span>}
      {displayUrl ? (
        <div
          className={`${styles.previewWrapper} ${isCircle ? styles.previewWrapperCircle : ''} ${disabled ? styles.previewWrapperDisabled : ''}`}
          aria-disabled={disabled || undefined}
        >
          {previewFailed ? (
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
              className={`${styles.logoPreview} ${isCircle ? styles.logoPreviewCircle : ''} ${displayIsIco ? styles.logoPreviewIco : ''}`}
              onError={() => setPreviewFailed(true)}
            />
          )}
          {!disabled && (
            <Button
              type="button"
              variant="ghost"
              intent="neutral"
              icon="delete"
              iconSize="1.5rem"
              className={styles.clearBtn}
              aria-label="Remove image"
              onClick={handleClear}
            />
          )}
        </div>
      ) : (
        <label
          ref={labelRef}
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled || undefined}
          className={`${styles.fileLabel} ${isCircle ? styles.fileLabelCircle : ''} ${disabled ? styles.fileLabelDisabled : ''}`}
          onKeyDown={(e: KeyboardEvent<HTMLLabelElement>) => {
            if (disabled) return;
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
          Upload
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
