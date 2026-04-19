import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Button from '../../../components/Button/Button';
import Field from '../../../components/Field/Field';
import LogoUpload from '../../../components/LogoUpload/LogoUpload';
import Modal from '../../../components/Modal/Modal';
import { type LeagueFullRecord } from '../../../hooks/useLeagueDetails';
import { type CreateLeagueData } from '../../../hooks/useLeagues';
import styles from './LeagueEditModal.module.scss';

interface FormValues {
  logo: File | string | null;
  name: string;
  code: string;
  primary_color: string;
  text_color: string;
  description: string | null;
}

const normalizeDescription = (html: string | null | undefined): string | null => {
  if (!html || html === '<p></p>') return null;
  return html;
};

interface Props {
  open: boolean;
  league: LeagueFullRecord;
  uploadLogo: (file: File) => Promise<string | null>;
  updateLeague: (id: string, data: Partial<CreateLeagueData>) => Promise<boolean>;
  onClose: () => void;
}

const LeagueEditModal = ({ open, league, uploadLogo, updateLeague, onClose }: Props) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      logo: null,
      name: '',
      code: '',
      primary_color: '#334155',
      text_color: '#ffffff',
      description: null,
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      logo: league.logo ?? null,
      name: league.name,
      code: league.code,
      primary_color: league.primary_color,
      text_color: league.text_color,
      description: league.description ?? null,
    });
  }, [open, league, reset]);

  const onSubmit = handleSubmit(async (data) => {
    let logoUrl: string | null = typeof data.logo === 'string' ? data.logo : null;
    if (data.logo instanceof File) {
      const url = await uploadLogo(data.logo);
      if (!url) return;
      logoUrl = url;
    }
    const payload: Partial<CreateLeagueData> = {
      logo: logoUrl,
      name: data.name,
      code: data.code,
      primary_color: data.primary_color,
      text_color: data.text_color,
      description: normalizeDescription(data.description) ?? undefined,
    };
    const ok = await updateLeague(league.id, payload);
    if (ok) onClose();
  });

  return (
    <Modal
      open={open}
      title="Edit League"
      onClose={onClose}
      footer={
        <div className={styles.formActions}>
          <Button
            type="button"
            variant="outlined"
            intent="neutral"
            disabled={isSubmitting}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="league-edit-form"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      }
    >
      <form
        id="league-edit-form"
        className={styles.form}
        onSubmit={onSubmit}
      >
        <LogoUpload
          control={control}
          name="logo"
          label="Logo"
          disabled={isSubmitting}
        />
        <Field
          label="Name"
          required
          control={control}
          name="name"
          rules={{ required: true }}
          placeholder="e.g. National Hockey League"
          autoFocus
          disabled={isSubmitting}
        />
        <Field
          label="Code"
          required
          control={control}
          name="code"
          rules={{ required: true }}
          transform={(v) => v.toUpperCase()}
          placeholder="e.g. NHL"
          disabled={isSubmitting}
        />
        <div className={styles.colorRow}>
          <Field
            label="Primary Color"
            type="color"
            control={control}
            name="primary_color"
            disabled={isSubmitting}
          />
          <Field
            label="Text Color"
            type="color"
            control={control}
            name="text_color"
            disabled={isSubmitting}
          />
        </div>
        <Field
          label="Description"
          type="richtext"
          control={control}
          name="description"
          disabled={isSubmitting}
        />
      </form>
    </Modal>
  );
};

export default LeagueEditModal;
