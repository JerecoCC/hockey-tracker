import React from 'react';
import ActionOverlay from '@/components/ActionOverlay/ActionOverlay';
import Badge from '@/components/Badge/Badge';
import Tooltip from '@/components/Tooltip/Tooltip';
import Accordion, { type AccordionAction } from '@/components/Accordion/Accordion';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import type { GameRecord, CurrentPeriod } from '@/hooks/useGames';
import type { GoalRecord } from '@/hooks/useGameGoals';
import type { ShootoutAttempt } from '@/hooks/useShootoutAttempts';
import type { ShotsNextAction } from './RecordShotsModal';
import ShootoutAccordion from './ShootoutAccordion';
import { formatPlayerName } from './formatUtils';
import { PERIOD_IDS, PERIODS, GOAL_TYPE_BADGE } from './constants';
import styles from './ScoringCard.module.scss';

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
  busy: string | null;
  liveAwayScore: number;
  liveHomeScore: number;
  tallyByGoalId: Map<string, GoalTally>;
  lastCurrentPeriodGoalId: string | undefined;
  attempts: ShootoutAttempt[];
  soComplete: boolean;
  deletingAttemptId: string | null;
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
  onDeleteAttempt?: (attemptId: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

const ScoringCard = ({
  game,
  goals,
  isFinal,
  isInProgress,
  busy,
  liveAwayScore,
  liveHomeScore,
  tallyByGoalId,
  lastCurrentPeriodGoalId,
  attempts,
  soComplete,
  deletingAttemptId,
  setAccordionRef,
  onScoreGoal,
  onEditGoal,
  onDeleteGoal,
  onOpenShotsModal,
  onAddAttempt,
  onEditAttempt,
  onDeleteAttempt,
}: Props) => {
  // ── Shared goal-list renderer ──────────────────────────────────────────────
  const renderGoalList = (periodGoals: GoalRecord[]) => (
    <ul className={styles.goalList}>
      {periodGoals.map((goal) => {
        const tally = tallyByGoalId.get(goal.id);
        const scorerName =
          formatPlayerName(goal.scorer_first_name, goal.scorer_last_name) +
          (tally ? ` (${tally.scorerGoals})` : '');
        const assists = [
          goal.assist_1_id
            ? formatPlayerName(goal.assist_1_first_name, goal.assist_1_last_name) +
              (tally?.assist1Assists != null ? ` (${tally.assist1Assists})` : '')
            : null,
          goal.assist_2_id
            ? formatPlayerName(goal.assist_2_first_name, goal.assist_2_last_name) +
              (tally?.assist2Assists != null ? ` (${tally.assist2Assists})` : '')
            : null,
        ].filter(Boolean) as string[];
        const primaryBadge =
          goal.goal_type === 'empty-net' ? null : (GOAL_TYPE_BADGE[goal.goal_type] ?? null);
        const showEN = goal.empty_net || goal.goal_type === 'empty-net';
        return (
          <li
            key={goal.id}
            className={styles.goalItem}
          >
            <span className={styles.goalTime}>{goal.period_time ?? '—'}</span>
            {goal.team_logo ? (
              <img
                src={goal.team_logo}
                alt={goal.team_code}
                className={styles.goalTeamLogo}
              />
            ) : (
              <span
                className={styles.goalTeamLogoPlaceholder}
                style={{ background: goal.team_primary_color, color: goal.team_text_color }}
              >
                {goal.team_code?.slice(0, 1)}
              </span>
            )}
            {goal.scorer_photo ? (
              <img
                src={goal.scorer_photo}
                alt=""
                className={styles.goalScorerPhoto}
              />
            ) : (
              <span
                className={styles.goalScorerPhotoPlaceholder}
                style={{ background: goal.team_primary_color, color: goal.team_text_color }}
              >
                {goal.scorer_last_name?.charAt(0)}
              </span>
            )}
            <div className={styles.goalInfo}>
              <span className={styles.goalScorer}>{scorerName}</span>
              <span className={styles.goalAssists}>
                {assists.length > 0 ? assists.join(', ') : 'Unassisted'}
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
            {isInProgress && goal.id === lastCurrentPeriodGoalId && onEditGoal && onDeleteGoal && (
              <ActionOverlay className={styles.goalActions}>
                <Button
                  variant="ghost"
                  intent="neutral"
                  icon="edit"
                  size="sm"
                  tooltip="Edit goal"
                  onClick={() => onEditGoal(goal)}
                />
                <Button
                  variant="ghost"
                  intent="danger"
                  icon="delete"
                  size="sm"
                  tooltip="Delete goal"
                  onClick={() => onDeleteGoal(goal.id)}
                />
              </ActionOverlay>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <Card title="Scoring">
      <div className={styles.periodList}>
        {/* ── Regular period accordions ── */}
        {PERIODS.map(({ num, label, periodId }, idx) => {
          const currentIdx = PERIOD_IDS.indexOf(game.current_period as '1' | '2' | '3');
          const isPostRegulation = game.current_period === 'OT' || game.current_period === 'SO';
          const isActive = !isFinal && game.current_period === periodId;
          const isDone = isFinal || isPostRegulation || currentIdx > idx;
          const periodGoals = goals.filter((g) => g.period === periodId);
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
                                false,
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
                                false,
                              ),
                          }
                        : null,
                      num === 3 && liveAwayScore !== liveHomeScore
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
                  <p className={styles.noGoalsText}>No goals scored</p>
                ) : null
              ) : (
                renderGoalList(periodGoals)
              )}
            </Accordion>
          );
        })}

        {/* ── Overtime accordion ── */}
        {(game.current_period === 'OT' ||
          game.current_period === 'SO' ||
          goals.some((g) => g.period === 'OT') ||
          (isFinal && (game.overtime_periods ?? 0) > 0) ||
          (isFinal && game.shootout)) &&
          (() => {
            const isOTActive = !isFinal && game.current_period === 'OT';
            const isOTDone = isFinal || game.current_period === 'SO';
            const otGoals = goals.filter((g) => g.period === 'OT');
            return (
              <Accordion
                ref={setAccordionRef ? setAccordionRef('OT') : undefined}
                variant="static"
                className={isOTActive ? styles.periodItemActive : undefined}
                label={<span className={styles.periodLabel}>Overtime</span>}
                hoverActions={
                  isOTActive && onScoreGoal && onOpenShotsModal
                    ? ([
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
                              intent: 'info' as const,
                              disabled: !!busy,
                              onClick: () =>
                                onOpenShotsModal(
                                  'OT',
                                  { type: 'advance', label: 'Go to Shootouts', next: 'SO' },
                                  false,
                                  true,
                                ),
                            }
                          : null,
                        otGoals.length > 0
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
                    <p className={styles.noGoalsText}>No goals scored</p>
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
            onEndGame={
              onOpenShotsModal
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
