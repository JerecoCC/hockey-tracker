import { useMemo, useState } from 'react';
import Button from '../../../components/Button/Button';
import Icon from '../../../components/Icon/Icon';
import Table, { Column } from '../../../components/Table/Table';
import useSeasons, { SeasonRecord } from '../../../hooks/useSeasons';
import useLeagues from '../../../hooks/useLeagues';
import SeasonDeleteModal from './SeasonDeleteModal';
import SeasonFormModal from './SeasonFormModal';
import styles from './Seasons.module.scss';

const US_DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '—';
  // Use noon UTC (T12:00:00Z) so the date is always 7–8 AM Eastern — the
  // correct US calendar date regardless of the viewer's browser timezone.
  // Without the Z, local-noon in UTC+8+ shifts the UTC instant to the previous
  // day, causing the displayed Eastern date to be one day behind.
  return US_DATE_FORMAT.format(new Date(`${dateStr.slice(0, 10)}T12:00:00Z`));
};

const sortRows = <T,>(data: T[], key: string, dir: 'asc' | 'desc'): T[] =>
  [...data].sort((a, b) => {
    const av = String((a as Record<string, unknown>)[key] ?? '');
    const bv = String((b as Record<string, unknown>)[key] ?? '');
    const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
    return dir === 'asc' ? cmp : -cmp;
  });

const SeasonsPage = () => {
  const { seasons, loading, busy, addSeason, updateSeason, deleteSeason } = useSeasons();
  const { leagues } = useLeagues();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SeasonRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SeasonRecord | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string, dir: 'asc' | 'desc') => {
    setSortKey(key);
    setSortDir(dir);
  };

  const sortedSeasons = useMemo(
    () => sortRows(seasons, sortKey, sortDir),
    [seasons, sortKey, sortDir],
  );

  const columns: Column<SeasonRecord>[] = [
    { header: 'Season', key: 'name', sortable: true },
    {
      type: 'custom',
      header: 'League',
      align: 'center',
      render: (s) =>
        s.league_logo ? (
          <img
            src={s.league_logo}
            alt={s.league_name}
            title={s.league_name}
            className={styles.logoThumb}
          />
        ) : (
          <span
            className={styles.logoPlaceholder}
            title={s.league_name}
          >
            {s.league_code.slice(0, 3)}
          </span>
        ),
    },
    {
      type: 'custom',
      header: 'Start Date',
      align: 'center',
      sortable: true,
      sortKey: 'start_date',
      render: (s) => formatDate(s.start_date),
    },
    {
      type: 'custom',
      header: 'End Date',
      align: 'center',
      sortable: true,
      sortKey: 'end_date',
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
          data={sortedSeasons}
          rowKey={(s) => s.id}
          loading={loading}
          emptyMessage="No seasons yet. Add one to get started."
          activeSortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
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
