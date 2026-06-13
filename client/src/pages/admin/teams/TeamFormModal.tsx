import { useCallback, useLayoutEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import Field from '@/components/Field/Field';
import LogoUpload from '@/components/LogoUpload/LogoUpload';
import Modal from '@/components/Modal/Modal';
import { type CreateTeamData, type TeamRecord } from '@/hooks/useTeams';
import styles from './TeamFormModal.module.scss';

interface FormValues {
  place_name: string;
  team_name: string;
  code: string;
  league_id: string | null;
  logo_dark: File | string | null;
  logo_light: File | string | null;
  icon: File | string | null;
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

const resolveUploadedAsset = async (
  value: File | string | null,
  uploadLogo: (file: File) => Promise<string | null>,
) => {
  if (value instanceof File) return uploadLogo(value);
  return typeof value === 'string' ? value : null;
};

interface Props {
  open: boolean;
  editTarget: TeamRecord | null;
  onClose: () => void;
  addTeam: (data: CreateTeamData) => Promise<boolean>;
  updateTeam: (id: string, data: Partial<CreateTeamData>) => Promise<boolean>;
  uploadLogo: (file: File) => Promise<string | null>;
  /** When set, the team is implicitly linked to this league on save. */
  lockedLeagueId?: string;
}

const TeamFormModal = (props: Props) => {
  const { open, editTarget, onClose, addTeam, updateTeam, uploadLogo, lockedLeagueId } = props;
  const formValues = useMemo<FormValues>(() => {
    const fallbackName = splitTeamName(editTarget?.name, editTarget?.city ?? editTarget?.location);
    return {
      place_name: editTarget?.place_name ?? fallbackName.placeName,
      team_name: editTarget?.team_name ?? fallbackName.teamName,
      code: editTarget?.code ?? '',
      league_id: lockedLeagueId ?? editTarget?.league_id ?? null,
      logo_dark: editTarget?.logo_dark ?? null,
      logo_light: editTarget?.logo_light ?? null,
      icon: editTarget?.icon ?? null,
    };
  }, [editTarget, lockedLeagueId]);
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, isDirty, isValid },
  } = useForm<FormValues>({
    defaultValues: formValues,
    mode: 'onChange',
  });

  useLayoutEffect(() => {
    reset(formValues);
  }, [formValues, reset]);

  const handleClose = useCallback(() => {
    reset(formValues);
    onClose();
  }, [formValues, onClose, reset]);

  const onSubmit = handleSubmit(async (data) => {
    const logoDarkUrl = await resolveUploadedAsset(data.logo_dark, uploadLogo);
    const logoLightUrl = await resolveUploadedAsset(data.logo_light, uploadLogo);
    const iconUrl = await resolveUploadedAsset(data.icon, uploadLogo);
    if (
      (data.logo_dark instanceof File && !logoDarkUrl) ||
      (data.logo_light instanceof File && !logoLightUrl) ||
      (data.icon instanceof File && !iconUrl)
    ) {
      return;
    }
    const payload: CreateTeamData = {
      name: displayTeamName(data.place_name, data.team_name),
      place_name: data.place_name,
      team_name: data.team_name,
      code: data.code,
      logo_dark: logoDarkUrl,
      logo_light: logoLightUrl,
      icon: iconUrl,
      league_id: data.league_id || null,
    };
    const ok = editTarget ? await updateTeam(editTarget.id, payload) : await addTeam(payload);
    if (ok) handleClose();
  });

  return (
    <Modal
      open={open}
      title={editTarget ? 'Edit Team' : 'Create Team'}
      onClose={handleClose}
      confirmLabel={isSubmitting ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Team'}
      confirmForm="team-form"
      confirmDisabled={isSubmitting || !isDirty || !isValid}
      busy={isSubmitting}
    >
      <form
        id="team-form"
        className={styles.form}
        onSubmit={onSubmit}
      >
        <div className={styles.assetRow}>
          <LogoUpload
            control={control}
            name="logo_dark"
            label="Logo (Dark)"
            disabled={isSubmitting}
          />
          <LogoUpload
            control={control}
            name="logo_light"
            label="Logo (Light)"
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
        <div className={styles.identityRow}>
          <Field
            label="Code"
            required
            control={control}
            name="code"
            rules={{ required: true }}
            transform={(v) => v.toUpperCase()}
            placeholder="TOR"
            disabled={isSubmitting}
          />
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
      </form>
    </Modal>
  );
};

export default TeamFormModal;
