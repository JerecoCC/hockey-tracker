import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import Button from '../../../components/Button/Button';
import Field from '../../../components/Field/Field';
import LogoUpload from '../../../components/LogoUpload/LogoUpload';
import Modal from '../../../components/Modal/Modal';
import { type CreateLeagueData, type LeagueRecord } from '../../../hooks/useLeagues';
import styles from './Leagues.module.scss';

interface FormValues {
  name: string;
  code: string;
}

interface Props {
  open: boolean;
  editTarget: LeagueRecord | null;
  onClose: () => void;
  addLeague: (data: CreateLeagueData) => Promise<boolean>;
  updateLeague: (id: string, data: Partial<CreateLeagueData>) => Promise<boolean>;
  uploadLogo: (file: File) => Promise<string | null>;
}

const LeagueFormModal = ({
  open,
  editTarget,
  onClose,
  addLeague,
  updateLeague,
  uploadLogo,
}: Props) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({ defaultValues: { name: '', code: '' } });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [existingLogoUrl, setExistingLogoUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    reset({ name: editTarget?.name ?? '', code: editTarget?.code ?? '' });
    setLogoFile(null);
    setLogoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
    setExistingLogoUrl(editTarget?.logo ?? '');
  }, [open, editTarget, reset]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setLogoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setLogoFile(file);
  };

  const clearFile = () => {
    setLogoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
    setLogoFile(null);
    setExistingLogoUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onSubmit = handleSubmit(async (data) => {
    let logoUrl: string | null = existingLogoUrl || null;
    if (logoFile) {
      const url = await uploadLogo(logoFile);
      if (!url) return;
      logoUrl = url;
    }
    const payload: CreateLeagueData = { name: data.name, code: data.code, logo: logoUrl };
    const ok = editTarget ? await updateLeague(editTarget.id, payload) : await addLeague(payload);
    if (ok) onClose();
  });

  return (
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
          control={control}
          name="name"
          rules={{ required: true }}
          placeholder="e.g. National Hockey League"
          autoFocus
        />
        <Field
          label="Code"
          required
          control={control}
          name="code"
          rules={{ required: true }}
          transform={(v) => v.toUpperCase()}
          placeholder="e.g. NHL"
        />
        <LogoUpload
          preview={logoPreview}
          existingUrl={existingLogoUrl}
          label="Add League Logo"
          fileInputRef={fileInputRef}
          onFileChange={handleFileChange}
          onClearFile={clearFile}
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
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving…' : editTarget ? 'Save Changes' : 'Add League'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default LeagueFormModal;
