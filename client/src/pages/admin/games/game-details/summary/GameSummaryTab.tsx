import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useGameGoals from '@/hooks/useGameGoals';
import useShootoutAttempts from '@/hooks/useShootoutAttempts';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import MoreActionsMenu from '@/components/MoreActionsMenu/MoreActionsMenu';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import StartGameModal from '../StartGameModal';
import ThreeStarsModal from '../ThreeStarsModal';
import ScoreGoalModal from '../ScoreGoalModal';
import ShootoutAttemptModal from '../ShootoutAttemptModal';
import GoalieStatsCard from './GoalieStatsCard';
import ShotsEditModal from '../ShotsEditModal';
import RecordShotsModal, { type ShotsNextAction } from '../RecordShotsModal';
import ScoreImageModal from '../ScoreImageModal';
import ScoringCard from '../ScoringCard';
import ThreeStarsCard from './ThreeStarsCard';
import type { GameRecord, CurrentPeriod, GameStatus, UpdateGameInfoData } from '@/hooks/useGames';
import type { GoalRecord } from '@/hooks/useGameGoals';
import type { GoalieStatRecord, UpsertGoalieStatData } from '@/hooks/useGameGoalieStats';
import type { ShootoutAttempt } from '@/hooks/useShootoutAttempts';
import type { GameRosterEntry } from '@/hooks/useGameRoster';
import type { LineupEntry } from '@/hooks/useGameLineup';
import PreviousMeetingsCard from './PreviousMeetingsCard';
import GameInfoCard from './GameInfoCard';
import LastFiveCard from './LastFiveCard';
import styles from '../GameDetailsPage.module.scss';
import { PERIOD_IDS } from '../constants';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  game: GameRecord;
  isFinal: boolean;
  isInProgress: boolean;
  busy: string | null;
  leagueId: string;
  seasonId: string;
  liveAwayScore: number;
  liveHomeScore: number;
  overtimeSuffix: string;
  linescorePeriods: { id: string; label: string }[];
  goalieStats: GoalieStatRecord[];
  awayRoster: GameRosterEntry[];
  homeRoster: GameRosterEntry[];
  roster: GameRosterEntry[];
  lineup: LineupEntry[];
  rosterReady: boolean;
  lineupsReady: boolean;
  // Write callbacks
  upsertGoalieStat: (data: UpsertGoalieStatData) => Promise<GoalieStatRecord | null>;
  startGame: (time_start: string) => Promise<boolean>;
  updateStatus: (status: GameStatus) => Promise<boolean>;
  advancePeriod: (nextPeriod: CurrentPeriod) => Promise<boolean>;
  endGame: (stars: { star1: string; star2: string; star3: string }) => Promise<boolean>;
  updateStars: (stars: { star1: string; star2: string; star3: string }) => Promise<boolean>;
  updateGameInfo: (data: UpdateGameInfoData) => Promise<boolean>;
  updatePeriodShots: (period: string, home_shots: number, away_shots: number) => Promise<boolean>;
  deleteGame: () => Promise<boolean>;
}

// ── Component ─────────────────────────────────────────────────────────────────

const GameSummaryTab = ({
  game,
  isFinal,
  isInProgress,
  busy,
  leagueId,
  seasonId,
  liveAwayScore,
  liveHomeScore,
  overtimeSuffix,
  linescorePeriods,
  goalieStats,
  awayRoster,
  homeRoster,
  roster,
  lineup,
  rosterReady,
  lineupsReady,
  upsertGoalieStat,
  startGame,
  updateStatus,
  advancePeriod,
  endGame,
  updateStars,
  updateGameInfo,
  updatePeriodShots,
  deleteGame,
}: Props) => {
  const navigate = useNavigate();

  // ── Data hooks ───────────────────────────────────────────────────────────
  const { goals, addGoal, updateGoal, deleteGoal } = useGameGoals(game.id);
  const { attempts, addAttempt, updateAttempt, deleteAttempt } = useShootoutAttempts(game.id);

  // Only the last recorded goal in the active period can be edited or deleted.
  const currentPeriodGoals = goals.filter((g) => g.period === game.current_period);
  const lastCurrentPeriodGoalId = currentPeriodGoals[currentPeriodGoals.length - 1]?.id;

  /**
   * True when the shootout has a winner and "End Game" can be offered.
   */
  const soComplete = useMemo(() => {
    const bestOf = game.best_of_shootout ?? 3;
    const firstTeamId = game.shootout_first_team_id;
    const firstSideId =
      firstTeamId === game.away_team.id
        ? game.away_team.id
        : firstTeamId === game.home_team.id
          ? game.home_team.id
          : game.away_team.id;
    const secondSideId = firstSideId === game.away_team.id ? game.home_team.id : game.away_team.id;
    const firstAttempts = attempts.filter((a) => a.team_id === firstSideId);
    const secondAttempts = attempts.filter((a) => a.team_id === secondSideId);
    const firstRegGoals = firstAttempts.slice(0, bestOf).filter((a) => a.scored).length;
    const secondRegGoals = secondAttempts.slice(0, bestOf).filter((a) => a.scored).length;
    const firstRemaining = Math.max(0, bestOf - firstAttempts.length);
    const secondRemaining = Math.max(0, bestOf - secondAttempts.length);
    if (firstRegGoals > secondRegGoals + secondRemaining) return true;
    if (secondRegGoals > firstRegGoals + firstRemaining) return true;
    if (firstAttempts.length < bestOf || secondAttempts.length < bestOf) return false;
    if (firstRegGoals !== secondRegGoals) return true;
    let sdRound = 0;
    while (true) {
      const sdFirst = firstAttempts[bestOf + sdRound];
      const sdSecond = secondAttempts[bestOf + sdRound];
      if (!sdFirst || !sdSecond) return false;
      if (sdFirst.scored !== sdSecond.scored) return true;
      sdRound++;
    }
  }, [game, attempts]);

  // ── Tally memos ──────────────────────────────────────────────────────────
  const tallyByGoalId = useMemo(() => {
    const goalCounts = new Map<string, number>();
    const assistCounts = new Map<string, number>();
    const map = new Map<
      string,
      { scorerGoals: number; assist1Assists: number | null; assist2Assists: number | null }
    >();
    for (const goal of goals) {
      if (!goalCounts.has(goal.scorer_id))
        goalCounts.set(goal.scorer_id, goal.scorer_prior_goals ?? 0);
      const scorerGoals = goalCounts.get(goal.scorer_id)! + 1;
      goalCounts.set(goal.scorer_id, scorerGoals);
      let assist1Assists: number | null = null;
      if (goal.assist_1_id) {
        if (!assistCounts.has(goal.assist_1_id))
          assistCounts.set(goal.assist_1_id, goal.assist_1_prior_assists ?? 0);
        const n = assistCounts.get(goal.assist_1_id)! + 1;
        assistCounts.set(goal.assist_1_id, n);
        assist1Assists = n;
      }
      let assist2Assists: number | null = null;
      if (goal.assist_2_id) {
        if (!assistCounts.has(goal.assist_2_id))
          assistCounts.set(goal.assist_2_id, goal.assist_2_prior_assists ?? 0);
        const n = assistCounts.get(goal.assist_2_id)! + 1;
        assistCounts.set(goal.assist_2_id, n);
        assist2Assists = n;
      }
      map.set(goal.id, { scorerGoals, assist1Assists, assist2Assists });
    }
    return map;
  }, [goals]);

  const playerGameStats = useMemo(() => {
    const stats = new Map<string, { goals: number; assists: number }>();
    for (const goal of goals) {
      const s = stats.get(goal.scorer_id) ?? { goals: 0, assists: 0 };
      stats.set(goal.scorer_id, { ...s, goals: s.goals + 1 });
      if (goal.assist_1_id) {
        const a = stats.get(goal.assist_1_id) ?? { goals: 0, assists: 0 };
        stats.set(goal.assist_1_id, { ...a, assists: a.assists + 1 });
      }
      if (goal.assist_2_id) {
        const a = stats.get(goal.assist_2_id) ?? { goals: 0, assists: 0 };
        stats.set(goal.assist_2_id, { ...a, assists: a.assists + 1 });
      }
    }
    return stats;
  }, [goals]);

  const playerTeamMap = useMemo(
    () => new Map(roster.map((e) => [e.player_id, e.team_id])),
    [roster],
  );

  // ── Goal modal state ─────────────────────────────────────────────────────
  const [goalPeriod, setGoalPeriod] = useState<string | null>(null);
  const [editGoal, setEditGoal] = useState<GoalRecord | null>(null);

  // ── Shootout Attempt modal state ─────────────────────────────────────────
  const [attemptModalMode, setAttemptModalMode] = useState<null | 'add' | string>(null);
  const [attemptInitialTeam, setAttemptInitialTeam] = useState<'away' | 'home'>('away');
  const [attemptInitialShooterId, setAttemptInitialShooterId] = useState('');
  const [attemptInitialScored, setAttemptInitialScored] = useState<boolean | null>(null);
  const [deletingAttemptId, setDeletingAttemptId] = useState<string | null>(null);

  const openAttemptModal = () => {
    const firstTeamId = game.shootout_first_team_id;
    const fSide: 'away' | 'home' =
      firstTeamId === game.away_team.id
        ? 'away'
        : firstTeamId === game.home_team.id
          ? 'home'
          : 'away';
    const nextSide: 'away' | 'home' =
      attempts.length % 2 === 0 ? fSide : fSide === 'away' ? 'home' : 'away';
    setAttemptInitialTeam(nextSide);
    setAttemptInitialShooterId('');
    setAttemptInitialScored(null);
    setAttemptModalMode('add');
  };

  const openEditAttemptModal = (attempt: ShootoutAttempt) => {
    setAttemptInitialTeam(attempt.team_id === game.away_team.id ? 'away' : 'home');
    setAttemptInitialShooterId(attempt.shooter_id);
    setAttemptInitialScored(attempt.scored);
    setAttemptModalMode(attempt.id);
  };

  const closeAttemptModal = () => setAttemptModalMode(null);

  const handleDeleteAttempt = async (attemptId: string) => {
    setDeletingAttemptId(attemptId);
    await deleteAttempt(attemptId);
    setDeletingAttemptId(null);
  };

  // ── End Game / 3-stars modal ─────────────────────────────────────────────
  const [starsModalOpen, setStarsModalOpen] = useState(false);
  const [starsEditMode, setStarsEditMode] = useState(false);
  const [endGameReadyForStars, setEndGameReadyForStars] = useState(false);

  // ── Shots edit modal ─────────────────────────────────────────────────────
  const [shotsEditModalOpen, setShotsEditModalOpen] = useState(false);

  // ── Score image modal ────────────────────────────────────────────────────
  const [scoreImageOpen, setScoreImageOpen] = useState(false);

  // ── Start Game modal ─────────────────────────────────────────────────────
  const [startGameModalOpen, setStartGameModalOpen] = useState(false);
  const openStartGameModal = () => setStartGameModalOpen(true);

  // ── Delete Game confirm ──────────────────────────────────────────────────
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // ── Record Shots modal state ─────────────────────────────────────────────
  const [shotsPeriod, setShotsPeriod] = useState<string | null>(null);
  const [shotsNextAction, setShotsNextAction] = useState<ShotsNextAction | null>(null);
  const [shotsShowGoalies, setShotsShowGoalies] = useState(false);
  const [shotsShowShootsFirst, setShotsShowShootsFirst] = useState(false);

  const openShotsModal = (
    period: string,
    nextAction: ShotsNextAction,
    showGoalies: boolean,
    showShootsFirst = false,
  ) => {
    setShotsNextAction(nextAction);
    setShotsShowGoalies(showGoalies);
    setShotsShowShootsFirst(showShootsFirst);
    setShotsPeriod(period);
  };

  // ── Period accordion refs ────────────────────────────────────────────────
  const periodAccordionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const setAccordionRef = useCallback(
    (periodId: string) => (el: HTMLDivElement | null) => {
      if (el) periodAccordionRefs.current.set(periodId, el);
      else periodAccordionRefs.current.delete(periodId);
    },
    [],
  );

  const openGoalModal = (period: 1 | 2 | 3 | 'OT' | 'SO') => {
    setEditGoal(null);
    setGoalPeriod(String(period));
  };

  const openEditGoalModal = (goal: GoalRecord) => {
    setEditGoal(goal);
    setGoalPeriod(goal.period);
  };

  const closeGoalModal = () => {
    setGoalPeriod(null);
    setEditGoal(null);
  };

  const focusCurrentPeriodAction = useCallback(() => {
    if (!game?.current_period) return;
    const accordionEl = periodAccordionRefs.current.get(game.current_period);
    const firstBtn = accordionEl?.querySelector<HTMLButtonElement>(
      '[data-hover-actions] button:not([disabled])',
    );
    firstBtn?.focus();
  }, [game?.current_period]);

  const prevGoalPeriodRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevGoalPeriodRef.current;
    prevGoalPeriodRef.current = goalPeriod;
    if (prev !== null && goalPeriod === null && game?.current_period) {
      focusCurrentPeriodAction();
    }
  }, [goalPeriod, game?.current_period, focusCurrentPeriodAction]);

  const pendingFocusRef = useRef(false);
  const prevCurrentPeriodRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const prev = prevCurrentPeriodRef.current;
    const cur = game?.current_period ?? null;
    prevCurrentPeriodRef.current = cur;
    if (game?.status !== 'in_progress' || cur === null) return;
    if (prev === undefined || prev !== cur) pendingFocusRef.current = true;
  }, [game?.status, game?.current_period]);

  useEffect(() => {
    if (!busy && pendingFocusRef.current) {
      pendingFocusRef.current = false;
      focusCurrentPeriodAction();
    }
  }, [busy, focusCurrentPeriodAction]);

  const hasStars = isFinal && !!(game.star_1_id && game.star_2_id && game.star_3_id);

  return (
    <>
      <div className={styles.tabContent}>
        <div className={styles.summaryGrid}>
          {/* ── Left column: Three Stars + Scoring + Goalie Stats + Previous Meetings + Last 5 ── */}
          <div className={styles.summaryLeft}>
            {hasStars && (
              <ThreeStarsCard
                game={game}
                roster={roster}
                goalieStats={goalieStats}
                playerGameStats={playerGameStats}
                leagueId={leagueId}
                isFinal={isFinal}
                onEdit={() => {
                  setStarsEditMode(true);
                  setStarsModalOpen(true);
                }}
              />
            )}

            <ScoringCard
              game={game}
              goals={goals}
              isFinal={isFinal}
              isInProgress={isInProgress}
              busy={busy}
              liveAwayScore={liveAwayScore}
              liveHomeScore={liveHomeScore}
              tallyByGoalId={tallyByGoalId}
              lastCurrentPeriodGoalId={lastCurrentPeriodGoalId}
              attempts={attempts}
              soComplete={soComplete}
              deletingAttemptId={deletingAttemptId}
              setAccordionRef={setAccordionRef}
              onScoreGoal={openGoalModal}
              onEditGoal={openEditGoalModal}
              onDeleteGoal={deleteGoal}
              onOpenShotsModal={openShotsModal}
              onAddAttempt={openAttemptModal}
              onEditAttempt={openEditAttemptModal}
              onDeleteAttempt={handleDeleteAttempt}
              getPlayerHref={(playerId) => {
                const teamId = playerTeamMap.get(playerId);
                return teamId
                  ? `/admin/leagues/${leagueId}/teams/${teamId}/players/${playerId}`
                  : '#';
              }}
            />

            {/* ── Goalie Stats card ── */}
            {(isFinal || isInProgress) && (
              <GoalieStatsCard
                game={game}
                awayRoster={awayRoster}
                homeRoster={homeRoster}
                goalieStats={goalieStats}
                lineup={lineup}
                leagueId={leagueId}
                isFinal={isFinal}
                upsertGoalieStat={upsertGoalieStat}
              />
            )}

            {/* ── Previous Meetings card ── */}
            <PreviousMeetingsCard
              game={game}
              leagueId={leagueId}
              seasonId={seasonId}
            />

            {/* ── Last 5 Games card ── */}
            <LastFiveCard
              game={game}
              leagueId={leagueId}
              seasonId={seasonId}
            />
          </div>
          {/* end summaryLeft */}

          {/* ── Right column: Linescore + Shots + Game Info ── */}
          <div className={styles.summaryRight}>
            <Card
              title="Linescore"
              action={
                <div className={styles.linescoreActions}>
                  {game.status === 'scheduled' && (
                    <>
                      <Button
                        variant="filled"
                        intent="success"
                        icon="play_arrow"
                        size="sm"
                        tooltip={
                          !rosterReady
                            ? 'Set lineups for both teams first'
                            : !lineupsReady
                              ? 'Set starting lineups for both teams'
                              : 'Start Game'
                        }
                        tooltipIntent={rosterReady && lineupsReady ? undefined : 'error'}
                        disabled={!!busy || !rosterReady || !lineupsReady}
                        onClick={openStartGameModal}
                      />
                      <MoreActionsMenu
                        disabled={!!busy}
                        items={[
                          {
                            label: 'Reschedule Game',
                            icon: 'calendar',
                            onClick: () => updateStatus('postponed'),
                          },
                          {
                            label: 'Cancel Game',
                            icon: 'close',
                            intent: 'danger',
                            onClick: () => updateStatus('cancelled'),
                          },
                          {
                            label: 'Delete Game',
                            icon: 'delete',
                            intent: 'danger',
                            onClick: () => setConfirmDeleteOpen(true),
                          },
                        ]}
                      />
                    </>
                  )}
                  {isInProgress &&
                    ['3', 'OT', 'SO'].includes(game.current_period ?? '') &&
                    (game.current_period !== 'SO' || soComplete) &&
                    (game.current_period !== 'OT' || goals.some((g) => g.period === 'OT')) &&
                    (game.current_period !== '3' || liveAwayScore !== liveHomeScore) && (
                      <Button
                        variant="filled"
                        intent="danger"
                        icon="flag"
                        size="sm"
                        tooltip="End Game"
                        disabled={!!busy}
                        onClick={() => {
                          if (endGameReadyForStars) {
                            setStarsEditMode(false);
                            setStarsModalOpen(true);
                          } else {
                            openShotsModal(game.current_period ?? '3', { type: 'end-game' }, true);
                          }
                        }}
                      />
                    )}
                  {isFinal && (
                    <Button
                      variant="outlined"
                      intent="neutral"
                      icon="download"
                      size="sm"
                      tooltip="Download score card"
                      onClick={() => setScoreImageOpen(true)}
                    />
                  )}
                  {game.status !== 'scheduled' && (
                    <MoreActionsMenu
                      disabled={!!busy}
                      items={[
                        {
                          label: 'Delete Game',
                          icon: 'delete',
                          intent: 'danger',
                          onClick: () => setConfirmDeleteOpen(true),
                        },
                      ]}
                    />
                  )}
                </div>
              }
            >
              <table className={styles.periodsTable}>
                <thead>
                  <tr>
                    <th className={styles.thTeam}></th>
                    {linescorePeriods.map((p) => (
                      <th
                        key={p.id}
                        className={styles.thPeriod}
                      >
                        {p.label}
                      </th>
                    ))}
                    <th className={styles.thTotal}>T</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const currentPeriodIdx = PERIOD_IDS.indexOf(
                      game.current_period as '1' | '2' | '3',
                    );
                    return [
                      {
                        teamId: game.away_team.id,
                        teamCode: game.away_team.code,
                        teamLogo: game.away_team.logo,
                        primaryColor: game.away_team.primary_color,
                        textColor: game.away_team.text_color,
                        total: liveAwayScore,
                        isLoser: isFinal && liveAwayScore < liveHomeScore,
                      },
                      {
                        teamId: game.home_team.id,
                        teamCode: game.home_team.code,
                        teamLogo: game.home_team.logo,
                        primaryColor: game.home_team.primary_color,
                        textColor: game.home_team.text_color,
                        total: liveHomeScore,
                        isLoser: isFinal && liveHomeScore < liveAwayScore,
                      },
                    ].map((row) => (
                      <tr key={row.teamId}>
                        <td className={styles.tdTeam}>
                          <span className={styles.linescoreTeam}>
                            {row.teamLogo ? (
                              <img
                                src={row.teamLogo}
                                alt={row.teamCode}
                                className={styles.linescoreLogo}
                              />
                            ) : (
                              <span
                                className={styles.linescoreLogoPlaceholder}
                                style={{ background: row.primaryColor, color: row.textColor }}
                              >
                                {row.teamCode?.slice(0, 1)}
                              </span>
                            )}
                            <span className={styles.linescoreCode}>{row.teamCode}</span>
                          </span>
                        </td>
                        {linescorePeriods.map((p) => {
                          const ps = game.period_scores.find((s) => s.period === p.id);
                          const pIdx = PERIOD_IDS.indexOf(p.id as '1' | '2' | '3');
                          const isPeriodDone =
                            isFinal || (pIdx >= 0 ? currentPeriodIdx > pIdx : true);
                          if (p.id === 'SO') {
                            const teamAttempts = attempts.filter((a) => a.team_id === row.teamId);
                            const soDisplay =
                              teamAttempts.length > 0
                                ? `${teamAttempts.filter((a) => a.scored).length}/${teamAttempts.length}`
                                : '—';
                            return (
                              <td
                                key={p.id}
                                className={styles.tdGoals}
                              >
                                {soDisplay}
                              </td>
                            );
                          }
                          const rawGoals =
                            row.teamId === game.away_team.id ? ps?.away_goals : ps?.home_goals;
                          const goals2: number | string = rawGoals ?? (isPeriodDone ? 0 : '—');
                          return (
                            <td
                              key={p.id}
                              className={styles.tdGoals}
                            >
                              {goals2}
                            </td>
                          );
                        })}
                        <td
                          className={`${styles.tdTotal}${row.isLoser ? ` ${styles.scoreNumberLoser}` : ''}`}
                        >
                          {row.total}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </Card>

            {/* ── Shots breakdown card ── */}
            {(game.period_shots.length > 0 || isInProgress || isFinal) && (
              <Card
                title="Shots"
                action={
                  isFinal ? (
                    <Button
                      variant="outlined"
                      intent="neutral"
                      icon="edit"
                      size="sm"
                      tooltip="Edit shots"
                      onClick={() => setShotsEditModalOpen(true)}
                    />
                  ) : undefined
                }
              >
                <table className={styles.periodsTable}>
                  <thead>
                    <tr>
                      <th className={styles.thTeam}></th>
                      {linescorePeriods
                        .filter((p) => p.id !== 'SO')
                        .map((p) => (
                          <th
                            key={p.id}
                            className={styles.thPeriod}
                          >
                            {p.label}
                          </th>
                        ))}
                      <th className={styles.thTotal}>T</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {
                        key: 'away',
                        isAway: true,
                        logo: game.away_team.logo,
                        code: game.away_team.code,
                        primary: game.away_team.primary_color,
                        text: game.away_team.text_color,
                      },
                      {
                        key: 'home',
                        isAway: false,
                        logo: game.home_team.logo,
                        code: game.home_team.code,
                        primary: game.home_team.primary_color,
                        text: game.home_team.text_color,
                      },
                    ].map((row) => (
                      <tr key={row.key}>
                        <td className={styles.tdTeam}>
                          <span className={styles.linescoreTeam}>
                            {row.logo ? (
                              <img
                                src={row.logo}
                                alt={row.code}
                                className={styles.linescoreLogo}
                              />
                            ) : (
                              <span
                                className={styles.linescoreLogoPlaceholder}
                                style={{ background: row.primary, color: row.text }}
                              >
                                {row.code?.slice(0, 1)}
                              </span>
                            )}
                            <span className={styles.linescoreCode}>{row.code}</span>
                          </span>
                        </td>
                        {linescorePeriods
                          .filter((p) => p.id !== 'SO')
                          .map((p) => {
                            const ps = game.period_shots.find((s) => s.period === p.id);
                            const shots = row.isAway ? ps?.away_shots : ps?.home_shots;
                            return (
                              <td
                                key={p.id}
                                className={styles.tdGoals}
                              >
                                {shots ?? '—'}
                              </td>
                            );
                          })}
                        <td className={styles.tdTotal}>
                          {game.period_shots.reduce(
                            (sum, ps) => sum + (row.isAway ? ps.away_shots : ps.home_shots),
                            0,
                          ) || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}

            {/* ── Game Info card ── */}
            <GameInfoCard
              game={game}
              busy={busy}
              updateGameInfo={updateGameInfo}
            />
          </div>
        </div>
      </div>

      {/* ── Score Goal Form ── */}
      {goalPeriod !== null && (
        <ScoreGoalModal
          open={goalPeriod !== null}
          period={goalPeriod}
          editGoal={editGoal}
          game={game}
          goals={goals}
          awayRoster={awayRoster}
          homeRoster={homeRoster}
          busy={!!busy}
          onClose={closeGoalModal}
          onAdd={addGoal}
          onUpdate={updateGoal}
        />
      )}

      {/* ── Add / Edit Shootout Attempt ── */}
      <ShootoutAttemptModal
        mode={attemptModalMode}
        initialTeam={attemptInitialTeam}
        initialShooterId={attemptInitialShooterId}
        initialScored={attemptInitialScored}
        game={game}
        awayRoster={awayRoster}
        homeRoster={homeRoster}
        busy={!!busy}
        onClose={closeAttemptModal}
        onAdd={addAttempt}
        onUpdate={updateAttempt}
      />

      {/* ── Start Game modal ── */}
      <StartGameModal
        open={startGameModalOpen}
        isStarting={busy === 'in_progress'}
        disabled={!!busy}
        onClose={() => setStartGameModalOpen(false)}
        onStart={startGame}
      />

      {/* ── 3 Stars modal ── */}
      <ThreeStarsModal
        open={starsModalOpen}
        editMode={starsEditMode}
        roster={roster}
        busy={!!busy}
        awayTeam={{
          id: game.away_team.id,
          code: game.away_team.code,
          logo: game.away_team.logo,
          primaryColor: game.away_team.primary_color,
          textColor: game.away_team.text_color,
        }}
        homeTeam={{
          id: game.home_team.id,
          code: game.home_team.code,
          logo: game.home_team.logo,
          primaryColor: game.home_team.primary_color,
          textColor: game.home_team.text_color,
        }}
        initialStars={
          starsEditMode && game
            ? {
                star1: game.star_1_id ?? '',
                star2: game.star_2_id ?? '',
                star3: game.star_3_id ?? '',
              }
            : undefined
        }
        onClose={() => setStarsModalOpen(false)}
        onSave={updateStars}
        onEndGame={async (payload) => {
          const ok = await endGame(payload);
          if (ok) setEndGameReadyForStars(false);
          return ok;
        }}
      />

      {/* ── Record Shots modal ── */}
      {shotsPeriod !== null && shotsNextAction && (
        <RecordShotsModal
          open={shotsPeriod !== null}
          period={shotsPeriod}
          nextAction={shotsNextAction}
          showGoalies={shotsShowGoalies}
          showShootsFirst={shotsShowShootsFirst}
          game={game}
          awayRoster={awayRoster}
          homeRoster={homeRoster}
          goalieStats={goalieStats}
          lineup={lineup}
          onClose={() => setShotsPeriod(null)}
          updatePeriodShots={updatePeriodShots}
          upsertGoalieStat={async (data) => {
            await upsertGoalieStat(data);
          }}
          updateGameInfo={updateGameInfo}
          onAdvancePeriod={advancePeriod}
          onEndGameReady={() => {
            setEndGameReadyForStars(true);
            setStarsEditMode(false);
            setStarsModalOpen(true);
          }}
        />
      )}

      {/* ── Shots edit modal (all periods) ── */}
      {shotsEditModalOpen && (
        <ShotsEditModal
          open={shotsEditModalOpen}
          game={game}
          periods={linescorePeriods}
          onClose={() => setShotsEditModalOpen(false)}
          updatePeriodShots={updatePeriodShots}
        />
      )}

      {/* ── Score image modal ── */}
      {scoreImageOpen && (
        <ScoreImageModal
          open={scoreImageOpen}
          game={game}
          liveAwayScore={liveAwayScore}
          liveHomeScore={liveHomeScore}
          overtimeSuffix={overtimeSuffix}
          onClose={() => setScoreImageOpen(false)}
        />
      )}

      {/* ── Delete Game confirm ── */}
      <ConfirmModal
        open={confirmDeleteOpen}
        title="Delete Game"
        body={`Delete ${game.away_team.code} @ ${game.home_team.code}? This will remove all goals, lineups, and related data. This cannot be undone.`}
        confirmLabel="Delete"
        confirmIcon="delete"
        variant="danger"
        busy={busy === 'deleting'}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={async () => {
          const ok = await deleteGame();
          if (ok) {
            navigate(`/admin/leagues/${leagueId}/seasons/${seasonId}`);
          } else {
            setConfirmDeleteOpen(false);
          }
        }}
      />
    </>
  );
};

export default GameSummaryTab;
