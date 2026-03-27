import type { ChangeEvent, FormEvent, RefObject } from 'react';
import Button from '../../../components/Button/Button';
import Icon from '../../../components/Icon/Icon';
import Modal from '../../../components/Modal/Modal';
import { LeagueRecord } from '../../../hooks/useLeagues';
import styles from './Leagues.module.scss';

export interface FormState {
  name: string;
  code: string;
  logoFile: File | null;
  logoPreview: string;
  existingLogoUrl: string;
}

// eslint-disable-next-line react-refresh/only-export-components
export const emptyForm = (): FormState => ({
  name: '',
  code: '',
  logoFile: null,
  logoPreview: '',
  existingLogoUrl: '',
});

interface Props {
  open: boolean;
  editTarget: LeagueRecord | null;
  form: FormState;
  setForm: (form: FormState) => void;
  submitting: boolean;
  fileInputRef: RefObject<HTMLInputElement>;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onClearFile: () => void;
}

const LeagueFormModal = ({
  open,
  editTarget,
  form,
  setForm,
  submitting,
  fileInputRef,
  onClose,
  onSubmit,
  onFileChange,
  onClearFile,
}: Props) => (
  <Modal
    open={open}
    title={editTarget ? 'Edit League' : 'Add League'}
    onClose={onClose}
  >
    <form
      className={styles.form}
      onSubmit={onSubmit}
    >
      <label className={styles.label}>
        <span className={styles.labelText}>
          Name <span className={styles.required}>*</span>
        </span>
        <input
          className={styles.input}
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. National Hockey League"
          required
          autoFocus
        />
      </label>
      <label className={styles.label}>
        <span className={styles.labelText}>
          Code <span className={styles.required}>*</span>
        </span>
        <input
          className={styles.input}
          type="text"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          placeholder="e.g. NHL"
          required
        />
      </label>
      <div className={styles.logoSection}>
        {form.logoPreview || form.existingLogoUrl ? (
          <div className={styles.previewWrapper}>
            <img
              src={form.logoPreview || form.existingLogoUrl}
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
            Add League Logo
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
      <div className={styles.formActions}>
        <Button
          type="button"
          variant="outlined"
          intent="neutral"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={submitting}
        >
          {submitting ? 'Saving…' : editTarget ? 'Save Changes' : 'Add League'}
        </Button>
      </div>
    </form>
  </Modal>
);

export default LeagueFormModal;
