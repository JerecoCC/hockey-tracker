import React from 'react';
import { Link } from 'react-router-dom';
import ActionOverlay from '@/components/ActionOverlay/ActionOverlay';
import PlayerAvatar from '@/components/PlayerAvatar/PlayerAvatar';
import Badge from '@/components/Badge/Badge';
import Tooltip from '@/components/Tooltip/Tooltip';
import Accordion, { type AccordionAction } from '@/components/Accordion/Accordion';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
import type { GameRecord, CurrentPeriod } from '@/hooks/useGames';
import type { GoalRecord } from '@/hooks/useGameGoals';
import type { ShootoutAttempt } from '@/hooks/useShootoutAttempts';
import type { ShotsNextAction } from './RecordShotsModal';
import ShootoutAccordion from './ShootoutAccordion';
import { formatPlayerName } from './formatUtils';
import { PERIOD_IDS, PERIODS, GOAL_TYPE_BADGE } from './constants';
import styles from './ScoringCard.module.scss';
import { playerDataComplete } from './gameUtils';

// ── Types ────────────────────────────────────────────────────────────────────

type GoalTally = {
  scorerGoals: number;
  assist1Assists: number | null;
  assist2Assists: number | null;
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  game: GameRecord;
  goals: GoalRecord[];
  isFinal: boolean;
  isInProgress: boolean;
  isEditMode?: boolean;
  busy: string | null;
  liveAwayScore: number;
  liveHomeScore: number;
  tallyByGoalId: Map<string, GoalTally>;
  lastCurrentPeriodGoalId: string | undefined;
  attempts: ShootoutAttempt[];
  soComplete: boolean;
  deletingAttemptId: string | null;
  awayTeamId: string;
  homeTeamId: string;
  /** When omitted, no admin action overlays are rendered (used in read-only user view). */
  setAccordionRef?: (periodId: string) => (el: HTMLDivElement | null) => void;
  onScoreGoal?: (period: 1 | 2 | 3 | 'OT') => void;
  onEditGoal?: (goal: GoalRecord) => void;
  onDeleteGoal?: (goalId: string) => void;
  onOpenShotsModal?: (
    period: string,
    action: ShotsNextAction,
    showGoalies: boolean,
    showShootsFirst?: boolean,
  ) => void;
  onAddAttempt?: () => void;
  onEditAttempt?: (attempt: ShootoutAttempt) => void;
  onDeleteAttempt?: (attemptId: string) => Promise<void>;
  onGoBackPeriod?: (prev: CurrentPeriod) => void;
  onGoBackOTPeriod?: (targetNum: number) => void;
  /** When provided, player names in goal rows become navigation links. */
  getPlayerHref?: (playerId: string) => string;
}

// ── Component ─────────────────────────────────────────────────────────────────

const ScoringCard = ({
  game,
  goals,
  isFinal,
  isInProgress,
  isEditMode = false,
  busy,
  liveAwayScore,
  liveHomeScore,
  tallyByGoalId,
  lastCurrentPeriodGoalId,
  attempts,
  soComplete,
  deletingAttemptId,
  awayTeamId,
  homeTeamId,
  setAccordionRef,
  onScoreGoal,
  onEditGoal,
  onDeleteGoal,
  onOpenShotsModal,
  onAddAttempt,
  onEditAttempt,
  onDeleteAttempt,
  onGoBackPeriod,
  onGoBackOTPeriod,
  getPlayerHref,
}: Props) => {
  // ── Helpers ────────────────────────────────────────────────────────────────
  const periodTimeToSecs = (t: string | null | undefined): number => {
    if (!t) return 0;
    const [m, s] = t.split(':').map(Number);
    return (m || 0) * 60 + (s || 0);
  };

  const sortedByTime = (gs: GoalRecord[]) =>
    [...gs].sort((a, b) => periodTimeToSecs(a.period_time) - periodTimeToSecs(b.period_time));

  let awayScore: number = 0;
  let homeScore: number = 0;
  // ── Shared goal-list renderer ──────────────────────────────────────────────
  const renderGoalList = (periodGoals: GoalRecord[]) => {
    return (
      <ul className={styles.goalList}>
        {periodGoals.map((goal) => {
          if (awayTeamId === goal.team_id) {
            awayScore += 1;
          } else if (homeTeamId === goal.team_id) {
            homeScore += 1;
          }
          const tally = tallyByGoalId.get(goal.id);
          const scorerBaseName = formatPlayerName(goal.scorer_first_name, goal.scorer_last_name);
          const scorerTally = tally ? ` (${tally.scorerGoals})` : '';
          const assistList = [
            goal.assist_1_id
              ? {
                  id: goal.assist_1_id,
                  name: formatPlayerName(goal.assist_1_first_name, goal.assist_1_last_name),
                  tally: tally?.assist1Assists != null ? ` (${tally.assist1Assists})` : '',
                }
              : null,
            goal.assist_2_id
              ? {
                  id: goal.assist_2_id,
                  name: formatPlayerName(goal.assist_2_first_name, goal.assist_2_last_name),
                  tally: tally?.assist2Assists != null ? ` (${tally.assist2Assists})` : '',
                }
              : null,
          ].filter(Boolean) as { id: string; name: string; tally: string }[];
          const primaryBadge =
            goal.goal_type === 'empty-net' || goal.goal_type === 'penalty-shot'
              ? null
              : (GOAL_TYPE_BADGE[goal.goal_type] ?? null);
          const showEN = goal.empty_net || goal.goal_type === 'empty-net';
          const showPS = goal.penalty_shot || goal.goal_type === 'penalty-shot';
          return (
            <li
              key={goal.id}
              className={styles.goalItem}
            >
              <span className={styles.goalTime}>{goal.period_time ?? '—'}</span>
              <TeamLogo
                logo={goal.team_logo}
                code={goal.team_code ?? '?'}
                primaryColor={goal.team_primary_color}
                textColor={goal.team_text_color}
                size={36}
                shape="square"
              />
              <PlayerAvatar
                photo={goal.scorer_photo}
                initials={
                  `${goal.scorer_first_name?.charAt(0) ?? ''}${goal.scorer_last_name?.charAt(0) ?? ''}`.trim() ||
                  '?'
                }
                primaryColor={goal.team_primary_color}
                textColor={goal.team_text_color}
                size={48}
              />
              <div className={styles.goalInfo}>
                <span className={styles.goalScorer}>
                  {getPlayerHref ? (
                    <Link
                      to={getPlayerHref(goal.scorer_id)}
                      className={styles.playerLink}
                    >
                      {scorerBaseName}
                      {playerDataComplete(
                        goal.scorer_date_of_birth,
                        goal.scorer_start_date,
                        goal.scorer_acquisition_type,
                      )}
                    </Link>
                  ) : (
                    scorerBaseName
                  )}
                  {scorerTally}
                </span>
                <span className={styles.goalAssists}>
                  {assistList.length > 0
                    ? assistList.map((a, i) => (
                        <React.Fragment key={a.id}>
                          {i > 0 && ', '}
                          {getPlayerHref ? (
                            <Link
                              to={getPlayerHref(a.id)}
                              className={styles.playerLink}
                            >
                              {a.name}
                            </Link>
                          ) : (
                            a.name
                          )}
                          {a.tally}
                        </React.Fragment>
                      ))
                    : 'Unassisted'}
                </span>
              </div>
              {primaryBadge && (
                <Tooltip text={primaryBadge.tooltip}>
                  <Badge
                    label={primaryBadge.label}
                    intent={primaryBadge.intent}
                  />
                </Tooltip>
              )}
              {showEN && (
                <Tooltip text="Empty Net">
                  <Badge
                    label="EN"
                    intent="neutral"
                  />
                </Tooltip>
              )}
              {showPS && (
                <Tooltip text="Penalty Shot">
                  <Badge
                    label="PS"
                    intent="success"
                  />
                </Tooltip>
              )}
              <span className={styles.goalScore}>
                {awayScore} - {homeScore}
              </span>
              {isInProgress && onEditGoal && onDeleteGoal && (
                <ActionOverlay className={styles.goalActions}>
                  <Button
                    variant="ghost"
                    intent="neutral"
                    icon="edit"
                    size="sm"
                    tooltip="Edit goal"
                    onClick={() => onEditGoal(goal)}
                  />
                  {goal.id === lastCurrentPeriodGoalId && (
                    <Button
                      variant="ghost"
                      intent="danger"
                      icon="delete"
                      size="sm"
                      tooltip="Delete goal"
                      onClick={() => onDeleteGoal(goal.id)}
                    />
                  )}
                </ActionOverlay>
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <Card title="Scoring">
      <div className={styles.periodList}>
        {/* ── Regular period accordions ── */}
        {PERIODS.map(({ num, label, periodId }, idx) => {
          const currentIdx = PERIOD_IDS.indexOf(game.current_period as '1' | '2' | '3');
          const isPostRegulation = game.current_period === 'OT' || game.current_period === 'SO';
          const isActive = !isFinal && game.current_period === periodId;
          const isDone = isFinal || isPostRegulation || currentIdx > idx;
          const periodGoals = sortedByTime(goals.filter((g) => g.period === periodId));
          if (isFinal && !isEditMode && periodGoals.length === 0) return null;
          return (
            <Accordion
              key={num}
              ref={setAccordionRef ? setAccordionRef(periodId) : undefined}
              variant="static"
              className={isActive ? styles.periodItemActive : undefined}
              label={<span className={styles.periodLabel}>{label}</span>}
              hoverActions={
                isActive && onScoreGoal && onOpenShotsModal
                  ? ([
                      onGoBackPeriod && num > 1 && periodGoals.length === 0
                        ? {
                            icon: 'undo',
                            tooltip: 'Go Back to Previous Period',
                            intent: 'neutral' as const,
                            disabled: !!busy,
                            onClick: () => onGoBackPeriod(String(num - 1) as CurrentPeriod),
                          }
                        : null,
                      {
                        icon: 'sports_hockey',
                        tooltip: 'Score Goal',
                        intent: 'success' as const,
                        disabled: !!busy,
                        onClick: () => onScoreGoal(num as 1 | 2 | 3),
                      },
                      num < 3
                        ? {
                            icon: 'flag',
                            tooltip: 'End Period',
                            intent: 'danger' as const,
                            disabled: !!busy,
                            onClick: () =>
                              onOpenShotsModal(
                                periodId,
                                {
                                  type: 'advance',
                                  label: 'End Period',
                                  next: String(num + 1) as CurrentPeriod,
                                },
                                true,
                              ),
                          }
                        : null,
                      num === 3 && liveAwayScore === liveHomeScore
                        ? {
                            icon: 'more_time',
                            tooltip: 'Go to Overtime',
                            intent: 'accent' as const,
                            disabled: !!busy,
                            onClick: () =>
                              onOpenShotsModal(
                                '3',
                                { type: 'advance', label: 'Go to Overtime', next: 'OT' },
                                true,
                              ),
                          }
                        : null,
                      num === 3 && liveAwayScore !== liveHomeScore && !isEditMode
                        ? {
                            icon: 'flag',
                            tooltip: 'End Game',
                            intent: 'danger' as const,
                            disabled: !!busy,
                            onClick: () => onOpenShotsModal('3', { type: 'end-game' }, true),
                          }
                        : null,
                    ].filter(Boolean) as AccordionAction[])
                  : undefined
              }
            >
              {periodGoals.length === 0 ? (
                isActive || isDone ? (
                  <p className={styles.noGoalsText}>No goals scored.</p>
                ) : null
              ) : (
                renderGoalList(periodGoals)
              )}
            </Accordion>
          );
        })}

        {/* ── Overtime accordion(s) ── */}
        {(game.current_period === 'OT' ||
          game.current_period === 'SO' ||
          goals.some((g) => g.period === 'OT') ||
          (isFinal && (game.overtime_periods ?? 0) > 0) ||
          (isFinal && game.shootout)) &&
          (() => {
            const isPlayoff = game.game_type === 'playoff';
            const isOTActive = !isFinal && game.current_period === 'OT';
            const isOTDone = isFinal || game.current_period === 'SO';
            const otGoals = sortedByTime(goals.filter((g) => g.period === 'OT'));
            const otCount = game.overtime_periods ?? 1;

            if (isPlayoff) {
              // Render a separate accordion for each OT period played.
              // Since OT is sudden-death, goals only ever appear in the last period.
              return Array.from({ length: otCount }, (_, i) => {
                const otNum = i + 1;
                const isLast = otNum === otCount;
                const isThisActive = isOTActive && isLast;
                const isThisDone = isOTDone || !isLast;
                const periodGoals = isLast ? otGoals : [];
                if (isFinal && !isEditMode && periodGoals.length === 0) return null;
                return (
                  <Accordion
                    key={`OT${otNum}`}
                    ref={isLast && setAccordionRef ? setAccordionRef('OT') : undefined}
                    variant="static"
                    className={isThisActive ? styles.periodItemActive : undefined}
                    label={<span className={styles.periodLabel}>Overtime {otNum}</span>}
                    hoverActions={
                      isThisActive && onScoreGoal && onOpenShotsModal
                        ? ([
                            // Go back: OT1 → period 3; OT2+ → previous OT period.
                            (onGoBackPeriod || onGoBackOTPeriod) && periodGoals.length === 0
                              ? {
                                  icon: 'undo',
                                  tooltip: 'Go Back to Previous Period',
                                  intent: 'neutral' as const,
                                  disabled: !!busy,
                                  onClick: () =>
                                    otNum === 1
                                      ? onGoBackPeriod?.('3')
                                      : onGoBackOTPeriod?.(otNum - 1),
                                }
                              : null,
                            periodGoals.length === 0
                              ? {
                                  icon: 'sports_hockey',
                                  tooltip: 'Score Goal',
                                  intent: 'success' as const,
                                  disabled: !!busy,
                                  onClick: () => onScoreGoal('OT'),
                                }
                              : null,
                            periodGoals.length === 0
                              ? {
                                  icon: 'play_arrow',
                                  tooltip: 'Next Overtime Period',
                                  intent: 'accent' as const,
                                  disabled: !!busy,
                                  onClick: () =>
                                    onOpenShotsModal(`OT${otNum}`, { type: 'next-ot' }, true),
                                }
                              : null,
                            periodGoals.length > 0 && !isEditMode
                              ? {
                                  icon: 'flag',
                                  tooltip: 'End Game',
                                  intent: 'danger' as const,
                                  disabled: !!busy,
                                  onClick: () =>
                                    onOpenShotsModal(`OT${otNum}`, { type: 'end-game' }, true),
                                }
                              : null,
                          ].filter(Boolean) as AccordionAction[])
                        : undefined
                    }
                  >
                    {periodGoals.length === 0 ? (
                      isThisActive || isThisDone ? (
                        <p className={styles.noGoalsText}>No goals scored.</p>
                      ) : null
                    ) : (
                      renderGoalList(periodGoals)
                    )}
                  </Accordion>
                );
              });
            }

            // Regular season: single OT accordion.
            if (isFinal && !isEditMode && otGoals.length === 0) return null;
            return (
              <Accordion
                ref={setAccordionRef ? setAccordionRef('OT') : undefined}
                variant="static"
                className={isOTActive ? styles.periodItemActive : undefined}
                label={<span className={styles.periodLabel}>Overtime</span>}
                hoverActions={
                  isOTActive && onScoreGoal && onOpenShotsModal
                    ? ([
                        onGoBackPeriod && otGoals.length === 0
                          ? {
                              icon: 'undo',
                              tooltip: 'Go Back to Previous Period',
                              intent: 'neutral' as const,
                              disabled: !!busy,
                              onClick: () => onGoBackPeriod('3'),
                            }
                          : null,
                        otGoals.length === 0
                          ? {
                              icon: 'sports_hockey',
                              tooltip: 'Score Goal',
                              intent: 'success' as const,
                              disabled: !!busy,
                              onClick: () => onScoreGoal('OT'),
                            }
                          : null,
                        otGoals.length === 0
                          ? {
                              icon: 'play_arrow',
                              tooltip: 'Go to Shootouts',
                              intent: 'accent' as const,
                              disabled: !!busy,
                              onClick: () =>
                                onOpenShotsModal(
                                  'OT',
                                  { type: 'advance', label: 'Go to Shootouts', next: 'SO' },
                                  true,
                                  true,
                                ),
                            }
                          : null,
                        otGoals.length > 0 && !isEditMode
                          ? {
                              icon: 'flag',
                              tooltip: 'End Game',
                              intent: 'danger' as const,
                              disabled: !!busy,
                              onClick: () => onOpenShotsModal('OT', { type: 'end-game' }, true),
                            }
                          : null,
                      ].filter(Boolean) as AccordionAction[])
                    : undefined
                }
              >
                {otGoals.length === 0 ? (
                  isOTActive || isOTDone ? (
                    <p className={styles.noGoalsText}>No goals scored.</p>
                  ) : null
                ) : (
                  renderGoalList(otGoals)
                )}
              </Accordion>
            );
          })()}

        {/* ── Shootouts accordion ── */}
        {(game.current_period === 'SO' ||
          goals.some((g) => g.period === 'SO') ||
          (isFinal && game.shootout)) && (
          <ShootoutAccordion
            game={game}
            attempts={attempts}
            goals={goals}
            isFinal={isFinal}
            isInProgress={isInProgress}
            soComplete={soComplete}
            busy={busy}
            deletingAttemptId={deletingAttemptId}
            className={
              !isFinal && game.current_period === 'SO' ? styles.periodItemActive : undefined
            }
            labelClassName={styles.periodLabel}
            onAddAttempt={onAddAttempt}
            onEditAttempt={onEditAttempt}
            onDeleteAttempt={onDeleteAttempt}
            getPlayerHref={getPlayerHref}
            onEndGame={
              onOpenShotsModal && !isEditMode
                ? () => onOpenShotsModal('SO', { type: 'end-game' }, true)
                : undefined
            }
          />
        )}
      </div>
    </Card>
  );
};

export default ScoringCard;
