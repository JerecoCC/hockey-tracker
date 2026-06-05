import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Field from '@/components/Field/Field';
import LogoUpload from '@/components/LogoUpload/LogoUpload';
import Modal from '@/components/Modal/Modal';
import { type TeamDetailRecord } from '@/hooks/useTeamDetails';
import { type CreateTeamData } from '@/hooks/useTeams';
import { descriptionHtmlToTextarea, textareaToDescriptionHtml } from '@/lib/descriptionHtml';
import styles from './TeamEditModal.module.scss';

interface FormValues {
  logo: File | string | null;
  icon: File | string | null;
  place_name: string;
  team_name: string;
  code: string;
  primary_color: string;
  secondary_color: string;
  text_color: string;
  city: string;
  home_arena: string;
  description: string | null;
}

const splitTeamName = (name: string | null | undefined, placeHint?: string | null) => {
  const cleanName = name?.trim() ?? '';
  const cleanPlaceHint = placeHint?.trim();
  if (cleanPlaceHint && cleanName.toLowerCase().startsWith(`${cleanPlaceHint.toLowerCase()} `)) {
    return {
      placeName: cleanPlaceHint,
      teamName: cleanName.slice(cleanPlaceHint.length).trim(),
    };
  }
  const firstSpace = cleanName.indexOf(' ');
  if (firstSpace === -1) return { placeName: '', teamName: cleanName };
  return {
    placeName: cleanName.slice(0, firstSpace).trim(),
    teamName: cleanName.slice(firstSpace + 1).trim(),
  };
};

const displayTeamName = (placeName: string, teamName: string) =>
  [placeName.trim(), teamName.trim()].filter(Boolean).join(' ');

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
      icon: null,
      place_name: '',
      team_name: '',
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
    const fallbackName = splitTeamName(team.name, team.city ?? team.location);
    reset({
      logo: team.logo ?? null,
      icon: team.icon ?? null,
      place_name: team.place_name ?? fallbackName.placeName,
      team_name: team.team_name ?? fallbackName.teamName,
      code: team.code,
      primary_color: team.primary_color,
      secondary_color: team.secondary_color,
      text_color: team.text_color,
      city: team.city ?? '',
      home_arena: team.home_arena ?? '',
      description: descriptionHtmlToTextarea(team.description),
    });
  }, [open, team, reset]);

  const onSubmit = handleSubmit(async (data) => {
    let logoUrl: string | null = typeof data.logo === 'string' ? data.logo : null;
    if (data.logo instanceof File) {
      const url = await uploadLogo(data.logo);
      if (!url) return;
      logoUrl = url;
    }
    let iconUrl: string | null = typeof data.icon === 'string' ? data.icon : null;
    if (data.icon instanceof File) {
      const url = await uploadLogo(data.icon);
      if (!url) return;
      iconUrl = url;
    }
    const payload: Partial<CreateTeamData> = {
      logo: logoUrl,
      icon: iconUrl,
      name: displayTeamName(data.place_name, data.team_name),
      place_name: data.place_name,
      team_name: data.team_name,
      code: data.code,
      primary_color: data.primary_color,
      secondary_color: data.secondary_color,
      text_color: data.text_color,
      city: data.city || undefined,
      home_arena: data.home_arena || undefined,
      description: textareaToDescriptionHtml(data.description),
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
      confirmLabel={isSubmitting ? 'Saving…' : 'Save Changes'}
      confirmForm="team-edit-form"
      confirmDisabled={isSubmitting}
      busy={isSubmitting}
    >
      <form
        id="team-edit-form"
        className={styles.form}
        onSubmit={onSubmit}
      >
        <div className={styles.assetRow}>
          <LogoUpload
            control={control}
            name="logo"
            label="Logo"
            disabled={isSubmitting}
          />
          <LogoUpload
            control={control}
            name="icon"
            label="Header Icon"
            accept="image/x-icon,image/vnd.microsoft.icon,.ico"
            hint="Upload .ico"
            disabled={isSubmitting}
          />
        </div>
        <div className={styles.nameRow}>
          <Field
            label="Place Name"
            control={control}
            name="place_name"
            placeholder="e.g. Toronto or PWHL"
            autoFocus
            disabled={isSubmitting}
          />
          <Field
            label="Team Name"
            required
            control={control}
            name="team_name"
            rules={{ required: true }}
            placeholder="e.g. Maple Leafs"
            disabled={isSubmitting}
          />
        </div>
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
          type="textarea"
          control={control}
          name="description"
          rows={6}
          placeholder="Add a description..."
          disabled={isSubmitting}
        />
      </form>
    </Modal>
  );
};

export default TeamEditModal;
