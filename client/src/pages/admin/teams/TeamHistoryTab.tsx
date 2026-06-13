import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import Field from '@/components/Field/Field';
import LogoUpload from '@/components/LogoUpload/LogoUpload';
import Modal from '@/components/Modal/Modal';
import ListItem, { type ListItemAction } from '@/components/ListItem/ListItem';
import useTeamHistory, { type TeamIteration } from '@/hooks/useTeamHistory';
import styles from './TeamDetails.module.scss';

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
    formState: { isSubmitting, isDirty, isValid },
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
    const ok = isEditing
      ? await updateIteration(editTarget.id, payload)
      : await addIteration(payload);
    if (ok) closeModal();
  });

  return (
    <>
      <Card
        title="Team History"
        action={
          <Button
            icon="history"
            size="sm"
            onClick={openAdd}
          >
            Record Version
          </Button>
        }
      >
        {isLoading ? (
          <p className={styles.tabPlaceholder}>Loading…</p>
        ) : iterations.length === 0 ? (
          <p className={styles.tabPlaceholder}>
            No versions recorded yet. Use &ldquo;Record Version&rdquo; to snapshot the team&apos;s
            current identity.
          </p>
        ) : (
          <ul className={styles.historyList}>
            {iterations.map((iter) => {
              const subtitle = iter.start_date
                ? `${iter.start_date.slice(0, 10)} - ${iter.end_date?.slice(0, 10) ?? 'Present'}`
                : iter.end_date
                  ? `Until ${iter.end_date.slice(0, 10)}`
                  : undefined;
              return (
                <ListItem
                  key={iter.id}
                  image={iter.logo}
                  name={iter.name}
                  rightContent={{ type: 'code', value: iter.code }}
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
          </ul>
        )}
      </Card>

      {/* ── Record / edit version modal ── */}
      <Modal
        open={modalOpen}
        title={isEditing ? 'Edit Team Version' : 'Record Version'}
        onClose={closeModal}
        confirmLabel={isSubmitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Record Version'}
        confirmIcon={isEditing ? 'edit' : 'history'}
        confirmForm="team-history-form"
        confirmDisabled={isSubmitting || !isDirty || !isValid}
        busy={isSubmitting}
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
          <div className={styles.historyFormRow}>
            <Field
              label="Place Name"
              control={control}
              name="place_name"
              placeholder="e.g. Toronto or PWHL"
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
            control={control}
            name="code"
            placeholder="e.g. TOR"
            disabled={isSubmitting}
          />
          <div className={styles.historyFormRow}>
            <Field
              label="Start Date"
              type="datepicker"
              control={control}
              name="start_date"
              placeholder="YYYY-MM-DD"
              disabled={isSubmitting}
            />
            <Field
              label="End Date"
              type="datepicker"
              control={control}
              name="end_date"
              placeholder="YYYY-MM-DD (leave blank if current)"
              disabled={isSubmitting}
            />
          </div>
          <Field
            label="Note"
            type="textarea"
            control={control}
            name="note"
            placeholder="e.g. Rebranded after relocation"
            disabled={isSubmitting}
          />
        </form>
      </Modal>

      {/* ── Delete confirmation ── */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Version"
        body={
          <>
            Delete the <strong>{deleteTarget?.name}</strong> version? This cannot be undone.
          </>
        }
        confirmLabel={busy ? 'Deleting…' : 'Delete'}
        confirmIcon="delete"
        variant="danger"
        busy={busy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          const ok = await deleteIteration(deleteTarget.id);
          if (ok) setDeleteTarget(null);
        }}
      />
    </>
  );
};

export default TeamHistoryTab;
