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
  teamCode: string;
  teamLogo: string | null;
  primaryColor: string;
  textColor: string;
  uploadLogo: (file: File) => Promise<string | null>;
}

interface FormValues {
  name: string;
  code: string;
  logo: File | string | null;
  note: string;
  start_date: string;
  end_date: string;
}

const TeamHistoryTab = ({
  teamId,
  teamName,
  teamCode,
  teamLogo,
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
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      name: '',
      code: '',
      logo: null,
      note: '',
      start_date: '',
      end_date: '',
    },
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
      reset({
        name: editTarget.name,
        code: editTarget.code ?? '',
        logo: editTarget.logo,
        note: editTarget.note ?? '',
        start_date: editTarget.start_date?.slice(0, 10) ?? '',
        end_date: editTarget.end_date?.slice(0, 10) ?? '',
      });
    } else {
      reset({
        name: teamName,
        code: teamCode,
        logo: teamLogo,
        note: '',
        start_date: '',
        end_date: '',
      });
    }
  }, [modalOpen, editTarget, teamName, teamCode, teamLogo, reset]);

  const onSubmit = handleSubmit(async (data) => {
    let logoUrl: string | null = typeof data.logo === 'string' ? data.logo : null;
    if (data.logo instanceof File) {
      const url = await uploadLogo(data.logo);
      if (!url) return;
      logoUrl = url;
    }
    const payload = {
      name: data.name,
      code: data.code || null,
      logo: logoUrl,
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
        confirmDisabled={isSubmitting}
        busy={isSubmitting}
      >
        <form
          id="team-history-form"
          className={styles.historyForm}
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
            disabled={isSubmitting}
          />
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
