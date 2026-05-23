import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import DatePicker from '@/components/DatePicker/DatePicker';
import Icon from '@/components/Icon/Icon';
import Modal from '@/components/Modal/Modal';
import Select, { type SelectOption } from '@/components/Select/Select';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
import { type GameRecord } from '@/hooks/useGames';
import styles from './UserGames.module.scss';

const API = import.meta.env.VITE_API_URL || '/api';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const TZ_STORAGE_KEY = 'user-games-tz-pref';

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

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const daysInMonth = (year: number, monthIndex: number) =>
  new Date(year, monthIndex + 1, 0).getDate();
const firstDayOfWeek = (year: number, monthIndex: number) => new Date(year, monthIndex, 1).getDay();
const toMonthPickerValue = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const fromMonthPickerValue = (value: string) => {
  const [year, month] = value.split('-').map(Number);
  return new Date(year, month - 1, 1);
};

type TzPref = 'ET' | 'local';

const getStoredTzPref = (): TzPref => {
  const stored = localStorage.getItem(TZ_STORAGE_KEY);
  return stored === 'local' || stored === 'ET' ? stored : 'ET';
};

/** Returns 'EST' or 'EDT' for the America/New_York timezone on the given game date. */
const getEtAbbr = (scheduledAt: string | null): string => {
  const base = scheduledAt ? new Date(scheduledAt) : new Date();
  const etDatePart = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(
    base,
  );
  return (
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      timeZoneName: 'short',
    })
      .formatToParts(new Date(`${etDatePart}T12:00:00`))
      .find((p) => p.type === 'timeZoneName')?.value ?? 'ET'
  );
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
  if (!scheduledTime) return '';
  const [h, m] = scheduledTime.split(':').map(Number);
  const abbr = getEtAbbr(scheduledAt);

  if (tzPref === 'ET') {
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'} ${abbr}`;
  }

  // Derive the ET calendar date for this game so we can reconstruct the full
  // Eastern moment even if scheduled_at only carries a date (no time).
  const base = scheduledAt ? new Date(scheduledAt) : new Date();
  const etDatePart = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(
    base,
  );
  const offset = abbr === 'EDT' ? '-04:00' : '-05:00';

  // Build the exact UTC moment and format in the browser's local timezone.
  const d = new Date(`${etDatePart}T${scheduledTime}:00${offset}`);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const getScheduledInstant = (scheduledAt: string | null, scheduledTime: string | null) => {
  if (!scheduledAt) return null;
  if (!scheduledTime) return new Date(scheduledAt);

  const abbr = getEtAbbr(scheduledAt);
  const base = new Date(scheduledAt);
  const etDatePart = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(
    base,
  );
  const offset = abbr === 'EDT' ? '-04:00' : '-05:00';
  return new Date(`${etDatePart}T${scheduledTime}:00${offset}`);
};

const getOriginalGameDateKey = (game: GameRecord, tzPref: TzPref) => {
  const instant = getScheduledInstant(game.scheduled_at, game.scheduled_time);
  if (!instant) return null;
  return tzPref === 'ET' ? toDateKeyInZone(instant, 'America/New_York') : toDateKeyInZone(instant);
};

const getScheduledWatchDateKey = (value: string | null | undefined) => {
  if (!value) return null;
  if (DATE_ONLY_RE.test(value)) return value;
  return toLocalDateKey(value);
};

const getEffectiveUserDateKey = (game: GameRecord, tzPref: TzPref) =>
  getScheduledWatchDateKey(game.scheduled_for) ?? getOriginalGameDateKey(game, tzPref);

const totalScore = (periods: GameRecord['period_scores']) => ({
  home: periods.reduce((s, p) => s + p.home_goals, 0),
  away: periods.reduce((s, p) => s + p.away_goals, 0),
});

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

interface GameActionsProps {
  watched: boolean;
  scheduled: boolean;
  busy: boolean;
  onView: () => void;
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
  if (!game) return null;

  return (
    <Modal
      open={open}
      title="Schedule Watch"
      onClose={onClose}
      onConfirm={onSave}
      confirmLabel={busy ? 'Saving…' : 'Save Schedule'}
      confirmDisabled={busy}
      busy={busy}
      footerStart={
        value ? (
          <Button
            type="button"
            variant="ghost"
            intent="neutral"
            onClick={() => onChange('')}
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
        <DatePicker
          value={value}
          onChange={onChange}
          placeholder="Watch date"
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
  onMarkWatched,
  onUnwatch,
  onSchedule,
  onSkip,
  busy,
}: {
  game: GameRecord;
  tzPref: TzPref;
  onOpen: () => void;
  onMarkWatched: () => Promise<void>;
  onUnwatch: () => Promise<void>;
  onSchedule: () => void;
  onSkip: () => Promise<void>;
  busy: boolean;
}) => {
  const showScore = shouldShowWatchedScore(game);
  const { home, away } = totalScore(game.period_scores);
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

const CalendarGameCard = ({
  game,
  tzPref,
  onOpen,
  onMarkWatched,
  onUnwatch,
  onSchedule,
  onSkip,
  busy,
}: {
  game: GameRecord;
  tzPref: TzPref;
  onOpen: () => void;
  onMarkWatched: () => Promise<void>;
  onUnwatch: () => Promise<void>;
  onSchedule: () => void;
  onSkip: () => Promise<void>;
  busy: boolean;
}) => {
  const showScore = shouldShowWatchedScore(game);
  const { home, away } = totalScore(game.period_scores);
  const originalDateLabel = getOriginalGameDateLabel(game, tzPref);

  return (
    <div
      className={[
        styles.calendarGameCard,
        game.status === 'in_progress' ? styles.calendarGameLive : '',
        !game.watched_by_user ? styles.calendarGameCardUnwatched : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={getLeagueStyle(game)}
    >
      {originalDateLabel && (
        <div className={styles.calendarGameOriginalDate}>{originalDateLabel}</div>
      )}
      <GameHoverActions
        watched={!!game.watched_by_user}
        scheduled={!!game.scheduled_for}
        busy={busy}
        onView={onOpen}
        onMarkWatched={onMarkWatched}
        onUnwatch={onUnwatch}
        onSchedule={onSchedule}
        onSkip={onSkip}
      />
      <span className={styles.calendarGameScore}>{showScore ? away : '–'}</span>
      <TeamLogo
        logo={game.away_team.logo}
        code={game.away_team.code}
        primaryColor={game.away_team.primary_color}
        textColor={game.away_team.text_color}
        size={28}
        shape="circle"
      />
      <span className={styles.calendarGameAt}>@</span>
      <span className={styles.calendarGameScore}>{showScore ? home : '–'}</span>
      <TeamLogo
        logo={game.home_team.logo}
        code={game.home_team.code}
        primaryColor={game.home_team.primary_color}
        textColor={game.home_team.text_color}
        size={28}
        shape="circle"
      />
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

const UserGames = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState<Date>(() => toDay(new Date()));
  const [view, setView] = useState<'list' | 'calendar'>('calendar');
  const [leagueId, setLeagueId] = useState<string>('all');
  const [seasonId, setSeasonId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tzPref, setTzPref] = useState<TzPref>(() => getStoredTzPref());
  const [actionGameId, setActionGameId] = useState<string | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<GameRecord | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const prevTzPrefRef = useRef<TzPref>(tzPref);
  const preserveCalendarMonthRef = useRef(false);

  const weekEnd = addDays(weekStart, 6);

  useEffect(() => {
    localStorage.setItem(TZ_STORAGE_KEY, tzPref);
  }, [tzPref]);

  const { data: leagues = [] } = useQuery<
    { id: string; name: string; code: string; logo: string | null }[]
  >({
    queryKey: ['user-leagues'],
    queryFn: async () => {
      const { data } = await axios.get(`${API}/user/leagues`, { headers: authHeaders() });
      return data;
    },
  });

  const leagueSelected = leagueId !== 'all';

  const { data: seasons = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['user-seasons', leagueId],
    queryFn: async () => {
      const { data } = await axios.get(`${API}/user/seasons`, {
        headers: authHeaders(),
        params: leagueSelected ? { league_id: leagueId } : undefined,
      });
      return data;
    },
  });

  const { data: games = [], isLoading } = useQuery<GameRecord[]>({
    queryKey: ['user-games', statusFilter, leagueId, seasonId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (leagueSelected) params.league_id = leagueId;
      if (seasonId !== 'all') params.season_id = seasonId;
      const { data } = await axios.get<GameRecord[]>(`${API}/user/games`, {
        headers: authHeaders(),
        params,
      });
      return data;
    },
  });

  const scheduledGames = useMemo(
    () => games.filter((game) => !!getEffectiveUserDateKey(game, tzPref)),
    [games, tzPref],
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

  const [calendarMonth, setCalendarMonth] = useState<Date>(preferredMonth);

  useEffect(() => {
    const tzChanged = prevTzPrefRef.current !== tzPref;
    prevTzPrefRef.current = tzPref;
    if (tzChanged) return;
    if (preserveCalendarMonthRef.current) {
      preserveCalendarMonthRef.current = false;
      return;
    }
    setCalendarMonth((current) =>
      monthKey(monthStart(current)) === monthKey(preferredMonth) ? current : preferredMonth,
    );
  }, [preferredMonth, tzPref]);

  // Build a 7-slot array (one per day in the window), each with its games.
  const groupedByDate = useMemo(() => {
    const map = new Map<string, GameRecord[]>();
    for (const g of games) {
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
  }, [games, weekStart, weekEnd, tzPref]);

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

  const calendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const monthIndex = calendarMonth.getMonth();
    const total = daysInMonth(year, monthIndex);
    const startDow = firstDayOfWeek(year, monthIndex);
    const cells: (number | null)[] = Array(startDow).fill(null);
    for (let day = 1; day <= total; day++) cells.push(day);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calendarMonth]);

  const leagueOptions: SelectOption[] = [
    { value: 'all', label: 'All Leagues' },
    ...leagues.map((l) => ({ value: l.id, label: l.code, logo: l.logo })),
  ];
  const seasonOptions: SelectOption[] = [
    { value: 'all', label: 'All Seasons' },
    ...seasons.map((s) => ({ value: s.id, label: s.name })),
  ];

  const openGame = (gameId: string) => navigate(`/games/${gameId}`);
  const openScheduleModal = (game: GameRecord) => {
    setScheduleTarget(game);
    setScheduleDate(getScheduledWatchDateKey(game.scheduled_for) ?? '');
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
      await axios.put(
        `${API}/user/watched-games/${targetGameId}/schedule`,
        { scheduled_for: normalizedScheduleDate },
        { headers: authHeaders() },
      );
      preserveCalendarMonthRef.current = true;
      queryClient.setQueriesData(
        { queryKey: ['user-games'] },
        (existing: GameRecord[] | undefined) => {
          if (!Array.isArray(existing)) return existing;
          return existing.map((game) =>
            game.id === targetGameId ? { ...game, scheduled_for: normalizedScheduleDate } : game,
          );
        },
      );
      setScheduleTarget(null);
      setScheduleDate('');
    } catch {
      toast.error('Failed to save watch schedule');
    } finally {
      setScheduleBusy(false);
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
                onClick={() => setWeekStart((d) => addDays(d, -7))}
              >
                <Icon name="chevron_left" />
              </button>
              <DatePicker
                value={dateToISO(weekStart)}
                onChange={(v) => setWeekStart(v ? fromISODate(v) : toDay(new Date()))}
                triggerLabel={fmtWeekRange(weekStart, weekEnd)}
                triggerAriaLabel={`Select week: ${fmtWeekRange(weekStart, weekEnd)}`}
              />
              <button
                className={styles.navBtn}
                aria-label="Next week"
                onClick={() => setWeekStart((d) => addDays(d, 7))}
              >
                <Icon name="chevron_right" />
              </button>
            </div>
          ) : (
            <div className={styles.weekNav}>
              <button
                className={styles.navBtn}
                aria-label="Previous month"
                onClick={() => setCalendarMonth((current) => addMonths(current, -1))}
              >
                <Icon name="chevron_left" />
              </button>
              <DatePicker
                value={toMonthPickerValue(calendarMonth)}
                onChange={(value) => value && setCalendarMonth(fromMonthPickerValue(value))}
                granularity="month"
                triggerLabel={MONTH_LABEL_FMT.format(calendarMonth)}
                triggerAriaLabel={`Select month: ${MONTH_LABEL_FMT.format(calendarMonth)}`}
              />
              <button
                className={styles.navBtn}
                aria-label="Next month"
                onClick={() => setCalendarMonth((current) => addMonths(current, 1))}
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
              onChange={(v) => {
                setLeagueId(v);
                setSeasonId('all');
              }}
            />
          </div>
          <div className={styles.filterSelect}>
            <Select
              value={seasonId}
              options={seasonOptions}
              onChange={setSeasonId}
              placeholder="All Seasons"
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
                      onMarkWatched={() => markGameWatched(g.id)}
                      onUnwatch={() => unwatchGame(g.id)}
                      onSchedule={() => openScheduleModal(g)}
                      onSkip={() => skipGame(g.id)}
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
          <div className={styles.calendarGrid}>
            {DAY_LABELS.map((label) => (
              <div
                key={label}
                className={styles.calendarDayName}
              >
                {label}
              </div>
            ))}
            {calendarCells.map((day, index) => {
              if (day === null) {
                return (
                  <div
                    key={`blank-${index}`}
                    className={styles.calendarEmptyCell}
                  />
                );
              }

              const dateKey = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayGames = gamesByCalendarDate.get(dateKey) ?? [];

              return (
                <div
                  key={dateKey}
                  className={styles.calendarDayCell}
                >
                  <div className={styles.calendarDayHeader}>
                    <span className={styles.calendarDayNumber}>{day}</span>
                  </div>
                  {dayGames.length > 0 && (
                    <div className={styles.calendarGameList}>
                      {dayGames.map((game) => (
                        <CalendarGameCard
                          key={game.id}
                          game={game}
                          tzPref={tzPref}
                          onOpen={() => openGame(game.id)}
                          onMarkWatched={() => markGameWatched(game.id)}
                          onUnwatch={() => unwatchGame(game.id)}
                          onSchedule={() => openScheduleModal(game)}
                          onSkip={() => skipGame(game.id)}
                          busy={actionGameId === game.id}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
    </div>
  );
};

export default UserGames;
