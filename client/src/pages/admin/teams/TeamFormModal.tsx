import type { ChangeEvent, FormEvent, RefObject } from 'react';
import Button from '../../../components/Button/Button';
import Field from '../../../components/Field/Field';
import LogoUpload from '../../../components/LogoUpload/LogoUpload';
import Modal from '../../../components/Modal/Modal';
import { SelectOption } from '../../../components/Select/Select';
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
      <Field
        label="Name"
        required
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        placeholder="e.g. Toronto Maple Leafs"
        autoFocus
      />
      <Field
        label="Code"
        required
        value={form.code}
        onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
        placeholder="e.g. TOR"
      />
      <Field
        label="Location"
        value={form.location ?? ''}
        onChange={(e) => setForm({ ...form, location: e.target.value })}
        placeholder="e.g. Toronto, ON"
      />
      <Field
        label="League"
        required
        type="select"
        value={form.league_id}
        options={leagueOptions}
        placeholder="— Select a league —"
        onChange={(id) => setForm({ ...form, league_id: id })}
      />
      <Field
        label="Description"
        type="textarea"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        placeholder="Optional description"
        rows={3}
      />
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
