import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/Button/Button';
import ToggleButton from '@/components/ToggleButton/ToggleButton';
import Card from '@/components/Card/Card';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import DatePicker from '@/components/DatePicker/DatePicker';
import useGames, { type GameRecord, type GameStatus, type GameType } from '@/hooks/useGames';
import GameListItem from './GameListItem';
import Select from '@/components/Select/Select';
import MultiSelect, { type MultiSelectOption } from '@/components/MultiSelect/MultiSelect';
import { type SeasonTeam } from '@/hooks/useSeasonDetails';
import type { SelectOption } from '@/components/Select/Select';
import BulkCreateGamesModal from './BulkCreateGamesModal';
import GameFormModal from './GameFormModal';
import styles from './SeasonGamesTab.module.scss';

// ── Display helpers ───────────────────────────────────────────────────────────

/** Converts a stored "HH:MM" string to "h:mm AM/PM EST/EDT" for display (DST-aware). */
const formatTime = (hhmm: string, scheduledAt?: string | null): string => {
  const [hStr, mStr] = hhmm.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return hhmm;
  const period = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const min = String(m).padStart(2, '0');
  const base = scheduledAt ? new Date(scheduledAt) : new Date();
  const etDatePart = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(
    base,
  );
  const abbr =
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' })
      .formatToParts(new Date(`${etDatePart}T12:00:00`))
      .find((p) => p.type === 'timeZoneName')?.value ?? 'ET';
  return `${hour12}:${min} ${period} ${abbr}`;
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

const STATUS_FILTER_OPTIONS: SelectOption[] = [
  { value: '', label: 'All Statuses' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'final', label: 'Final' },
  { value: 'postponed', label: 'Postponed' },
  { value: 'cancelled', label: 'Cancelled' },
];

// ── Week-navigation date helpers ─────────────────────────────────────────────

const toDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

const toLocalDateKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const dateToISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const fromISODate = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const fmtDayHeading = (key: string) => {
  const [y, mo, d] = key.split('-').map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
};

const SHORT_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const SHORT_FMT_YEAR = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const fmtWeekRange = (start: Date, end: Date) => {
  if (start.getFullYear() === end.getFullYear()) {
    return `${SHORT_FMT.format(start)} – ${SHORT_FMT_YEAR.format(end)}`;
  }
  return `${SHORT_FMT_YEAR.format(start)} – ${SHORT_FMT_YEAR.format(end)}`;
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
    label: t.name,
    logo: t.logo,
    code: t.code,
  }));

  const teamFilterOptions: MultiSelectOption[] = seasonTeams.map((t) => ({
    value: t.id,
    label: t.name,
    logo: t.logo,
    code: t.code,
  }));

  // ── Week navigation (with sessionStorage persistence) ────────────────────
  const weekKey = `season-games-week:${seasonId}`;
  const [weekStart, setWeekStartState] = useState<Date>(() => {
    const stored = sessionStorage.getItem(`season-games-week:${seasonId}`);
    return stored ? fromISODate(stored) : toDay(new Date());
  });
  const weekEnd = addDays(weekStart, 6);

  const setWeekStart = (updater: Date | ((d: Date) => Date)) => {
    setWeekStartState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      sessionStorage.setItem(weekKey, dateToISO(next));
      return next;
    });
  };

  // ── Filter state (with sessionStorage persistence) ────────────────────────
  const gameTypeKey = `season-games-type:${seasonId}`;
  const statusKey = `season-games-status:${seasonId}`;
  const teamKey = `season-games-team:${seasonId}`;

  const [gameTypeFilter, setGameTypeFilter] = useState(
    () => sessionStorage.getItem(gameTypeKey) ?? '',
  );
  const [statusFilter, setStatusFilter] = useState(() => sessionStorage.getItem(statusKey) ?? '');
  const [teamFilter, setTeamFilter] = useState<string[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(teamKey) ?? '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    sessionStorage.setItem(gameTypeKey, gameTypeFilter);
  }, [gameTypeKey, gameTypeFilter]);

  useEffect(() => {
    sessionStorage.setItem(statusKey, statusFilter);
  }, [statusKey, statusFilter]);

  useEffect(() => {
    sessionStorage.setItem(teamKey, JSON.stringify(teamFilter));
  }, [teamKey, teamFilter]);

  /** Games after type/status/team filters, earliest date/time first. */
  const filteredGames = useMemo(() => {
    return [...games]
      .filter((g) => {
        if (gameTypeFilter && g.game_type !== (gameTypeFilter as GameType)) return false;
        if (statusFilter && g.status !== (statusFilter as GameStatus)) return false;
        if (
          teamFilter.length > 0 &&
          !teamFilter.includes(g.home_team.id) &&
          !teamFilter.includes(g.away_team.id)
        )
          return false;
        return true;
      })
      .sort((a, b) => {
        if (!a.scheduled_at && !b.scheduled_at) return 0;
        if (!a.scheduled_at) return 1;
        if (!b.scheduled_at) return -1;
        if (a.scheduled_at !== b.scheduled_at) return a.scheduled_at < b.scheduled_at ? -1 : 1;
        if (!a.scheduled_time && !b.scheduled_time) return 0;
        if (!a.scheduled_time) return 1;
        if (!b.scheduled_time) return -1;
        return a.scheduled_time < b.scheduled_time ? -1 : 1;
      });
  }, [games, gameTypeFilter, statusFilter, teamFilter]);

  const hasActiveFilters = !!(gameTypeFilter || statusFilter || teamFilter.length > 0);

  /** Filtered games grouped into 7 day-slots for the current week window. */
  const groupedByDate = useMemo(() => {
    const map = new Map<string, GameRecord[]>();
    for (const g of filteredGames) {
      if (!g.scheduled_at) continue;
      const d = toDay(new Date(g.scheduled_at));
      if (d < weekStart || d > toDay(weekEnd)) continue;
      const key = toLocalDateKey(g.scheduled_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(g);
    }
    return Array.from({ length: 7 }, (_, i) => {
      const key = dateToISO(addDays(weekStart, i));
      return [key, map.get(key) ?? []] as [string, GameRecord[]];
    });
  }, [filteredGames, weekStart, weekEnd]);

  const [filtersVisible, setFiltersVisible] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formDate, setFormDate] = useState<string | null>(null);
  const [bulkDate, setBulkDate] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<GameRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<GameRecord | null>(null);

  const handleAdd = (date?: string) => {
    setEditTarget(null);
    setFormDate(date ?? null);
    setFormOpen(true);
  };

  const handleEdit = (game: GameRecord) => {
    setEditTarget(game);
    setFormDate(null);
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditTarget(null);
    setFormDate(null);
  };

  return (
    <>
      <Card
        noHeaderMargin
        title={
          <>
            Games
            <span className={styles.titleDivider} />
            <span className={styles.weekNav}>
              <Button
                variant="outlined"
                intent="neutral"
                icon="chevron_left"
                size="sm"
                onClick={() => setWeekStart((d) => addDays(d, -7))}
              />
              <div className={styles.datePicker}>
                <DatePicker
                  value={dateToISO(weekStart)}
                  onChange={(v) => setWeekStart(v ? fromISODate(v) : toDay(new Date()))}
                  triggerLabel={fmtWeekRange(weekStart, weekEnd)}
                  triggerAriaLabel={`Select week: ${fmtWeekRange(weekStart, weekEnd)}`}
                />
              </div>
              <Button
                variant="outlined"
                intent="neutral"
                icon="chevron_right"
                size="sm"
                onClick={() => setWeekStart((d) => addDays(d, 7))}
              />
            </span>
          </>
        }
        action={
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {!isEnded && (
              <>
                <Button
                  variant="outlined"
                  intent="accent"
                  icon="playlist_add"
                  onClick={() => setBulkDate('')}
                >
                  Bulk Create
                </Button>
                <Button
                  icon="add"
                  onClick={() => handleAdd()}
                >
                  Create Game
                </Button>
              </>
            )}
            <ToggleButton
              active={filtersVisible}
              onClick={() => setFiltersVisible((v) => !v)}
              icon="filter_list"
              iconHeight="button"
              activeTooltip="Hide filters"
              inactiveTooltip="Show filters"
            />
          </div>
        }
      >
        <div className={`${styles.filters}${filtersVisible ? '' : ` ${styles.filtersHidden}`}`}>
          <Select
            value={gameTypeFilter}
            options={GAME_TYPE_OPTIONS}
            onChange={setGameTypeFilter}
          />
          <Select
            value={statusFilter}
            options={STATUS_FILTER_OPTIONS}
            onChange={setStatusFilter}
          />
          <div className={styles.teamFilter}>
            <MultiSelect
              value={teamFilter}
              options={teamFilterOptions}
              placeholder="All Teams"
              emptyMessage="No teams in this season"
              onChange={setTeamFilter}
              searchable
            />
          </div>
        </div>
      </Card>

      {/* ── Day cards ── */}
      {loading ? (
        <p className={styles.empty}>Loading…</p>
      ) : (
        <div className={styles.dayList}>
          {groupedByDate.map(([dateKey, dayGames]) => (
            <Card
              key={dateKey}
              title={fmtDayHeading(dateKey)}
              action={
                !isEnded && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button
                      variant="outlined"
                      intent="accent"
                      icon="playlist_add"
                      size="sm"
                      tooltip="Bulk Create"
                      onClick={() => setBulkDate(dateKey)}
                    />
                    <Button
                      icon="add"
                      size="sm"
                      tooltip="Create Game"
                      onClick={() => handleAdd(dateKey)}
                    />
                  </div>
                )
              }
            >
              {dayGames.length === 0 ? (
                <p className={styles.dayEmpty}>
                  {hasActiveFilters ? 'No games match the filters.' : 'No games scheduled.'}
                </p>
              ) : (
                <ul className={styles.list}>
                  {dayGames.map((game) => (
                    <GameListItem
                      key={game.id}
                      href={`/admin/leagues/${leagueId}/seasons/${seasonId}/games/${game.id}`}
                      awayTeam={{
                        logo: game.away_team.logo,
                        code: game.away_team.code,
                        primaryColor: game.away_team.primary_color,
                        textColor: game.away_team.text_color,
                      }}
                      homeTeam={{
                        logo: game.home_team.logo,
                        code: game.home_team.code,
                        primaryColor: game.home_team.primary_color,
                        textColor: game.home_team.text_color,
                      }}
                      awayScore={game.away_score}
                      homeScore={game.home_score}
                      showScore={game.status === 'final' || game.status === 'in_progress'}
                      isFinal={game.status === 'final'}
                      statusLabel={formatStatusLabel(game)}
                      statusIntent={STATUS_INTENT[game.status]}
                      gameType={game.game_type}
                      time={
                        game.scheduled_time
                          ? formatTime(game.scheduled_time, game.scheduled_at)
                          : undefined
                      }
                      venue={game.venue ?? undefined}
                      round={game.playoff_round}
                      roundLabel={
                        game.playoff_round != null
                          ? (game.playoff_round_names?.[game.playoff_round] ?? null)
                          : null
                      }
                      gameNumberInSeries={game.game_number_in_series}
                      gameNumber={game.game_number}
                      actions={[
                        {
                          icon: 'open_in_new',
                          intent: 'neutral',
                          tooltip: 'View game',
                          onClick: () =>
                            navigate(
                              `/admin/leagues/${leagueId}/seasons/${seasonId}/games/${game.id}`,
                            ),
                        },
                        ...(!isEnded
                          ? [
                              {
                                icon: 'edit',
                                intent: 'neutral' as const,
                                tooltip: 'Edit game',
                                onClick: () => handleEdit(game),
                              },
                              game.status === 'scheduled' && {
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
          ))}
        </div>
      )}

      <BulkCreateGamesModal
        open={bulkDate !== null}
        defaultDate={bulkDate || undefined}
        seasonId={seasonId}
        seasonTeams={seasonTeams}
        teamOptions={teamOptions}
        bulkCreateGames={bulkCreateGames}
        onClose={() => setBulkDate(null)}
      />

      <GameFormModal
        open={formOpen}
        defaultDate={formDate ?? undefined}
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
            ? `Delete ${confirmDelete.away_team.code} @ ${confirmDelete.home_team.code}? This cannot be undone.`
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
