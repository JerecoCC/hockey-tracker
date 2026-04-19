import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Button from '../../../components/Button/Button';
import Field from '../../../components/Field/Field';
import LogoUpload from '../../../components/LogoUpload/LogoUpload';
import Modal from '../../../components/Modal/Modal';
import { type TeamDetailRecord } from '../../../hooks/useTeamDetails';
import { type CreateTeamData } from '../../../hooks/useTeams';
import styles from './TeamEditModal.module.scss';

interface FormValues {
  logo: File | string | null;
  name: string;
  code: string;
  primary_color: string;
  secondary_color: string;
  text_color: string;
  city: string;
  home_arena: string;
  description: string | null;
}

const normalizeDescription = (html: string | null | undefined): string | null => {
  if (!html || html === '<p></p>') return null;
  return html;
};

interface Props {
  open: boolean;
  team: TeamDetailRecord;
  uploadLogo: (file: File) => Promise<string | null>;
  updateTeam: (id: string, payload: Partial<CreateTeamData>) => Promise<boolean>;
  onClose: () => void;
}

const TeamEditModal = ({ open, team, uploadLogo, updateTeam, onClose }: Props) => {
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
      secondary_color: '#1e293b',
      text_color: '#ffffff',
      city: '',
      home_arena: '',
      description: null,
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      logo: team.logo ?? null,
      name: team.name,
      code: team.code,
      primary_color: team.primary_color,
      secondary_color: team.secondary_color,
      text_color: team.text_color,
      city: team.city ?? '',
      home_arena: team.home_arena ?? '',
      description: team.description ?? null,
    });
  }, [open, team, reset]);

  const onSubmit = handleSubmit(async (data) => {
    let logoUrl: string | null = typeof data.logo === 'string' ? data.logo : null;
    if (data.logo instanceof File) {
      const url = await uploadLogo(data.logo);
      if (!url) return;
      logoUrl = url;
    }
    const payload: Partial<CreateTeamData> = {
      logo: logoUrl,
      name: data.name,
      code: data.code,
      primary_color: data.primary_color,
      secondary_color: data.secondary_color,
      text_color: data.text_color,
      city: data.city || undefined,
      home_arena: data.home_arena || undefined,
      description: normalizeDescription(data.description) ?? undefined,
    };
    const ok = await updateTeam(team.id, payload);
    if (ok) onClose();
  });

  return (
    <Modal
      open={open}
      title="Edit Team"
      size="lg"
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
            form="team-edit-form"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      }
    >
      <form
        id="team-edit-form"
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
          placeholder="e.g. Toronto Maple Leafs"
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
          placeholder="e.g. TOR"
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
            label="Secondary Color"
            type="color"
            control={control}
            name="secondary_color"
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
        <div className={styles.locationRow}>
          <Field
            label="City"
            control={control}
            name="city"
            placeholder="e.g. Toronto"
            disabled={isSubmitting}
          />
          <Field
            label="Home Arena"
            control={control}
            name="home_arena"
            placeholder="e.g. Scotiabank Arena"
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

export default TeamEditModal;
