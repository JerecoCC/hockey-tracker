import { useState } from 'react';
import Button from '../../../components/Button/Button';
import Icon from '../../../components/Icon/Icon';
import Table, { Column } from '../../../components/Table/Table';
import useSeasons, { SeasonRecord } from '../../../hooks/useSeasons';
import useLeagues from '../../../hooks/useLeagues';
import SeasonDeleteModal from './SeasonDeleteModal';
import SeasonFormModal from './SeasonFormModal';
import styles from './Seasons.module.scss';

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
};

const SeasonsPage = () => {
  const { seasons, loading, busy, addSeason, updateSeason, deleteSeason } = useSeasons();
  const { leagues } = useLeagues();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SeasonRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SeasonRecord | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const columns: Column<SeasonRecord>[] = [
    {
      type: 'logo',
      header: 'League',
      getLogo: (s) => s.league_logo,
      getName: (s) => s.league_name,
      getCode: (s) => s.league_code,
      align: 'center',
    },
    { header: 'League', key: 'league_name' },
    { header: 'Season', key: 'name' },
    {
      type: 'custom',
      header: 'Start Date',
      align: 'center',
      render: (s) => formatDate(s.start_date),
    },
    {
      type: 'custom',
      header: 'End Date',
      align: 'center',
      render: (s) => formatDate(s.end_date),
    },
    {
      type: 'custom',
      header: 'Actions',
      align: 'center',
      render: (s) => (
        <div className={styles.actions}>
          <Button
            variant="outlined"
            intent="accent"
            icon="edit"
            size="sm"
            title="Edit"
            disabled={busy === s.id}
            onClick={() => openEditModal(s)}
          />
          <Button
            variant="outlined"
            intent="danger"
            icon="delete"
            size="sm"
            title="Delete"
            disabled={busy === s.id}
            onClick={() => {
              setConfirmDelete(s);
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

  const openEditModal = (season: SeasonRecord) => {
    setEditTarget(season);
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
            name="calendar_month"
            size="1em"
          />{' '}
          Seasons
        </h2>
        <Button
          icon="add"
          onClick={openModal}
        >
          Add Season
        </Button>
      </div>

      <div className={styles.card}>
        <Table
          columns={columns}
          data={seasons}
          rowKey={(s) => s.id}
          loading={loading}
          emptyMessage="No seasons yet. Add one to get started."
        />
      </div>

      <SeasonDeleteModal
        open={confirmDeleteOpen}
        busy={busy}
        target={confirmDelete}
        onCancel={() => {
          setConfirmDeleteOpen(false);
          setConfirmDelete(null);
        }}
        onConfirm={async () => {
          await deleteSeason(confirmDelete!.id);
          setConfirmDeleteOpen(false);
          setConfirmDelete(null);
        }}
      />

      <SeasonFormModal
        open={modalOpen}
        editTarget={editTarget}
        leagueOptions={leagues.map((l) => ({
          value: l.id,
          label: l.name,
          logo: l.logo,
          code: l.code,
        }))}
        onClose={closeModal}
        addSeason={addSeason}
        updateSeason={updateSeason}
      />
    </main>
  );
};

export default SeasonsPage;

