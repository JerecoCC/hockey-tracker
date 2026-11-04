import { useCallback, useLayoutEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import {
  ControlledColorPickerField,
  ControlledInputField,
  ControlledTextareaField,
} from '@/components/form/ControlledFields';
import GroupedFields from '@jerecocc/tracker-ui/components/GroupedFields/GroupedFields';
import LogoUpload from '@jerecocc/tracker-ui/components/LogoUpload/LogoUpload';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import useBackgroundModalAction from '@/hooks/useBackgroundModalAction';
import { type TeamDetailRecord } from '@/hooks/useTeamDetails';
import { type CreateTeamData } from '@/hooks/useTeams';
import { descriptionHtmlToTextarea, textareaToDescriptionHtml } from '@/lib/descriptionHtml';
import TeamLogoUploadGroup from './TeamLogoUploadGroup';
import styles from './TeamEditModal.module.scss';

interface FormValues {
  logo_dark: File | string | null;
  logo_light: File | string | null;
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

const resolveUploadedAsset = async (
  value: File | string | null,
  uploadLogo: (file: File) => Promise<string | null>,
) => {
  if (value instanceof File) return uploadLogo(value);
  return typeof value === 'string' ? value : null;
};

interface Props {
  open: boolean;
  team: TeamDetailRecord;
  uploadLogo: (file: File) => Promise<string | null>;
  updateTeam: (id: string, payload: Partial<CreateTeamData>) => Promise<boolean>;
  onClose: () => void;
}

const TeamEditModal = ({ open, team, uploadLogo, updateTeam, onClose }: Props) => {
  const formValues = useMemo<FormValues>(() => {
    const fallbackName = splitTeamName(team.name, team.city ?? team.location);
    return {
      logo_dark: team.logo_dark ?? null,
      logo_light: team.logo_light ?? null,
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
    };
  }, [team]);
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
    target: open ? team.id : null,
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
    const payload: Partial<CreateTeamData> = {
      logo_dark: logoDarkUrl,
      logo_light: logoLightUrl,
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
    return updateTeam(team.id, payload);
  };

  const onSubmit = handleSubmit((data) => {
    void runSettled(() => save(data), { pending: 'Saving team…' });
  });

  return (
    <Modal
      open={open && !hidden}
      title="Edit Team"
      onClose={handleClose}
      confirmLabel="Save Changes"
      confirmForm="team-edit-form"
      confirmDisabled={!isDirty || !isValid}
    >
      <form
        id="team-edit-form"
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
          pasteMode="focus"        />
        <TeamLogoUploadGroup
          control={control}        />
        <div className={styles.identityRow}>
          <ControlledInputField
            label="Code"
            required
            control={control}
            name="code"
            rules={{ required: true }}
            transform={(v) => v.toUpperCase()}
            placeholder="TOR"          />
          <ControlledInputField
            label="Place Name"
            control={control}
            name="place_name"
            placeholder="e.g. Toronto or PWHL"
            autoFocus          />
          <ControlledInputField
            label="Team Name"
            required
            control={control}
            name="team_name"
            rules={{ required: true }}
            placeholder="e.g. Maple Leafs"          />
        </div>
        <div className={styles.locationRow}>
          <ControlledInputField
            label="City"
            control={control}
            name="city"
            placeholder="e.g. Toronto"          />
          <ControlledInputField
            label="Home Arena"
            control={control}
            name="home_arena"
            placeholder="e.g. Scotiabank Arena"          />
        </div>
        <GroupedFields
          legend="Team Colors"
          className={styles.colorGroup}
        >
          <ControlledColorPickerField
            label="Primary"
            control={control}
            name="primary_color"          />
          <ControlledColorPickerField
            label="Secondary"
            control={control}
            name="secondary_color"          />
          <ControlledColorPickerField
            label="Text"
            control={control}
            name="text_color"          />
        </GroupedFields>
        <ControlledTextareaField
          label="Description"
          control={control}
          name="description"
          rows={6}
          placeholder="Add a description..."        />
      </form>
    </Modal>
  );
};

export default TeamEditModal;
