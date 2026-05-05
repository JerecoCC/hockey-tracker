import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import Badge, { BadgeIntent } from '@/components/Badge/Badge';
import Card from '@/components/Card/Card';
import DatePicker from '@/components/DatePicker/DatePicker';
import Icon from '@/components/Icon/Icon';
import Select, { type SelectOption } from '@/components/Select/Select';
import { type GameRecord, type GameStatus } from '@/hooks/useGames';
import styles from './UserGames.module.scss';

const API = import.meta.env.VITE_API_URL || '/api';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<GameStatus, { label: string; intent: BadgeIntent }> = {
  scheduled: { label: 'Upcoming', intent: 'neutral' },
  in_progress: { label: 'Live', intent: 'success' },
  final: { label: 'Final', intent: 'info' },
  postponed: { label: 'PPD', intent: 'warning' },
  cancelled: { label: 'Cancelled', intent: 'danger' },
};

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

type TzPref = 'ET' | 'local';

/**
 * Format a game's scheduled time.
 *
 * When `tzPref` is 'ET', the raw HH:MM stored in the DB (Eastern Time) is
 * formatted as 12-hour with an "ET" suffix.
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

  if (tzPref === 'ET') {
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'} ET`;
  }

  // Derive the ET calendar date for this game so we can reconstruct the full
  // Eastern moment even if scheduled_at only carries a date (no time).
  const base = scheduledAt ? new Date(scheduledAt) : new Date();
  const etDatePart = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(
    base,
  );

  // Determine the UTC offset for America/New_York on that date (handles DST).
  const probe = new Date(`${etDatePart}T12:00:00`);
  const tzAbbr =
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      timeZoneName: 'short',
    })
      .formatToParts(probe)
      .find((p) => p.type === 'timeZoneName')?.value ?? 'EST';
  const offset = tzAbbr === 'EDT' ? '-04:00' : '-05:00';

  // Build the exact UTC moment and format in the browser's local timezone.
  const d = new Date(`${etDatePart}T${scheduledTime}:00${offset}`);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const totalScore = (periods: GameRecord['period_scores']) => ({
  home: periods.reduce((s, p) => s + p.home_goals, 0),
  away: periods.reduce((s, p) => s + p.away_goals, 0),
});

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
    {logo ? (
      <img
        src={logo}
        alt=""
        className={styles.teamLogo}
      />
    ) : (
      <span
        className={styles.teamLogoPlaceholder}
        style={{ background: primaryColor, color: textColor }}
      >
        {code.slice(0, 3)}
      </span>
    )}
    <span className={styles.teamName}>{name}</span>
  </div>
);

// ── Game card ─────────────────────────────────────────────────────────────────

const GameCard = ({ game, tzPref }: { game: GameRecord; tzPref: TzPref }) => {
  const navigate = useNavigate();
  const scored = game.status === 'final' || game.status === 'in_progress';
  const { home, away } = totalScore(game.period_scores);
  const badge = STATUS_BADGE[game.status];

  return (
    <div
      className={`${styles.gameCard} ${game.status === 'in_progress' ? styles.live : ''} ${styles.gameCardClickable}`}
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/games/${game.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') navigate(`/games/${game.id}`);
      }}
    >
      <div className={styles.cardMeta}>
        {game.scheduled_time && (
          <span className={styles.metaTime}>
            {fmtGameTime(game.scheduled_at, game.scheduled_time, tzPref)}
          </span>
        )}
        {game.season_name && <span className={styles.metaSeason}>{game.season_name}</span>}
        <Badge
          label={badge.label}
          intent={badge.intent}
        />
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
          {scored ? (
            <>
              <span className={home > away ? styles.scoreWin : styles.scoreVal}>{home}</span>
              <span className={styles.scoreSep}>–</span>
              <span className={away > home ? styles.scoreWin : styles.scoreVal}>{away}</span>
            </>
          ) : (
            <span className={styles.scoreVs}>vs</span>
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

// ── Page ──────────────────────────────────────────────────────────────────────

const UserGames = () => {
  const [weekStart, setWeekStart] = useState<Date>(() => toDay(new Date()));
  const [leagueId, setLeagueId] = useState<string>('all');
  const [seasonId, setSeasonId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tzPref, setTzPref] = useState<TzPref>('ET');

  const weekEnd = addDays(weekStart, 6);

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
    enabled: leagueSelected,
    queryFn: async () => {
      const { data } = await axios.get(`${API}/user/seasons`, {
        headers: authHeaders(),
        params: { league_id: leagueId },
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

  // Build a 7-slot array (one per day in the window), each with its games.
  const groupedByDate = useMemo(() => {
    const map = new Map<string, GameRecord[]>();
    for (const g of games) {
      if (!g.scheduled_at) continue;
      const d = toDay(new Date(g.scheduled_at));
      if (d < weekStart || d > toDay(weekEnd)) continue;
      const key = toLocalDateKey(g.scheduled_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(g);
    }
    // Always include every day in the window, even days with no games.
    return Array.from({ length: 7 }, (_, i) => {
      const key = dateToISO(addDays(weekStart, i));
      const dayGames = (map.get(key) ?? []).slice().sort((a, b) => {
        // scheduled_time is "HH:MM" text — compare lexicographically (works for 24h times).
        // Games with no time float to the end.
        if (!a.scheduled_time && !b.scheduled_time) return 0;
        if (!a.scheduled_time) return 1;
        if (!b.scheduled_time) return -1;
        return a.scheduled_time.localeCompare(b.scheduled_time);
      });
      return [key, dayGames] as [string, GameRecord[]];
    });
  }, [games, weekStart, weekEnd]);

  const leagueOptions: SelectOption[] = [
    { value: 'all', label: 'All Leagues' },
    ...leagues.map((l) => ({ value: l.id, label: l.code, logo: l.logo })),
  ];
  const seasonOptions: SelectOption[] = [
    { value: 'all', label: 'All Seasons' },
    ...seasons.map((s) => ({ value: s.id, label: s.name })),
  ];

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div className={styles.weekNav}>
          <button
            className={styles.navBtn}
            onClick={() => setWeekStart((d) => addDays(d, -7))}
          >
            <Icon name="chevron_left" />
          </button>
          <DatePicker
            value={dateToISO(weekStart)}
            onChange={(v) => setWeekStart(v ? fromISODate(v) : toDay(new Date()))}
          />
          <button
            className={styles.navBtn}
            onClick={() => setWeekStart((d) => addDays(d, 7))}
          >
            <Icon name="chevron_right" />
          </button>
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
              disabled={!leagueSelected}
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
      ) : (
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
                    />
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserGames;
