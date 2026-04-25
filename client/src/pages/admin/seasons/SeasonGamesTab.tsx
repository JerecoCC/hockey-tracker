import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../components/Button/Button';
import Card from '../../../components/Card/Card';
import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal';
import useGames, { type GameRecord, type GameStatus, type GameType } from '../../../hooks/useGames';
import GameListItem from './GameListItem';
import Select from '../../../components/Select/Select';
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

/** Converts a stored "HH:MM" string to "h:mm AM/PM ET" for display. */
const formatTime = (hhmm: string): string => {
  const [hStr, mStr] = hhmm.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return hhmm;
  const period = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const min = String(m).padStart(2, '0');
  return `${hour12}:${min} ${period} ET`;
};

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

const formatStatusLabel = (game: GameRecord): string => {
  if (game.status !== 'final') return STATUS_LABEL[game.status];
  // Prefer period_scores (source of truth) but fall back to stored columns for
  // legacy games that were created before goal tracking was introduced.
  if (game.shootout || game.period_scores.some((ps) => ps.period === 'SO')) return 'Final/SO';
  if ((game.overtime_periods ?? 0) > 0 || game.period_scores.some((ps) => ps.period === 'OT'))
    return 'Final/OT';
  return 'Final';
};

// ── Filter options ────────────────────────────────────────────────────────────

const GAME_TYPE_OPTIONS: SelectOption[] = [
  { value: '', label: 'All Types' },
  { value: 'preseason', label: 'Pre-season' },
  { value: 'regular', label: 'Regular Season' },
  { value: 'playoff', label: 'Playoffs' },
];

const MONTH_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });

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

  // ── Filter state ───────────────────────────────────────────────────────────
  const [gameTypeFilter, setGameTypeFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');

  /** Month options derived from the fetched games (only months that have games). */
  const monthOptions = useMemo<SelectOption[]>(() => {
    const seen = new Set<string>();
    const months: SelectOption[] = [];
    [...games]
      .filter((g) => g.scheduled_at)
      .sort((a, b) => (a.scheduled_at! < b.scheduled_at! ? -1 : 1))
      .forEach((g) => {
        const ym = g.scheduled_at!.slice(0, 7); // "YYYY-MM"
        if (!seen.has(ym)) {
          seen.add(ym);
          const [y, m] = ym.split('-');
          const label = MONTH_FMT.format(new Date(Number(y), Number(m) - 1, 1));
          months.push({ value: ym, label });
        }
      });
    return [{ value: '', label: 'All Months' }, ...months];
  }, [games]);

  /** Games after both filters are applied. */
  const filteredGames = useMemo(
    () =>
      games.filter((g) => {
        if (gameTypeFilter && g.game_type !== (gameTypeFilter as GameType)) return false;
        if (monthFilter && (g.scheduled_at?.slice(0, 7) ?? '') !== monthFilter) return false;
        return true;
      }),
    [games, gameTypeFilter, monthFilter],
  );

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
        {/* ── Filters ── */}
        <div className={styles.filters}>
          <Select
            value={gameTypeFilter}
            options={GAME_TYPE_OPTIONS}
            onChange={setGameTypeFilter}
          />
          <Select
            value={monthFilter}
            options={monthOptions}
            onChange={setMonthFilter}
          />
        </div>

        {loading ? (
          <p className={styles.empty}>Loading…</p>
        ) : games.length === 0 ? (
          <p className={styles.empty}>No games scheduled yet.</p>
        ) : filteredGames.length === 0 ? (
          <p className={styles.empty}>No games match the selected filters.</p>
        ) : (
          <ul className={styles.list}>
            {filteredGames.map((game) => (
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
                date={game.scheduled_at ? DATE_FMT.format(new Date(game.scheduled_at)) : undefined}
                time={game.scheduled_time ? formatTime(game.scheduled_time) : undefined}
                venue={game.venue ?? undefined}
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
