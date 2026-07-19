import { Link } from 'react-router-dom';
import ActionOverlay from '@jerecocc/tracker-ui/components/ActionOverlay/ActionOverlay';
import PlayerAvatar from '@jerecocc/tracker-ui/components/PlayerAvatar/PlayerAvatar';
import Accordion, { type AccordionAction } from '@jerecocc/tracker-ui/components/Accordion/Accordion';
import Button from '@jerecocc/tracker-ui/components/Button/Button';
import TeamLogo from '@jerecocc/tracker-ui/components/TeamLogo/TeamLogo';
import { type GameRecord } from '@/hooks/useGames';
import { type GoalRecord } from '@/hooks/useGameGoals';
import { type ShootoutAttempt } from '@/hooks/useShootoutAttempts';
import { formatPlayerName } from './formatUtils';
import styles from './ShootoutAccordion.module.scss';
import ResponsiveList from '@/shared/ResponsiveList/ResponsiveList';
import scoringStyles from './ScoringCard.module.scss';
import { playerDataComplete } from './gameUtils';
import { PERIOD } from './constants';

const playerInitials = (firstName?: string | null, lastName?: string | null) =>
  `${firstName?.trim().charAt(0) ?? ''}${lastName?.trim().charAt(0) ?? ''}`.trim() || '?';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  game: GameRecord;
  attempts: ShootoutAttempt[];
  goals: GoalRecord[];
  isFinal: boolean;
  isInProgress: boolean;
  canUseEditControls?: boolean;
  soComplete: boolean;
  busy: string | null;
  deletingAttemptId: string | null;
  /** className applied to the Accordion root — used by the parent to tint active period. */
  className?: string;
  /** Class for the label <span> — keeps the period label style consistent. */
  labelClassName?: string;
  /** When omitted, no admin action overlays are rendered (used in read-only user view). */
  onAddAttempt?: () => void;
  onEditAttempt?: (attempt: ShootoutAttempt) => void;
  onDeleteAttempt?: (id: string) => Promise<void>;
  onEndGame?: () => void;
  /** When provided, shooter names become navigation links. */
  getPlayerHref?: (playerId: string) => string;
  showPlayerDataStatus?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

const ShootoutAccordion = ({
  game,
  attempts,
  goals,
  isFinal,
  isInProgress,
  canUseEditControls = false,
  soComplete,
  busy,
  deletingAttemptId,
  className,
  labelClassName,
  onAddAttempt,
  onEditAttempt,
  onDeleteAttempt,
  onEndGame,
  getPlayerHref,
  showPlayerDataStatus = false,
}: Props) => {
  const canEditShootout = isInProgress || canUseEditControls;
  const isSOActive = canEditShootout && game.current_period === PERIOD.SHOOTOUT;
  const isSODone = isFinal;

  // ── Shoot order & team split ──────────────────────────────────────────────

  const firstTeamId = game.shootout_first_team_id;
  const firstSide: 'away' | 'home' =
    firstTeamId === game.away_team.id
      ? 'away'
      : firstTeamId === game.home_team.id
        ? 'home'
        : 'away';
  const secondSide: 'away' | 'home' = firstSide === 'away' ? 'home' : 'away';

  const firstTeamAttempts = attempts.filter(
    (a) => a.team_id === (firstSide === 'away' ? game.away_team.id : game.home_team.id),
  );
  const secondTeamAttempts = attempts.filter(
    (a) => a.team_id === (secondSide === 'away' ? game.away_team.id : game.home_team.id),
  );

  const bestOf = game.best_of_shootout ?? 3;

  // ── Clinch & sudden-death detection ──────────────────────────────────────

  const firstRegGoals = firstTeamAttempts.slice(0, bestOf).filter((a) => a.scored).length;
  const secondRegGoals = secondTeamAttempts.slice(0, bestOf).filter((a) => a.scored).length;

  const firstRemaining = Math.max(0, bestOf - firstTeamAttempts.length);
  const secondRemaining = Math.max(0, bestOf - secondTeamAttempts.length);
  const isEarlyClinch =
    firstRegGoals > secondRegGoals + secondRemaining ||
    secondRegGoals > firstRegGoals + firstRemaining;

  const regulationComplete =
    firstTeamAttempts.length >= bestOf && secondTeamAttempts.length >= bestOf;
  const tiedAfterRegulation = regulationComplete && firstRegGoals === secondRegGoals;

  let sdExtraRounds = 0;
  if (tiedAfterRegulation) {
    let sdRound = 0;
    while (true) {
      const sdFirst = firstTeamAttempts[bestOf + sdRound];
      const sdSecond = secondTeamAttempts[bestOf + sdRound];
      if (!sdFirst && !sdSecond) {
        sdExtraRounds = sdRound + 1;
        break;
      }
      if (!sdFirst || !sdSecond) break;
      if (sdFirst.scored !== sdSecond.scored) break;
      sdRound++;
    }
  }

  const roundCount = isEarlyClinch
    ? Math.max(firstTeamAttempts.length, secondTeamAttempts.length)
    : Math.max(bestOf + sdExtraRounds, firstTeamAttempts.length, secondTeamAttempts.length);

  // ── Team display info (away always left, home always right) ───────────────

  const firstTeamInfo = {
    code: firstSide === 'away' ? game.away_team.code : game.home_team.code,
    logo: firstSide === 'away' ? game.away_team.logo : game.home_team.logo,
    logoDark: firstSide === 'away' ? game.away_team.logo_dark : game.home_team.logo_dark,
    logoLight: firstSide === 'away' ? game.away_team.logo_light : game.home_team.logo_light,
    primary: firstSide === 'away' ? game.away_team.primary_color : game.home_team.primary_color,
    text: firstSide === 'away' ? game.away_team.text_color : game.home_team.text_color,
  };
  const secondTeamInfo = {
    code: secondSide === 'away' ? game.away_team.code : game.home_team.code,
    logo: secondSide === 'away' ? game.away_team.logo : game.home_team.logo,
    logoDark: secondSide === 'away' ? game.away_team.logo_dark : game.home_team.logo_dark,
    logoLight: secondSide === 'away' ? game.away_team.logo_light : game.home_team.logo_light,
    primary: secondSide === 'away' ? game.away_team.primary_color : game.home_team.primary_color,
    text: secondSide === 'away' ? game.away_team.text_color : game.home_team.text_color,
  };

  const awayShootsFirst = firstSide === 'away';
  const leftInfo = awayShootsFirst ? firstTeamInfo : secondTeamInfo;
  const rightInfo = awayShootsFirst ? secondTeamInfo : firstTeamInfo;
  const orderedAttempts = [...attempts].sort((a, b) => a.attempt_order - b.attempt_order);
  const shouldShowFutureAttemptRows = isSOActive && !isFinal;
  const visibleAttemptRowCount = shouldShowFutureAttemptRows
    ? Math.max(orderedAttempts.length, roundCount * 2)
    : orderedAttempts.length;
  const awayPreShootoutScore = goals.filter((goal) => goal.team_id === game.away_team.id).length;
  const homePreShootoutScore = goals.filter((goal) => goal.team_id === game.home_team.id).length;

  // ── Label summary (e.g. "2/3 – 1/3") ─────────────────────────────────────

  const awayAttempts = firstSide === 'away' ? firstTeamAttempts : secondTeamAttempts;
  const homeAttempts = firstSide === 'home' ? firstTeamAttempts : secondTeamAttempts;
  const awayShootoutGoals = awayAttempts.filter((a) => a.scored).length;
  const homeShootoutGoals = homeAttempts.filter((a) => a.scored).length;
  const shootoutWinnerAttempt = (() => {
    if (!soComplete) return null;
    const winnerTeamId =
      awayShootoutGoals > homeShootoutGoals
        ? game.away_team.id
        : homeShootoutGoals > awayShootoutGoals
          ? game.home_team.id
          : null;
    if (!winnerTeamId) return null;
    const losingGoalTotal =
      winnerTeamId === game.away_team.id ? homeShootoutGoals : awayShootoutGoals;
    return (
      orderedAttempts.filter((attempt) => attempt.team_id === winnerTeamId && attempt.scored)[
        losingGoalTotal
      ] ?? null
    );
  })();
  const soLabelSummary =
    attempts.length > 0
      ? `${awayAttempts.filter((a) => a.scored).length}/${awayAttempts.length} – ${homeAttempts.filter((a) => a.scored).length}/${homeAttempts.length}`
      : null;

  // ── Attempt cell renderer ─────────────────────────────────────────────────

  const maxAttemptOrder =
    attempts.length > 0 ? Math.max(...attempts.map((a) => a.attempt_order)) : -1;

  const renderAttemptCell = (
    attempt: ShootoutAttempt | undefined,
    teamInfo: typeof firstTeamInfo,
    side: 'away' | 'home',
  ) => {
    const isAway = side === 'away';
    if (!attempt) {
      return (
        <div className={`${styles.soAttemptCell} ${styles.soAttemptCellEmpty}`}>
          {isAway ? (
            <>
              <span className={styles.soAttemptEmptyDash}>—</span>
              <span className={styles.soAttemptEmptySquare} />
            </>
          ) : (
            <>
              <span className={styles.soAttemptEmptySquare} />
              <span className={styles.soAttemptEmptyDash}>—</span>
            </>
          )}
        </div>
      );
    }

    const shooterName = formatPlayerName(attempt.shooter_first_name, attempt.shooter_last_name);
    const jerseyLabel =
      attempt.shooter_jersey_number != null ? `#${attempt.shooter_jersey_number}` : null;
    const resultBadge = (
      <span
        className={[
          styles.soResultBadge,
          attempt.scored ? styles.soResultBadgeScored : styles.soResultBadgeMissed,
        ].join(' ')}
      >
        {attempt.scored ? '✓' : '✕'}
      </span>
    );

    const photo = (
      <PlayerAvatar
        photo={attempt.shooter_photo}
        initials={playerInitials(attempt.shooter_first_name, attempt.shooter_last_name)}
        primaryColor={teamInfo.primary}
        textColor={teamInfo.text}
        size={48}
      />
    );

    const href = getPlayerHref ? getPlayerHref(attempt.shooter_id) : undefined;
    const nameEl = href ? (
      <Link
        to={href}
        className={styles.soAttemptName}
      >
        {shooterName}
        {playerDataComplete(
          attempt.shooter_date_of_birth,
          attempt.shooter_start_date,
          attempt.shooter_acquisition_type,
          showPlayerDataStatus,
        )}
      </Link>
    ) : (
      <span className={styles.soAttemptName}>{shooterName}</span>
    );

    const playerInfo = (
      <div
        className={[styles.soAttemptPlayerInfo, !isAway ? styles.soAttemptPlayerInfoAway : '']
          .filter(Boolean)
          .join(' ')}
      >
        {jerseyLabel && <span className={styles.soAttemptJersey}>{jerseyLabel}</span>}
        {nameEl}
      </div>
    );

    return (
      <div
        className={[
          styles.soAttemptCell,
          !isAway ? styles.soAttemptCellAway : '',
          attempt.scored ? styles.soAttemptCellScored : styles.soAttemptCellMissed,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {isAway ? (
          <>
            {photo}
            {playerInfo}
            {resultBadge}
          </>
        ) : (
          <>
            {resultBadge}
            {playerInfo}
            {photo}
          </>
        )}
        {canEditShootout &&
          attempt.attempt_order === maxAttemptOrder &&
          onEditAttempt &&
          onDeleteAttempt && (
            <ActionOverlay className={styles.goalActions}>
              <Button
                variant="ghost"
                intent="neutral"
                icon="edit"
                size="medium"
                tooltip="Edit attempt"
                disabled={deletingAttemptId === attempt.id}
                onClick={() => onEditAttempt(attempt)}
              />
              <Button
                variant="ghost"
                intent="danger"
                icon={deletingAttemptId === attempt.id ? 'hourglass_empty' : 'delete'}
                size="medium"
                tooltip={deletingAttemptId === attempt.id ? 'Deleting…' : 'Delete attempt'}
                disabled={deletingAttemptId === attempt.id}
                onClick={() => onDeleteAttempt(attempt.id)}
              />
            </ActionOverlay>
          )}
      </div>
    );
  };

  const renderAttemptSpacer = () => <div className={styles.soAttemptSpacer} />;

  const renderAttemptRow = (attempt: ShootoutAttempt | undefined, index: number) => {
    const expectedSide =
      index % 2 === 0 ? firstSide : firstSide === 'away' ? 'home' : 'away';
    const side = attempt
      ? attempt.team_id === game.away_team.id
        ? 'away'
        : 'home'
      : expectedSide;
    const teamInfo = side === 'away' ? leftInfo : rightInfo;

    return (
      <div
        key={attempt?.id ?? `empty-${index}`}
        className={styles.soAttemptRow}
      >
        {side === 'away'
          ? renderAttemptCell(attempt, teamInfo, 'away')
          : renderAttemptSpacer()}
        {side === 'away'
          ? renderAttemptSpacer()
          : renderAttemptCell(attempt, teamInfo, 'home')}
      </div>
    );
  };

  const renderShootoutWinner = () => {
    if (!shootoutWinnerAttempt) return null;
    const isAwayWinner = shootoutWinnerAttempt.team_id === game.away_team.id;
    const team = isAwayWinner ? game.away_team : game.home_team;
    const displayedAwayScore = awayPreShootoutScore + (isAwayWinner ? 1 : 0);
    const displayedHomeScore = homePreShootoutScore + (!isAwayWinner ? 1 : 0);
    const shooterName = formatPlayerName(
      shootoutWinnerAttempt.shooter_first_name,
      shootoutWinnerAttempt.shooter_last_name,
    );
    const shooter = getPlayerHref ? (
      <Link
        to={getPlayerHref(shootoutWinnerAttempt.shooter_id)}
        className={scoringStyles.playerLink}
      >
        {shooterName}
        {playerDataComplete(
          shootoutWinnerAttempt.shooter_date_of_birth,
          shootoutWinnerAttempt.shooter_start_date,
          shootoutWinnerAttempt.shooter_acquisition_type,
          showPlayerDataStatus,
        )}
      </Link>
    ) : (
      shooterName
    );

    return (
            <ResponsiveList className={scoringStyles.goalList}>
        <li className={[scoringStyles.goalItem, styles.soWinnerGoalItem].join(' ')}>
          <span className={scoringStyles.goalTime}>SO</span>
          <TeamLogo
            logo={team.logo}
            logoDark={team.logo_dark}
            logoLight={team.logo_light}
            code={team.code ?? '?'}
            primaryColor={team.primary_color}
            textColor={team.text_color}
            size={30}
            shape="square"
          />
          <PlayerAvatar
            photo={shootoutWinnerAttempt.shooter_photo}
            initials={playerInitials(
              shootoutWinnerAttempt.shooter_first_name,
              shootoutWinnerAttempt.shooter_last_name,
            )}
            primaryColor={team.primary_color}
            textColor={team.text_color}
            size={48}
          />
          <div className={scoringStyles.goalInfo}>
            <span className={scoringStyles.goalScorer}>{shooter}</span>
            <span className={scoringStyles.goalAssists}>Shootout Winner</span>
          </div>
          <span className={scoringStyles.goalScore}>
            {displayedAwayScore} - {displayedHomeScore}
          </span>
        </li>
            </ResponsiveList>
    );
  };

  // ── Accordion actions ─────────────────────────────────────────────────────

  // The current round is "unbalanced" when the first team has already taken
  // their attempt but the second team hasn't yet.
  const roundUnbalanced = firstTeamAttempts.length > secondTeamAttempts.length;

  // Second team has already won without needing their current attempt:
  // they lead even accounting for first team's remaining regular-round attempts.
  const secondWonEarly = roundUnbalanced && secondRegGoals > firstRegGoals + firstRemaining;

  // First team clinched: second team cannot catch up even with their remaining
  // regular-round attempts. e.g. Home shoots first, scores 2/3, Away is 0/2 —
  // Away's 3rd shot cannot tie so the game is already decided.
  const firstWonEarly = roundUnbalanced && firstRegGoals > secondRegGoals + secondRemaining;

  // Allow adding only when the game isn't decided, or when the round is
  // unbalanced and the second team still has a meaningful shot to take.
  const canAddAttempt = !soComplete || (roundUnbalanced && !secondWonEarly && !firstWonEarly);
  const canEndGame = soComplete && (!roundUnbalanced || secondWonEarly || firstWonEarly);

  const hoverActions: AccordionAction[] | undefined =
    isSOActive && (onAddAttempt || onEndGame)
      ? ([
          canAddAttempt && onAddAttempt
            ? {
                icon: 'sports_hockey',
                tooltip: 'Add Attempt',
                intent: 'success' as const,
                disabled: !!busy,
                onClick: onAddAttempt,
              }
            : null,
          canEndGame && onEndGame
            ? {
                icon: 'flag',
                tooltip: 'End Game',
                intent: 'danger' as const,
                disabled: !!busy,
                onClick: onEndGame,
              }
            : null,
        ].filter(Boolean) as AccordionAction[])
      : undefined;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Accordion
      mode="static"
      headerVariant="light"
      className={className}
      label={
        <span className={labelClassName}>
          Shootout
          {soLabelSummary && <span className={styles.soLabelSummary}>{soLabelSummary}</span>}
        </span>
      }
      hoverActions={hoverActions}
    >
      {(isSOActive || isSODone) && (
        <div className={styles.soAttemptGrid}>
          {renderShootoutWinner()}
          {/* Header row — away always left, home always right */}
          <div className={styles.soAttemptHeaderRow}>
            <div className={styles.soAttemptColHeader}>
              <span className={styles.soAttemptColTeam}>
                <TeamLogo
                  logo={leftInfo.logo}
                  logoDark={leftInfo.logoDark}
                  logoLight={leftInfo.logoLight}
                  code={leftInfo.code}
                  primaryColor={leftInfo.primary}
                  textColor={leftInfo.text}
                  size={18}
                  shape="square"
                />
                <span>{leftInfo.code}</span>
              </span>
              <span className={styles.soAttemptHeaderGoalCount}>{awayShootoutGoals}</span>
            </div>
            <div className={[styles.soAttemptColHeader, styles.soAttemptColHeaderAway].join(' ')}>
              <span className={styles.soAttemptColTeam}>
                <TeamLogo
                  logo={rightInfo.logo}
                  logoDark={rightInfo.logoDark}
                  logoLight={rightInfo.logoLight}
                  code={rightInfo.code}
                  primaryColor={rightInfo.primary}
                  textColor={rightInfo.text}
                  size={18}
                  shape="square"
                />
                <span>{rightInfo.code}</span>
              </span>
              <span className={styles.soAttemptHeaderGoalCount}>{homeShootoutGoals}</span>
            </div>
          </div>
          {Array.from({ length: visibleAttemptRowCount }, (_, index) =>
            renderAttemptRow(orderedAttempts[index], index),
          )}
        </div>
      )}
    </Accordion>
  );
};

export default ShootoutAccordion;
