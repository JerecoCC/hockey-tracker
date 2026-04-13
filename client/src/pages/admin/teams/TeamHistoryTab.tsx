import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import Button from '../../../components/Button/Button';
import Card from '../../../components/Card/Card';
import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal';
import Field from '../../../components/Field/Field';
import LogoUpload from '../../../components/LogoUpload/LogoUpload';
import Modal from '../../../components/Modal/Modal';
import TeamListItem from '../../../components/TeamListItem/TeamListItem';
import useTeamHistory, { type TeamIteration } from '../../../hooks/useTeamHistory';
import useSeasons from '../../../hooks/useSeasons';
import styles from './TeamDetails.module.scss';

interface Props {
  teamId: string;
  leagueId: string | null;
  teamName: string;
  teamCode: string;
  teamLogo: string | null;
  uploadLogo: (file: File) => Promise<string | null>;
}

interface FormValues {
  name: string;
  code: string;
  logo: File | string | null;
  season_id: string;
  note: string;
}

/** Derives a "2024-25" label from season start/end dates. */
const seasonLabel = (startDate: string | null, endDate: string | null, name: string): string => {
  if (!startDate) return name;
  const sy = startDate.slice(0, 4);
  const ey = endDate?.slice(0, 4);
  if (!ey || ey === sy) return sy;
  return `${sy}-${ey.slice(2)}`;
};

const TeamHistoryTab = ({ teamId, leagueId, teamName, teamCode, teamLogo, uploadLogo }: Props) => {
  const { iterations, isLoading, busy, addIteration, updateIteration, deleteIteration } =
    useTeamHistory(teamId);
  const { seasons } = useSeasons();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TeamIteration | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TeamIteration | null>(null);

  const isEditing = editTarget !== null;

  // Seasons belonging to this team's league, newest first
  const leagueSeasons = seasons
    .filter((s) => leagueId && s.league_id === leagueId)
    .sort((a, b) => {
      if (!a.start_date && !b.start_date) return 0;
      if (!a.start_date) return 1;
      if (!b.start_date) return -1;
      return b.start_date.localeCompare(a.start_date);
    });

  const seasonOptions = leagueSeasons.map((s) => ({
    value: s.id,
    label: seasonLabel(s.start_date, s.end_date, s.name),
  }));

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { name: '', code: '', logo: null, season_id: '', note: '' },
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
        season_id: editTarget.season_id ?? '',
        note: editTarget.note ?? '',
      });
    } else {
      reset({ name: teamName, code: teamCode, logo: teamLogo, season_id: '', note: '' });
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
      season_id: data.season_id || null,
      note: data.note || null,
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
            {iterations.map((iter, index) => {
              // iterations are newest-first; derive a year-range subtitle
              const startYear = iter.season_start_date?.slice(0, 4);
              const newerIter = iterations[index - 1]; // index-1 = the one that superseded this one
              const endYear =
                index === 0 ? 'present' : (newerIter?.season_start_date?.slice(0, 4) ?? 'present');
              const subtitle = startYear ? `${startYear} – ${endYear}` : undefined;
              return (
                <TeamListItem
                  key={iter.id}
                  logo={iter.logo}
                  name={iter.name}
                  code={iter.code}
                  subtitle={subtitle}
                  note={iter.note ?? undefined}
                  actions={
                    <>
                      <Button
                        variant="ghost"
                        intent="neutral"
                        icon="edit"
                        size="sm"
                        tooltip="Edit version"
                        disabled={busy}
                        onClick={() => openEdit(iter)}
                      />
                      <Button
                        variant="ghost"
                        intent="danger"
                        icon="delete"
                        size="sm"
                        tooltip="Delete version"
                        disabled={busy}
                        onClick={() => setDeleteTarget(iter)}
                      />
                    </>
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
        title={isEditing ? 'Edit Version' : 'Record Version'}
        onClose={closeModal}
      >
        <form
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
          <Field
            label="Season"
            type="select"
            control={control}
            name="season_id"
            options={seasonOptions}
            placeholder="— No season —"
          />
          <Field
            label="Note"
            type="textarea"
            control={control}
            name="note"
            placeholder="e.g. Rebranded after relocation"
            disabled={isSubmitting}
          />
          <div className={styles.historyFormActions}>
            <Button
              type="button"
              variant="outlined"
              intent="neutral"
              disabled={isSubmitting}
              onClick={closeModal}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              icon={isEditing ? 'edit' : 'history'}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Record Version'}
            </Button>
          </div>
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
