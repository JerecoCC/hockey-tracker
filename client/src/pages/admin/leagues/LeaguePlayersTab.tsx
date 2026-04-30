import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import ListItem, { type ListItemAction } from '@/components/ListItem/ListItem';
import SearchableList from '@/components/SearchableList/SearchableList';
import Select from '@/components/Select/Select';
import { type LeagueSeasonRecord } from '@/hooks/useLeagueDetails';
import { type PlayerRecord } from '@/hooks/useLeaguePlayers';
import styles from './LeagueDetails.module.scss';

const POSITION_LABELS: Record<string, string> = {
  C: 'Center',
  LW: 'Left Wing',
  RW: 'Right Wing',
  D: 'Defense',
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

const LeaguePlayersTab = ({
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
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState<PlayerRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
        <SearchableList
          items={[...players].sort((a, b) =>
            `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`),
          )}
          filterFn={(p, q) => {
            const query = q.toLowerCase();
            const name = `${p.first_name} ${p.last_name}`.toLowerCase();
            const pos = (p.position ?? '').toLowerCase();
            const jersey = p.jersey_number != null ? String(p.jersey_number) : '';
            return (
              name.includes(query) || pos.includes(query) || jersey.startsWith(q.replace('#', ''))
            );
          }}
          renderItems={(filtered) => (
            <ul className={styles.teamList}>
              {filtered.map((p) => (
                <ListItem
                  key={p.id}
                  leadingImage={p.team_logo}
                  leadingImagePlaceholder={(p.team_name ?? '').slice(0, 3) || undefined}
                  leadingImagePrimaryColor={p.primary_color ?? undefined}
                  leadingImageTextColor={p.text_color ?? undefined}
                  image={p.photo}
                  image_shape="circle"
                  name={`${p.first_name} ${p.last_name}`}
                  placeholder={`${p.first_name[0]}${p.last_name[0]}`}
                  primaryColor={p.primary_color ?? undefined}
                  textColor={p.text_color ?? undefined}
                  eyebrow={
                    [
                      p.jersey_number != null ? `#${p.jersey_number}` : null,
                      p.position ? (POSITION_LABELS[p.position] ?? p.position) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || undefined
                  }
                  subtitle={p.team_name ?? undefined}
                  rightContent={{
                    type: 'tag',
                    label: p.is_active ? 'Active' : 'Inactive',
                    intent: p.is_active ? 'success' : 'neutral',
                  }}
                  actions={
                    [
                      {
                        icon: 'open_in_new',
                        intent: 'neutral',
                        tooltip: 'View player',
                        onClick: () => navigate(`/admin/players/${p.id}`),
                      },
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
          placeholder="Search players…"
          actions={
            <>
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
            </>
          }
          loading={loading}
          emptyMessage="No players in this league yet."
          noResultsMessage={(q) => `No players match "${q}".`}
        />
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

export default LeaguePlayersTab;
