import { useCallback, useLayoutEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { ControlledInputField } from '@/components/form/ControlledFields';
import LogoUpload from '@jerecocc/tracker-ui/components/LogoUpload/LogoUpload';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import useBackgroundModalAction from '@/hooks/useBackgroundModalAction';
import { type CreateTeamData, type TeamRecord } from '@/hooks/useTeams';
import TeamLogoUploadGroup from './TeamLogoUploadGroup';
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
    formState: { isDirty, isValid },
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

  // Saving (logo uploads included) runs behind a progress toast with the modal hidden; it
  // reappears with what was entered if the save fails.
  const { hidden, runSettled } = useBackgroundModalAction({
    target: open ? (editTarget?.id ?? 'new') : null,
    onDone: handleClose,
  });

  const save = async (data: FormValues) => {
    const logoDarkUrl = await resolveUploadedAsset(data.logo_dark, uploadLogo);
    const logoLightUrl = await resolveUploadedAsset(data.logo_light, uploadLogo);
    const iconUrl = await resolveUploadedAsset(data.icon, uploadLogo);
    if (
      (data.logo_dark instanceof File && !logoDarkUrl) ||
      (data.logo_light instanceof File && !logoLightUrl) ||
      (data.icon instanceof File && !iconUrl)
    ) {
      return false;
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
    return editTarget ? updateTeam(editTarget.id, payload) : addTeam(payload);
  };

  const onSubmit = handleSubmit((data) => {
    void runSettled(() => save(data), {
      pending: editTarget ? 'Saving team…' : 'Creating team…',
    });
  });

  return (
    <Modal
      open={open && !hidden}
      title={editTarget ? 'Edit Team' : 'Create Team'}
      onClose={handleClose}
      confirmLabel={editTarget ? 'Save Changes' : 'Create Team'}
      confirmForm="team-form"
      confirmDisabled={!isDirty || !isValid}
    >
      <form
        id="team-form"
        className={styles.form}
        onSubmit={onSubmit}
      >
        <LogoUpload
          control={control}
          name="icon"
          label="Header Icon"
          accept="image/x-icon,image/vnd.microsoft.icon,.ico"
          hint="Upload .ico"
          fullWidth
          previewSize="icon"
          pasteMode="focus"
        />
        <TeamLogoUploadGroup
          control={control}
        />
        <div className={styles.identityRow}>
          <ControlledInputField
            label="Code"
            required
            control={control}
            name="code"
            rules={{ required: true }}
            transform={(v) => v.toUpperCase()}
            placeholder="TOR"
          />
          <ControlledInputField
            label="Place Name"
            control={control}
            name="place_name"
            placeholder="e.g. Toronto or PWHL"
            autoFocus
          />
          <ControlledInputField
            label="Team Name"
            required
            control={control}
            name="team_name"
            rules={{ required: true }}
            placeholder="e.g. Maple Leafs"
          />
        </div>
      </form>
    </Modal>
  );
};

export default TeamFormModal;
