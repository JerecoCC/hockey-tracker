import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import Button from '../../../components/Button/Button';
import Card from '../../../components/Card/Card';
import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal';
import Field from '../../../components/Field/Field';
import LogoUpload from '../../../components/LogoUpload/LogoUpload';
import Modal from '../../../components/Modal/Modal';
import ListItem, { type ListItemAction } from '../../../components/ListItem/ListItem';
import useTeamHistory, { type TeamIteration } from '../../../hooks/useTeamHistory';
import useSeasons from '../../../hooks/useSeasons';
import { seasonLabel } from './TeamInfoGrid';
import styles from './TeamDetails.module.scss';

interface Props {
  teamId: string;
  leagueId: string | null;
  teamName: string;
  teamCode: string;
  teamLogo: string | null;
  primaryColor: string;
  textColor: string;
  startSeasonId: string | null;
  latestSeasonId: string | null;
  /** start_date of the team's first ever season (drives the subtitle start year) */
  startSeasonStartDate: string | null;
  /** end_date of the team's most recent season; null means still active (show "present") */
  latestSeasonEndDate: string | null;
  uploadLogo: (file: File) => Promise<string | null>;
}

interface FormValues {
  name: string;
  code: string;
  logo: File | string | null;
  note: string;
  start_season_id: string;
  latest_season_id: string;
}

const TeamHistoryTab = ({
  teamId,
  leagueId,
  teamName,
  teamCode,
  teamLogo,
  primaryColor,
  textColor,
  startSeasonId,
  latestSeasonId,
  startSeasonStartDate,
  latestSeasonEndDate,
  uploadLogo,
}: Props) => {
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
    defaultValues: {
      name: '',
      code: '',
      logo: null,
      note: '',
      start_season_id: '',
      latest_season_id: '',
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
    const teamStartId = startSeasonId ?? '';
    const teamLatestId = latestSeasonId ?? '';
    if (editTarget) {
      reset({
        name: editTarget.name,
        code: editTarget.code ?? '',
        logo: editTarget.logo,
        note: editTarget.note ?? '',
        start_season_id: teamStartId,
        latest_season_id: teamLatestId,
      });
    } else {
      reset({
        name: teamName,
        code: teamCode,
        logo: teamLogo,
        note: '',
        start_season_id: teamStartId,
        latest_season_id: teamLatestId,
      });
    }
  }, [modalOpen, editTarget, teamName, teamCode, teamLogo, startSeasonId, latestSeasonId, reset]);

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
      start_season_id: data.start_season_id || null,
      latest_season_id: data.latest_season_id || null,
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
              // Start year = first year of the team's starting season (team-level field).
              // End year   = second year of the team's latest season, or "present".
              const startYear = startSeasonStartDate?.slice(0, 4);
              const endYear = latestSeasonEndDate?.slice(0, 4) ?? 'present';
              const subtitle = startYear ? `${startYear} – ${endYear}` : undefined;
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
          <div className={styles.historyFormRow}>
            <Field
              label="Starting Season"
              type="select"
              control={control}
              name="start_season_id"
              options={seasonOptions}
              placeholder="— None —"
              disabled={isSubmitting}
            />
            <Field
              label="Latest Season"
              type="select"
              control={control}
              name="latest_season_id"
              options={seasonOptions}
              placeholder="— None —"
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
