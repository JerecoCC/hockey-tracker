import Icon from '../../../components/Icon/Icon';
import Modal from '../../../components/Modal/Modal';
import { LeagueRecord } from '../../../hooks/useLeagues';
import styles from './Leagues.module.scss';

export interface FormState {
  name: string;
  code: string;
  description: string;
  logoFile: File | null;
  logoPreview: string;
  existingLogoUrl: string;
}

export const emptyForm = (): FormState => ({
  name: '', code: '', description: '',
  logoFile: null, logoPreview: '', existingLogoUrl: '',
});

interface Props {
  open: boolean;
  editTarget: LeagueRecord | null;
  form: FormState;
  setForm: (form: FormState) => void;
  submitting: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearFile: () => void;
}

const LeagueFormModal = ({
  open, editTarget, form, setForm, submitting,
  fileInputRef, onClose, onSubmit, onFileChange, onClearFile,
}: Props) => (
  <Modal open={open} title={editTarget ? 'Edit League' : 'Add League'} onClose={onClose}>
    <form className={styles.form} onSubmit={onSubmit}>
      <label className={styles.label}>
        <span className={styles.labelText}>Name <span className={styles.required}>*</span></span>
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
        <span className={styles.labelText}>Code <span className={styles.required}>*</span></span>
        <input
          className={styles.input}
          type="text"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          placeholder="e.g. NHL"
          required
        />
      </label>
      <label className={styles.label}>
        Description
        <textarea
          className={styles.textarea}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Optional description"
          rows={3}
        />
      </label>
      <div className={styles.label}>
        Logo
        <div className={styles.fileRow}>
          {(form.logoPreview || form.existingLogoUrl) && (
            <div className={styles.previewWrapper}>
              <img src={form.logoPreview || form.existingLogoUrl} alt="Preview" className={styles.logoPreview} />
              <button type="button" className={styles.clearBtn} onClick={onClearFile}>
                <Icon name="close" size="0.9em" />
              </button>
            </div>
          )}
          <label className={styles.fileLabel}>
            <Icon name="upload" size="1em" />
            {form.logoFile ? form.logoFile.name : 'Choose image…'}
            <input
              ref={fileInputRef}
              className={styles.fileInput}
              type="file"
              accept="image/*,image/svg+xml,.svg"
              onChange={onFileChange}
            />
          </label>
        </div>
      </div>
      <div className={styles.formActions}>
        <button type="button" className={styles.cancelBtn} onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className={styles.submitBtn} disabled={submitting}>
          {submitting ? 'Saving…' : editTarget ? 'Save Changes' : 'Add League'}
        </button>
      </div>
    </form>
  </Modal>
);

export default LeagueFormModal;

