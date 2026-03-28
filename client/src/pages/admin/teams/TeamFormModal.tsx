import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import Button from '../../../components/Button/Button';
import Field from '../../../components/Field/Field';
import LogoUpload from '../../../components/LogoUpload/LogoUpload';
import Modal from '../../../components/Modal/Modal';
import { type SelectOption } from '../../../components/Select/Select';
import { type CreateTeamData, type TeamRecord } from '../../../hooks/useTeams';
import styles from './Teams.module.scss';

interface FormValues {
  name: string;
  code: string;
  league_id: string | null;
}

interface Props {
  open: boolean;
  editTarget: TeamRecord | null;
  leagueOptions: SelectOption[];
  onClose: () => void;
  addTeam: (data: CreateTeamData) => Promise<boolean>;
  updateTeam: (id: string, data: Partial<CreateTeamData>) => Promise<boolean>;
  uploadLogo: (file: File) => Promise<string | null>;
}

const TeamFormModal = ({
  open,
  editTarget,
  leagueOptions,
  onClose,
  addTeam,
  updateTeam,
  uploadLogo,
}: Props) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({ defaultValues: { name: '', code: '', league_id: null } });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [existingLogoUrl, setExistingLogoUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    reset({
      name: editTarget?.name ?? '',
      code: editTarget?.code ?? '',
      league_id: editTarget?.league_id ?? null,
    });
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
    const payload: CreateTeamData = {
      name: data.name,
      code: data.code,
      logo: logoUrl,
      league_id: data.league_id || null,
    };
    const ok = editTarget ? await updateTeam(editTarget.id, payload) : await addTeam(payload);
    if (ok) onClose();
  });

  return (
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
          control={control}
          name="name"
          rules={{ required: true }}
          placeholder="e.g. Toronto Maple Leafs"
          autoFocus
        />
        <Field
          label="Code"
          required
          control={control}
          name="code"
          rules={{ required: true }}
          transform={(v) => v.toUpperCase()}
          placeholder="e.g. TOR"
        />
        <Field
          label="League"
          required
          type="select"
          control={control}
          name="league_id"
          rules={{ required: true }}
          options={leagueOptions}
          placeholder="— Select a league —"
        />
        <LogoUpload
          preview={logoPreview}
          existingUrl={existingLogoUrl}
          label="Add Team Logo"
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
            {isSubmitting ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Team'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default TeamFormModal;
