import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import DatePicker from '@/components/DatePicker/DatePicker';
import Icon from '@/components/Icon/Icon';
import MonthCalendar from '@/components/MonthCalendar/MonthCalendar';
import MultiSelect, { type MultiSelectOption } from '@/components/MultiSelect/MultiSelect';
import Modal from '@/components/Modal/Modal';
import Select, { type SelectOption } from '@/components/Select/Select';
import TeamLogo, { TeamLogoProps } from '@/components/TeamLogo/TeamLogo';
import ScoreImageModal from '@/pages/admin/games/game-details/ScoreImageModal';
import { type GameRecord } from '@/hooks/useGames';
import { downloadMonthScheduleImage } from '@/lib/monthScheduleImage';
import styles from './UserGames.module.scss';

const API = import.meta.env.VITE_API_URL || '/api';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const TZ_STORAGE_KEY = 'user-games-tz-pref';
const WEEK_STORAGE_KEY = 'user-games-week-start';
const CALENDAR_MONTH_STORAGE_KEY = 'user-games-calendar-month';

// ── Constants ─────────────────────────────────────────────────────────────────

const TZ_OPTIONS: SelectOption[] = [
  { value: 'ET', label: 'Eastern Time' },
  { value: 'local', label: 'My Timezone' },
];

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'in_progress', label: 'Live' },
  { value: 'scheduled', label: 'Upcoming' },
  { value: 'final', label: 'Final' },
];

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
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const toMonthPickerValue = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const fromMonthPickerValue = (value: string) => {
  const [year, month] = value.split('-').map(Number);
  return new Date(year, month - 1, 1);
};

const getStoredWeekStart = () => {
  const stored = sessionStorage.getItem(WEEK_STORAGE_KEY);
  return stored && DATE_ONLY_RE.test(stored) ? fromISODate(stored) : toDay(new Date());
};

const getStoredCalendarMonth = () => {
  const stored = sessionStorage.getItem(CALENDAR_MONTH_STORAGE_KEY);
  return stored && MONTH_ONLY_RE.test(stored) ? fromMonthPickerValue(stored) : null;
};

type TzPref = 'ET' | 'local';

const getStoredTzPref = (): TzPref => {
  const stored = localStorage.getItem(TZ_STORAGE_KEY);
  return stored === 'local' || stored === 'ET' ? stored : 'ET';
};

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
  const rawDateKey = getRawDateKey(scheduledAt);
  const isMidnightPlaceholder =
    !!scheduledTime &&
    scheduledTime !== '00:00' &&
    !!rawDateKey &&
    ISO_MIDNIGHT_RE.test(scheduledAt);

  if (!scheduledTime) {
    if (DATE_ONLY_RE.test(scheduledAt)) return new Date(`${scheduledAt}T17:00:00Z`);
    return hasDirectInstant ? direct : null;
  }

  if (hasDirectInstant && !DATE_ONLY_RE.test(scheduledAt) && !isMidnightPlaceholder) {
    return direct;
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
 * When `tzPref` is 'ET', the raw HH:MM stored in the DB (Eastern Time) is
 * formatted as 12-hour with "EST" or "EDT" suffix (DST-aware).
 *
 * When `tzPref` is 'local', we reconstruct the exact Eastern moment (DST-aware)
 * and convert it to the browser's local timezone using the browser's locale.
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

const getScoreCardGame = (game: GameRecord): GameRecord => ({
  ...game,
  series_home_wins: game.series_home_wins_at_game ?? null,
  series_away_wins: game.series_away_wins_at_game ?? null,
});

interface GameActionsProps {
  watched: boolean;
  scheduled: boolean;
  busy: boolean;
  onView: () => void;
  onDownloadScoreCard: () => void;
  onMarkWatched: () => void;
  onUnwatch: () => void;
  onSchedule: () => void;
  onSkip: () => void;
}

const GameHoverActions = ({
  watched,
  scheduled,
  busy,
  onView,
  onDownloadScoreCard,
  onMarkWatched,
  onUnwatch,
  onSchedule,
  onSkip,
}: GameActionsProps) => (
  <span className={styles.gameActions}>
    {watched && (
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
        intent="warning"
        icon="undo"
        size="sm"
        tooltip="Unwatch"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          void onUnwatch();
        }}
      />
    )}
    {!watched && (
      <Button
        type="button"
        variant="outlined"
        intent="danger"
        icon="visibility_off"
        size="sm"
        tooltip="Won’t watch"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          void onSkip();
        }}
      />
    )}
    {!watched && (
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
    {!watched && (
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

// ── Team block ────────────────────────────────────────────────────────────────

interface TeamBlockProps {
  name: string;
  code: string;
  logo: string | null;
  primaryColor: string;
  textColor: string;
  align: 'left' | 'right';
}

const TeamBlock = ({ name, code, logo, primaryColor, textColor, align }: TeamBlockProps) => (
  <div className={`${styles.team} ${align === 'right' ? styles.teamRight : ''}`}>
    <TeamLogo
      logo={logo}
      code={code}
      primaryColor={primaryColor}
      textColor={textColor}
      size={32}
      shape="circle"
    />
    <span className={styles.teamName}>{name}</span>
  </div>
);

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

  useEffect(() => {
    if (open) reset({ scheduled_for: value });
  }, [open, reset, value]);

  const submit = handleSubmit(() => onSave());

  if (!game) return null;

  return (
    <Modal
      open={open}
      title="Schedule Watch"
      onClose={onClose}
      onConfirm={submit}
      confirmLabel={busy ? 'Saving…' : 'Save Schedule'}
      confirmDisabled={busy || !isDirty || !isValid}
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
      </div>
    </Modal>
  );
};

// ── Game card ─────────────────────────────────────────────────────────────────

const GameCard = ({
  game,
  tzPref,
  onOpen,
  onDownloadScoreCard,
  onMarkWatched,
  onUnwatch,
  onSchedule,
  onSkip,
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
  busy: boolean;
}) => {
  const showScore = shouldShowWatchedScore(game);
  const home = game.home_score;
  const away = game.away_score;
  const originalDateLabel = getOriginalGameDateLabel(game, tzPref);
  const isWatched = !!game.watched_by_user;

  return (
    <div
      className={[
        styles.gameCard,
        game.status === 'in_progress' ? styles.live : '',
        !game.watched_by_user ? styles.gameCardUnwatched : '',
        isWatched ? styles.gameCardClickable : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role={isWatched ? 'button' : undefined}
      tabIndex={isWatched ? 0 : undefined}
      style={getLeagueStyle(game)}
      onClick={isWatched ? onOpen : undefined}
      onKeyDown={
        isWatched
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onOpen();
            }
          : undefined
      }
    >
      <GameHoverActions
        watched={isWatched}
        scheduled={!!game.scheduled_for}
        busy={busy}
        onView={onOpen}
        onDownloadScoreCard={onDownloadScoreCard}
        onMarkWatched={onMarkWatched}
        onUnwatch={onUnwatch}
        onSchedule={onSchedule}
        onSkip={onSkip}
      />

      {originalDateLabel && <div className={styles.originalGameDate}>{originalDateLabel}</div>}

      <div className={styles.cardMeta}>
        {game.scheduled_time && (
          <span className={styles.metaTime}>
            {fmtGameTime(game.scheduled_at, game.scheduled_time, tzPref)}
          </span>
        )}
        {game.season_name && <span className={styles.metaSeason}>{game.season_name}</span>}
      </div>

      <div className={styles.matchup}>
        <TeamBlock
          name={game.home_team.name}
          code={game.home_team.code}
          logo={game.home_team.logo}
          primaryColor={game.home_team.primary_color}
          textColor={game.home_team.text_color}
          align="left"
        />
        <div className={styles.scoreBlock}>
          {showScore ? (
            <>
              <span className={home > away ? styles.scoreWin : styles.scoreVal}>{home}</span>
              <span className={styles.scoreSep}>–</span>
              <span className={away > home ? styles.scoreWin : styles.scoreVal}>{away}</span>
            </>
          ) : (
            <>
              <span className={styles.scoreVal}>–</span>
              <span className={styles.scoreSep}>–</span>
              <span className={styles.scoreVal}>–</span>
            </>
          )}
        </div>
        <TeamBlock
          name={game.away_team.name}
          code={game.away_team.code}
          logo={game.away_team.logo}
          primaryColor={game.away_team.primary_color}
          textColor={game.away_team.text_color}
          align="right"
        />
      </div>
    </div>
  );
};

const CalendarGameTeam = ({
  code,
  gameStatus,
  logo,
  primaryColor,
  score,
  showPlayoffSeriesDots,
  seriesTotalWins = 0,
  seriesWins = 0,
  textColor,
}: Pick<TeamLogoProps, 'logo' | 'code' | 'primaryColor' | 'textColor'> & {
  gameStatus: 'pending' | 'win' | 'lose';
  score: string | number;
  showPlayoffSeriesDots?: boolean;
  seriesTotalWins: number | null;
  seriesWins: number | null;
}) => {
  return (
    <div className={styles.calendarGameTeam}>
      <div className={styles.calendarGameInfo}>
        <span
          className={[
            styles.calendarGameScore,
            gameStatus === 'win' ? styles.calendarGameScoreWin : '',
            gameStatus === 'lose' ? styles.calendarGameScoreLose : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {score}
        </span>
        <TeamLogo
          logo={logo}
          code={code}
          primaryColor={primaryColor}
          textColor={textColor}
          size={28}
          shape="circle"
        />
      </div>
      {showPlayoffSeriesDots && (
        <PlayoffSeriesDots
          wins={seriesWins || 0}
          total={seriesTotalWins || 0}
        />
      )}
    </div>
  );
};

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
  const showScore = shouldShowWatchedScore(game);
  const home = game.home_score;
  const away = game.away_score;
  const awayGameStatus: 'pending' | 'win' | 'lose' =
    !showScore || away === home ? 'pending' : away > home ? 'win' : 'lose';
  const homeGameStatus: 'pending' | 'win' | 'lose' =
    !showScore || home === away ? 'pending' : home > away ? 'win' : 'lose';
  const originalDateLabel = getOriginalGameDateLabel(game, tzPref);
  const playoffMetaLabel = getPlayoffGameMetaLabel(game);
  const awaySeriesWins = getSeriesWinsForTeam(game, game.away_team.id);
  const homeSeriesWins = getSeriesWinsForTeam(game, game.home_team.id);
  const seriesTotalWins = game.series_games_to_win;

  return (
    <div
      className={[
        styles.calendarGameCard,
        game.status === 'in_progress' ? styles.calendarGameLive : '',
        !game.watched_by_user ? styles.calendarGameCardUnwatched : '',
        draggable ? styles.calendarGameCardDraggable : '',
        dragging ? styles.calendarGameCardDragging : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={getLeagueStyle(game)}
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
    >
      <GameHoverActions
        watched={!!game.watched_by_user}
        scheduled={!!game.scheduled_for}
        busy={busy}
        onView={onOpen}
        onDownloadScoreCard={onDownloadScoreCard}
        onMarkWatched={onMarkWatched}
        onUnwatch={onUnwatch}
        onSchedule={onSchedule}
        onSkip={onSkip}
      />
      {originalDateLabel && (
        <div className={styles.calendarGameOriginalDate}>{originalDateLabel}</div>
      )}
      <div className={styles.calendarGameInfo}>
        <CalendarGameTeam
          code={game.away_team.code}
          gameStatus={awayGameStatus}
          logo={game.away_team.logo}
          primaryColor={game.away_team.primary_color}
          score={showScore ? away : '–'}
          showPlayoffSeriesDots={
            !!game.watched_by_user && seriesTotalWins != null && awaySeriesWins != null
          }
          seriesTotalWins={seriesTotalWins}
          seriesWins={awaySeriesWins}
          textColor={game.away_team.text_color}
        />
        <span className={styles.calendarGameAt}>
          {playoffMetaLabel && (
            <span className={styles.calendarGamePlayoffMeta}>{playoffMetaLabel}</span>
          )}
          <span className={styles.calendarGameAtSymbol}>@</span>
        </span>
        <CalendarGameTeam
          code={game.home_team.code}
          gameStatus={homeGameStatus}
          logo={game.home_team.logo}
          primaryColor={game.home_team.primary_color}
          score={showScore ? home : '–'}
          showPlayoffSeriesDots={
            !!game.watched_by_user && seriesTotalWins != null && homeSeriesWins != null
          }
          seriesTotalWins={seriesTotalWins}
          seriesWins={homeSeriesWins}
          textColor={game.home_team.text_color}
        />
      </div>
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

const UserGames = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const initialStoredCalendarMonth = getStoredCalendarMonth();
  const [weekStart, setWeekStart] = useState<Date>(() => getStoredWeekStart());
  const [view, setView] = useState<'list' | 'calendar'>('calendar');
  const [leagueId, setLeagueId] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tzPref, setTzPref] = useState<TzPref>(() => getStoredTzPref());
  const [actionGameId, setActionGameId] = useState<string | null>(null);
  const [dragGameId, setDragGameId] = useState<string | null>(null);
  const [confirmSkipGame, setConfirmSkipGame] = useState<GameRecord | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<GameRecord | null>(null);
  const [scoreCardTarget, setScoreCardTarget] = useState<GameRecord | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [exportingMonthImage, setExportingMonthImage] = useState(false);
  const prevTzPrefRef = useRef<TzPref>(tzPref);
  const preserveCalendarMonthRef = useRef(false);
  const hasPinnedCalendarMonthRef = useRef(initialStoredCalendarMonth !== null);
  const calendarGridRef = useRef<HTMLDivElement>(null);

  const weekEnd = addDays(weekStart, 6);

  useEffect(() => {
    localStorage.setItem(TZ_STORAGE_KEY, tzPref);
  }, [tzPref]);

  useEffect(() => {
    sessionStorage.setItem(WEEK_STORAGE_KEY, dateToISO(weekStart));
  }, [weekStart]);

  const { data: leagues = [] } = useQuery<
    { id: string; name: string; code: string; logo: string | null }[]
  >({
    queryKey: ['user-leagues'],
    queryFn: async () => {
      const { data } = await axios.get(`${API}/user/leagues`, { headers: authHeaders() });
      return data;
    },
  });

  const { data: favoriteTeamIds = [] } = useQuery<string[]>({
    queryKey: ['user-favorites'],
    queryFn: async () => {
      const { data } = await axios.get<string[]>(`${API}/user/favorites`, {
        headers: authHeaders(),
      });
      return data;
    },
  });

  const leagueSelected = leagueId !== 'all';

  const { data: games = [], isLoading } = useQuery<GameRecord[]>({
    queryKey: ['user-games', statusFilter, leagueId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (leagueSelected) params.league_id = leagueId;
      const { data } = await axios.get<GameRecord[]>(`${API}/user/games`, {
        headers: authHeaders(),
        params,
      });
      return data;
    },
  });

  const favoriteTeamOptions = useMemo<MultiSelectOption[]>(() => {
    const favoriteTeamIdSet = new Set(favoriteTeamIds);
    const options = new Map<string, MultiSelectOption>();

    for (const game of games) {
      for (const team of [game.home_team, game.away_team]) {
        if (!favoriteTeamIdSet.has(team.id) || options.has(team.id)) continue;
        options.set(team.id, {
          value: team.id,
          label: team.name,
          logo: team.logo ?? undefined,
          code: team.code,
        });
      }
    }

    return Array.from(options.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [games, favoriteTeamIds]);

  useEffect(() => {
    const availableIds = new Set(favoriteTeamOptions.map((option) => option.value));
    setTeamFilter((current) => {
      const next = current.filter((teamId) => availableIds.has(teamId));
      return next.length === current.length &&
        next.every((teamId, index) => teamId === current[index])
        ? current
        : next;
    });
  }, [favoriteTeamOptions]);

  const filteredGames = useMemo(() => {
    if (teamFilter.length === 0) return games;
    return games.filter(
      (game) => teamFilter.includes(game.home_team.id) || teamFilter.includes(game.away_team.id),
    );
  }, [games, teamFilter]);

  const scheduledGames = useMemo(
    () => filteredGames.filter((game) => !!getEffectiveUserDateKey(game, tzPref)),
    [filteredGames, tzPref],
  );

  const preferredMonth = useMemo(() => {
    const now = monthStart(new Date());
    if (
      scheduledGames.some((game) => {
        const key = getEffectiveUserDateKey(game, tzPref);
        return key && monthKey(monthStart(dateKeyToDate(key))) === monthKey(now);
      })
    ) {
      return now;
    }
    const firstKey = scheduledGames[0] ? getEffectiveUserDateKey(scheduledGames[0], tzPref) : null;
    return firstKey ? monthStart(dateKeyToDate(firstKey)) : now;
  }, [scheduledGames, tzPref]);

  const [calendarMonth, setCalendarMonth] = useState<Date>(
    () => initialStoredCalendarMonth ?? preferredMonth,
  );

  useEffect(() => {
    sessionStorage.setItem(CALENDAR_MONTH_STORAGE_KEY, toMonthPickerValue(calendarMonth));
  }, [calendarMonth]);

  useEffect(() => {
    const tzChanged = prevTzPrefRef.current !== tzPref;
    prevTzPrefRef.current = tzPref;
    if (tzChanged) return;
    if (preserveCalendarMonthRef.current) {
      preserveCalendarMonthRef.current = false;
      return;
    }
    if (hasPinnedCalendarMonthRef.current) return;
    setCalendarMonth((current) =>
      monthKey(monthStart(current)) === monthKey(preferredMonth) ? current : preferredMonth,
    );
  }, [preferredMonth, tzPref]);

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
      map.set(key, dayGames.slice().sort(sortGamesByTime));
    }
    return map;
  }, [scheduledGames, tzPref]);

  const leagueOptions: SelectOption[] = [
    { value: 'all', label: 'All Leagues' },
    ...leagues.map((l) => ({ value: l.id, label: l.code, logo: l.logo })),
  ];

  const openGame = (gameId: string) => navigate(`/games/${gameId}`);
  const openSkipConfirm = (game: GameRecord) => setConfirmSkipGame(game);
  const openScoreCardModal = (game: GameRecord) => setScoreCardTarget(getScoreCardGame(game));
  const openScheduleModal = (game: GameRecord) => {
    setScheduleTarget(game);
    setScheduleDate(getScheduledWatchDateKey(game.scheduled_for) ?? '');
  };

  const saveScheduleForGame = async (gameId: string, scheduledFor: string | null) => {
    if (actionGameId === gameId || scheduleBusy) return false;
    setActionGameId(gameId);
    try {
      await axios.put(
        `${API}/user/watched-games/${gameId}/schedule`,
        { scheduled_for: scheduledFor },
        { headers: authHeaders() },
      );
      preserveCalendarMonthRef.current = true;
      queryClient.setQueriesData(
        { queryKey: ['user-games'] },
        (existing: GameRecord[] | undefined) => {
          if (!Array.isArray(existing)) return existing;
          return existing.map((game) =>
            game.id === gameId ? { ...game, scheduled_for: scheduledFor } : game,
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
      preserveCalendarMonthRef.current = true;
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
      preserveCalendarMonthRef.current = true;
      queryClient.setQueriesData(
        { queryKey: ['user-games'] },
        (existing: GameRecord[] | undefined) => {
          if (!Array.isArray(existing)) return existing;
          return existing.filter((game) => game.id !== gameId);
        },
      );
    } catch {
      toast.error('Failed to hide game');
    } finally {
      setActionGameId(null);
    }
  };

  const unwatchGame = async (gameId: string) => {
    if (actionGameId === gameId) return;
    setActionGameId(gameId);
    try {
      await axios.delete(`${API}/user/watched-games/${gameId}`, { headers: authHeaders() });
      preserveCalendarMonthRef.current = true;
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
    const targetGameId = scheduleTarget.id;
    const normalizedScheduleDate = getScheduledWatchDateKey(scheduleDate);
    setScheduleBusy(true);
    try {
      const ok = await saveScheduleForGame(targetGameId, normalizedScheduleDate);
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

    await saveScheduleForGame(draggedId, normalizedScheduleDate);
  };

  const handleWeekNavigate = (offsetDays: number) => {
    setWeekStart((current) => toDay(addDays(current, offsetDays)));
  };

  const handleWeekPickerChange = (value: string | null) => {
    setWeekStart(value ? fromISODate(value) : toDay(new Date()));
  };

  const handleCalendarMonthChange = (next: Date | ((current: Date) => Date)) => {
    hasPinnedCalendarMonthRef.current = true;
    setCalendarMonth((current) => {
      const resolved = typeof next === 'function' ? next(current) : next;
      return monthStart(resolved);
    });
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

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div className={styles.primaryControls}>
          {view === 'list' ? (
            <div className={styles.weekNav}>
              <button
                className={styles.navBtn}
                aria-label="Previous week"
                onClick={() => handleWeekNavigate(-7)}
              >
                <Icon name="chevron_left" />
              </button>
              <DatePicker
                value={dateToISO(weekStart)}
                onChange={handleWeekPickerChange}
                triggerLabel={fmtWeekRange(weekStart, weekEnd)}
                triggerAriaLabel={`Select week: ${fmtWeekRange(weekStart, weekEnd)}`}
              />
              <button
                className={styles.navBtn}
                aria-label="Next week"
                onClick={() => handleWeekNavigate(7)}
              >
                <Icon name="chevron_right" />
              </button>
            </div>
          ) : (
            <div className={styles.weekNav}>
              <button
                className={styles.navBtn}
                aria-label="Previous month"
                onClick={() => handleCalendarMonthChange((current) => addMonths(current, -1))}
              >
                <Icon name="chevron_left" />
              </button>
              <DatePicker
                value={toMonthPickerValue(calendarMonth)}
                onChange={(value) =>
                  value && handleCalendarMonthChange(fromMonthPickerValue(value))
                }
                granularity="month"
                triggerLabel={MONTH_LABEL_FMT.format(calendarMonth)}
                triggerAriaLabel={`Select month: ${MONTH_LABEL_FMT.format(calendarMonth)}`}
              />
              <button
                className={styles.navBtn}
                aria-label="Next month"
                onClick={() => handleCalendarMonthChange((current) => addMonths(current, 1))}
              >
                <Icon name="chevron_right" />
              </button>
            </div>
          )}

          <div className={styles.viewToggle}>
            <button
              type="button"
              className={`${styles.viewBtn} ${view === 'calendar' ? styles.viewBtnActive : ''}`}
              aria-label="Calendar view"
              onClick={() => setView('calendar')}
            >
              <Icon name="calendar_month" />
            </button>
            <button
              type="button"
              className={`${styles.viewBtn} ${view === 'list' ? styles.viewBtnActive : ''}`}
              aria-label="List view"
              onClick={() => setView('list')}
            >
              <Icon name="view_list" />
            </button>
          </div>
        </div>

        <div className={styles.filters}>
          <div className={styles.filterSelect}>
            <Select
              value={leagueId}
              options={leagueOptions}
              onChange={setLeagueId}
            />
          </div>
          <div className={`${styles.filterSelect} ${styles.teamFilter}`}>
            <MultiSelect
              value={teamFilter}
              options={favoriteTeamOptions}
              placeholder="All Favorite Teams"
              emptyMessage="No favorite teams available"
              onChange={setTeamFilter}
              searchable
            />
          </div>
          <div className={styles.filterSelect}>
            <Select
              value={statusFilter}
              options={STATUS_OPTIONS}
              onChange={setStatusFilter}
            />
          </div>
          <div className={styles.filterSelect}>
            <Select
              value={tzPref}
              options={TZ_OPTIONS}
              onChange={(v) => setTzPref(v as TzPref)}
            />
          </div>
          {view === 'calendar' && scheduledGames.length > 0 && (
            <div className={`${styles.filterSelect} ${styles.filterAction}`}>
              <Button
                type="button"
                variant="outlined"
                intent="neutral"
                size="sm"
                icon="download"
                iconHeight="field"
                aria-label="Download month image"
                tooltip="Download month image"
                className={styles.calendarExportButton}
                onClick={() => void handleDownloadMonthImage()}
                disabled={exportingMonthImage}
              />
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className={styles.empty}>Loading…</p>
      ) : view === 'list' ? (
        <div className={styles.gamesList}>
          {groupedByDate.map(([dateKey, dayGames]) => (
            <Card
              key={dateKey}
              title={fmtDayHeading(dateKey)}
            >
              {dayGames.length === 0 ? (
                <p className={styles.dayEmpty}>No games scheduled.</p>
              ) : (
                <div className={styles.dayGames}>
                  {dayGames.map((g) => (
                    <GameCard
                      key={g.id}
                      game={g}
                      tzPref={tzPref}
                      onOpen={() => openGame(g.id)}
                      onDownloadScoreCard={() => openScoreCardModal(g)}
                      onMarkWatched={() => markGameWatched(g.id)}
                      onUnwatch={() => unwatchGame(g.id)}
                      onSchedule={() => openScheduleModal(g)}
                      onSkip={() => openSkipConfirm(g)}
                      busy={actionGameId === g.id}
                    />
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : scheduledGames.length === 0 ? (
        <p className={styles.empty}>
          No scheduled games from your favorite teams to place on the calendar.
        </p>
      ) : (
        <div className={styles.calendarWrap}>
          <MonthCalendar
            ref={calendarGridRef}
            month={calendarMonth}
            getDayProps={({ dateKey }) => ({
              'data-date-key': dateKey,
              onDragOver: handleCalendarDragOver(dateKey),
              onDrop: handleCalendarDrop(dateKey),
            })}
            renderDayContent={({ dateKey }) => {
              const dayGames = gamesByCalendarDate.get(dateKey) ?? [];
              return dayGames.length > 0 ? (
                <div className={styles.calendarGameList}>
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
                      onSkip={() => openSkipConfirm(game)}
                      onDragStart={handleCalendarDragStart(game)}
                      onDragEnd={handleCalendarDragEnd}
                      draggable={!game.watched_by_user && actionGameId !== game.id}
                      dragging={dragGameId === game.id}
                      busy={actionGameId === game.id}
                    />
                  ))}
                </div>
              ) : null;
            }}
          />
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

      <ConfirmModal
        open={!!confirmSkipGame}
        title="Won’t Watch Game"
        body={
          confirmSkipGame
            ? `Hide ${confirmSkipGame.away_team.code} @ ${confirmSkipGame.home_team.code} from your games feed?`
            : ''
        }
        confirmLabel="Hide game"
        confirmIcon="visibility_off"
        variant="danger"
        busy={actionGameId === confirmSkipGame?.id}
        onCancel={() => {
          if (actionGameId === confirmSkipGame?.id) return;
          setConfirmSkipGame(null);
        }}
        onConfirm={async () => {
          if (!confirmSkipGame) return;
          await skipGame(confirmSkipGame.id);
          setConfirmSkipGame(null);
        }}
      />

      <ScoreImageModal
        open={!!scoreCardTarget}
        game={scoreCardTarget ?? undefined}
        liveAwayScore={scoreCardTarget?.away_score}
        liveHomeScore={scoreCardTarget?.home_score}
        overtimeSuffix={scoreCardTarget ? getOvertimeSuffix(scoreCardTarget) : ''}
        onClose={() => setScoreCardTarget(null)}
      />
    </div>
  );
};

export default UserGames;
