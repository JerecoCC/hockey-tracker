import { useState } from 'react';
import Button from '../../../components/Button/Button';
import Card from '../../../components/Card/Card';
import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal';
import Icon from '../../../components/Icon/Icon';
import ListItem, { type ListItemAction } from '../../../components/ListItem/ListItem';
import useTeamPlayers, { type TeamPlayerRecord } from '../../../hooks/useTeamPlayers';
import AddPlayersModal from './AddPlayersModal';
import styles from './TeamDetails.module.scss';

const POSITION_LABELS: Record<string, string> = {
  C: 'Center',
  LW: 'Left Wing',
  RW: 'Right Wing',
  D: 'Defenseman',
  G: 'Goalie',
};

interface Props {
  teamId: string;
  leagueId: string;
  latestSeasonId: string | null;
}

const TeamRosterTab = ({ teamId, leagueId, latestSeasonId }: Props) => {
  const { players, loading, busy, addPlayersToRoster, deletePlayer } = useTeamPlayers(teamId);
  const [query, setQuery] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TeamPlayerRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const existingPlayerIds = new Set(players.map((p) => p.id));

  const filtered = query.trim()
    ? players.filter((p) => {
        const q = query.trim().toLowerCase();
        const name = `${p.first_name} ${p.last_name}`.toLowerCase();
        const pos = (p.position ?? '').toLowerCase();
        return name.includes(q) || pos.includes(q);
      })
    : players;

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setIsDeleting(true);
    await deletePlayer(confirmDelete.id);
    setIsDeleting(false);
    setConfirmDelete(null);
  };

  return (
    <>
      <Card
        title="Roster"
        action={
          <Button
            intent="accent"
            icon="group_add"
            size="sm"
            onClick={() => setAddModalOpen(true)}
          >
            Add Players
          </Button>
        }
      >
        {loading ? (
          <p className={styles.rosterEmpty}>Loading…</p>
        ) : players.length === 0 ? (
          <p className={styles.rosterEmpty}>No players on this roster yet.</p>
        ) : (
          <>
            <div className={styles.rosterSearch}>
              <Icon
                name="search"
                size="1em"
                className={styles.rosterSearchIcon}
              />
              <input
                className={styles.rosterSearchInput}
                type="text"
                placeholder="Search players…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  className={styles.rosterSearchClear}
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                >
                  <Icon
                    name="close"
                    size="0.8em"
                  />
                </button>
              )}
            </div>

            {filtered.length === 0 ? (
              <p className={styles.rosterEmpty}>No players match "{query}".</p>
            ) : (
              <ul className={styles.rosterList}>
                {filtered.map((p) => (
                  <ListItem
                    key={p.id}
                    image={p.photo}
                    image_shape="circle"
                    name={`${p.jersey_number != null ? `#${p.jersey_number} ` : ''}${p.first_name} ${p.last_name}`}
                    placeholder={`${p.first_name[0]}${p.last_name[0]}`}
                    primaryColor={p.primary_color ?? undefined}
                    textColor={p.text_color ?? undefined}
                    subtitle={p.position ? (POSITION_LABELS[p.position] ?? p.position) : undefined}
                    rightContent={{
                      type: 'tag',
                      label: p.is_active ? 'Active' : 'Inactive',
                      intent: p.is_active ? 'success' : 'neutral',
                    }}
                    actions={
                      [
                        {
                          icon: 'delete',
                          intent: 'danger',
                          tooltip: 'Delete player',
                          disabled: busy === p.id,
                          onClick: () => setConfirmDelete(p),
                        },
                      ] satisfies ListItemAction[]
                    }
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </Card>

      <AddPlayersModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        teamId={teamId}
        leagueId={leagueId}
        latestSeasonId={latestSeasonId}
        existingPlayerIds={existingPlayerIds}
        addPlayersToRoster={addPlayersToRoster}
      />

      <ConfirmModal
        open={!!confirmDelete}
        title="Delete Player"
        body={
          confirmDelete ? (
            <>
              Are you sure you want to delete{' '}
              <strong>
                {confirmDelete.first_name} {confirmDelete.last_name}
              </strong>
              ? This cannot be undone.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Delete"
        confirmIcon="delete"
        variant="danger"
        busy={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
};

export default TeamRosterTab;
