import type { CSSProperties, ReactNode } from 'react';
import Card from '@/components/Card/Card';
import Icon from '@/components/Icon/Icon';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
import { type GameRecord, type GameType } from '@/hooks/useGames';
import styles from './GameCard.module.scss';

export type GameCardTimezone = 'ET' | 'local';

const GAME_TYPE_CLASS: Record<GameType, string> = {
  preseason: styles.typePreseason,
  regular: styles.typeRegular,
  playoff: styles.typePlayoff,
};

type MaybePromise = void | Promise<void>;

interface GameCardProps {
  game: GameRecord;
  tzPref: GameCardTimezone;
  onOpen: () => MaybePromise;
  canOpen?: boolean;
  className?: string;
  useLeagueColors?: boolean;
  originalDateLabel?: string | null;
  bottomLabel?: ReactNode;
  actions?: ReactNode;
  showScore?: boolean;
  timeLabel?: string | null;
  /** Renders a left accent stripe coloured by game type. */
  showTypeIndicator?: boolean;
}

const DATE_ONLY_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const ISO_DATE_PREFIX_RE = /^([0-9]{4}-[0-9]{2}-[0-9]{2})/;
const ISO_MIDNIGHT_RE = /[T ]00:00(?::00(?:\.0+)?)?(?:Z|[+-][0-9]{2}(?::?[0-9]{2})?)?$/;

const run = (handler: () => MaybePromise) => {
  void handler();
};

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

const dateKeyToDate = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
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
  tzPref: GameCardTimezone,
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
  return getRawDateKey(value) ?? toLocalDateKey(value);
};

const getOriginalGameDateKey = (game: GameRecord, tzPref: GameCardTimezone) => {
  if (game.scheduled_at && !game.scheduled_time) {
    if (DATE_ONLY_RE.test(game.scheduled_at)) return game.scheduled_at;
    const rawDateKey = getRawDateKey(game.scheduled_at);
    if (rawDateKey && ISO_MIDNIGHT_RE.test(game.scheduled_at)) return rawDateKey;
  }
  const instant = getScheduledInstant(game.scheduled_at, game.scheduled_time);
  if (!instant) return null;
  return tzPref === 'ET'
    ? (getEtDateKey(game.scheduled_at, game.scheduled_time) ??
        toDateKeyInZone(instant, 'America/New_York'))
    : toDateKeyInZone(instant);
};

const ORIGINAL_GAME_DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
});

const getOriginalGameDateLabel = (game: GameRecord, tzPref: GameCardTimezone) => {
  const watchDateKey = getScheduledWatchDateKey(game.scheduled_for);
  if (!watchDateKey) return null;
  const originalDateKey = getOriginalGameDateKey(game, tzPref);
  if (!originalDateKey || originalDateKey === watchDateKey) return null;
  return ORIGINAL_GAME_DATE_FMT.format(dateKeyToDate(originalDateKey));
};

const getOvertimeSuffix = (game: GameRecord) => {
  if (game.shootout || game.period_scores.some((ps) => ps.period === 'SO')) return '/SO';
  if ((game.overtime_periods ?? 0) > 0 || game.period_scores.some((ps) => ps.period === 'OT')) {
    return '/OT';
  }
  return '';
};

const getStatusLabel = (game: GameRecord) => {
  if (game.status === 'in_progress') return 'LIVE';
  if (game.status === 'final') return `FINAL${getOvertimeSuffix(game)}`;
  return game.status.replace(/_/g, ' ').toUpperCase();
};

const getPlayoffRoundShortLabel = (game: GameRecord) => {
  if (game.game_type !== 'playoff' || game.playoff_round == null) return null;
  const customLabel = game.playoff_round_names?.[game.playoff_round] ?? null;
  if (!customLabel) return `R${game.playoff_round}`;

  const trimmed = customLabel.trim();
  if (!trimmed) return `R${game.playoff_round}`;

  const roundNumber = trimmed.match(/^round\s+([0-9]+)$/i);
  if (roundNumber) return `R${roundNumber[1]}`;

  const shortRound = trimmed.match(/^r([0-9]+)$/i);
  if (shortRound) return `R${shortRound[1]}`;

  const initials = trimmed
    .split(/\s+/)
    .map((word) => word[0]?.toUpperCase())
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

const shouldShowWatchedScore = (game: GameRecord) =>
  !!game.watched_by_user && (game.status === 'final' || game.status === 'in_progress');

const getLeagueStyle = (game: GameRecord) =>
  ({
    '--game-league-primary': game.league_primary_color ?? '#334155',
    '--game-league-text': game.league_text_color ?? '#ffffff',
  }) as CSSProperties;

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
      logoDark={team.logo_dark}
      logoLight={team.logo_light}
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

const GameCard = ({
  game,
  tzPref,
  canOpen,
  className,
  useLeagueColors = false,
  originalDateLabel: originalDateLabelProp,
  bottomLabel,
  actions,
  showScore: showScoreProp,
  timeLabel: timeLabelProp,
  showTypeIndicator = false,
  onOpen,
}: GameCardProps) => {
  const showScore = showScoreProp ?? shouldShowWatchedScore(game);
  const homeScore = showScore ? game.home_score : '-';
  const awayScore = showScore ? game.away_score : '-';
  const awayDim = showScore && game.away_score < game.home_score;
  const homeDim = showScore && game.home_score < game.away_score;
  const isWatched = !!game.watched_by_user;
  const isOpenable = canOpen ?? isWatched;
  const timeLabel =
    timeLabelProp === undefined
      ? game.scheduled_time
        ? fmtGameTime(game.scheduled_at, game.scheduled_time, tzPref)
        : ''
      : (timeLabelProp ?? '');
  const originalDateLabel =
    originalDateLabelProp === undefined
      ? getOriginalGameDateLabel(game, tzPref)
      : originalDateLabelProp;
  const primaryFallbackLabel = game.status === 'scheduled' ? 'TBD' : getStatusLabel(game);
  const primaryMetaLabel = [originalDateLabel, timeLabel || primaryFallbackLabel]
    .filter(Boolean)
    .join(' \u00b7 ');
  const playoffMetaLabel = getPlayoffGameMetaLabel(game);

  return (
    <Card
      variant="border"
      className={[
        styles.card,
        showTypeIndicator ? GAME_TYPE_CLASS[game.game_type] : '',
        useLeagueColors ? styles.leagueColors : '',
        game.status === 'in_progress' ? styles.live : '',
        game.skipped_by_user ? styles.skipped : '',
        isOpenable ? styles.clickable : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={useLeagueColors ? getLeagueStyle(game) : undefined}
      role={isOpenable ? 'button' : undefined}
      tabIndex={isOpenable ? 0 : undefined}
      onClick={isOpenable ? () => run(onOpen) : undefined}
      onKeyDown={
        isOpenable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                run(onOpen);
              }
            }
          : undefined
      }
    >
      {actions && <span className={styles.gameActions}>{actions}</span>}
      {isWatched && (
        <span
          className={styles.watchedRibbon}
          role="img"
          aria-label="Watched"
        >
          <Icon
            name="visibility"
            size="0.72rem"
          />
        </span>
      )}
      <div className={styles.gameMeta}>
        <span>{primaryMetaLabel}</span>
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
      {bottomLabel && <div className={styles.bottomLabel}>{bottomLabel}</div>}
      <div className={styles.gameFooter}>
        <span>{getStatusLabel(game)}</span>
        {playoffMetaLabel && <span>{playoffMetaLabel}</span>}
      </div>
    </Card>
  );
};

export default GameCard;
