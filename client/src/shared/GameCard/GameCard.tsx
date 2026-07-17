import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import ActionOverlay from '@jerecocc/tracker-ui/components/ActionOverlay/ActionOverlay';
import Button, { type ButtonIntent } from '@jerecocc/tracker-ui/components/Button/Button';
import Card from '@jerecocc/tracker-ui/components/Card/Card';
import Icon from '@jerecocc/tracker-ui/components/Icon/Icon';
import Tag, { type TagIntent } from '@jerecocc/tracker-ui/components/Tag/Tag';
import TeamLogo from '@jerecocc/tracker-ui/components/TeamLogo/TeamLogo';
import { type GameRecord, type GameType } from '@/hooks/useGames';
import listStyles from '../GameListItem.module.scss';
import styles from './GameCard.module.scss';

export type GameCardTimezone = 'ET' | 'local';

const GAME_TYPE_CLASS: Record<GameType, string> = {
  preseason: styles.typePreseason,
  regular: styles.typeRegular,
  playoff: styles.typePlayoff,
};

const LIST_GAME_TYPE_CLASS: Record<GameType, string> = {
  preseason: listStyles.typePreseason,
  regular: listStyles.typeRegular,
  playoff: listStyles.typePlayoff,
};

type MaybePromise = void | Promise<void>;

export interface GameCardAction {
  icon: string;
  intent?: ButtonIntent;
  tooltip?: string;
  disabled?: boolean;
  onClick: () => void;
}

export interface GameCardProps {
  variant?: 'card' | 'list-item';
  game: GameRecord;
  tzPref?: GameCardTimezone;
  onOpen?: () => MaybePromise;
  href?: string;
  canOpen?: boolean;
  className?: string;
  useLeagueColors?: boolean;
  originalDateLabel?: string | null;
  bottomLabel?: ReactNode;
  actions?: ReactNode | (GameCardAction | false | null | undefined)[];
  showScore?: boolean;
  timeLabel?: string | null;
  statusLabel?: string;
  statusIntent?: TagIntent;
  supplementalMeta?: string;
  /** Controls the watched ribbon on the card variant. Defaults to true. */
  showWatchedBanner?: boolean;
  /** Renders a left accent stripe coloured by game type. */
  showTypeIndicator?: boolean;
}

const DATE_ONLY_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const ISO_DATE_PREFIX_RE = /^([0-9]{4}-[0-9]{2}-[0-9]{2})/;
const ISO_MIDNIGHT_RE = /[T ]00:00(?::00(?:\.0+)?)?(?:Z|[+-][0-9]{2}(?::?[0-9]{2})?)?$/;

const run = (handler: () => MaybePromise) => {
  void handler();
};

const isGameCardActionArray = (
  actions: GameCardProps['actions'],
): actions is (GameCardAction | false | null | undefined)[] =>
  Array.isArray(actions) &&
  actions.every(
    (action) =>
      !action ||
      (typeof action === 'object' &&
        'icon' in action &&
        'onClick' in action &&
        typeof action.onClick === 'function'),
  );

const renderActions = (actions: GameCardProps['actions']) => {
  if (!actions) return null;
  if (!isGameCardActionArray(actions)) return actions;

  return actions.filter(Boolean).map((action, index) => (
    <Button
      key={index}
      variant="outlined"
      intent={action.intent ?? 'neutral'}
      icon={action.icon}
      size="medium"
      tooltip={action.tooltip}
      disabled={action.disabled}
      onClick={action.onClick}
    />
  ));
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

const GameCardVariant = ({
  game,
  tzPref = 'local',
  href,
  canOpen,
  className,
  useLeagueColors = false,
  originalDateLabel: originalDateLabelProp,
  bottomLabel,
  actions,
  showScore: showScoreProp,
  timeLabel: timeLabelProp,
  showWatchedBanner = true,
  showTypeIndicator = false,
  onOpen,
}: GameCardProps) => {
  const showScore = showScoreProp ?? shouldShowWatchedScore(game);
  const homeScore = showScore ? game.home_score : '-';
  const awayScore = showScore ? game.away_score : '-';
  const awayDim = showScore && game.away_score < game.home_score;
  const homeDim = showScore && game.home_score < game.away_score;
  const isWatched = !!game.watched_by_user;
  const hasTypeIndicator = showTypeIndicator || game.skipped_by_user;
  const isOpenable = canOpen ?? (!!href || isWatched);
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
      data-game-card-variant="card"
      className={[
        styles.card,
        hasTypeIndicator ? styles.withTypeIndicator : '',
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
      role={isOpenable && onOpen ? 'button' : undefined}
      tabIndex={isOpenable && onOpen ? 0 : undefined}
      onClick={isOpenable && onOpen ? () => run(onOpen) : undefined}
      onKeyDown={
        isOpenable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (onOpen) run(onOpen);
              }
            }
          : undefined
      }
    >
      {href && (
        <Link
          to={href}
          className={listStyles.itemLink}
          tabIndex={-1}
          aria-hidden="true"
        />
      )}
      {actions && <span className={styles.gameActions}>{renderActions(actions)}</span>}
      {showWatchedBanner && isWatched && (
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
      {hasTypeIndicator && (
        <span
          className={styles.typeIndicator}
          aria-hidden="true"
        />
      )}
      <div className={styles.cardContent}>
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
      </div>
    </Card>
  );
};

const LIST_DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const DEFAULT_STATUS_INTENT: Record<GameRecord['status'], TagIntent> = {
  scheduled: 'neutral',
  in_progress: 'success',
  final: 'info',
  postponed: 'warning',
};

const GameListItemVariant = ({
  game,
  tzPref = 'local',
  href,
  showScore: showScoreProp,
  statusLabel: statusLabelProp,
  statusIntent,
  originalDateLabel: dateLabelProp,
  timeLabel: timeLabelProp,
  supplementalMeta,
  actions,
}: GameCardProps) => {
  const awayTeam = game.away_team;
  const homeTeam = game.home_team;
  const awayScore = game.away_score;
  const homeScore = game.home_score;
  const showScore = showScoreProp ?? shouldShowWatchedScore(game);
  const isFinal = game.status === 'final';
  const awayLost = isFinal && awayScore < homeScore;
  const homeLost = isFinal && homeScore < awayScore;
  const dateKey = getOriginalGameDateKey(game, tzPref);
  const dateLabel =
    dateLabelProp === undefined
      ? dateKey
        ? LIST_DATE_FMT.format(dateKeyToDate(dateKey))
        : undefined
      : (dateLabelProp ?? undefined);
  const timeLabel =
    timeLabelProp === undefined
      ? game.scheduled_time
        ? fmtGameTime(game.scheduled_at, game.scheduled_time, tzPref)
        : undefined
      : (timeLabelProp ?? undefined);
  const dateLine = [dateLabel, timeLabel].filter(Boolean).join(' • ') || 'TBD';
  const resolvedRoundLabel =
    game.playoff_round != null
      ? (game.playoff_round_names?.[game.playoff_round] ?? `Round ${game.playoff_round}`)
      : null;
  const metaLine =
    resolvedRoundLabel == null && game.game_number_in_series != null
      ? `Game ${game.game_number_in_series}`
      : resolvedRoundLabel != null && game.game_number_in_series != null
        ? `${resolvedRoundLabel} · Game ${game.game_number_in_series}`
        : resolvedRoundLabel != null && game.playoff_round != null
          ? resolvedRoundLabel
          : game.game_number != null
            ? `Game ${game.game_number}`
            : null;
  const itemClass = [listStyles.item, LIST_GAME_TYPE_CLASS[game.game_type]]
    .filter(Boolean)
    .join(' ');

  return (
    <li
      className={itemClass}
      data-game-card-variant="list-item"
    >
      {href && (
        <Link
          to={href}
          className={listStyles.itemLink}
          tabIndex={-1}
          aria-hidden="true"
        />
      )}
      <div className={listStyles.leading}>
        <span
          className={listStyles.typeIndicator}
          aria-hidden="true"
        />
        <div className={listStyles.main}>
          <span className={listStyles.dateLine}>{dateLine}</span>
          <div
            className={[listStyles.teamRow, awayLost ? listStyles.teamLoser : '']
              .filter(Boolean)
              .join(' ')}
          >
            <TeamLogo
              logo={awayTeam.logo}
              logoDark={awayTeam.logo_dark}
              logoLight={awayTeam.logo_light}
              code={awayTeam.code}
              primaryColor={awayTeam.primary_color}
              textColor={awayTeam.text_color}
              size={24}
              shape="circle"
            />
            <span className={listStyles.teamCode}>{awayTeam.code}</span>
            {showScore && (
              <span
                className={[listStyles.scoreNum, awayLost ? listStyles.scoreLoser : '']
                  .filter(Boolean)
                  .join(' ')}
              >
                {awayScore}
              </span>
            )}
          </div>
          <div
            className={[listStyles.teamRow, homeLost ? listStyles.teamLoser : '']
              .filter(Boolean)
              .join(' ')}
          >
            <TeamLogo
              logo={homeTeam.logo}
              logoDark={homeTeam.logo_dark}
              logoLight={homeTeam.logo_light}
              code={homeTeam.code}
              primaryColor={homeTeam.primary_color}
              textColor={homeTeam.text_color}
              size={24}
              shape="circle"
            />
            <span className={listStyles.teamCode}>{homeTeam.code}</span>
            {showScore && (
              <span
                className={[listStyles.scoreNum, homeLost ? listStyles.scoreLoser : '']
                  .filter(Boolean)
                  .join(' ')}
              >
                {homeScore}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className={listStyles.middle}>
        {metaLine && <b className={listStyles.metaLine}>{metaLine}</b>}
        {supplementalMeta && (
          <span className={listStyles.supplementalMeta}>{supplementalMeta}</span>
        )}
        {game.venue && <span className={listStyles.venue}>{game.venue}</span>}
      </div>
      <Tag
        label={statusLabelProp ?? getStatusLabel(game)}
        intent={statusIntent ?? DEFAULT_STATUS_INTENT[game.status]}
      />
      {actions && (
        <ActionOverlay className={listStyles.actions}>
          {renderActions(actions)}
        </ActionOverlay>
      )}
    </li>
  );
};

const GameCard = (props: GameCardProps) =>
  props.variant === 'list-item' ? (
    <GameListItemVariant {...props} />
  ) : (
    <GameCardVariant {...props} />
  );

export default GameCard;
