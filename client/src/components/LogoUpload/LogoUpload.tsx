import type { ChangeEvent, RefObject } from 'react';
import Button from '../Button/Button';
import Icon from '../Icon/Icon';
import styles from './LogoUpload.module.scss';

interface Props {
  preview: string;
  existingUrl: string;
  label?: string;
  fileInputRef: RefObject<HTMLInputElement>;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onClearFile: () => void;
}

const LogoUpload = ({
  preview,
  existingUrl,
  label = 'Add Logo',
  fileInputRef,
  onFileChange,
  onClearFile,
}: Props) => (
  <div className={styles.logoSection}>
    {preview || existingUrl ? (
      <div className={styles.previewWrapper}>
        <img
          src={preview || existingUrl}
          alt="Preview"
          className={styles.logoPreview}
        />
        <Button
          type="button"
          variant="ghost"
          intent="neutral"
          icon="close"
          iconSize="0.9em"
          className={styles.clearBtn}
          onClick={onClearFile}
        />
      </div>
    ) : (
      <label className={styles.fileLabel}>
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
          onChange={onFileChange}
        />
      </label>
    )}
  </div>
);

export default LogoUpload;

