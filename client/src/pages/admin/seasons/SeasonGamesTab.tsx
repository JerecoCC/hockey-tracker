import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast, type TypeOptions } from 'react-toastify';
import Button from '@/components/Button/Button';
import ToggleButton from '@/components/ToggleButton/ToggleButton';
import Section from '@/components/Section/Section';
import CalendarGameListItem from '@/components/CalendarGameListItem/CalendarGameListItem';
import MoreActionsMenu from '@/components/MoreActionsMenu/MoreActionsMenu';
import MonthCalendar from '@/components/MonthCalendar/MonthCalendar';
import PeriodPicker from '@/components/PeriodPicker/PeriodPicker';
import {
  ScheduleCalendarCard,
  ScheduleCalendarDayCount,
  ScheduleCalendarGameList,
  ScheduleCalendarLoading,
  ScheduleFilters,
  ScheduleFilterSlot,
  ScheduleGamesActions,
  ScheduleGamesTitle,
  ScheduleWeekList,
  ScheduleWeekSummary,
  scheduleCalendarDayActionButtonClassName,
  scheduleViewSegmentedControlClassName,
  useScheduleWeekSummaryStuck,
} from '@/components/ScheduleGamesLayout/ScheduleGamesLayout';
import SegmentedControl from '@/components/SegmentedControl/SegmentedControl';
import Skeleton from '@/components/Skeleton/Skeleton';
import useGames, { type GameRecord, type GameStatus, type GameType } from '@/hooks/useGames';
import GameCard from '@/components/GameCard/GameCard';
import Select from '@/components/Select/Select';
import MultiSelect, { type MultiSelectOption } from '@/components/MultiSelect/MultiSelect';
import { type SeasonTeam } from '@/hooks/useSeasonDetails';
import type { SelectOption } from '@/components/Select/Select';
import BulkCreateGamesModal from './BulkCreateGamesModal';
import GameFormModal from './GameFormModal';
import { autofillGameFromNhlGamecenter } from '@/pages/admin/games/game-details/nhlGameAutofill';
import { buildGameDetailsPath } from '@/lib/routeSlugs';
import Icon from '@/components/Icon/Icon';
import {
  firstWeekStartForMonth,
  majorityMonthForWeek,
  toEasternDateKey,
  weekBelongsToCalendarMonth,
} from './seasonDateUtils';
import styles from './SeasonGamesTab.module.scss';

const API = import.meta.env.VITE_API_URL || '/api';
const SEASON_WEEK_SUMMARY_STICKY_TOP = '52px';
const SEASON_WEEK_SUMMARY_STICKY_TOP_PX = 52;
const SEASON_WEEK_SUMMARY_ACTIVE_MARKER_OFFSET_PX = 8;
const SEASON_WEEK_SUMMARY_SCROLL_SETTLE_MS = 180;

const getSeasonWeekSummaryActiveMarker = (summaryCard: HTMLDivElement | null): number =>
  (summaryCard?.getBoundingClientRect().bottom ?? SEASON_WEEK_SUMMARY_STICKY_TOP_PX) +
  SEASON_WEEK_SUMMARY_ACTIVE_MARKER_OFFSET_PX;

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const getErrorMessage = (err: unknown, fallback = 'Something went wrong'): string => {
  const responseError = (err as AxiosError<{ error?: string }>).response?.data?.error;
  if (responseError) return responseError;

  const aggregateErrors = (err as { errors?: unknown[] }).errors;
  if (Array.isArray(aggregateErrors) && aggregateErrors.length > 0) {
    const messages = aggregateErrors.map((nested) => getErrorMessage(nested, '')).filter(Boolean);
    if (messages.length > 0) return messages.join('; ');
  }

  if (err instanceof Error) {
    const cause = (err as Error & { cause?: unknown }).cause;
    const causeMessage = cause && cause !== err ? getErrorMessage(cause, '') : '';
    if (err.message && causeMessage && !err.message.includes(causeMessage)) {
      return `${err.message}: ${causeMessage}`;
    }
    return err.message || causeMessage || fallback;
  }

  return typeof err === 'string' && err ? err : fallback;
};

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

const MONTH_LABEL_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
});

const shouldShowGameScore = (game: GameRecord) =>
  game.status === 'final' ||
  game.status === 'in_progress' ||
  game.away_score > 0 ||
  game.home_score > 0;

interface NhlScheduleTeam {
  abbrev?: string;
}

interface NhlScheduleGame {
  id?: number;
  gameDate?: string;
  awayTeam?: NhlScheduleTeam;
  homeTeam?: NhlScheduleTeam;
}

interface NhlScheduleDay {
  date: string;
  games?: NhlScheduleGame[];
}

interface NhlScheduleResponse {
  gameWeek?: NhlScheduleDay[];
  games?: NhlScheduleGame[];
}

const normalizeCode = (value: string | null | undefined) => value?.trim().toUpperCase() ?? '';

const nhlScheduleKey = (
  dateKey: string,
  awayCode: string | null | undefined,
  homeCode: string | null | undefined,
) => `${dateKey}|${normalizeCode(awayCode)}|${normalizeCode(homeCode)}`;

const isNhlGame = (game: GameRecord, leagueCode: string | null | undefined) =>
  normalizeCode(game.league_code ?? leagueCode) === 'NHL';

const isDayAutofillCandidate = (game: GameRecord, leagueCode: string | null | undefined) =>
  isNhlGame(game, leagueCode) &&
  !!game.scheduled_at &&
  (game.status === 'scheduled' ||
    game.status === 'in_progress' ||
    (game.status === 'final' && (!game.time_start || !game.time_end)));

const fetchNhlScheduleIndex = async (dateKey: string) => {
  const { data } = await axios.get<NhlScheduleResponse>(`${API}/admin/games/nhl-api`, {
    headers: authHeaders(),
    params: { url: `https://api-web.nhle.com/v1/schedule/${dateKey}` },
  });
  const index = new Map<string, string>();
  const days = [
    ...(data.gameWeek ?? []),
    ...(data.games ? [{ date: dateKey, games: data.games }] : []),
  ];

  for (const day of days) {
    for (const game of day.games ?? []) {
      if (!game.id || !game.awayTeam?.abbrev || !game.homeTeam?.abbrev) continue;
      index.set(
        nhlScheduleKey(game.gameDate ?? day.date, game.awayTeam.abbrev, game.homeTeam.abbrev),
        String(game.id),
      );
    }
  }

  return index;
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
];

// ── Week-navigation date helpers ─────────────────────────────────────────────

const toDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);

const nhlScheduleDateKeys = (game: GameRecord) => {
  const scheduledAt = game.scheduled_at;
  if (!scheduledAt) return [];
  const easternDate = toEasternDateKey(scheduledAt);
  return Array.from(new Set([easternDate].filter((dateKey): dateKey is string => !!dateKey)));
};

const compareOptionalStringAsc = (
  left: string | null | undefined,
  right: string | null | undefined,
) => {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  if (left === right) return 0;
  return left < right ? -1 : 1;
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

type SeasonGamesView = 'list' | 'calendar';

const SeasonGamesTab = ({
  leagueId,
  leagueCode,
  seasonId,
  seasonName,
  seasonTeams,
  isEnded,
}: Props) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [view, setView] = useState<SeasonGamesView>('list');
  const calendarMonthKey = `season-games-calendar-month:${seasonId}`;
  const [calendarMonth, setCalendarMonthState] = useState<Date>(() => {
    const stored = sessionStorage.getItem(`season-games-calendar-month:${seasonId}`);
    return stored ? fromMonthPickerValue(stored) : monthStart(new Date());
  });

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

  const handleViewChange = (nextView: SeasonGamesView) => {
    if (nextView === view) return;
    if (nextView === 'list') {
      if (!weekBelongsToCalendarMonth(weekStart, calendarMonth)) {
        setWeekStart(firstWeekStartForMonth(calendarMonth));
      }
    } else {
      setCalendarMonth(majorityMonthForWeek(weekStart));
    }
    setView(nextView);
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

  const { games, loading, createGame, updateGame, bulkCreateGames } = useGames({
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
        const scheduledAtOrder = compareOptionalStringAsc(a.scheduled_at, b.scheduled_at);
        if (scheduledAtOrder !== 0) return scheduledAtOrder;
        const scheduledTimeOrder = compareOptionalStringAsc(a.scheduled_time, b.scheduled_time);
        if (scheduledTimeOrder !== 0) return scheduledTimeOrder;
        const startTimeOrder = compareOptionalStringAsc(a.time_start, b.time_start);
        if (startTimeOrder !== 0) return startTimeOrder;
        return compareOptionalStringAsc(a.time_end, b.time_end);
      });
  }, [games, teamFilter]);

  const hasActiveFilters = !!(gameTypeFilter || statusFilter || teamFilter.length > 0);
  const gameDateKey = useCallback(
    (game: GameRecord) => (game.scheduled_at ? toEasternDateKey(game.scheduled_at) : null),
    [],
  );

  /** Backend returns the week window; the UI only groups it into day slots. */
  const groupedByDate = useMemo(() => {
    const map = new Map<string, GameRecord[]>();
    for (let i = 0; i < 7; i++) {
      map.set(dateToISO(addDays(weekStart, i)), []);
    }
    for (const g of filteredGames) {
      if (!g.scheduled_at) continue;
      const key = gameDateKey(g);
      if (!key) continue;
      map.get(key)?.push(g);
    }
    return Array.from(map.entries());
  }, [filteredGames, gameDateKey, weekStart]);

  const calendarGamesByDate = useMemo(() => {
    const map = new Map<string, GameRecord[]>();
    for (const game of filteredGames) {
      if (!game.scheduled_at) continue;
      const key = gameDateKey(game);
      if (!key) continue;
      const dayGames = map.get(key) ?? [];
      dayGames.push(game);
      map.set(key, dayGames);
    }
    return map;
  }, [filteredGames, gameDateKey]);

  const [filtersVisible, setFiltersVisible] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formDate, setFormDate] = useState<string | null>(null);
  const [bulkDate, setBulkDate] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<GameRecord | null>(null);
  const [autofillDay, setAutofillDay] = useState<string | null>(null);
  const [autofillingGameIds, setAutofillingGameIds] = useState<Set<string>>(() => new Set());
  const todayKey = dateToISO(toDay(new Date()));
  const initialSummaryDay = groupedByDate.some(([dateKey]) => dateKey === todayKey)
    ? todayKey
    : groupedByDate[0]?.[0];
  const [activeSummaryDay, setActiveSummaryDay] = useState<string | undefined>(initialSummaryDay);
  const dayRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const weekSummarySentinelRef = useRef<HTMLDivElement>(null);
  const weekSummaryCardRef = useRef<HTMLDivElement>(null);
  const weekSummaryScrollTargetRef = useRef<string | null>(null);
  const weekSummaryScrollTimeoutRef = useRef<number | null>(null);
  const isWeekSummaryStuck = useScheduleWeekSummaryStuck({
    active: view === 'list',
    sentinelRef: weekSummarySentinelRef,
    stickyTopPx: SEASON_WEEK_SUMMARY_STICKY_TOP_PX,
  });

  useEffect(() => {
    setActiveSummaryDay((current) => {
      if (current && groupedByDate.some(([dateKey]) => dateKey === current)) return current;
      return groupedByDate.some(([dateKey]) => dateKey === todayKey)
        ? todayKey
        : groupedByDate[0]?.[0];
    });
  }, [groupedByDate, todayKey]);

  const clearWeekSummaryScrollTarget = () => {
    weekSummaryScrollTargetRef.current = null;
    if (weekSummaryScrollTimeoutRef.current !== null) {
      window.clearTimeout(weekSummaryScrollTimeoutRef.current);
      weekSummaryScrollTimeoutRef.current = null;
    }
  };

  const holdWeekSummaryScrollTarget = (dateKey: string) => {
    weekSummaryScrollTargetRef.current = dateKey;
    if (weekSummaryScrollTimeoutRef.current !== null) {
      window.clearTimeout(weekSummaryScrollTimeoutRef.current);
    }
    weekSummaryScrollTimeoutRef.current = window.setTimeout(() => {
      clearWeekSummaryScrollTarget();
    }, SEASON_WEEK_SUMMARY_SCROLL_SETTLE_MS);
  };

  const scrollToDay = (dateKey: string) => {
    const dayNode = dayRefs.current[dateKey];
    setActiveSummaryDay(dateKey);
    if (!dayNode) {
      clearWeekSummaryScrollTarget();
      return;
    }
    holdWeekSummaryScrollTarget(dateKey);
    dayNode.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (view !== 'list' || loading || groupedByDate.length === 0) return;
    const firstDayRef = dayRefs.current[groupedByDate[0][0]];
    if (!firstDayRef) return;

    const scrollEl = getScrollParent(firstDayRef);
    let frame = 0;

    const updateActiveDay = () => {
      const marker = getSeasonWeekSummaryActiveMarker(weekSummaryCardRef.current);
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
      const scrollTarget = weekSummaryScrollTargetRef.current;
      if (scrollTarget) {
        holdWeekSummaryScrollTarget(scrollTarget);
        return;
      }
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
      clearWeekSummaryScrollTarget();
      scrollEl.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [groupedByDate, loading, view]);

  const handleAdd = (date?: string) => {
    setEditTarget(null);
    setFormDate(date ?? null);
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

  const getDayAutofillCandidates = (dayGames: GameRecord[]) =>
    dayGames.filter((game) => isDayAutofillCandidate(game, leagueCode));

  const describeGame = (game: GameRecord) => `${game.away_team.code} @ ${game.home_team.code}`;

  const revealAutofilledGame = (gameId: string) => {
    setAutofillingGameIds((current) => {
      const next = new Set(current);
      next.delete(gameId);
      return next;
    });
  };

  const refreshAutofilledGame = async (gameId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['games', gameId] }),
      queryClient.refetchQueries({ queryKey: ['games'], type: 'active' }),
    ]);
  };

  const handleAutofillDay = async (dateKey: string, dayGames: GameRecord[]) => {
    const candidates = getDayAutofillCandidates(dayGames);
    if (candidates.length === 0) {
      toast.info('No scheduled NHL games to auto-fill for this day.');
      return;
    }

    setAutofillDay(dateKey);
    setAutofillingGameIds(new Set(candidates.map((game) => game.id)));
    const failures: string[] = [];
    let filled = 0;
    const dayLabel = fmtDayHeading(dateKey);
    const totalProgressSteps = candidates.length + 1;
    const progressToastId = toast.loading(
      `Auto-filling NHL games for ${dayLabel}: loading schedule...`,
      {
        autoClose: false,
        closeButton: false,
        closeOnClick: false,
        draggable: false,
        hideProgressBar: false,
        pauseOnHover: false,
        progress: 0,
        progressClassName: styles.dayAutofillProgressBar,
      },
    );

    const updateProgressToast = (completedSteps: number, message: string) => {
      toast.update(progressToastId, {
        render: message,
        isLoading: true,
        autoClose: false,
        closeButton: false,
        closeOnClick: false,
        draggable: false,
        hideProgressBar: false,
        pauseOnHover: false,
        progress: Math.min(completedSteps / totalProgressSteps, 0.98),
        progressClassName: styles.dayAutofillProgressBar,
      });
    };

    const finishProgressToast = (type: TypeOptions, message: string) => {
      toast.update(progressToastId, {
        render: message,
        type,
        isLoading: false,
        autoClose: 4000,
        closeButton: true,
        closeOnClick: true,
        draggable: true,
        hideProgressBar: true,
        pauseOnHover: true,
        progress: 1,
        progressClassName: styles.dayAutofillProgressBar,
      });
    };

    try {
      const scheduleDates = Array.from(
        new Set(candidates.flatMap((game) => nhlScheduleDateKeys(game))),
      );
      const scheduleIndexes = await Promise.all(scheduleDates.map(fetchNhlScheduleIndex));
      const scheduleIndex = new Map<string, string>();
      for (const index of scheduleIndexes) {
        for (const entry of index) scheduleIndex.set(entry[0], entry[1]);
      }
      updateProgressToast(
        1,
        `Auto-filling NHL games for ${dayLabel}: schedule loaded. 0/${candidates.length} games processed.`,
      );

      for (const [index, game] of candidates.entries()) {
        updateProgressToast(
          index + 1,
          `Auto-filling ${describeGame(game)} (${index + 1}/${candidates.length})...`,
        );
        const scheduleKeys = nhlScheduleDateKeys(game).map((candidateDateKey) =>
          nhlScheduleKey(candidateDateKey, game.away_team.code, game.home_team.code),
        );
        const nhlGameId =
          scheduleKeys.map((scheduleKey) => scheduleIndex.get(scheduleKey)).find(Boolean) ??
          (game.game_number ? String(game.game_number) : null);

        if (!nhlGameId) {
          const dateKeys = nhlScheduleDateKeys(game);
          failures.push(
            `${describeGame(game)}: no NHL schedule match${
              dateKeys.length > 0 ? ` for ${dateKeys.join(' or ')}` : ''
            }`,
          );
          updateProgressToast(
            index + 2,
            `Skipped ${describeGame(game)} (${index + 1}/${candidates.length}).`,
          );
          revealAutofilledGame(game.id);
          continue;
        }

        try {
          await autofillGameFromNhlGamecenter(game, nhlGameId);
          filled += 1;
          await refreshAutofilledGame(game.id);
          updateProgressToast(
            index + 2,
            `Auto-filled ${describeGame(game)} (${index + 1}/${candidates.length}).`,
          );
        } catch (err) {
          const message = getErrorMessage(err, 'Auto-fill failed');
          failures.push(`${describeGame(game)}: ${message}`);
          console.warn(`NHL day auto-fill skipped ${describeGame(game)}`, err);
          updateProgressToast(
            index + 2,
            `Skipped ${describeGame(game)} (${index + 1}/${candidates.length}).`,
          );
        } finally {
          revealAutofilledGame(game.id);
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['games'] });

      if (failures.length > 0) {
        console.warn('NHL day auto-fill skipped games:', failures);
      }

      if (failures.length === 0) {
        finishProgressToast(
          'success',
          `Auto-filled ${filled} NHL game${filled === 1 ? '' : 's'} for ${dayLabel}.`,
        );
      } else if (filled > 0) {
        finishProgressToast(
          'info',
          `Auto-filled ${filled} NHL game${filled === 1 ? '' : 's'}; skipped ${failures.length}. First skipped: ${failures[0]}`,
        );
      } else {
        finishProgressToast(
          'error',
          `No NHL games were auto-filled. First skipped: ${failures[0] ?? 'check the console for details.'}`,
        );
      }
    } catch (err) {
      finishProgressToast(
        'error',
        getErrorMessage(err, 'Failed to load the NHL schedule for this day.'),
      );
    } finally {
      setAutofillDay(null);
      setAutofillingGameIds(new Set());
    }
  };

  const buildDayActions = (dateKey: string, dayGames: GameRecord[]) => {
    const candidates = getDayAutofillCandidates(dayGames);
    const showNhlAutofill = candidates.length > 0;

    return [
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
      ...(showNhlAutofill
        ? [
            {
              label: autofillDay === dateKey ? 'Auto-filling NHL Games' : 'Auto-fill NHL Games',
              icon: 'sports_hockey',
              disabled: autofillDay !== null,
              onClick: () => {
                void handleAutofillDay(dateKey, dayGames);
              },
            },
          ]
        : []),
    ];
  };

  // Compact game representation for a calendar day cell — mirrors the user games
  // calendar (away vs home in one row), clickable to open the game.
  const renderCalendarGamePill = (game: GameRecord) => {
    const showScore = shouldShowGameScore(game);
    const isFinal = game.status === 'final';
    const awayLost = isFinal && game.away_score < game.home_score;
    const homeLost = isFinal && game.home_score < game.away_score;
    const awayScoreStatus =
      !showScore || game.away_score === game.home_score
        ? 'pending'
        : game.away_score > game.home_score
          ? 'win'
          : 'lose';
    const homeScoreStatus =
      !showScore || game.home_score === game.away_score
        ? 'pending'
        : game.home_score > game.away_score
          ? 'win'
          : 'lose';
    return (
      <CalendarGameListItem
        key={game.id}
        href={gameDetailsPath(game)}
        tooltip={`${game.away_team.name} @ ${game.home_team.name}`}
        showScore={showScore}
        gameType={game.game_type}
        live={game.status === 'in_progress'}
        awayTeam={{
          logo: game.away_team.logo,
          code: game.away_team.code,
          primaryColor: game.away_team.primary_color,
          textColor: game.away_team.text_color,
          score: game.away_score,
          scoreStatus: awayScoreStatus,
          dimmed: awayLost,
        }}
        homeTeam={{
          logo: game.home_team.logo,
          code: game.home_team.code,
          primaryColor: game.home_team.primary_color,
          textColor: game.home_team.text_color,
          score: game.home_score,
          scoreStatus: homeScoreStatus,
          dimmed: homeLost,
        }}
      />
    );
  };

  const renderCalendarAutofillSkeletons = () => (
    <div
      className={styles.calendarAutofillSkeletonList}
      aria-label="Auto-filling NHL games"
    >
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton
          key={index}
          type="block"
          className={styles.calendarAutofillSkeleton}
        />
      ))}
    </div>
  );

  const renderWeekGameAutofillSkeleton = (game: GameRecord) => (
    <div
      key={game.id}
      className={styles.weekGameSkeletonItem}
      aria-label={`Auto-filling ${describeGame(game)}`}
    >
      <Skeleton
        type="block"
        className={styles.weekGameSkeleton}
      />
    </div>
  );

  const renderGameCard = (game: GameRecord) => {
    if (autofillingGameIds.has(game.id)) return renderWeekGameAutofillSkeleton(game);

    return (
      <GameCard
        key={game.id}
        game={game}
        tzPref="ET"
        canOpen
        originalDateLabel={null}
        timeLabel={formatGameTime(game) ?? null}
        showScore={shouldShowGameScore(game)}
        showTypeIndicator
        onOpen={() => openGame(game)}
      />
    );
  };

  const renderWeekGameList = (dateKey: string, dayGames: GameRecord[]) => {
    if (autofillDay !== dateKey) return dayGames.map((game) => renderGameCard(game));

    const revealedGames = dayGames.filter((game) => !autofillingGameIds.has(game.id));
    const loadingGames = dayGames.filter((game) => autofillingGameIds.has(game.id));

    return [
      ...revealedGames.map((game) => renderGameCard(game)),
      ...loadingGames.map((game) => renderWeekGameAutofillSkeleton(game)),
    ];
  };

  return (
    <>
      <div className={styles.scheduleLayout}>
        <Section
          noHeaderMargin
          title={
            <ScheduleGamesTitle
              picker={
                view === 'list' ? (
                  <PeriodPicker
                    value={dateToISO(weekStart)}
                    label={fmtWeekRange(weekStart, weekEnd)}
                    onChange={(v) => setWeekStart(v ? fromISODate(v) : toDay(new Date()))}
                    onPrevious={() => setWeekStart((d) => addDays(d, -7))}
                    onNext={() => setWeekStart((d) => addDays(d, 7))}
                  />
                ) : (
                  <PeriodPicker
                    kind="month"
                    value={toMonthPickerValue(calendarMonth)}
                    label={MONTH_LABEL_FMT.format(calendarMonth)}
                    onChange={changeCalendarMonth}
                    onPrevious={() => setCalendarMonth((current) => addMonths(current, -1))}
                    onNext={() => setCalendarMonth((current) => addMonths(current, 1))}
                  />
                )
              }
            />
          }
          action={
            <ScheduleGamesActions>
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
              <SegmentedControl
                value={view}
                onChange={(value) => handleViewChange(value as SeasonGamesView)}
                className={scheduleViewSegmentedControlClassName}
                options={[
                  {
                    value: 'list',
                    label: <Icon name="view_list" />,
                    tooltip: 'Week view',
                    ariaLabel: 'Week view',
                  },
                  {
                    value: 'calendar',
                    label: <Icon name="calendar_month" />,
                    tooltip: 'Month view',
                    ariaLabel: 'Month view',
                  },
                ]}
              />
              <ToggleButton
                variant="switch"
                active={filtersVisible}
                onClick={() => setFiltersVisible((v) => !v)}
                icon="filter_list"
                activeTooltip="Hide filters"
                inactiveTooltip="Show filters"
              />
            </ScheduleGamesActions>
          }
        >
          <ScheduleFilters visible={filtersVisible}>
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
            <ScheduleFilterSlot wide>
              <MultiSelect
                value={teamFilter}
                options={teamFilterOptions}
                placeholder="All Teams"
                emptyMessage="No teams in this season"
                onChange={setTeamFilter}
                searchable
              />
            </ScheduleFilterSlot>
          </ScheduleFilters>
        </Section>

        {/* ── Day cards ── */}
        {view === 'list' && (
          <>
            <div
              ref={weekSummarySentinelRef}
              className={styles.weekSummarySentinel}
            />
            <ScheduleWeekSummary
              days={groupedByDate}
              loading={loading}
              activeDateKey={activeSummaryDay}
              stuck={isWeekSummaryStuck}
              onSelectDate={scrollToDay}
              formatDate={fmtDaySummaryDate}
              formatWeekday={fmtDaySummaryWeekday}
              formatHeading={fmtDayHeading}
              summaryRef={weekSummaryCardRef}
              stickyTop={SEASON_WEEK_SUMMARY_STICKY_TOP}
            />
          </>
        )}

        {loading && view === 'calendar' ? (
          <div className={styles.scheduleContentBlock}>
            <ScheduleCalendarLoading month={calendarMonth} />
          </div>
        ) : view === 'calendar' ? (
          <div className={styles.scheduleContentBlock}>
            <ScheduleCalendarCard>
              <MonthCalendar
                month={calendarMonth}
                getDayLabelSuffix={({ dateKey }) => (
                  <ScheduleCalendarDayCount count={calendarGamesByDate.get(dateKey)?.length ?? 0} />
                )}
                getDayHeaderRight={({ dateKey }) => {
                  if (isEnded) return undefined;
                  const dayGames = calendarGamesByDate.get(dateKey) ?? [];
                  return (
                    <MoreActionsMenu
                      variant="ghost"
                      buttonClassName={scheduleCalendarDayActionButtonClassName}
                      disabled={autofillDay === dateKey}
                      items={buildDayActions(dateKey, dayGames)}
                    />
                  );
                }}
                renderDayContent={({ dateKey }) => {
                  const dayGames = calendarGamesByDate.get(dateKey) ?? [];
                  if (autofillDay === dateKey) return renderCalendarAutofillSkeletons();
                  return dayGames.length > 0 ? (
                    <ScheduleCalendarGameList>
                      {dayGames.map((game) => renderCalendarGamePill(game))}
                    </ScheduleCalendarGameList>
                  ) : null;
                }}
              />
            </ScheduleCalendarCard>
          </div>
        ) : (
          <div className={styles.scheduleContentBlock}>
            <ScheduleWeekList
              days={groupedByDate}
              loading={loading}
              dayRefs={dayRefs}
              formatHeading={fmtDayHeading}
              renderDayAction={(dateKey, dayGames) =>
                !isEnded && (
                  <MoreActionsMenu
                    variant="ghost"
                    buttonClassName={scheduleCalendarDayActionButtonClassName}
                    disabled={autofillDay === dateKey}
                    items={buildDayActions(dateKey, dayGames)}
                  />
                )
              }
              getEmptyMessage={() =>
                hasActiveFilters ? 'No games match the filters.' : 'No games scheduled.'
              }
              renderDayContent={(dateKey, dayGames) => (
                <div className={styles.weekGameCards}>
                  {renderWeekGameList(dateKey, dayGames)}
                </div>
              )}
            />
          </div>
        )}
      </div>

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

    </>
  );
};

export default SeasonGamesTab;
