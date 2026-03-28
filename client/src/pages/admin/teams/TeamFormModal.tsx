import type { ChangeEvent, FormEvent, RefObject } from 'react';
import Button from '../../../components/Button/Button';
import LogoUpload from '../../../components/LogoUpload/LogoUpload';
import Modal from '../../../components/Modal/Modal';
import Select, { SelectOption } from '../../../components/Select/Select';
import { TeamRecord } from '../../../hooks/useTeams';
import styles from './Teams.module.scss';

export interface FormState {
  name: string;
  code: string;
  description: string;
  location: string;
  league_id: string | null;
  logoFile: File | null;
  logoPreview: string;
  existingLogoUrl: string;
}

// eslint-disable-next-line react-refresh/only-export-components
export const emptyForm = (): FormState => ({
  name: '',
  code: '',
  description: '',
  location: '',
  league_id: null,
  logoFile: null,
  logoPreview: '',
  existingLogoUrl: '',
});

interface Props {
  open: boolean;
  editTarget: TeamRecord | null;
  form: FormState;
  setForm: (form: FormState) => void;
  submitting: boolean;
  leagueOptions: SelectOption[];
  fileInputRef: RefObject<HTMLInputElement>;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onClearFile: () => void;
}

const TeamFormModal = ({
  open,
  editTarget,
  form,
  setForm,
  submitting,
  leagueOptions,
  fileInputRef,
  onClose,
  onSubmit,
  onFileChange,
  onClearFile,
}: Props) => (
  <Modal
    open={open}
    title={editTarget ? 'Edit Team' : 'Add Team'}
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
          placeholder="e.g. Toronto Maple Leafs"
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
          placeholder="e.g. TOR"
          required
        />
      </label>
      <label className={styles.label}>
        Location
        <input
          className={styles.input}
          type="text"
          value={form.location ?? ''}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          placeholder="e.g. Toronto, ON"
        />
      </label>
      <div className={styles.label}>
        <span className={styles.labelText}>
          League <span className={styles.required}>*</span>
        </span>
        <Select
          value={form.league_id}
          options={leagueOptions}
          placeholder="— Select a league —"
          onChange={(id) => setForm({ ...form, league_id: id })}
        />
      </div>
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
      <LogoUpload
        preview={form.logoPreview}
        existingUrl={form.existingLogoUrl}
        label="Add Team Logo"
        fileInputRef={fileInputRef}
        onFileChange={onFileChange}
        onClearFile={onClearFile}
      />
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
          {submitting ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Team'}
        </Button>
      </div>
    </form>
  </Modal>
);

export default TeamFormModal;
