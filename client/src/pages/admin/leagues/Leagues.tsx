import { useState } from 'react';
import Button from '../../../components/Button/Button';
import Icon from '../../../components/Icon/Icon';
import Table, { Column } from '../../../components/Table/Table';
import useLeagues, { LeagueRecord } from '../../../hooks/useLeagues';
import LeagueDeleteModal from './LeagueDeleteModal';
import LeagueFormModal from './LeagueFormModal';
import styles from './Leagues.module.scss';

const LeaguesPage = () => {
  const { leagues, loading, busy, uploadLogo, addLeague, updateLeague, deleteLeague } =
    useLeagues();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LeagueRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LeagueRecord | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const columns: Column<LeagueRecord>[] = [
    {
      type: 'custom',
      header: 'League',
      render: (l) => (
        <div className={styles.logoWithName}>
          {l.logo ? (
            <img
              src={l.logo}
              alt=""
              className={styles.logoThumb}
            />
          ) : (
            <span className={styles.logoPlaceholder}>{l.code.slice(0, 3)}</span>
          )}
          {l.name}
        </div>
      ),
    },
    { header: 'Code', key: 'code' },
    {
      type: 'custom',
      header: 'Actions',
      align: 'center',
      render: (l) => (
        <div className={styles.actions}>
          <Button
            variant="outlined"
            intent="accent"
            icon="edit"
            size="sm"
            title="Edit"
            disabled={busy === l.id}
            onClick={() => openEditModal(l)}
          />
          <Button
            variant="outlined"
            intent="danger"
            icon="delete"
            size="sm"
            title="Delete"
            disabled={busy === l.id}
            onClick={() => {
              setConfirmDelete(l);
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

  const openEditModal = (league: LeagueRecord) => {
    setEditTarget(league);
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
            name="emoji_events"
            size="1em"
          />{' '}
          Leagues
        </h2>
        <Button
          icon="add"
          onClick={openModal}
        >
          Add League
        </Button>
      </div>

      <div className={styles.card}>
        <Table
          columns={columns}
          data={leagues}
          rowKey={(l) => l.id}
          loading={loading}
          emptyMessage="No leagues yet. Add one to get started."
        />
      </div>

      <LeagueDeleteModal
        open={confirmDeleteOpen}
        busy={busy}
        target={confirmDelete}
        onCancel={() => {
          setConfirmDeleteOpen(false);
          setConfirmDelete(null);
        }}
        onConfirm={async () => {
          await deleteLeague(confirmDelete!.id);
          setConfirmDeleteOpen(false);
          setConfirmDelete(null);
        }}
      />

      <LeagueFormModal
        open={modalOpen}
        editTarget={editTarget}
        onClose={closeModal}
        addLeague={addLeague}
        updateLeague={updateLeague}
        uploadLogo={uploadLogo}
      />
    </main>
  );
};

export default LeaguesPage;
