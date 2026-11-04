import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import Button from '@jerecocc/tracker-ui/components/Button/Button';
import ConfirmModal from '@jerecocc/tracker-ui/components/ConfirmModal/ConfirmModal';
import {
  ControlledDatePickerField,
  ControlledInputField,
  ControlledTextareaField,
} from '@/components/form/ControlledFields';
import LogoUpload from '@jerecocc/tracker-ui/components/LogoUpload/LogoUpload';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import ListItem, { type ListItemAction } from '@jerecocc/tracker-ui/components/ListItem/ListItem';
import Section from '@jerecocc/tracker-ui/components/Section/Section';
import Skeleton from '@jerecocc/tracker-ui/components/Skeleton/Skeleton';
import useBackgroundModalAction from '@/hooks/useBackgroundModalAction';
import useTeamHistory, { type TeamIteration } from '@/hooks/useTeamHistory';
import EmptyMessage from '@/shared/EmptyMessage/EmptyMessage';
import ResponsiveList from '@/shared/ResponsiveList/ResponsiveList';
import styles from './TeamDetails.module.scss';

const HISTORY_SKELETON_ROW_COUNT = 3;

interface Props {
  teamId: string;
  leagueId: string | null;
  teamName: string;
  teamPlaceName?: string | null;
  teamNickname?: string | null;
  teamCode: string;
  teamLogoDark: string | null;
  teamLogoLight: string | null;
  teamIcon: string | null;
  primaryColor: string;
  textColor: string;
  uploadLogo: (file: File) => Promise<string | null>;
}

interface FormValues {
  place_name: string;
  team_name: string;
  code: string;
  logo_dark: File | string | null;
  logo_light: File | string | null;
  icon: File | string | null;
  note: string;
  start_date: string;
  end_date: string;
}

const splitTeamName = (name: string | null | undefined) => {
  const cleanName = name?.trim() ?? '';
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

const renderHistorySkeletons = () => (
  <ResponsiveList
    className={[styles.historyList, styles.listSkeletonList].join(' ')}
    aria-label="Team history loading"
  >
    {Array.from({ length: HISTORY_SKELETON_ROW_COUNT }, (_, index) => (
      <Skeleton
        as="li"
        key={`team-history-skeleton-${index}`}
        variant="card"
        className={styles.listSkeletonRow}
      />
    ))}
  </ResponsiveList>
);

const TeamHistoryTab = ({
  teamId,
  teamName,
  teamPlaceName,
  teamNickname,
  teamCode,
  teamLogoDark,
  teamLogoLight,
  teamIcon,
  primaryColor,
  textColor,
  uploadLogo,
}: Props) => {
  const { iterations, isLoading, busy, addIteration, updateIteration, deleteIteration } =
    useTeamHistory(teamId);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TeamIteration | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TeamIteration | null>(null);

  const isEditing = editTarget !== null;

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty, isValid },
  } = useForm<FormValues>({
    defaultValues: {
      place_name: '',
      team_name: '',
      code: '',
      logo_dark: null,
      logo_light: null,
      icon: null,
      note: '',
      start_date: '',
      end_date: '',
    },
    mode: 'onChange',
  });

  const closeModal = () => {
    setModalOpen(false);
    setEditTarget(null);
  };

  // Saving and deleting a version run behind a progress toast with their modal hidden; it
  // reappears (with what was entered, for the form) if they fail.
  const { hidden: formHidden, runSettled: runFormSave } = useBackgroundModalAction({
    target: modalOpen ? (editTarget?.id ?? 'new') : null,
    onDone: closeModal,
  });
  const { hidden: deleteHidden, runSettled: runDelete } = useBackgroundModalAction({
    target: deleteTarget?.id ?? null,
    onDone: () => setDeleteTarget(null),
  });

  const openAdd = () => {
    setEditTarget(null);
    setModalOpen(true);
  };

  const openEdit = (iter: TeamIteration) => {
    setEditTarget(iter);
    setModalOpen(true);
  };

  useEffect(() => {
    if (!modalOpen) return;
    if (editTarget) {
      const fallbackName = splitTeamName(editTarget.name);
      reset({
        place_name: editTarget.place_name ?? fallbackName.placeName,
        team_name: editTarget.team_name ?? fallbackName.teamName,
        code: editTarget.code ?? '',
        logo_dark: editTarget.logo_dark,
        logo_light: editTarget.logo_light,
        icon: editTarget.icon,
        note: editTarget.note ?? '',
        start_date: editTarget.start_date?.slice(0, 10) ?? '',
        end_date: editTarget.end_date?.slice(0, 10) ?? '',
      });
    } else {
      const fallbackName = splitTeamName(teamName);
      reset({
        place_name: teamPlaceName ?? fallbackName.placeName,
        team_name: teamNickname ?? fallbackName.teamName,
        code: teamCode,
        logo_dark: teamLogoDark,
        logo_light: teamLogoLight,
        icon: teamIcon,
        note: '',
        start_date: '',
        end_date: '',
      });
    }
  }, [
    modalOpen,
    editTarget,
    teamName,
    teamPlaceName,
    teamNickname,
    teamCode,
    teamLogoDark,
    teamLogoLight,
    teamIcon,
    reset,
  ]);

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
    const payload = {
      name: displayTeamName(data.place_name, data.team_name),
      place_name: data.place_name,
      team_name: data.team_name,
      code: data.code || null,
      logo_dark: logoDarkUrl,
      logo_light: logoLightUrl,
      icon: iconUrl,
      note: data.note || null,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
    };
    return editTarget ? updateIteration(editTarget.id, payload) : addIteration(payload);
  };

  const onSubmit = handleSubmit((data) => {
    void runFormSave(() => save(data), {
      pending: isEditing ? 'Saving version…' : 'Recording version…',
    });
  });

  return (
    <>
      <Section
        title="Team History"
        action={
          <Button
            icon="history"
            size="medium"
            onClick={openAdd}
          >
            Record Version
          </Button>
        }
      >
        {isLoading ? (
          renderHistorySkeletons()
        ) : iterations.length === 0 ? (
          <EmptyMessage>
            No versions recorded yet. Use &ldquo;Record Version&rdquo; to snapshot the team&apos;s
            current identity.
          </EmptyMessage>
        ) : (
          <ResponsiveList className={styles.historyList}>
            {iterations.map((iter) => {
              const subtitle = iter.start_date
                ? `${iter.start_date.slice(0, 10)} - ${iter.end_date?.slice(0, 10) ?? 'Present'}`
                : iter.end_date
                  ? `Until ${iter.end_date.slice(0, 10)}`
                  : undefined;
              return (
                <ListItem
                  key={iter.id}
                  fullWidth
                  image={iter.logo}
                  imageDark={iter.logo_dark}
                  imageLight={iter.logo_light}
                  name={iter.name}
                  rightContent={iter.code ? { type: 'code', value: iter.code } : undefined}
                  primaryColor={primaryColor}
                  textColor={textColor}
                  subtitle={subtitle}
                  note={iter.note ?? undefined}
                  actions={
                    [
                      {
                        icon: 'edit',
                        intent: 'neutral',
                        tooltip: 'Edit version',
                        disabled: busy,
                        onClick: () => openEdit(iter),
                      },
                      {
                        icon: 'delete',
                        intent: 'danger',
                        tooltip: 'Delete version',
                        disabled: busy,
                        onClick: () => setDeleteTarget(iter),
                      },
                    ] satisfies ListItemAction[]
                  }
                />
              );
            })}
          </ResponsiveList>
        )}
      </Section>

      {/* ── Record / edit version modal ── */}
      <Modal
        open={modalOpen && !formHidden}
        title={isEditing ? 'Edit Team Version' : 'Record Version'}
        onClose={closeModal}
        confirmLabel={isEditing ? 'Save Changes' : 'Record Version'}
        confirmIcon={isEditing ? 'edit' : 'history'}
        confirmForm="team-history-form"
        confirmDisabled={!isDirty || !isValid}
      >
        <form
          id="team-history-form"
          className={styles.historyForm}
          onSubmit={onSubmit}
        >
          <div className={styles.historyAssetRow}>
            <LogoUpload
              control={control}
              name="logo_dark"
              label="Logo (Dark)"            />
            <LogoUpload
              control={control}
              name="logo_light"
              label="Logo (Light)"            />
            <LogoUpload
              control={control}
              name="icon"
              label="Header Icon"
              accept="image/x-icon,image/vnd.microsoft.icon,.ico"
              hint="Upload .ico"            />
          </div>
          <div className={styles.historyFormRow}>
            <ControlledInputField
              label="Place Name"
              control={control}
              name="place_name"
              placeholder="e.g. Toronto or PWHL"            />
            <ControlledInputField
              label="Team Name"
              required
              control={control}
              name="team_name"
              rules={{ required: true }}
              placeholder="e.g. Maple Leafs"            />
          </div>
          <ControlledInputField
            label="Code"
            control={control}
            name="code"
            placeholder="e.g. TOR"          />
          <div className={styles.historyFormRow}>
            <ControlledDatePickerField
              label="Start Date"
              control={control}
              name="start_date"
              placeholder="YYYY-MM-DD"            />
            <ControlledDatePickerField
              label="End Date"
              control={control}
              name="end_date"
              placeholder="YYYY-MM-DD (leave blank if current)"            />
          </div>
          <ControlledTextareaField
            label="Note"
            control={control}
            name="note"
            placeholder="e.g. Rebranded after relocation"          />
        </form>
      </Modal>

      {/* ── Delete confirmation ── */}
      <ConfirmModal
        open={!!deleteTarget && !deleteHidden}
        title="Delete Version"
        body={
          <>
            Delete the <strong>{deleteTarget?.name}</strong> version? This cannot be undone.
          </>
        }
        confirmLabel="Delete"
        confirmIcon="delete"
        intent="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          const { id } = deleteTarget;
          void runDelete(() => deleteIteration(id), { pending: 'Deleting version…' });
        }}
      />
    </>
  );
};

export default TeamHistoryTab;
