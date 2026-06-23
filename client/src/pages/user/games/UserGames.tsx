import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import CalendarGameListItem from '@/components/CalendarGameListItem/CalendarGameListItem';
import DatePicker from '@/components/DatePicker/DatePicker';
import Icon from '@/components/Icon/Icon';
import MonthCalendar from '@/components/MonthCalendar/MonthCalendar';
import MoreActionsMenu from '@/components/MoreActionsMenu/MoreActionsMenu';
import MultiSelect, { type MultiSelectOption } from '@/components/MultiSelect/MultiSelect';
import Modal from '@/components/Modal/Modal';
import {
  ScheduleCalendarCard,
  ScheduleCalendarDayCount,
  ScheduleCalendarGameList,
  ScheduleCalendarLoading,
  ScheduleFilters,
  ScheduleFilterSlot,
  ScheduleGameList,
  ScheduleGamesActions,
  ScheduleGamesTitle,
  ScheduleWeekList,
  ScheduleWeekSummary,
  scheduleViewSegmentedControlClassName,
  useScheduleWeekSummaryStuck,
} from '@/components/ScheduleGamesLayout/ScheduleGamesLayout';
import GameListItem, { type GameListItemAction } from '@/components/GameListItem';
import SegmentedControl from '@/components/SegmentedControl/SegmentedControl';
import Select, { type SelectOption } from '@/components/Select/Select';
import ToggleButton from '@/components/ToggleButton/ToggleButton';
import PeriodPicker from '@/components/PeriodPicker/PeriodPicker';
import ScoreImageModal from '@/pages/admin/games/game-details/ScoreImageModal';
import { type GameRecord, type GameStatus } from '@/hooks/useGames';
import { downloadMonthScheduleImage } from '@/lib/monthScheduleImage';
import styles from './UserGames.module.scss';

const API = import.meta.env.VITE_API_URL || '/api';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const WEEK_STORAGE_KEY = 'user-games-week-start';
const CALENDAR_MONTH_STORAGE_KEY = 'user-games-calendar-month';
const USER_WEEK_SUMMARY_STICKY_TOP = '52px';
const USER_WEEK_SUMMARY_STICKY_TOP_PX = 52;
const USER_WEEK_SUMMARY_ACTIVE_MARKER_OFFSET_PX = 12;
const USER_WEEK_SUMMARY_AUTO_SCROLL_START_GRACE_MS = 700;
const USER_WEEK_SUMMARY_AUTO_SCROLL_IDLE_MS = 160;

const getUserWeekSummaryActiveMarker = (summaryCard: HTMLDivElement | null): number =>
  (summaryCard?.getBoundingClientRect().bottom ?? USER_WEEK_SUMMARY_STICKY_TOP_PX) +
  USER_WEEK_SUMMARY_ACTIVE_MARKER_OFFSET_PX;

// ── Constants ─────────────────────────────────────────────────────────────────

interface UserTeamOptionRecord {
  id: string;
  name: string | null;
  code: string | null;
  logo: string | null;
  league_id: string | null;
}

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'in_progress', label: 'Live' },
  { value: 'scheduled', label: 'Upcoming' },
  { value: 'final', label: 'Final' },
];

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

// ── Date helpers ──────────────────────────────────────────────────────────────

const toDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

const toLocalDateKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const DATE_ONLY_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const MONTH_ONLY_RE = /^[0-9]{4}-[0-9]{2}$/;
const ISO_DATE_PREFIX_RE = /^([0-9]{4}-[0-9]{2}-[0-9]{2})/;
const ISO_MIDNIGHT_RE = /T00:00(?::00(?:\.0+)?)?(?:Z|[+-][0-9]{2}:[0-9]{2})$/;

const toDateKeyInZone = (date: Date, timeZone?: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return year && month && day ? `${year}-${month}-${day}` : null;
};

const getRawDateKey = (value: string | null) => value?.match(ISO_DATE_PREFIX_RE)?.[1] ?? null;

const dateKeyToDate = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
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

const getScrollParent = (el: HTMLElement): HTMLElement => {
  let parent = el.parentElement;
  while (parent) {
    const { overflowY } = window.getComputedStyle(parent);
    if (/(auto|scroll|overlay)/.test(overflowY)) return parent;
    parent = parent.parentElement;
  }
  return document.documentElement;
};

const dateToISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const fromISODate = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
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

const MONTH_LABEL_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
});

const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const toMonthPickerValue = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const fromMonthPickerValue = (value: string) => {
  const [year, month] = value.split('-').map(Number);
  return new Date(year, month - 1, 1);
};
const firstWeekStartForMonth = (month: Date) => new Date(month.getFullYear(), month.getMonth(), 1);
const isSameCalendarMonth = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
const majorityMonthForWeek = (weekStart: Date) => {
  type MonthCount = { count: number; month: Date };
  const counts = new Map<string, MonthCount>();

  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDays(weekStart, offset);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const current = counts.get(key);
    if (current) {
      current.count += 1;
    } else {
      counts.set(key, {
        count: 1,
        month: firstWeekStartForMonth(date),
      });
    }
  }

  let majority: MonthCount | undefined;
  for (const candidate of counts.values()) {
    if (!majority || candidate.count > majority.count) majority = candidate;
  }

  return majority?.month ?? firstWeekStartForMonth(weekStart);
};
const weekBelongsToCalendarMonth = (weekStart: Date, month: Date) =>
  isSameCalendarMonth(majorityMonthForWeek(weekStart), month);

const getStoredWeekStart = () => {
  const stored = sessionStorage.getItem(WEEK_STORAGE_KEY);
  return stored && DATE_ONLY_RE.test(stored) ? fromISODate(stored) : toDay(new Date());
};

const getStoredCalendarMonth = () => {
  const stored = sessionStorage.getItem(CALENDAR_MONTH_STORAGE_KEY);
  return stored && MONTH_ONLY_RE.test(stored) ? fromMonthPickerValue(stored) : null;
};

type TzPref = 'ET' | 'local';

const USER_TIMEZONE: TzPref = 'local';

/** Returns 'EST' or 'EDT' for the America/New_York timezone on the given game date. */
const getEtAbbrForDateKey = (dateKey: string): string => {
  return (
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      timeZoneName: 'short',
    })
      .formatToParts(new Date(`${dateKey}T17:00:00Z`))
      .find((p) => p.type === 'timeZoneName')?.value ?? 'ET'
  );
};

const getEtDateKey = (scheduledAt: string | null, scheduledTime: string | null) => {
  if (!scheduledAt) return null;
  if (DATE_ONLY_RE.test(scheduledAt)) return scheduledAt;
  const rawDateKey = getRawDateKey(scheduledAt);
  const isMidnightPlaceholder =
    !!scheduledTime &&
    scheduledTime !== '00:00' &&
    !!rawDateKey &&
    ISO_MIDNIGHT_RE.test(scheduledAt);
  if (isMidnightPlaceholder) return rawDateKey;
  const base = new Date(scheduledAt);
  if (Number.isNaN(base.getTime())) return rawDateKey;
  return toDateKeyInZone(base, 'America/New_York');
};

const getScheduledInstant = (scheduledAt: string | null, scheduledTime: string | null) => {
  if (!scheduledAt) return null;

  const direct = new Date(scheduledAt);
  const hasDirectInstant = !Number.isNaN(direct.getTime());

  if (!scheduledTime) {
    if (DATE_ONLY_RE.test(scheduledAt)) return new Date(`${scheduledAt}T17:00:00Z`);
    return hasDirectInstant ? direct : null;
  }

  const etDatePart =
    getEtDateKey(scheduledAt, scheduledTime) ??
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  const offset = getEtAbbrForDateKey(etDatePart) === 'EDT' ? '-04:00' : '-05:00';
  return new Date(`${etDatePart}T${scheduledTime}:00${offset}`);
};

/**
 * Format a game's scheduled time.
 *
 * The user games page always passes 'local': reconstruct the exact Eastern
 * scheduled moment when needed and display it in the browser's timezone.
 */
const fmtGameTime = (
  scheduledAt: string | null,
  scheduledTime: string | null,
  tzPref: TzPref,
): string => {
  const instant = getScheduledInstant(scheduledAt, scheduledTime);
  if (!instant) return '';

  if (tzPref === 'ET') {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    }).format(instant);
  }

  return instant.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const getOriginalGameDateKey = (game: GameRecord, tzPref: TzPref) => {
  if (game.scheduled_at && DATE_ONLY_RE.test(game.scheduled_at) && !game.scheduled_time) {
    return game.scheduled_at;
  }
  const instant = getScheduledInstant(game.scheduled_at, game.scheduled_time);
  if (!instant) return null;
  return tzPref === 'ET'
    ? (getEtDateKey(game.scheduled_at, game.scheduled_time) ??
        toDateKeyInZone(instant, 'America/New_York'))
    : toDateKeyInZone(instant);
};

const isInvalidWatchScheduleDate = (
  game: GameRecord,
  scheduledFor: string | null | undefined,
  tzPref: TzPref,
) => {
  const watchDateKey = getScheduledWatchDateKey(scheduledFor);
  if (!watchDateKey) return false;
  const gameDateKey = getOriginalGameDateKey(game, tzPref);
  return !!gameDateKey && watchDateKey <= gameDateKey;
};

const getScheduledWatchDateKey = (value: string | null | undefined) => {
  if (!value) return null;
  if (DATE_ONLY_RE.test(value)) return value;
  return toLocalDateKey(value);
};

const getEffectiveUserDateKey = (game: GameRecord, tzPref: TzPref) =>
  getScheduledWatchDateKey(game.scheduled_for) ?? getOriginalGameDateKey(game, tzPref);

const getPlayoffRoundShortLabel = (game: GameRecord) => {
  if (game.game_type !== 'playoff' || game.playoff_round == null) return null;
  const customLabel = game.playoff_round_names?.[game.playoff_round] ?? null;
  if (!customLabel) return `R${game.playoff_round}`;

  const trimmed = customLabel.trim();
  const bareNumber = trimmed.match(/^([0-9]+)$/);
  if (bareNumber) return `R${bareNumber[1]}`;

  const roundNumber = trimmed.match(/^round\s+([0-9]+)$/i);
  if (roundNumber) return `R${roundNumber[1]}`;

  const tokens = trimmed.match(/[A-Za-z0-9]+/g) ?? [];
  const initials = tokens
    .map((token) => (/^[0-9]+$/.test(token) ? token : (token[0]?.toUpperCase() ?? '')))
    .join('');

  return initials || `R${game.playoff_round}`;
};

const getPlayoffGameMetaLabel = (game: GameRecord) => {
  if (game.game_type !== 'playoff') return null;
  const round = getPlayoffRoundShortLabel(game);
  const gameNumber = game.game_number_in_series ?? game.game_number;
  if (!round && gameNumber == null) return null;
  if (!round) return `G${gameNumber}`;
  if (gameNumber == null) return round;
  return `${round} - G${gameNumber}`;
};

const getSeriesWinsForTeam = (game: GameRecord, teamId: string) => {
  if (game.series_games_to_win == null) return null;
  if (teamId === game.series_home_team_id) {
    return game.series_home_wins_at_game ?? null;
  }
  if (teamId === game.series_away_team_id) {
    return game.series_away_wins_at_game ?? null;
  }
  return null;
};

const sortGamesByTime = (a: GameRecord, b: GameRecord) => {
  if (!a.scheduled_time && !b.scheduled_time) return 0;
  if (!a.scheduled_time) return 1;
  if (!b.scheduled_time) return -1;
  return a.scheduled_time.localeCompare(b.scheduled_time);
};

const sortCalendarDayGames = (a: GameRecord, b: GameRecord) => {
  const watchedDiff = Number(!!b.watched_by_user) - Number(!!a.watched_by_user);
  if (watchedDiff !== 0) return watchedDiff;
  return sortGamesByTime(a, b);
};

const getLeagueStyle = (game: GameRecord) =>
  ({
    '--game-league-primary': game.league_primary_color ?? '#334155',
    '--game-league-text': game.league_text_color ?? '#ffffff',
  }) as CSSProperties;

const ORIGINAL_GAME_DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
});

const getOriginalGameDateLabel = (game: GameRecord, tzPref: TzPref) => {
  if (!getScheduledWatchDateKey(game.scheduled_for)) return null;
  const originalDateKey = getOriginalGameDateKey(game, tzPref);
  return originalDateKey ? ORIGINAL_GAME_DATE_FMT.format(dateKeyToDate(originalDateKey)) : null;
};

const shouldShowWatchedScore = (game: GameRecord) =>
  !!game.watched_by_user && (game.status === 'final' || game.status === 'in_progress');

const getOvertimeSuffix = (game: GameRecord) => {
  if (game.shootout || game.period_scores.some((ps) => ps.period === 'SO')) return '/SO';
  if ((game.overtime_periods ?? 0) > 0 || game.period_scores.some((ps) => ps.period === 'OT')) {
    return '/OT';
  }
  return '';
};

const formatStatusLabel = (game: GameRecord) =>
  game.status === 'final' ? `Final${getOvertimeSuffix(game)}` : STATUS_LABEL[game.status];

const getScoreCardGame = (game: GameRecord): GameRecord => ({
  ...game,
  series_home_wins: game.series_home_wins_at_game ?? null,
  series_away_wins: game.series_away_wins_at_game ?? null,
});

interface GameActionsProps {
  watched: boolean;
  skipped: boolean;
  scheduled: boolean;
  busy: boolean;
  onView: () => void;
  onDownloadScoreCard: () => void;
  onMarkWatched: () => void;
  onUnwatch: () => void;
  onUndoSkip: () => void;
  onSchedule: () => void;
  onSkip: () => void;
}

const GameHoverActions = ({
  watched,
  skipped,
  scheduled,
  busy,
  onView,
  onDownloadScoreCard,
  onMarkWatched,
  onUnwatch,
  onUndoSkip,
  onSchedule,
  onSkip,
}: GameActionsProps) => (
  <span
    className={styles.gameActions}
    data-calendar-game-actions
  >
    {(watched || skipped) && (
      <Button
        type="button"
        variant="outlined"
        intent="neutral"
        icon="open_in_new"
        size="sm"
        tooltip="View game details"
        onClick={(e) => {
          e.stopPropagation();
          onView();
        }}
      />
    )}
    {skipped && (
      <Button
        type="button"
        variant="outlined"
        intent="warning"
        icon="undo"
        size="sm"
        tooltip="Undo skip"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          void onUndoSkip();
        }}
      />
    )}
    {watched && (
      <Button
        type="button"
        variant="outlined"
        intent="neutral"
        icon="download"
        size="sm"
        tooltip="Download score card"
        onClick={(e) => {
          e.stopPropagation();
          onDownloadScoreCard();
        }}
      />
    )}
    {watched && (
      <Button
        type="button"
        variant="outlined"
        intent="danger"
        icon="visibility_off"
        size="sm"
        tooltip="Unwatch"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          void onUnwatch();
        }}
      />
    )}
    {!watched && !skipped && (
      <Button
        type="button"
        variant="outlined"
        intent="warning"
        icon="remove_circle_outline"
        size="sm"
        tooltip="Skip game"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          void onSkip();
        }}
      />
    )}
    {!watched && !skipped && (
      <Button
        type="button"
        variant="outlined"
        intent="neutral"
        icon="calendar_month"
        size="sm"
        tooltip={scheduled ? 'Edit watch schedule' : 'Schedule watch'}
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          onSchedule();
        }}
      />
    )}
    {!watched && !skipped && (
      <Button
        type="button"
        variant="outlined"
        intent="accent"
        icon="visibility"
        size="sm"
        tooltip="Mark as watched"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          void onMarkWatched();
        }}
      />
    )}
  </span>
);

// ── Playoff series markers ───────────────────────────────────────────────────

const PlayoffSeriesDots = ({ wins, total }: { wins: number; total: number }) => (
  <span
    className={styles.playoffDots}
    aria-label={`Series record ${wins} of ${total}`}
  >
    {Array.from({ length: total }, (_, i) => (
      <span
        key={i}
        className={[styles.playoffDot, i < wins ? styles.playoffDotFilled : '']
          .filter(Boolean)
          .join(' ')}
      />
    ))}
  </span>
);

const ScheduleWatchModal = ({
  open,
  game,
  value,
  busy,
  onChange,
  onClose,
  onSave,
}: {
  open: boolean;
  game: GameRecord | null;
  value: string;
  busy: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) => {
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isDirty, isValid },
  } = useForm<{ scheduled_for: string }>({
    defaultValues: { scheduled_for: value },
    mode: 'onChange',
  });
  const scheduledFor = watch('scheduled_for');

  // Initialise the form only when the modal opens (or the target game changes).
  // Depending on `value` here would reset the form on every date pick, clearing
  // `isDirty` and keeping the Save button permanently disabled.
  useEffect(() => {
    if (open) reset({ scheduled_for: value });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, game?.id, reset]);

  const scheduleDateInvalid = game
    ? isInvalidWatchScheduleDate(game, scheduledFor, USER_TIMEZONE)
    : false;
  const submit = handleSubmit(() => onSave());

  if (!game) return null;

  return (
    <Modal
      open={open}
      title="Schedule Watch"
      onClose={onClose}
      onConfirm={submit}
      confirmLabel={busy ? 'Saving…' : 'Save Schedule'}
      confirmDisabled={busy || !isDirty || !isValid || scheduleDateInvalid}
      busy={busy}
      footerStart={
        scheduledFor ? (
          <Button
            type="button"
            variant="ghost"
            intent="neutral"
            onClick={() => {
              setValue('scheduled_for', '', { shouldDirty: true, shouldValidate: true });
              onChange('');
            }}
            disabled={busy}
          >
            Clear Date
          </Button>
        ) : undefined
      }
    >
      <div className={styles.scheduleModalBody}>
        <p className={styles.scheduleModalCopy}>
          Choose when you plan to watch {game.away_team.code} @ {game.home_team.code}. Scheduled
          dates are saved in your local timezone.
        </p>
        <Controller
          control={control}
          name="scheduled_for"
          render={({ field }) => (
            <DatePicker
              value={field.value}
              onChange={(next) => {
                field.onChange(next);
                onChange(next ?? '');
              }}
              placeholder="Watch date"
            />
          )}
        />
        {scheduleDateInvalid && (
          <p className={styles.scheduleModalError}>
            Choose a watch date after the game's scheduled date.
          </p>
        )}
      </div>
    </Modal>
  );
};

// ── Calendar game card ────────────────────────────────────────────────────────

const CalendarGameCard = ({
  game,
  tzPref,
  onOpen,
  onDownloadScoreCard,
  onMarkWatched,
  onUnwatch,
  onSchedule,
  onSkip,
  onDragStart,
  onDragEnd,
  draggable,
  dragging,
  busy,
}: {
  game: GameRecord;
  tzPref: TzPref;
  onOpen: () => void;
  onDownloadScoreCard: () => void;
  onMarkWatched: () => Promise<void>;
  onUnwatch: () => Promise<void>;
  onSchedule: () => void;
  onSkip: () => Promise<void>;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
  draggable?: boolean;
  dragging?: boolean;
  busy: boolean;
}) => {
  const showRecordedScore = shouldShowWatchedScore(game);
  const showMissingScore = !!game.watched_by_user && !showRecordedScore;
  const showScore = showRecordedScore || showMissingScore;
  const home = game.home_score;
  const away = game.away_score;
  const awayGameStatus = showMissingScore
    ? 'missing'
    : !showRecordedScore || away === home
      ? 'pending'
      : away > home
        ? 'win'
        : 'lose';
  const homeGameStatus = showMissingScore
    ? 'missing'
    : !showRecordedScore || home === away
      ? 'pending'
      : home > away
        ? 'win'
        : 'lose';
  const originalDateLabel = getOriginalGameDateLabel(game, tzPref);
  const playoffMetaLabel = getPlayoffGameMetaLabel(game);
  const awaySeriesWins = getSeriesWinsForTeam(game, game.away_team.id);
  const homeSeriesWins = getSeriesWinsForTeam(game, game.home_team.id);
  const seriesTotalWins = game.series_games_to_win;
  const showAwaySeriesDots =
    !!game.watched_by_user && seriesTotalWins != null && awaySeriesWins != null;
  const showHomeSeriesDots =
    !!game.watched_by_user && seriesTotalWins != null && homeSeriesWins != null;

  return (
    <CalendarGameListItem
      className={[
        styles.calendarGameLeagueTint,
        game.skipped_by_user ? styles.calendarGameSkipped : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={getLeagueStyle(game)}
      showScore={showScore}
      live={game.status === 'in_progress'}
      dragging={dragging}
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      topLabel={originalDateLabel}
      bottomLabel={playoffMetaLabel}
      awayTeam={{
        logo: game.away_team.logo,
        code: game.away_team.code,
        primaryColor: game.away_team.primary_color,
        textColor: game.away_team.text_color,
        score: showMissingScore ? '-' : away,
        scoreStatus: awayGameStatus,
        meta: showAwaySeriesDots ? (
          <PlayoffSeriesDots
            wins={awaySeriesWins || 0}
            total={seriesTotalWins || 0}
          />
        ) : undefined,
      }}
      homeTeam={{
        logo: game.home_team.logo,
        code: game.home_team.code,
        primaryColor: game.home_team.primary_color,
        textColor: game.home_team.text_color,
        score: showMissingScore ? '-' : home,
        scoreStatus: homeGameStatus,
        meta: showHomeSeriesDots ? (
          <PlayoffSeriesDots
            wins={homeSeriesWins || 0}
            total={seriesTotalWins || 0}
          />
        ) : undefined,
      }}
    >
      <GameHoverActions
        watched={!!game.watched_by_user}
        skipped={!!game.skipped_by_user}
        scheduled={!!game.scheduled_for}
        busy={busy}
        onView={onOpen}
        onDownloadScoreCard={onDownloadScoreCard}
        onMarkWatched={onMarkWatched}
        onUnwatch={onUnwatch}
        onUndoSkip={onUnwatch}
        onSchedule={onSchedule}
        onSkip={onSkip}
      />
    </CalendarGameListItem>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

const UserGames = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const initialStoredCalendarMonth = getStoredCalendarMonth();
  const [weekStart, setWeekStart] = useState<Date>(() => getStoredWeekStart());
  const [calendarMonth, setCalendarMonth] = useState<Date>(
    () => initialStoredCalendarMonth ?? monthStart(new Date()),
  );
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [filtersVisible, setFiltersVisible] = useState(true);
  const [showSkippedGames, setShowSkippedGames] = useState(false);
  const [leagueId, setLeagueId] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const tzPref = USER_TIMEZONE;
  const [actionGameId, setActionGameId] = useState<string | null>(null);
  const [dragGameId, setDragGameId] = useState<string | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<GameRecord | null>(null);
  const [scoreCardTarget, setScoreCardTarget] = useState<GameRecord | null>(null);
  const [scoreImageOpen, setScoreImageOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [exportingMonthImage, setExportingMonthImage] = useState(false);
  const hasSeededTeamFilterRef = useRef(false);
  const calendarGridRef = useRef<HTMLDivElement>(null);

  const weekEnd = addDays(weekStart, 6);

  useEffect(() => {
    sessionStorage.setItem(WEEK_STORAGE_KEY, dateToISO(weekStart));
  }, [weekStart]);

  useEffect(() => {
    sessionStorage.setItem(CALENDAR_MONTH_STORAGE_KEY, toMonthPickerValue(calendarMonth));
  }, [calendarMonth]);

  const gamesPeriodParams = useMemo<{ week?: string; month?: string }>(() => {
    if (view === 'calendar') {
      return { month: toMonthPickerValue(calendarMonth) };
    }
    return { week: dateToISO(weekStart) };
  }, [calendarMonth, view, weekStart]);

  const { data: leagues = [] } = useQuery<
    { id: string; name: string; code: string; logo: string | null }[]
  >({
    queryKey: ['user-leagues'],
    queryFn: async () => {
      const { data } = await axios.get(`${API}/user/leagues`, { headers: authHeaders() });
      return data;
    },
  });

  const { data: favoriteTeamIdsData } = useQuery<string[]>({
    queryKey: ['user-favorites'],
    queryFn: async () => {
      const { data } = await axios.get<string[]>(`${API}/user/favorites`, {
        headers: authHeaders(),
      });
      return data;
    },
  });
  const favoriteTeamIds = useMemo(() => favoriteTeamIdsData ?? [], [favoriteTeamIdsData]);

  const leagueSelected = leagueId !== 'all';

  const { data: allTeams = [], isLoading: teamsLoading } = useQuery<UserTeamOptionRecord[]>({
    queryKey: ['user-teams'],
    queryFn: async () => {
      const { data } = await axios.get<UserTeamOptionRecord[]>(`${API}/user/teams`, {
        headers: authHeaders(),
      });
      return data;
    },
  });

  const { data: games = [], isLoading } = useQuery<GameRecord[]>({
    queryKey: [
      'user-games',
      statusFilter,
      leagueId,
      showSkippedGames,
      gamesPeriodParams.week ?? '',
      gamesPeriodParams.month ?? '',
    ],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (leagueSelected) params.league_id = leagueId;
      if (showSkippedGames) params.include_skipped = 'true';
      if (gamesPeriodParams.week) params.week = gamesPeriodParams.week;
      if (gamesPeriodParams.month) params.month = gamesPeriodParams.month;
      const { data } = await axios.get<GameRecord[]>(`${API}/user/games`, {
        headers: authHeaders(),
        params,
      });
      return data;
    },
  });

  const teamOptions = useMemo<MultiSelectOption[]>(() => {
    const favoriteTeamIdSet = new Set(favoriteTeamIds);
    const options = new Map<string, MultiSelectOption>();

    for (const team of allTeams) {
      if (leagueSelected && team.league_id !== leagueId) continue;
      if (options.has(team.id)) continue;
      const label = team.name ?? team.code ?? 'Unnamed Team';
      options.set(team.id, {
        value: team.id,
        label,
        logo: team.logo ?? undefined,
        code: team.code ?? undefined,
      });
    }

    return Array.from(options.values()).sort((a, b) => {
      const favoriteDiff =
        Number(favoriteTeamIdSet.has(b.value)) - Number(favoriteTeamIdSet.has(a.value));
      if (favoriteDiff !== 0) return favoriteDiff;
      return a.label.localeCompare(b.label);
    });
  }, [allTeams, favoriteTeamIds, leagueId, leagueSelected]);

  useEffect(() => {
    if (favoriteTeamIdsData === undefined) return;

    const availableIds = new Set(teamOptions.map((option) => option.value));
    const availableFavoriteIds = favoriteTeamIds.filter((teamId) => availableIds.has(teamId));
    const shouldSeedFavorites =
      !hasSeededTeamFilterRef.current &&
      (!teamsLoading || teamOptions.length > 0 || favoriteTeamIds.length === 0);

    if (shouldSeedFavorites) hasSeededTeamFilterRef.current = true;

    setTeamFilter((current) => {
      const next = shouldSeedFavorites
        ? availableFavoriteIds
        : current.filter((teamId) => availableIds.has(teamId));
      return next.length === current.length &&
        next.every((teamId, index) => teamId === current[index])
        ? current
        : next;
    });
  }, [favoriteTeamIds, favoriteTeamIdsData, teamOptions, teamsLoading]);

  const filteredGames = useMemo(() => {
    const visibleGames = showSkippedGames ? games : games.filter((game) => !game.skipped_by_user);
    if (teamFilter.length === 0) return visibleGames;
    return visibleGames.filter(
      (game) => teamFilter.includes(game.home_team.id) || teamFilter.includes(game.away_team.id),
    );
  }, [games, showSkippedGames, teamFilter]);

  const scheduledGames = useMemo(
    () => filteredGames.filter((game) => !!getEffectiveUserDateKey(game, tzPref)),
    [filteredGames, tzPref],
  );

  // Build a 7-slot array (one per day in the window), each with its games.
  const groupedByDate = useMemo(() => {
    const map = new Map<string, GameRecord[]>();
    for (const g of filteredGames) {
      const key = getEffectiveUserDateKey(g, tzPref);
      if (!key) continue;
      const d = toDay(dateKeyToDate(key));
      if (d < weekStart || d > toDay(weekEnd)) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(g);
    }
    // Always include every day in the window, even days with no games.
    return Array.from({ length: 7 }, (_, i) => {
      const key = dateToISO(addDays(weekStart, i));
      const dayGames = (map.get(key) ?? []).slice().sort(sortGamesByTime);
      return [key, dayGames] as [string, GameRecord[]];
    });
  }, [filteredGames, weekStart, weekEnd, tzPref]);

  const gamesByCalendarDate = useMemo(() => {
    const map = new Map<string, GameRecord[]>();
    scheduledGames.forEach((game) => {
      const key = getEffectiveUserDateKey(game, tzPref);
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(game);
    });
    for (const [key, dayGames] of map.entries()) {
      map.set(key, dayGames.slice().sort(sortCalendarDayGames));
    }
    return map;
  }, [scheduledGames, tzPref]);

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
    stickyTopPx: USER_WEEK_SUMMARY_STICKY_TOP_PX,
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

  const holdWeekSummaryScrollTarget = (
    dateKey: string,
    delay = USER_WEEK_SUMMARY_AUTO_SCROLL_IDLE_MS,
  ) => {
    weekSummaryScrollTargetRef.current = dateKey;
    if (weekSummaryScrollTimeoutRef.current !== null) {
      window.clearTimeout(weekSummaryScrollTimeoutRef.current);
    }
    weekSummaryScrollTimeoutRef.current = window.setTimeout(() => {
      clearWeekSummaryScrollTarget();
    }, delay);
  };

  const scrollToDay = (dateKey: string) => {
    const dayNode = dayRefs.current[dateKey];
    setActiveSummaryDay(dateKey);
    if (!dayNode) {
      clearWeekSummaryScrollTarget();
      return;
    }
    holdWeekSummaryScrollTarget(dateKey, USER_WEEK_SUMMARY_AUTO_SCROLL_START_GRACE_MS);
    dayNode.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (view !== 'list' || isLoading || groupedByDate.length === 0) return;
    const firstDayRef = dayRefs.current[groupedByDate[0][0]];
    if (!firstDayRef) return;

    const scrollEl = getScrollParent(firstDayRef);
    let frame = 0;

    const updateActiveDay = () => {
      const marker = getUserWeekSummaryActiveMarker(weekSummaryCardRef.current);
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
  }, [groupedByDate, isLoading, view]);

  const leagueOptions: SelectOption[] = [
    { value: 'all', label: 'All Leagues' },
    ...leagues.map((l) => ({ value: l.id, label: l.code, logo: l.logo })),
  ];

  const openGame = (gameId: string) => navigate(`/games/${gameId}`);
  const openScoreCardModal = (game: GameRecord) => setScoreCardTarget(getScoreCardGame(game));
  const openScheduleModal = (game: GameRecord) => {
    setScheduleTarget(game);
    setScheduleDate(getScheduledWatchDateKey(game.scheduled_for) ?? '');
  };

  const saveScheduleForGame = async (game: GameRecord, scheduledFor: string | null) => {
    const gameId = game.id;
    if (actionGameId === gameId || scheduleBusy) return false;
    if (isInvalidWatchScheduleDate(game, scheduledFor, tzPref)) {
      toast.error("Choose a watch date after the game's scheduled date");
      return false;
    }
    setActionGameId(gameId);
    try {
      await axios.put(
        `${API}/user/watched-games/${gameId}/schedule`,
        { scheduled_for: scheduledFor },
        { headers: authHeaders() },
      );
      queryClient.setQueriesData(
        { queryKey: ['user-games'] },
        (existing: GameRecord[] | undefined) => {
          if (!Array.isArray(existing)) return existing;
          return existing.map((game) =>
            game.id === gameId
              ? { ...game, scheduled_for: scheduledFor, skipped_by_user: false }
              : game,
          );
        },
      );
      return true;
    } catch {
      toast.error('Failed to save watch schedule');
      return false;
    } finally {
      setActionGameId(null);
    }
  };

  const markGameWatched = async (gameId: string) => {
    if (actionGameId === gameId) return;
    setActionGameId(gameId);
    try {
      await axios.post(`${API}/user/watched-games/${gameId}`, {}, { headers: authHeaders() });
      queryClient.setQueriesData(
        { queryKey: ['user-games'] },
        (existing: GameRecord[] | undefined) => {
          if (!Array.isArray(existing)) return existing;
          return existing.map((game) =>
            game.id === gameId
              ? {
                  ...game,
                  watched_by_user: true,
                  watched_on: getScheduledWatchDateKey(game.scheduled_for) ?? dateToISO(new Date()),
                  skipped_by_user: false,
                }
              : game,
          );
        },
      );
    } catch {
      toast.error('Failed to mark game as watched');
    } finally {
      setActionGameId(null);
    }
  };

  const skipGame = async (gameId: string) => {
    if (actionGameId === gameId) return;
    setActionGameId(gameId);
    try {
      await axios.post(`${API}/user/watched-games/${gameId}/skip`, {}, { headers: authHeaders() });
      queryClient.setQueriesData(
        { queryKey: ['user-games'] },
        (existing: GameRecord[] | undefined) => {
          if (!Array.isArray(existing)) return existing;
          return showSkippedGames
            ? existing.map((game) =>
                game.id === gameId
                  ? {
                      ...game,
                      watched_by_user: false,
                      watched_on: null,
                      scheduled_for: null,
                      skipped_by_user: true,
                    }
                  : game,
              )
            : existing.filter((game) => game.id !== gameId);
        },
      );
    } catch {
      toast.error('Failed to skip game');
    } finally {
      setActionGameId(null);
    }
  };

  const unwatchGame = async (gameId: string) => {
    if (actionGameId === gameId) return;
    setActionGameId(gameId);
    try {
      await axios.delete(`${API}/user/watched-games/${gameId}`, { headers: authHeaders() });
      queryClient.setQueriesData(
        { queryKey: ['user-games'] },
        (existing: GameRecord[] | undefined) => {
          if (!Array.isArray(existing)) return existing;
          return existing.map((game) =>
            game.id === gameId
              ? {
                  ...game,
                  watched_by_user: false,
                  watched_on: null,
                  skipped_by_user: false,
                }
              : game,
          );
        },
      );
    } catch {
      toast.error('Failed to unwatch game');
    } finally {
      setActionGameId(null);
    }
  };

  const saveSchedule = async () => {
    if (!scheduleTarget || scheduleBusy) return;
    const normalizedScheduleDate = getScheduledWatchDateKey(scheduleDate);
    setScheduleBusy(true);
    try {
      const ok = await saveScheduleForGame(scheduleTarget, normalizedScheduleDate);
      if (!ok) return;
      setScheduleTarget(null);
      setScheduleDate('');
    } finally {
      setScheduleBusy(false);
    }
  };

  const handleCalendarDragStart = (game: GameRecord) => (event: DragEvent<HTMLDivElement>) => {
    setDragGameId(game.id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/user-game-id', game.id);
  };

  const handleCalendarDragEnd = () => {
    setDragGameId(null);
  };

  const handleCalendarDragOver = (_dateKey: string) => (event: DragEvent<HTMLDivElement>) => {
    const draggedId = dragGameId || event.dataTransfer.getData('text/user-game-id');
    if (!draggedId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleCalendarDrop = (dateKey: string) => async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const draggedId = dragGameId || event.dataTransfer.getData('text/user-game-id');
    setDragGameId(null);
    if (!draggedId) return;

    const draggedGame = games.find((game) => game.id === draggedId);
    if (!draggedGame || draggedGame.watched_by_user) return;
    const originalDateKey = getOriginalGameDateKey(draggedGame, tzPref);
    const normalizedScheduleDate = originalDateKey === dateKey ? null : dateKey;
    if (getScheduledWatchDateKey(draggedGame.scheduled_for) === normalizedScheduleDate) return;

    await saveScheduleForGame(draggedGame, normalizedScheduleDate);
  };

  const handleWeekNavigate = (offsetDays: number) => {
    setWeekStart((current) => toDay(addDays(current, offsetDays)));
  };

  const handleWeekPeriodChange = (value: string) => {
    setWeekStart(value ? fromISODate(value) : toDay(new Date()));
  };

  const handleCalendarMonthChange = (next: Date | ((current: Date) => Date)) => {
    setCalendarMonth((current) => {
      const resolved = typeof next === 'function' ? next(current) : next;
      return monthStart(resolved);
    });
  };

  const handleViewChange = (nextView: 'list' | 'calendar') => {
    if (nextView === view) return;
    if (nextView === 'list') {
      if (!weekBelongsToCalendarMonth(weekStart, calendarMonth)) {
        setWeekStart(firstWeekStartForMonth(calendarMonth));
      }
    } else {
      handleCalendarMonthChange(majorityMonthForWeek(weekStart));
    }
    setView(nextView);
  };

  const handleDownloadMonthImage = async () => {
    const calendarNode = calendarGridRef.current;
    if (exportingMonthImage || view !== 'calendar' || scheduledGames.length === 0 || !calendarNode)
      return;
    setExportingMonthImage(true);
    try {
      await downloadMonthScheduleImage({
        calendarNode,
        calendarMonth,
        filenamePrefix: 'user-games',
      });
    } catch {
      toast.error('Failed to generate schedule image');
    } finally {
      setExportingMonthImage(false);
    }
  };

  const renderUserGameListItem = (game: GameRecord) => {
    const watched = !!game.watched_by_user;
    const skipped = !!game.skipped_by_user;
    const canOpen = watched || skipped;
    const busy = actionGameId === game.id;
    const actions: (GameListItemAction | false)[] = [
      canOpen && {
        icon: 'open_in_new',
        intent: 'neutral',
        tooltip: 'View game details',
        onClick: () => openGame(game.id),
      },
      skipped && {
        icon: 'undo',
        intent: 'warning',
        tooltip: 'Undo skip',
        disabled: busy,
        onClick: () => void unwatchGame(game.id),
      },
      watched && {
        icon: 'download',
        intent: 'neutral',
        tooltip: 'Download score card',
        onClick: () => openScoreCardModal(game),
      },
      watched && {
        icon: 'visibility_off',
        intent: 'danger',
        tooltip: 'Unwatch',
        disabled: busy,
        onClick: () => void unwatchGame(game.id),
      },
      !watched &&
        !skipped && {
          icon: 'remove_circle_outline',
          intent: 'warning',
          tooltip: 'Skip game',
          disabled: busy,
          onClick: () => void skipGame(game.id),
        },
      !watched &&
        !skipped && {
          icon: 'calendar_month',
          intent: 'neutral',
          tooltip: game.scheduled_for ? 'Edit watch schedule' : 'Schedule watch',
          disabled: busy,
          onClick: () => openScheduleModal(game),
        },
      !watched &&
        !skipped && {
          icon: 'visibility',
          intent: 'accent',
          tooltip: 'Mark as watched',
          disabled: busy,
          onClick: () => void markGameWatched(game.id),
        },
    ];

    return (
      <GameListItem
        key={game.id}
        href={canOpen ? `/games/${game.id}` : undefined}
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
        showScore={shouldShowWatchedScore(game)}
        isFinal={game.status === 'final'}
        statusLabel={formatStatusLabel(game)}
        statusIntent={STATUS_INTENT[game.status]}
        date={getOriginalGameDateLabel(game, tzPref) ?? undefined}
        time={
          game.scheduled_time
            ? fmtGameTime(game.scheduled_at, game.scheduled_time, tzPref)
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
        gameType={game.game_type}
        actions={actions}
      />
    );
  };

  return (
    <div className={styles.page}>
      <Card
        className={styles.controlsCard}
        noHeaderMargin
        title={
          <ScheduleGamesTitle
            picker={
              view === 'list' ? (
                <PeriodPicker
                  value={dateToISO(weekStart)}
                  label={fmtWeekRange(weekStart, weekEnd)}
                  onChange={handleWeekPeriodChange}
                  onPrevious={() => handleWeekNavigate(-7)}
                  onNext={() => handleWeekNavigate(7)}
                />
              ) : (
                <PeriodPicker
                  kind="month"
                  value={toMonthPickerValue(calendarMonth)}
                  label={MONTH_LABEL_FMT.format(calendarMonth)}
                  onChange={(value) =>
                    value && handleCalendarMonthChange(fromMonthPickerValue(value))
                  }
                  onPrevious={() => handleCalendarMonthChange((current) => addMonths(current, -1))}
                  onNext={() => handleCalendarMonthChange((current) => addMonths(current, 1))}
                />
              )
            }
          />
        }
        action={
          <ScheduleGamesActions>
            <div className={styles.viewFilterControls}>
              <SegmentedControl
                value={view}
                onChange={(value) => handleViewChange(value as 'list' | 'calendar')}
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
                onClick={() => setFiltersVisible((visible) => !visible)}
                activeIcon="filter_list"
                inactiveIcon="filter_list"
                activeTooltip="Hide filters"
                inactiveTooltip="Show filters"
                className={styles.filterVisibilitySwitch}
              />
              <MoreActionsMenu
                size="md"
                items={[
                  {
                    label: 'Generate Score Image',
                    icon: 'image',
                    onClick: () => setScoreImageOpen(true),
                  },
                  ...(view === 'calendar' && scheduledGames.length > 0
                    ? [
                        {
                          label: 'Download Month Image',
                          icon: 'download',
                          disabled: exportingMonthImage,
                          onClick: () => void handleDownloadMonthImage(),
                        },
                      ]
                    : []),
                ]}
              />
            </div>
          </ScheduleGamesActions>
        }
      >
        <ScheduleFilters visible={filtersVisible}>
          <Select
            value={leagueId}
            options={leagueOptions}
            onChange={setLeagueId}
          />
          <Select
            value={statusFilter}
            options={STATUS_OPTIONS}
            onChange={setStatusFilter}
          />
          <ScheduleFilterSlot wide>
            <MultiSelect
              value={teamFilter}
              options={teamOptions}
              placeholder="Teams"
              emptyMessage="No teams available"
              onChange={setTeamFilter}
              searchable
            />
          </ScheduleFilterSlot>
          <ScheduleFilterSlot fixed>
            <ToggleButton
              variant="switch"
              active={showSkippedGames}
              onClick={() => setShowSkippedGames((show) => !show)}
              activeIcon="visibility"
              inactiveIcon="visibility_off"
              activeTooltip="Hide skipped games"
              inactiveTooltip="Show skipped games"
            />
          </ScheduleFilterSlot>
        </ScheduleFilters>
      </Card>

      {view === 'list' && (
        <>
          <div
            ref={weekSummarySentinelRef}
            className={styles.weekSummarySentinel}
          />
          <ScheduleWeekSummary
            days={groupedByDate}
            loading={isLoading}
            activeDateKey={activeSummaryDay}
            stuck={isWeekSummaryStuck}
            onSelectDate={scrollToDay}
            formatDate={fmtDaySummaryDate}
            formatWeekday={fmtDaySummaryWeekday}
            formatHeading={fmtDayHeading}
            summaryRef={weekSummaryCardRef}
            stickyTop={USER_WEEK_SUMMARY_STICKY_TOP}
          />
        </>
      )}

      {view === 'list' ? (
        <div className={styles.scheduleContentBlock}>
          <ScheduleWeekList
            days={groupedByDate}
            loading={isLoading}
            dayRefs={dayRefs}
            formatHeading={fmtDayHeading}
            renderDayContent={(_dateKey, dayGames) => (
              <ScheduleGameList>
                {dayGames.map((game) => renderUserGameListItem(game))}
              </ScheduleGameList>
            )}
          />
        </div>
      ) : isLoading ? (
        <div className={styles.scheduleContentBlock}>
          <ScheduleCalendarLoading month={calendarMonth} />
        </div>
      ) : (
        <div className={styles.scheduleContentBlock}>
          <ScheduleCalendarCard>
            <MonthCalendar
              ref={calendarGridRef}
              month={calendarMonth}
              getDayLabelSuffix={({ dateKey }) => (
                <ScheduleCalendarDayCount count={gamesByCalendarDate.get(dateKey)?.length ?? 0} />
              )}
              getDayProps={({ dateKey }) => ({
                'data-date-key': dateKey,
                onDragOver: handleCalendarDragOver(dateKey),
                onDrop: handleCalendarDrop(dateKey),
              })}
              renderDayContent={({ dateKey }) => {
                const dayGames = gamesByCalendarDate.get(dateKey) ?? [];
                return dayGames.length > 0 ? (
                  <ScheduleCalendarGameList>
                    {dayGames.map((game) => (
                      <CalendarGameCard
                        key={game.id}
                        game={game}
                        tzPref={tzPref}
                        onOpen={() => openGame(game.id)}
                        onDownloadScoreCard={() => openScoreCardModal(game)}
                        onMarkWatched={() => markGameWatched(game.id)}
                        onUnwatch={() => unwatchGame(game.id)}
                        onSchedule={() => openScheduleModal(game)}
                        onSkip={() => skipGame(game.id)}
                        onDragStart={handleCalendarDragStart(game)}
                        onDragEnd={handleCalendarDragEnd}
                        draggable={
                          !game.watched_by_user && !game.skipped_by_user && actionGameId !== game.id
                        }
                        dragging={dragGameId === game.id}
                        busy={actionGameId === game.id}
                      />
                    ))}
                  </ScheduleCalendarGameList>
                ) : null;
              }}
            />
          </ScheduleCalendarCard>
        </div>
      )}

      <ScheduleWatchModal
        open={!!scheduleTarget}
        game={scheduleTarget}
        value={scheduleDate}
        busy={scheduleBusy}
        onChange={setScheduleDate}
        onClose={() => {
          if (scheduleBusy) return;
          setScheduleTarget(null);
          setScheduleDate('');
        }}
        onSave={saveSchedule}
      />

      <ScoreImageModal
        open={scoreImageOpen || !!scoreCardTarget}
        game={scoreCardTarget ?? undefined}
        liveAwayScore={scoreCardTarget?.away_score}
        liveHomeScore={scoreCardTarget?.home_score}
        overtimeSuffix={scoreCardTarget ? getOvertimeSuffix(scoreCardTarget) : ''}
        showForm={scoreImageOpen}
        onClose={() => {
          setScoreImageOpen(false);
          setScoreCardTarget(null);
        }}
      />
    </div>
  );
};

export default UserGames;
