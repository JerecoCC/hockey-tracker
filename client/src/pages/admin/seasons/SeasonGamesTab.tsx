import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../components/Button/Button';
import Card from '../../../components/Card/Card';
import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal';
import useGames, { type GameRecord, type GameStatus } from '../../../hooks/useGames';
import GameListItem from './GameListItem';
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
  in_progress: 'In Progress',
  final: 'Final',
  postponed: 'Postponed',
  cancelled: 'Cancelled',
};

const STATUS_INTENT: Record<GameStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  scheduled: 'info',
  in_progress: 'warning',
  final: 'success',
  postponed: 'warning',
  cancelled: 'danger',
};

const formatSubtitle = (game: GameRecord): string => {
  const parts: string[] = [];
  if (game.scheduled_at) parts.push(DATE_FMT.format(new Date(game.scheduled_at)));
  if (game.venue) parts.push(game.venue);
  return parts.join(' • ') || 'No date set';
};

const formatStatusLabel = (game: GameRecord): string => {
  if (game.status !== 'final') return STATUS_LABEL[game.status];
  // Prefer period_scores (source of truth) but fall back to stored columns for
  // legacy games that were created before goal tracking was introduced.
  if (game.shootout || game.period_scores.some((ps) => ps.period === 'SO')) return 'Final/SO';
  if ((game.overtime_periods ?? 0) > 0 || game.period_scores.some((ps) => ps.period === 'OT'))
    return 'Final/OT';
  return 'Final';
};

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  leagueId: string;
  seasonId: string;
  seasonTeams: SeasonTeam[];
  isEnded: boolean;
}

const SeasonGamesTab = ({ leagueId, seasonId, seasonTeams, isEnded }: Props) => {
  const navigate = useNavigate();
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
              <GameListItem
                key={game.id}
                awayTeam={{
                  logo: game.away_team_logo,
                  code: game.away_team_code,
                  primaryColor: game.away_team_primary_color,
                  textColor: game.away_team_text_color,
                }}
                homeTeam={{
                  logo: game.home_team_logo,
                  code: game.home_team_code,
                  primaryColor: game.home_team_primary_color,
                  textColor: game.home_team_text_color,
                }}
                awayScore={game.period_scores.reduce((s, ps) => s + ps.away_goals, 0)}
                homeScore={game.period_scores.reduce((s, ps) => s + ps.home_goals, 0)}
                showScore={game.status === 'final' || game.status === 'in_progress'}
                isFinal={game.status === 'final'}
                statusLabel={formatStatusLabel(game)}
                statusIntent={STATUS_INTENT[game.status]}
                subtitle={formatSubtitle(game)}
                actions={[
                  {
                    icon: 'open_in_new',
                    intent: 'neutral',
                    tooltip: 'View game',
                    onClick: () =>
                      navigate(`/admin/leagues/${leagueId}/seasons/${seasonId}/games/${game.id}`),
                  },
                  ...(!isEnded
                    ? [
                        {
                          icon: 'edit',
                          intent: 'neutral' as const,
                          tooltip: 'Edit game',
                          onClick: () => handleEdit(game),
                        },
                        {
                          icon: 'delete',
                          intent: 'danger' as const,
                          tooltip: 'Delete game',
                          onClick: () => setConfirmDelete(game),
                        },
                      ]
                    : []),
                ]}
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
