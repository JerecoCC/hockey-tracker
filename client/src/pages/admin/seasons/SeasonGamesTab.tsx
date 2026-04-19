import { useState } from 'react';
import Button from '../../../components/Button/Button';
import Card from '../../../components/Card/Card';
import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal';
import ListItem, { type ListItemRightContent } from '../../../components/ListItem/ListItem';
import useGames, { type GameRecord, type GameStatus } from '../../../hooks/useGames';
import { type SeasonTeam } from '../../../hooks/useSeasonDetails';
import type { SelectOption } from '../../../components/Select/Select';
import BulkCreateGamesModal from './BulkCreateGamesModal';
import GameFormModal from './GameFormModal';
import styles from './SeasonGamesTab.module.scss';

// ── Display helpers ───────────────────────────────────────────────────────────

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const STATUS_LABEL: Record<GameStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'Live',
  final: 'Final',
  postponed: 'Postponed',
  cancelled: 'Cancelled',
};

const STATUS_INTENT = {
  scheduled: 'neutral',
  in_progress: 'warning',
  final: 'success',
  postponed: 'warning',
  cancelled: 'danger',
} as const;

const formatSubtitle = (game: GameRecord): string => {
  const parts: string[] = [];
  if (game.scheduled_at) parts.push(DATE_FMT.format(new Date(game.scheduled_at)));
  if (game.venue) parts.push(game.venue);
  return parts.join(' • ') || 'No date set';
};

const formatNote = (game: GameRecord): string | undefined => {
  if (game.status !== 'final') return undefined;
  const suffix = game.shootout ? ' (SO)' : (game.overtime_periods ?? 0) > 0 ? ' (OT)' : '';
  return `${game.game_type === 'regular' ? 'Regular' : game.game_type === 'playoff' ? 'Playoff' : 'Preseason'}${suffix}`;
};

const formatRightContent = (game: GameRecord): ListItemRightContent => {
  if (game.status === 'final') {
    const away = game.away_score ?? 0;
    const home = game.home_score ?? 0;
    return { type: 'tag', label: `${away} – ${home}`, intent: 'neutral' };
  }
  return { type: 'tag', label: STATUS_LABEL[game.status], intent: STATUS_INTENT[game.status] };
};

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  seasonId: string;
  seasonTeams: SeasonTeam[];
  isEnded: boolean;
}

const SeasonGamesTab = ({ seasonId, seasonTeams, isEnded }: Props) => {
  const { games, loading, busy, createGame, updateGame, deleteGame, bulkCreateGames } = useGames({
    seasonId,
  });

  const teamOptions: SelectOption[] = seasonTeams.map((t) => ({
    value: t.id,
    label: `${t.name} (${t.code})`,
  }));
  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<GameRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<GameRecord | null>(null);

  const handleAdd = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  const handleEdit = (game: GameRecord) => {
    setEditTarget(game);
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditTarget(null);
  };

  return (
    <>
      <Card
        title="Games"
        action={
          !isEnded && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button
                variant="outlined"
                intent="neutral"
                icon="playlist_add"
                onClick={() => setBulkOpen(true)}
              >
                Bulk Create
              </Button>
              <Button
                icon="add"
                onClick={handleAdd}
              >
                Create Game
              </Button>
            </div>
          )
        }
      >
        {loading ? (
          <p className={styles.empty}>Loading…</p>
        ) : games.length === 0 ? (
          <p className={styles.empty}>No games scheduled yet.</p>
        ) : (
          <ul className={styles.list}>
            {games.map((game) => (
              <ListItem
                key={game.id}
                hideImage
                name={`${game.away_team_code} @ ${game.home_team_code}`}
                subtitle={formatSubtitle(game)}
                note={formatNote(game)}
                rightContent={formatRightContent(game)}
                actions={
                  !isEnded
                    ? [
                        {
                          icon: 'edit',
                          intent: 'neutral',
                          tooltip: 'Edit game',
                          onClick: () => handleEdit(game),
                        },
                        {
                          icon: 'delete',
                          intent: 'danger',
                          tooltip: 'Delete game',
                          onClick: () => setConfirmDelete(game),
                        },
                      ]
                    : undefined
                }
              />
            ))}
          </ul>
        )}
      </Card>

      <BulkCreateGamesModal
        open={bulkOpen}
        seasonId={seasonId}
        seasonTeams={seasonTeams}
        teamOptions={teamOptions}
        bulkCreateGames={bulkCreateGames}
        onClose={() => setBulkOpen(false)}
      />

      <GameFormModal
        open={formOpen}
        seasonId={seasonId}
        editTarget={editTarget}
        seasonTeams={seasonTeams}
        createGame={createGame}
        updateGame={updateGame}
        onClose={handleFormClose}
      />

      <ConfirmModal
        open={confirmDelete !== null}
        title="Delete Game"
        body={
          confirmDelete
            ? `Delete ${confirmDelete.away_team_code} @ ${confirmDelete.home_team_code}? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        confirmIcon="delete"
        variant="danger"
        busy={busy === confirmDelete?.id}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (confirmDelete) await deleteGame(confirmDelete.id);
          setConfirmDelete(null);
        }}
      />
    </>
  );
};

export default SeasonGamesTab;
