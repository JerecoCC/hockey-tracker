import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import DatePicker from '@/components/DatePicker/DatePicker';
import GameCard from '@/components/GameCard/GameCard';
import ListItem from '@/components/ListItem/ListItem';
import Modal from '@/components/Modal/Modal';
import { useAuth } from '@/context/AuthContext';
import useFavoriteTeams from '@/hooks/useFavoriteTeams';
import { type GameRecord } from '@/hooks/useGames';
import useTeams, { type TeamRecord } from '@/hooks/useTeams';
import ScoreImageModal from '@/pages/admin/games/game-details/ScoreImageModal';
import styles from './UserDashboard.module.scss';

const API = import.meta.env.VITE_API_URL || '/api';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
// Admin-only testing aid: overrides the dashboard's notion of "today".
const ADMIN_DATE_OVERRIDE_KEY = 'admin-dashboard-date-override';
const DATE_ONLY_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const ISO_DATE_PREFIX_RE = /^([0-9]{4}-[0-9]{2}-[0-9]{2})/;
const ISO_MIDNIGHT_RE = /T00:00(?::00(?:\.0+)?)?(?:Z|[+-][0-9]{2}:[0-9]{2})$/;

type TzPref = 'ET' | 'local';
const USER_TIMEZONE: TzPref = 'local';

const dateToISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const toLocalDateKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

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

const fmtDayHeading = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
};

const getEtAbbrForDateKey = (dateKey: string): string =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  })
    .formatToParts(new Date(`${dateKey}T17:00:00Z`))
    .find((part) => part.type === 'timeZoneName')?.value ?? 'ET';

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
    getEtDateKey(scheduledAt, scheduledTime) ?? toDateKeyInZone(new Date(), 'America/New_York');
  if (!etDatePart) return null;
  const offset = getEtAbbrForDateKey(etDatePart) === 'EDT' ? '-04:00' : '-05:00';
  return new Date(`${etDatePart}T${scheduledTime}:00${offset}`);
};

const getScheduledWatchDateKey = (value: string | null | undefined) => {
  if (!value) return null;
  if (DATE_ONLY_RE.test(value)) return value;
  return toLocalDateKey(value);
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

const sortGamesByTime = (a: GameRecord, b: GameRecord) => {
  if (!a.scheduled_time && !b.scheduled_time) return 0;
  if (!a.scheduled_time) return 1;
  if (!b.scheduled_time) return -1;
  return a.scheduled_time.localeCompare(b.scheduled_time);
};

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

const TeamChip = ({ team }: { team: TeamRecord }) => (
  <ListItem
    className={styles.favoriteTeam}
    image={team.logo}
    eyebrow={team.place_name || undefined}
    name={team.team_name || team.name}
    rightContent={{ type: 'code', value: team.code }}
    primaryColor={team.primary_color}
    textColor={team.text_color}
  />
);

const UserDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { teams, loading: teamsLoading } = useTeams();
  const { favorites } = useFavoriteTeams();
  const [actionGameId, setActionGameId] = useState<string | null>(null);
  const [confirmSkipGame, setConfirmSkipGame] = useState<GameRecord | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<GameRecord | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [scoreCardTarget, setScoreCardTarget] = useState<GameRecord | null>(null);
  const isAdmin = user?.role === 'admin';
  // Admins can override "today" to test date-dependent dashboard behavior.
  const [dateOverride, setDateOverride] = useState(() => {
    const stored = localStorage.getItem(ADMIN_DATE_OVERRIDE_KEY) ?? '';
    return DATE_ONLY_RE.test(stored) ? stored : '';
  });
  const updateDateOverride = (value: string) => {
    setDateOverride(value);
    if (value) localStorage.setItem(ADMIN_DATE_OVERRIDE_KEY, value);
    else localStorage.removeItem(ADMIN_DATE_OVERRIDE_KEY);
  };
  const todayKey = isAdmin && dateOverride ? dateOverride : dateToISO(new Date());
  const tzPref = USER_TIMEZONE;

  const { data: games = [], isLoading: gamesLoading } = useQuery<GameRecord[]>({
    queryKey: ['user-dashboard-games', todayKey],
    queryFn: async () => {
      const { data } = await axios.get<GameRecord[]>(`${API}/user/games`, {
        headers: authHeaders(),
        params: { date: todayKey },
      });
      return data;
    },
  });

  const favoriteTeams = useMemo(() => {
    const favoriteSet = new Set(favorites);
    return teams
      .filter((team) => favoriteSet.has(team.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [favorites, teams]);

  // The API already returns only games for `todayKey` (effective date filter),
  // so just order them for display.
  const todayGames = useMemo(() => [...games].sort(sortGamesByTime), [games]);

  const setDashboardGames = (updater: (games: GameRecord[]) => GameRecord[]) => {
    queryClient.setQueryData<GameRecord[]>(['user-dashboard-games', todayKey], (existing) =>
      Array.isArray(existing) ? updater(existing) : existing,
    );
    void queryClient.invalidateQueries({ queryKey: ['user-games'] });
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
      setDashboardGames((existing) =>
        existing.map((game) =>
          game.id === gameId
            ? { ...game, scheduled_for: scheduledFor, skipped_by_user: false }
            : game,
        ),
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
      await axios.post(
        `${API}/user/watched-games/${gameId}`,
        { watched_on: todayKey },
        { headers: authHeaders() },
      );
      setDashboardGames((existing) =>
        existing.map((game) =>
          game.id === gameId
            ? {
                ...game,
                watched_by_user: true,
                watched_on: getScheduledWatchDateKey(game.scheduled_for) ?? todayKey,
                skipped_by_user: false,
              }
            : game,
        ),
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
      setDashboardGames((existing) => existing.filter((game) => game.id !== gameId));
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
      setDashboardGames((existing) =>
        existing.map((game) =>
          game.id === gameId
            ? {
                ...game,
                watched_by_user: false,
                watched_on: null,
                skipped_by_user: false,
              }
            : game,
        ),
      );
    } catch {
      toast.error('Failed to unwatch game');
    } finally {
      setActionGameId(null);
    }
  };

  const openScheduleModal = (game: GameRecord) => {
    setScheduleTarget(game);
    setScheduleDate(getScheduledWatchDateKey(game.scheduled_for) ?? '');
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

  const scheduleDateInvalid = scheduleTarget
    ? isInvalidWatchScheduleDate(scheduleTarget, scheduleDate, tzPref)
    : false;

  return (
    <div className={styles.page}>
      <div className={styles.welcome}>
        {user?.photo && (
          <img
            src={user.photo}
            alt=""
            className={styles.avatar}
            referrerPolicy="no-referrer"
          />
        )}
        <div>
          <h2 className={styles.welcomeName}>
            Welcome, {user?.display_name ?? user?.displayName ?? 'Player'}!
          </h2>
          <p className={styles.welcomeEmail}>{user?.email}</p>
        </div>
      </div>

      <Card title="Favorite Teams">
        {teamsLoading ? (
          <p className={styles.empty}>Loading...</p>
        ) : favoriteTeams.length === 0 ? (
          <p className={styles.empty}>No favorite teams yet.</p>
        ) : (
          <ul className={styles.favoriteScroller}>
            {favoriteTeams.map((team) => (
              <TeamChip
                key={team.id}
                team={team}
              />
            ))}
          </ul>
        )}
      </Card>

      <Card
        title={fmtDayHeading(todayKey)}
        action={
          isAdmin ? (
            <div className={styles.testDateControl}>
              <span className={styles.testDateLabel}>Test date</span>
              <DatePicker
                value={dateOverride}
                onChange={updateDateOverride}
                granularity="day"
                placeholder="Today"
                triggerLabel={dateOverride ? fmtDayHeading(dateOverride) : 'Today'}
                triggerAriaLabel="Override the dashboard date for testing"
              />
              {dateOverride && (
                <Button
                  variant="ghost"
                  intent="neutral"
                  size="sm"
                  icon="close"
                  tooltip="Reset to today"
                  aria-label="Reset dashboard date to today"
                  onClick={() => updateDateOverride('')}
                />
              )}
            </div>
          ) : undefined
        }
      >
        {gamesLoading ? (
          <p className={styles.empty}>Loading...</p>
        ) : todayGames.length === 0 ? (
          <p className={styles.empty}>No games scheduled for today.</p>
        ) : (
          <div className={styles.todayGamesGrid}>
            {todayGames.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                tzPref={tzPref}
                busy={actionGameId === game.id}
                useLeagueColors
                onOpen={() => navigate(`/games/${game.id}`)}
                onDownloadScoreCard={() => setScoreCardTarget(getScoreCardGame(game))}
                onMarkWatched={() => void markGameWatched(game.id)}
                onUnwatch={() => void unwatchGame(game.id)}
                onSchedule={() => openScheduleModal(game)}
                onSkip={() => setConfirmSkipGame(game)}
              />
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={!!scheduleTarget}
        title="Schedule Watch"
        onClose={() => {
          if (scheduleBusy) return;
          setScheduleTarget(null);
          setScheduleDate('');
        }}
        onConfirm={() => void saveSchedule()}
        confirmLabel={scheduleBusy ? 'Saving...' : 'Save Schedule'}
        confirmDisabled={scheduleBusy || scheduleDateInvalid}
        busy={scheduleBusy}
        footerStart={
          scheduleDate ? (
            <Button
              type="button"
              variant="ghost"
              intent="neutral"
              onClick={() => setScheduleDate('')}
              disabled={scheduleBusy}
            >
              Clear Date
            </Button>
          ) : undefined
        }
      >
        {scheduleTarget && (
          <div className={styles.scheduleModalBody}>
            <p className={styles.scheduleModalCopy}>
              Choose when you plan to watch {scheduleTarget.away_team.code} @{' '}
              {scheduleTarget.home_team.code}. Scheduled dates are saved in your local timezone.
            </p>
            <DatePicker
              value={scheduleDate}
              onChange={setScheduleDate}
              placeholder="Watch date"
            />
            {scheduleDateInvalid && (
              <p className={styles.scheduleModalError}>
                Choose a watch date after the game's scheduled date.
              </p>
            )}
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!confirmSkipGame}
        title="Skip Game"
        body={
          confirmSkipGame
            ? `Move ${confirmSkipGame.away_team.code} @ ${confirmSkipGame.home_team.code} to skipped games?`
            : ''
        }
        confirmLabel="Skip game"
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
        showForm={false}
        onClose={() => setScoreCardTarget(null)}
      />
    </div>
  );
};

export default UserDashboard;
