import { Link } from 'react-router-dom';
import ActionOverlay from '@/components/ActionOverlay/ActionOverlay';
import Accordion, { type AccordionAction } from '@/components/Accordion/Accordion';
import Button from '@/components/Button/Button';
import { type GameRecord } from '@/hooks/useGames';
import { type ShootoutAttempt } from '@/hooks/useShootoutAttempts';
import { formatPlayerName } from './formatUtils';
import styles from './ShootoutAccordion.module.scss';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  game: GameRecord;
  attempts: ShootoutAttempt[];
  isFinal: boolean;
  isInProgress: boolean;
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
}

// ── Component ─────────────────────────────────────────────────────────────────

const ShootoutAccordion = ({
  game,
  attempts,
  isFinal,
  isInProgress,
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
}: Props) => {
  const isSOActive = !isFinal && game.current_period === 'SO';
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
    primary: firstSide === 'away' ? game.away_team.primary_color : game.home_team.primary_color,
    text: firstSide === 'away' ? game.away_team.text_color : game.home_team.text_color,
  };
  const secondTeamInfo = {
    code: secondSide === 'away' ? game.away_team.code : game.home_team.code,
    logo: secondSide === 'away' ? game.away_team.logo : game.home_team.logo,
    primary: secondSide === 'away' ? game.away_team.primary_color : game.home_team.primary_color,
    text: secondSide === 'away' ? game.away_team.text_color : game.home_team.text_color,
  };

  const awayShootsFirst = firstSide === 'away';
  const leftInfo = awayShootsFirst ? firstTeamInfo : secondTeamInfo;
  const rightInfo = awayShootsFirst ? secondTeamInfo : firstTeamInfo;
  const leftAttempts = awayShootsFirst ? firstTeamAttempts : secondTeamAttempts;
  const rightAttempts = awayShootsFirst ? secondTeamAttempts : firstTeamAttempts;

  // ── Label summary (e.g. "2/3 – 1/3") ─────────────────────────────────────

  const awayAttempts = firstSide === 'away' ? firstTeamAttempts : secondTeamAttempts;
  const homeAttempts = firstSide === 'home' ? firstTeamAttempts : secondTeamAttempts;
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

    const photo = attempt.shooter_photo ? (
      <img
        src={attempt.shooter_photo}
        alt=""
        className={styles.soAttemptPhoto}
      />
    ) : (
      <span
        className={styles.soAttemptPhotoPlaceholder}
        style={{ background: teamInfo.primary, color: teamInfo.text }}
      >
        {attempt.shooter_last_name?.charAt(0)}
      </span>
    );

    const href = getPlayerHref ? getPlayerHref(attempt.shooter_id) : undefined;
    const nameEl = href ? (
      <Link
        to={href}
        className={styles.soAttemptName}
      >
        {shooterName}
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
        {isInProgress &&
          attempt.attempt_order === maxAttemptOrder &&
          onEditAttempt &&
          onDeleteAttempt && (
            <ActionOverlay className={styles.goalActions}>
              <Button
                variant="ghost"
                intent="neutral"
                icon="edit"
                size="sm"
                tooltip="Edit attempt"
                disabled={deletingAttemptId === attempt.id}
                onClick={() => onEditAttempt(attempt)}
              />
              <Button
                variant="ghost"
                intent="danger"
                icon={deletingAttemptId === attempt.id ? 'hourglass_empty' : 'delete'}
                size="sm"
                tooltip={deletingAttemptId === attempt.id ? 'Deleting…' : 'Delete attempt'}
                disabled={deletingAttemptId === attempt.id}
                onClick={() => onDeleteAttempt(attempt.id)}
              />
            </ActionOverlay>
          )}
      </div>
    );
  };

  // ── Accordion actions ─────────────────────────────────────────────────────

  // The current round is "unbalanced" when the first team has already taken
  // their attempt but the second team hasn't yet (firstTeamAttempts.length >
  // secondTeamAttempts.length). In that case we must still allow recording the
  // second team's attempt for this round, even if the winner is already decided.
  const roundUnbalanced = firstTeamAttempts.length > secondTeamAttempts.length;
  const canAddAttempt = !soComplete || roundUnbalanced;
  const canEndGame = soComplete && !roundUnbalanced;

  const hoverActions: AccordionAction[] | undefined =
    isSOActive && onAddAttempt && onEndGame
      ? ([
          canAddAttempt
            ? {
                icon: 'sports_hockey',
                tooltip: 'Add Attempt',
                intent: 'success' as const,
                disabled: !!busy,
                onClick: onAddAttempt,
              }
            : null,
          canEndGame
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
      variant="static"
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
          {/* Header row — away always left, home always right */}
          <div className={styles.soAttemptHeaderRow}>
            <div className={styles.soAttemptColHeader}>
              {leftInfo.logo ? (
                <img
                  src={leftInfo.logo}
                  alt={leftInfo.code}
                  className={styles.soAttemptColLogo}
                />
              ) : (
                <span
                  className={styles.soAttemptColLogoPlaceholder}
                  style={{ background: leftInfo.primary, color: leftInfo.text }}
                >
                  {leftInfo.code.slice(0, 1)}
                </span>
              )}
              <span>{leftInfo.code}</span>
              {awayShootsFirst && <span className={styles.soFirstShooterBadge}>shoots first</span>}
            </div>
            <div className={[styles.soAttemptColHeader, styles.soAttemptColHeaderAway].join(' ')}>
              {!awayShootsFirst && <span className={styles.soFirstShooterBadge}>shoots first</span>}
              {rightInfo.logo ? (
                <img
                  src={rightInfo.logo}
                  alt={rightInfo.code}
                  className={styles.soAttemptColLogo}
                />
              ) : (
                <span
                  className={styles.soAttemptColLogoPlaceholder}
                  style={{ background: rightInfo.primary, color: rightInfo.text }}
                >
                  {rightInfo.code.slice(0, 1)}
                </span>
              )}
              <span>{rightInfo.code}</span>
            </div>
          </div>
          {/* Round rows */}
          {Array.from({ length: roundCount }, (_, i) => (
            <div
              key={i}
              className={styles.soAttemptRow}
            >
              {renderAttemptCell(leftAttempts[i], leftInfo, 'away')}
              {renderAttemptCell(rightAttempts[i], rightInfo, 'home')}
            </div>
          ))}
        </div>
      )}
    </Accordion>
  );
};

export default ShootoutAccordion;
