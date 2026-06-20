import { useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import DatePicker from '@/components/DatePicker/DatePicker';
import Modal from '@/components/Modal/Modal';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
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

interface GameActionsProps {
  watched: boolean;
  skipped: boolean;
  scheduled: boolean;
  busy: boolean;
  onView: () => void;
  onDownloadScoreCard: () => void;
  onMarkWatched: () => void;
  onUnwatch: () => void;
  onSchedule: () => void;
  onSkip: () => void;
}

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

const getScheduledWatchDateKey = (value: string | null | undefined) => {
  if (!value) return null;
  if (DATE_ONLY_RE.test(value)) return value;
  return toLocalDateKey(value);
};

const sortGamesByTime = (a: GameRecord, b: GameRecord) => {
  if (!a.scheduled_time && !b.scheduled_time) return 0;
  if (!a.scheduled_time) return 1;
  if (!b.scheduled_time) return -1;
  return a.scheduled_time.localeCompare(b.scheduled_time);
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

const getLeagueStyle = (game: GameRecord) =>
  ({
    '--game-league-primary': game.league_primary_color ?? '#334155',
    '--game-league-text': game.league_text_color ?? '#ffffff',
  }) as CSSProperties;

const getStatusLabel = (game: GameRecord) => {
  if (game.status === 'in_progress') return 'LIVE';
  if (game.status === 'final') return `FINAL${getOvertimeSuffix(game)}`;
  return game.status.replace(/_/g, ' ').toUpperCase();
};

const TeamChip = ({ team }: { team: TeamRecord }) => (
  <div className={styles.favoriteTeam}>
    <TeamLogo
      logo={team.logo}
      code={team.code}
      primaryColor={team.primary_color}
      textColor={team.text_color}
      size={40}
      shape={team.logo ? 'square' : 'circle'}
    />
    <div className={styles.favoriteTeamText}>
      <span className={styles.favoriteTeamName}>{team.team_name || team.name}</span>
      <span className={styles.favoriteTeamMeta}>
        {team.place_name ? `${team.place_name} - ${team.code}` : team.code}
      </span>
    </div>
  </div>
);

const GameHoverActions = ({
  watched,
  skipped,
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
          onUnwatch();
        }}
      />
    )}
    {!watched && !skipped && (
      <Button
        type="button"
        variant="outlined"
        intent="danger"
        icon="visibility_off"
        size="sm"
        tooltip="Skip game"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          onSkip();
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
          onMarkWatched();
        }}
      />
    )}
  </span>
);

const TeamLine = ({
  team,
  score,
  dim,
}: {
  team: GameRecord['home_team'];
  score: number | string;
  dim: boolean;
}) => (
  <div className={[styles.teamLine, dim ? styles.teamLineDim : ''].filter(Boolean).join(' ')}>
    <TeamLogo
      logo={team.logo}
      code={team.code}
      primaryColor={team.primary_color}
      textColor={team.text_color}
      size={34}
      shape={team.logo ? 'square' : 'circle'}
    />
    <span className={styles.teamCode}>{team.code}</span>
    <span className={styles.teamScore}>{score}</span>
  </div>
);

const TodayGameTile = ({
  game,
  tzPref,
  busy,
  onOpen,
  onDownloadScoreCard,
  onMarkWatched,
  onUnwatch,
  onSchedule,
  onSkip,
}: {
  game: GameRecord;
  tzPref: TzPref;
  busy: boolean;
  onOpen: () => void;
  onDownloadScoreCard: () => void;
  onMarkWatched: () => void;
  onUnwatch: () => void;
  onSchedule: () => void;
  onSkip: () => void;
}) => {
  const showScore = shouldShowWatchedScore(game);
  const homeScore = showScore ? game.home_score : '-';
  const awayScore = showScore ? game.away_score : '-';
  const awayDim = !showScore || game.away_score < game.home_score;
  const homeDim = !showScore || game.home_score < game.away_score;
  const isWatched = !!game.watched_by_user;
  const timeLabel = fmtGameTime(game.scheduled_at, game.scheduled_time, tzPref);

  return (
    <div
      className={[
        styles.todayGame,
        game.status === 'in_progress' ? styles.todayGameLive : '',
        !isWatched ? styles.todayGameUnwatched : '',
        isWatched ? styles.todayGameClickable : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={getLeagueStyle(game)}
      role={isWatched ? 'button' : undefined}
      tabIndex={isWatched ? 0 : undefined}
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
        skipped={!!game.skipped_by_user}
        scheduled={!!game.scheduled_for}
        busy={busy}
        onView={onOpen}
        onDownloadScoreCard={onDownloadScoreCard}
        onMarkWatched={onMarkWatched}
        onUnwatch={onUnwatch}
        onSchedule={onSchedule}
        onSkip={onSkip}
      />
      <div className={styles.gameMeta}>
        <span>{timeLabel || getStatusLabel(game)}</span>
        {game.season_name && <span>{game.season_name}</span>}
      </div>
      <TeamLine
        team={game.away_team}
        score={awayScore}
        dim={awayDim}
      />
      <TeamLine
        team={game.home_team}
        score={homeScore}
        dim={homeDim}
      />
      <div className={styles.gameFooter}>
        <span>{getStatusLabel(game)}</span>
        {game.league_code && <span>{game.league_code}</span>}
      </div>
    </div>
  );
};

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

  const saveScheduleForGame = async (gameId: string, scheduledFor: string | null) => {
    if (actionGameId === gameId || scheduleBusy) return false;
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
          <div className={styles.favoriteScroller}>
            {favoriteTeams.map((team) => (
              <TeamChip
                key={team.id}
                team={team}
              />
            ))}
          </div>
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
              <TodayGameTile
                key={game.id}
                game={game}
                tzPref={tzPref}
                busy={actionGameId === game.id}
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
