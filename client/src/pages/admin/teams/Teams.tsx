import { useMemo, useState } from 'react';
import Button from '../../../components/Button/Button';
import Icon from '../../../components/Icon/Icon';
import Table, { Column } from '../../../components/Table/Table';
import useTeams, { TeamRecord } from '../../../hooks/useTeams';
import useLeagues, { LeagueRecord } from '../../../hooks/useLeagues';
import TeamDeleteModal from './TeamDeleteModal';
import TeamFormModal from './TeamFormModal';
import styles from './Teams.module.scss';

const sortRows = <T,>(data: T[], key: string, dir: 'asc' | 'desc'): T[] =>
  [...data].sort((a, b) => {
    const av = String((a as Record<string, unknown>)[key] ?? '');
    const bv = String((b as Record<string, unknown>)[key] ?? '');
    const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
    return dir === 'asc' ? cmp : -cmp;
  });

const TeamsPage = () => {
  const { teams, loading, busy, uploadLogo, addTeam, updateTeam, deleteTeam } = useTeams();
  const { leagues } = useLeagues();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TeamRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TeamRecord | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string, dir: 'asc' | 'desc') => {
    setSortKey(key);
    setSortDir(dir);
  };

  const leagueMap = leagues.reduce<Record<string, LeagueRecord>>((acc, l) => {
    acc[l.id] = l;
    return acc;
  }, {});

  const sortedTeams = useMemo(() => sortRows(teams, sortKey, sortDir), [teams, sortKey, sortDir]);

  const columns: Column<TeamRecord>[] = [
    {
      type: 'custom',
      header: 'Team',
      sortable: true,
      sortKey: 'name',
      render: (t) => (
        <div className={styles.logoWithName}>
          {t.logo ? (
            <img
              src={t.logo}
              alt=""
              className={styles.logoThumb}
            />
          ) : (
            <span className={styles.logoPlaceholder}>{t.code.slice(0, 3)}</span>
          )}
          {t.name}
        </div>
      ),
    },
    { header: 'Code', key: 'code', sortable: true },
    {
      type: 'custom',
      header: 'League',
      align: 'center',
      render: (t) => {
        const league = t.league_id ? leagueMap[t.league_id] : null;
        if (!league) return <span className={styles.noLeague}>—</span>;
        return league.logo ? (
          <img
            src={league.logo}
            alt={league.name}
            title={league.name}
            className={styles.logoThumb}
          />
        ) : (
          <span
            className={styles.logoPlaceholder}
            title={league.name}
          >
            {league.code.slice(0, 3)}
          </span>
        );
      },
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
          data={sortedTeams}
          rowKey={(t) => t.id}
          loading={loading}
          emptyMessage="No teams yet. Add one to get started."
          activeSortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
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
