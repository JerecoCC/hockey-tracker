import { useState } from 'react';
import Button from '../../../components/Button/Button';
import Icon from '../../../components/Icon/Icon';
import Table, { Column } from '../../../components/Table/Table';
import useTeams, { TeamRecord } from '../../../hooks/useTeams';
import useLeagues, { LeagueRecord } from '../../../hooks/useLeagues';
import TeamDeleteModal from './TeamDeleteModal';
import TeamFormModal from './TeamFormModal';
import styles from './Teams.module.scss';

const TeamsPage = () => {
  const { teams, loading, busy, uploadLogo, addTeam, updateTeam, deleteTeam } = useTeams();
  const { leagues } = useLeagues();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TeamRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TeamRecord | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const leagueMap = leagues.reduce<Record<string, LeagueRecord>>((acc, l) => {
    acc[l.id] = l;
    return acc;
  }, {});

  const columns: Column<TeamRecord>[] = [
    {
      type: 'logo',
      header: 'Logo',
      getLogo: (t) => t.logo,
      getName: (t) => t.name,
      getCode: (t) => t.code,
      align: 'center',
    },
    { header: 'Code', key: 'code' },
    { header: 'Team', key: 'name' },

    {
      type: 'logo',
      header: 'League',
      getLogo: (t) => (t.league_id ? (leagueMap[t.league_id]?.logo ?? null) : null),
      getName: (t) => (t.league_id ? (leagueMap[t.league_id]?.name ?? '—') : '—'),
      getCode: (t) => (t.league_id ? (leagueMap[t.league_id]?.code ?? '—') : '—'),
      align: 'center',
    },
    {
      type: 'custom',
      header: 'Actions',
      align: 'center',
      render: (t) => (
        <div className={styles.actions}>
          <Button
            variant="outlined"
            intent="accent"
            icon="edit"
            size="sm"
            title="Edit"
            disabled={busy === t.id}
            onClick={() => openEditModal(t)}
          />
          <Button
            variant="outlined"
            intent="danger"
            icon="delete"
            size="sm"
            title="Delete"
            disabled={busy === t.id}
            onClick={() => {
              setConfirmDelete(t);
              setConfirmDeleteOpen(true);
            }}
          />
        </div>
      ),
    },
  ];

  const openModal = () => {
    setEditTarget(null);
    setModalOpen(true);
  };

  const openEditModal = (team: TeamRecord) => {
    setEditTarget(team);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditTarget(null);
  };

  return (
    <main className={styles.main}>
      <div className={styles.titleRow}>
        <h2 className={styles.sectionTitle}>
          <Icon
            name="groups"
            size="1em"
          />{' '}
          Teams
        </h2>
        <Button
          icon="add"
          onClick={openModal}
        >
          Add Team
        </Button>
      </div>

      <div className={styles.card}>
        <Table
          columns={columns}
          data={teams}
          rowKey={(t) => t.id}
          loading={loading}
          emptyMessage="No teams yet. Add one to get started."
        />
      </div>

      <TeamDeleteModal
        open={confirmDeleteOpen}
        busy={busy}
        target={confirmDelete}
        onCancel={() => {
          setConfirmDeleteOpen(false);
          setConfirmDelete(null);
        }}
        onConfirm={async () => {
          await deleteTeam(confirmDelete!.id);
          setConfirmDeleteOpen(false);
          setConfirmDelete(null);
        }}
      />

      <TeamFormModal
        open={modalOpen}
        editTarget={editTarget}
        leagueOptions={leagues.map((l) => ({
          value: l.id,
          label: l.name,
          logo: l.logo,
          code: l.code,
        }))}
        onClose={closeModal}
        addTeam={addTeam}
        updateTeam={updateTeam}
        uploadLogo={uploadLogo}
      />
    </main>
  );
};

export default TeamsPage;
