import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/Button/Button';
import ToggleButton from '@/components/ToggleButton/ToggleButton';
import Card from '@/components/Card/Card';
import CalendarGameListItem from '@/components/CalendarGameListItem/CalendarGameListItem';
import MoreActionsMenu from '@/components/MoreActionsMenu/MoreActionsMenu';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import DatePicker from '@/components/DatePicker/DatePicker';
import MonthCalendar from '@/components/MonthCalendar/MonthCalendar';
import SegmentedControl from '@/components/SegmentedControl/SegmentedControl';
import useGames, { type GameRecord, type GameStatus, type GameType } from '@/hooks/useGames';
import GameListItem from './GameListItem';
import Select from '@/components/Select/Select';
import MultiSelect, { type MultiSelectOption } from '@/components/MultiSelect/MultiSelect';
import { type SeasonTeam } from '@/hooks/useSeasonDetails';
import type { SelectOption } from '@/components/Select/Select';
import BulkCreateGamesModal from './BulkCreateGamesModal';
import GameFormModal from './GameFormModal';
import { buildGameDetailsPath } from '@/lib/routeSlugs';
import Icon from '@/components/Icon/Icon';
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

const formatTimestampTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
};

const formatGameTime = (game: GameRecord): string | undefined => {
  if (game.status === 'final' && game.time_start && game.time_end) {
    return `${formatTimestampTime(game.time_start)} - ${formatTimestampTime(game.time_end)}`;
  }
  return game.scheduled_time ? formatTime(game.scheduled_time, game.scheduled_at) : undefined;
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

const MONTH_LABEL_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
});

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
const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);

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

const toMonthPickerValue = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const fromMonthPickerValue = (value: string) => {
  const [year, month] = value.split('-').map(Number);
  return new Date(year, month - 1, 1);
};

const fmtDayHeading = (key: string) => {
  const [y, mo, d] = key.split('-').map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
};

const fmtDaySummaryDate = (key: string) => {
  const [, mo, d] = key.split('-').map(Number);
  return `${mo}/${d}`;
};

const fmtDaySummaryWeekday = (key: string) => {
  const [y, mo, d] = key.split('-').map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
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

const getScrollParent = (el: HTMLElement): HTMLElement => {
  let parent = el.parentElement;
  while (parent) {
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === 'auto' || overflowY === 'scroll') return parent;
    parent = parent.parentElement;
  }
  return document.documentElement;
};

interface Props {
  leagueId: string;
  leagueCode: string | null | undefined;
  seasonId: string;
  seasonName: string | null | undefined;
  seasonTeams: SeasonTeam[];
  isEnded: boolean;
}

const SeasonGamesTab = ({
  leagueId,
  leagueCode,
  seasonId,
  seasonName,
  seasonTeams,
  isEnded,
}: Props) => {
  const navigate = useNavigate();

  const viewKey = `season-games-view:${seasonId}`;
  const [view, setView] = useState<'list' | 'calendar'>(() =>
    sessionStorage.getItem(`season-games-view:${seasonId}`) === 'calendar' ? 'calendar' : 'list',
  );
  const calendarMonthKey = `season-games-calendar-month:${seasonId}`;
  const [calendarMonth, setCalendarMonthState] = useState<Date>(() => {
    const stored = sessionStorage.getItem(`season-games-calendar-month:${seasonId}`);
    return stored ? fromMonthPickerValue(stored) : monthStart(new Date());
  });

  useEffect(() => {
    const stored = sessionStorage.getItem(viewKey);
    setView(stored === 'calendar' ? 'calendar' : 'list');
  }, [viewKey]);

  useEffect(() => {
    sessionStorage.setItem(viewKey, view);
  }, [viewKey, view]);

  useEffect(() => {
    const stored = sessionStorage.getItem(calendarMonthKey);
    setCalendarMonthState(stored ? fromMonthPickerValue(stored) : monthStart(new Date()));
  }, [calendarMonthKey]);

  const setCalendarMonth = (updater: Date | ((d: Date) => Date)) => {
    setCalendarMonthState((prev) => {
      const next = monthStart(typeof updater === 'function' ? updater(prev) : updater);
      sessionStorage.setItem(calendarMonthKey, toMonthPickerValue(next));
      return next;
    });
  };

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

  const { games, loading, busy, createGame, updateGame, deleteGame, bulkCreateGames } = useGames({
    seasonId,
    ...(view === 'calendar'
      ? { month: toMonthPickerValue(calendarMonth) }
      : { week: dateToISO(weekStart) }),
    gameType: gameTypeFilter ? (gameTypeFilter as GameType) : undefined,
    status: statusFilter ? (statusFilter as GameStatus) : undefined,
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

  /** Games after the remaining multi-team filter, earliest date/time first. */
  const filteredGames = useMemo(() => {
    return [...games]
      .filter((g) => {
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
  }, [games, teamFilter]);

  const hasActiveFilters = !!(gameTypeFilter || statusFilter || teamFilter.length > 0);

  /** Backend returns the week window; the UI only groups it into day slots. */
  const groupedByDate = useMemo(() => {
    const map = new Map<string, GameRecord[]>();
    for (let i = 0; i < 7; i++) {
      map.set(dateToISO(addDays(weekStart, i)), []);
    }
    for (const g of filteredGames) {
      if (!g.scheduled_at) continue;
      const key = toLocalDateKey(g.scheduled_at);
      map.get(key)?.push(g);
    }
    return Array.from(map.entries());
  }, [filteredGames, weekStart]);

  const calendarGamesByDate = useMemo(() => {
    const map = new Map<string, GameRecord[]>();
    for (const game of filteredGames) {
      if (!game.scheduled_at) continue;
      const key = toLocalDateKey(game.scheduled_at);
      const dayGames = map.get(key) ?? [];
      dayGames.push(game);
      map.set(key, dayGames);
    }
    return map;
  }, [filteredGames]);

  const [filtersVisible, setFiltersVisible] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formDate, setFormDate] = useState<string | null>(null);
  const [bulkDate, setBulkDate] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<GameRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<GameRecord | null>(null);
  const todayKey = dateToISO(toDay(new Date()));
  const initialSummaryDay = groupedByDate.some(([dateKey]) => dateKey === todayKey)
    ? todayKey
    : groupedByDate[0]?.[0];
  const [activeSummaryDay, setActiveSummaryDay] = useState<string | undefined>(initialSummaryDay);
  const dayRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    setActiveSummaryDay((current) => {
      if (current && groupedByDate.some(([dateKey]) => dateKey === current)) return current;
      return groupedByDate.some(([dateKey]) => dateKey === todayKey)
        ? todayKey
        : groupedByDate[0]?.[0];
    });
  }, [groupedByDate, todayKey]);

  const scrollToDay = (dateKey: string) => {
    setActiveSummaryDay(dateKey);
    dayRefs.current[dateKey]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (view !== 'list' || loading || groupedByDate.length === 0) return;
    const firstDayRef = dayRefs.current[groupedByDate[0][0]];
    if (!firstDayRef) return;

    const scrollEl = getScrollParent(firstDayRef);
    let frame = 0;

    const updateActiveDay = () => {
      const summaryCard = document.querySelector<HTMLElement>(`.${styles.weekSummaryCard}`);
      const marker = (summaryCard?.getBoundingClientRect().bottom ?? 0) + 1;
      let nextActive = groupedByDate[0][0];

      for (const [dateKey] of groupedByDate) {
        const dayNode = dayRefs.current[dateKey];
        if (!dayNode) continue;
        const rect = dayNode.getBoundingClientRect();
        if (rect.top <= marker) {
          nextActive = dateKey;
          continue;
        }
        if (rect.bottom > marker) break;
      }

      setActiveSummaryDay((current) => (current === nextActive ? current : nextActive));
    };

    const scheduleUpdate = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        updateActiveDay();
      });
    };

    scrollEl.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate, { passive: true });
    updateActiveDay();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      scrollEl.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [groupedByDate, loading, view]);

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

  const changeCalendarMonth = (value: string) => {
    if (!value) return;
    setCalendarMonth(fromMonthPickerValue(value));
  };

  const gameDetailsPath = (game: GameRecord) =>
    buildGameDetailsPath({
      leagueCode,
      leagueId,
      seasonName,
      seasonId,
      gameId: game.id,
      awayTeamCode: game.away_team.code,
      homeTeamCode: game.home_team.code,
      scheduledAt: game.scheduled_at,
    });

  const openGame = (game: GameRecord) => navigate(gameDetailsPath(game));

  // Compact game representation for a calendar day cell — mirrors the user games
  // calendar (away vs home in one row), clickable to open the game.
  const renderCalendarGamePill = (game: GameRecord) => {
    const showScore = game.status === 'final' || game.status === 'in_progress';
    const isFinal = game.status === 'final';
    const awayLost = isFinal && game.away_score < game.home_score;
    const homeLost = isFinal && game.home_score < game.away_score;
    return (
      <CalendarGameListItem
        key={game.id}
        href={gameDetailsPath(game)}
        tooltip={`${game.away_team.name} @ ${game.home_team.name}`}
        showScore={showScore}
        live={game.status === 'in_progress'}
        awayTeam={{
          logo: game.away_team.logo,
          code: game.away_team.code,
          primaryColor: game.away_team.primary_color,
          textColor: game.away_team.text_color,
          score: game.away_score,
          dimmed: awayLost,
        }}
        homeTeam={{
          logo: game.home_team.logo,
          code: game.home_team.code,
          primaryColor: game.home_team.primary_color,
          textColor: game.home_team.text_color,
          score: game.home_score,
          dimmed: homeLost,
        }}
      />
    );
  };

  const renderGameListItem = (game: GameRecord) => {
    return (
      <GameListItem
        key={game.id}
        href={gameDetailsPath(game)}
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
        time={formatGameTime(game)}
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
            onClick: () => openGame(game),
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
    );
  };

  return (
    <>
      <Card
        noHeaderMargin
        title={
          <>
            Games
            {view === 'list' && (
              <>
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
            )}
            {view === 'calendar' && (
              <>
                <span className={styles.titleDivider} />
                <span className={styles.weekNav}>
                  <Button
                    variant="outlined"
                    intent="neutral"
                    icon="chevron_left"
                    size="sm"
                    tooltip="Previous month"
                    aria-label="Previous month"
                    onClick={() => setCalendarMonth((current) => addMonths(current, -1))}
                  />
                  <div className={styles.datePicker}>
                    <DatePicker
                      value={toMonthPickerValue(calendarMonth)}
                      onChange={changeCalendarMonth}
                      granularity="month"
                      triggerLabel={MONTH_LABEL_FMT.format(calendarMonth)}
                      triggerAriaLabel={`Select month: ${MONTH_LABEL_FMT.format(calendarMonth)}`}
                    />
                  </div>
                  <Button
                    variant="outlined"
                    intent="neutral"
                    icon="chevron_right"
                    size="sm"
                    tooltip="Next month"
                    aria-label="Next month"
                    onClick={() => setCalendarMonth((current) => addMonths(current, 1))}
                  />
                </span>
              </>
            )}
          </>
        }
        action={
          <div className={styles.actionsRow}>
            <SegmentedControl
              value={view}
              onChange={(value) => setView(value as 'list' | 'calendar')}
              className={styles.viewSegmentedControl}
              options={[
                {
                  value: 'list',
                  label: <Icon name="view_list" />,
                  tooltip: 'List view',
                  ariaLabel: 'List view',
                },
                {
                  value: 'calendar',
                  label: <Icon name="calendar_month" />,
                  tooltip: 'Calendar view',
                  ariaLabel: 'Calendar view',
                },
              ]}
            />
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
      {!loading && view === 'list' && (
        <Card
          className={styles.weekSummaryCard}
          noHeaderMargin
        >
          <div className={styles.weekSummaryGrid}>
            {groupedByDate.map(([dateKey, dayGames]) => {
              const isActive = activeSummaryDay === dateKey;
              return (
                <button
                  key={dateKey}
                  type="button"
                  className={`${styles.weekSummaryDay}${isActive ? ` ${styles.weekSummaryDayActive}` : ''}`}
                  onClick={() => scrollToDay(dateKey)}
                  aria-label={`Jump to ${fmtDayHeading(dateKey)}: ${dayGames.length} games`}
                >
                  <span className={styles.weekSummaryDate}>{fmtDaySummaryDate(dateKey)}</span>
                  <span className={styles.weekSummaryWeekday}>{fmtDaySummaryWeekday(dateKey)}</span>
                  <span className={styles.weekSummaryCount}>
                    {dayGames.length} {dayGames.length === 1 ? 'Game' : 'Games'}
                  </span>
                  {isActive && (
                    <Icon
                      name="calendar_today"
                      className={styles.weekSummaryIcon}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {loading ? (
        <p className={styles.empty}>Loading…</p>
      ) : view === 'calendar' ? (
        <Card
          className={styles.calendarCard}
          noHeaderMargin
        >
          <div className={styles.calendarWrap}>
            <div className={styles.calendarScroll}>
              <MonthCalendar
                month={calendarMonth}
                getDayHeaderRight={({ dateKey }) =>
                  !isEnded ? (
                    <MoreActionsMenu
                      variant="ghost"
                      buttonClassName={styles.calendarDayActionButton}
                      items={[
                        {
                          label: 'Create Game',
                          icon: 'add',
                          onClick: () => handleAdd(dateKey),
                        },
                        {
                          label: 'Bulk Create',
                          icon: 'playlist_add',
                          onClick: () => setBulkDate(dateKey),
                        },
                      ]}
                    />
                  ) : undefined
                }
                renderDayContent={({ dateKey }) => {
                  const dayGames = calendarGamesByDate.get(dateKey) ?? [];
                  return dayGames.length > 0 ? (
                    <div className={styles.calendarGameList}>
                      {dayGames.map((game) => renderCalendarGamePill(game))}
                    </div>
                  ) : null;
                }}
              />
            </div>
          </div>
        </Card>
      ) : (
        <div className={styles.dayList}>
          {groupedByDate.map(([dateKey, dayGames]) => (
            <div
              key={dateKey}
              ref={(node) => {
                dayRefs.current[dateKey] = node;
              }}
              className={styles.dayCardAnchor}
            >
              <Card
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
                    {dayGames.map((game) => renderGameListItem(game))}
                  </ul>
                )}
              </Card>
            </div>
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
