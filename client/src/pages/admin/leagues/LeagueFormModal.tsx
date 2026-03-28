import type { ChangeEvent, FormEvent, RefObject } from 'react';
import Button from '../../../components/Button/Button';
import Field from '../../../components/Field/Field';
import LogoUpload from '../../../components/LogoUpload/LogoUpload';
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
      <Field
        label="Name"
        required
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        placeholder="e.g. National Hockey League"
        autoFocus
      />
      <Field
        label="Code"
        required
        value={form.code}
        onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
        placeholder="e.g. NHL"
      />
      <LogoUpload
        preview={form.logoPreview}
        existingUrl={form.existingLogoUrl}
        label="Add League Logo"
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
          {submitting ? 'Saving…' : editTarget ? 'Save Changes' : 'Add League'}
        </Button>
      </div>
    </form>
  </Modal>
);

export default LeagueFormModal;
