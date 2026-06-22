import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import ListItem, { type ListItemAction } from '@/components/ListItem/ListItem';
import useLeagues, { LeagueRecord } from '@/hooks/useLeagues';
import { buildLeagueDetailsPath } from '@/lib/routeSlugs';
import LeagueDeleteModal from './LeagueDeleteModal';
import LeagueFormModal from './LeagueFormModal';
import styles from './Leagues.module.scss';

const sortRows = <T,>(data: T[], key: string, dir: 'asc' | 'desc'): T[] =>
  [...data].sort((a, b) => {
    const av = String((a as Record<string, unknown>)[key] ?? '');
    const bv = String((b as Record<string, unknown>)[key] ?? '');
    const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
    return dir === 'asc' ? cmp : -cmp;
  });

const LeaguesPage = () => {
  const navigate = useNavigate();
  const { leagues, loading, busy, uploadLogo, addLeague, updateLeague, deleteLeague } =
    useLeagues();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LeagueRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LeagueRecord | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const sortedLeagues = useMemo(() => sortRows(leagues, 'name', 'asc'), [leagues]);

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
    <>
      <Card
        title="Leagues"
        action={
          <Button
            icon="add"
            size="sm"
            onClick={openModal}
          >
            Create League
          </Button>
        }
      >
        {loading ? (
          <p className={styles.emptyMsg}>Loading...</p>
        ) : sortedLeagues.length === 0 ? (
          <p className={styles.emptyMsg}>No leagues yet. Add one to get started.</p>
        ) : (
          <ul className={styles.leagueList}>
            {sortedLeagues.map((league) => {
              const leagueHref = buildLeagueDetailsPath({
                leagueCode: league.code,
                leagueId: league.id,
              });

              return (
                <ListItem
                  key={league.id}
                  image={league.logo}
                  placeholder={league.code.slice(0, 3)}
                  name={league.name}
                  rightContent={{ type: 'code', value: league.code }}
                  primaryColor={league.primary_color}
                  textColor={league.text_color}
                  href={leagueHref}
                  actions={
                    [
                      {
                        icon: 'open_in_new',
                        intent: 'neutral',
                        tooltip: 'View league',
                        onClick: () => navigate(leagueHref),
                      },
                      {
                        icon: 'edit',
                        intent: 'accent',
                        tooltip: 'Edit',
                        disabled: busy === league.id,
                        onClick: () => openEditModal(league),
                      },
                      {
                        icon: 'delete',
                        intent: 'danger',
                        tooltip: 'Delete',
                        disabled: busy === league.id,
                        onClick: () => {
                          setConfirmDelete(league);
                          setConfirmDeleteOpen(true);
                        },
                      },
                    ] satisfies ListItemAction[]
                  }
                />
              );
            })}
          </ul>
        )}
      </Card>

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
    </>
  );
};

export default LeaguesPage;
