import { useState } from 'react';
import Button from '../../../components/Button/Button';
import Card from '../../../components/Card/Card';
import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal';
import Icon from '../../../components/Icon/Icon';
import ListItem, { type ListItemAction } from '../../../components/ListItem/ListItem';
import Select from '../../../components/Select/Select';
import { type PlayerRecord } from '../../../hooks/useLeaguePlayers';
import { type LeagueSeasonRecord } from '../../../hooks/useLeagueDetails';
import styles from './LeagueDetails.module.scss';

const POSITION_LABELS: Record<string, string> = {
  C: 'Center',
  LW: 'Left Wing',
  RW: 'Right Wing',
  D: 'Defenseman',
  G: 'Goalie',
};

interface Props {
  players: PlayerRecord[];
  seasons: LeagueSeasonRecord[];
  selectedSeasonId: string | null;
  onSeasonChange: (id: string) => void;
  loading: boolean;
  busy: string | null;
  onAdd: () => void;
  onBulkAdd: () => void;
  onEdit: (player: PlayerRecord) => void;
  onDelete: (playerId: string) => Promise<void>;
  className?: string;
}

const LeaguePlayersCard = ({
  players,
  seasons,
  selectedSeasonId,
  onSeasonChange,
  loading,
  busy,
  onAdd,
  onBulkAdd,
  onEdit,
  onDelete,
  className,
}: Props) => {
  const [query, setQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<PlayerRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
    await onDelete(confirmDelete.id);
    setIsDeleting(false);
    setConfirmDelete(null);
  };

  return (
    <>
      <Card
        className={className}
        title="Players"
        action={
          seasons.length > 0 ? (
            <Select
              value={selectedSeasonId}
              options={seasons.map((s) => ({
                value: s.id,
                label: s.is_current ? `${s.name} ✦` : s.name,
              }))}
              onChange={onSeasonChange}
            />
          ) : undefined
        }
      >
        <>
          <div className={styles.playersToolbar}>
            <div className={styles.teamSearch}>
              <Icon
                name="search"
                size="1em"
                className={styles.teamSearchIcon}
              />
              <input
                className={styles.teamSearchInput}
                type="text"
                placeholder="Search players…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  className={styles.teamSearchClear}
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
            <Button
              variant="outlined"
              intent="neutral"
              icon="group_add"
              size="sm"
              onClick={onBulkAdd}
            >
              Bulk Create
            </Button>
            <Button
              icon="add"
              size="sm"
              onClick={onAdd}
            >
              Create Player
            </Button>
          </div>

          {loading ? (
            <p className={styles.teamsEmpty}>Loading…</p>
          ) : players.length === 0 ? (
            <p className={styles.teamsEmpty}>No players in this league yet.</p>
          ) : filtered.length === 0 ? (
            <p className={styles.teamsEmpty}>No players match "{query}".</p>
          ) : (
            <ul className={styles.teamList}>
              {filtered.map((p) => (
                <ListItem
                  key={p.id}
                  image={p.photo}
                  image_shape="circle"
                  name={`${p.jersey_number != null ? `#${p.jersey_number} ` : ''}${p.first_name} ${p.last_name}`}
                  placeholder={`${p.first_name[0]}${p.last_name[0]}`}
                  primaryColor={p.primary_color ?? undefined}
                  textColor={p.text_color ?? undefined}
                  subtitle={
                    [p.team_name, p.position ? (POSITION_LABELS[p.position] ?? p.position) : null]
                      .filter(Boolean)
                      .join(' • ') || undefined
                  }
                  rightContent={{
                    type: 'tag',
                    label: p.is_active ? 'Active' : 'Inactive',
                    intent: p.is_active ? 'success' : 'neutral',
                  }}
                  actions={
                    [
                      {
                        icon: 'edit',
                        intent: 'neutral',
                        tooltip: 'Edit player',
                        disabled: busy === p.id,
                        onClick: () => onEdit(p),
                      },
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
      </Card>

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

export default LeaguePlayersCard;
