import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useGameGoals from '@/hooks/useGameGoals';
import useShootoutAttempts from '@/hooks/useShootoutAttempts';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
import StartGameModal from '../StartGameModal';
import ThreeStarsModal from '../ThreeStarsModal';
import ScoreGoalModal from '../ScoreGoalModal';
import ShootoutAttemptModal from '../ShootoutAttemptModal';
import GoalieStatsCard from './GoalieStatsCard';
import GoalieSwitchModal from '../GoalieSwitchModal';
import ShotsEditModal from '../ShotsEditModal';
import RecordShotsModal, { type ShotsNextAction } from '../RecordShotsModal';
import ScoreImageModal from '../ScoreImageModal';
import ScoringCard from '../ScoringCard';
import ThreeStarsCard from './ThreeStarsCard';
import type { GameRecord, CurrentPeriod, GameStatus, UpdateGameInfoData } from '@/hooks/useGames';
import type { GoalRecord } from '@/hooks/useGameGoals';
import type {
  GoalieStatRecord,
  GoalieSwitchData,
  UpsertGoalieStatData,
  UpdateGoalieStintData,
} from '@/hooks/useGameGoalieStats';
import type { ShootoutAttempt } from '@/hooks/useShootoutAttempts';
import type { GameRosterEntry } from '@/hooks/useGameRoster';
import type { LineupEntry } from '@/hooks/useGameLineup';
import SeasonSeriesCard from './SeasonSeriesCard';
import GameInfoCard from './GameInfoCard';
import LastFiveCard from './LastFiveCard';
import LinescoreCard from './LinescoreCard';
import styles from '../GameDetailsPage.module.scss';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  game: GameRecord;
  isFinal: boolean;
  isInProgress: boolean;
  isEditMode: boolean;
  setIsEditMode: (value: boolean) => void;
  editable?: boolean;
  busy: string | null;
  leagueId: string;
  seasonId: string;
  liveAwayScore: number;
  liveHomeScore: number;
  overtimeSuffix: string;
  gameHrefBuilder: (gameId: string) => string;
  playerHrefBuilder?: (teamId: string, playerId: string) => string;
  linescorePeriods: { id: string; label: string; shortLabel: string }[];
  goalieStats: GoalieStatRecord[];
  awayRoster: GameRosterEntry[];
  homeRoster: GameRosterEntry[];
  roster: GameRosterEntry[];
  lineup: LineupEntry[];
  rosterReady: boolean;
  lineupsReady: boolean;
  // Write callbacks
  upsertGoalieStat: (data: UpsertGoalieStatData) => Promise<GoalieStatRecord | null>;
  switchGoalie: (data: GoalieSwitchData) => Promise<GoalieStatRecord[] | null>;
  removeGoalieStat: (goalieId: string) => Promise<boolean>;
  updateGoalieStint: (
    stintId: string,
    data: UpdateGoalieStintData,
  ) => Promise<GoalieStatRecord[] | null>;
  removeGoalieStint: (stintId: string) => Promise<boolean>;
  startGame: (time_start: string) => Promise<boolean>;
  updateStatus: (status: GameStatus) => Promise<boolean>;
  advancePeriod: (nextPeriod: CurrentPeriod) => Promise<boolean>;
  advanceOTPeriod: (currentOTPeriods: number) => Promise<boolean>;
  revertOTPeriod: (targetOTPeriods: number) => Promise<boolean>;
  endGame: (stars: { star1: string; star2: string; star3: string }) => Promise<boolean>;
  updateStars: (stars: { star1: string; star2: string; star3: string }) => Promise<boolean>;
  updateGameInfo: (data: UpdateGameInfoData) => Promise<boolean>;
  updatePeriodShots: (period: string, home_shots: number, away_shots: number) => Promise<boolean>;
  revertToEditMode: (lastPeriod: CurrentPeriod) => Promise<boolean>;
  deleteGame: () => Promise<boolean>;
}

// ── Component ─────────────────────────────────────────────────────────────────

const GameSummaryTab = ({
  game,
  isFinal,
  isInProgress,
  isEditMode,
  setIsEditMode,
  editable = true,
  busy,
  leagueId,
  seasonId,
  liveAwayScore,
  liveHomeScore,
  overtimeSuffix,
  gameHrefBuilder,
  playerHrefBuilder,
  linescorePeriods,
  goalieStats,
  awayRoster,
  homeRoster,
  roster,
  lineup,
  rosterReady,
  lineupsReady,
  upsertGoalieStat,
  switchGoalie,
  removeGoalieStat,
  updateGoalieStint,
  removeGoalieStint,
  startGame,
  updateStatus,
  advancePeriod,
  advanceOTPeriod,
  revertOTPeriod,
  endGame,
  updateStars,
  updateGameInfo,
  updatePeriodShots,
  revertToEditMode,
  deleteGame,
}: Props) => {
  const navigate = useNavigate();

  // ── Data hooks ───────────────────────────────────────────────────────────
  const gameHasStarted = game.status !== 'scheduled';
  const { goals, addGoal, updateGoal, deleteGoal } = useGameGoals(game.id, {
    enabled: gameHasStarted,
  });
  const { attempts, addAttempt, updateAttempt, deleteAttempt } = useShootoutAttempts(game.id, {
    enabled: !!game.shootout,
  });

  // Only the last recorded goal in the active period can be edited or deleted.
  const currentPeriodGoals = goals.filter((g) => g.period === game.current_period);
  const lastCurrentPeriodGoalId = currentPeriodGoals[currentPeriodGoals.length - 1]?.id;

  // Shot periods — OT periods are separate entries for playoff games so each
  // OT period's shots can be tracked independently.
  const isPlayoff = game.game_type === 'playoff';
  const hasOTShots =
    game.current_period === 'OT' ||
    game.current_period === 'SO' ||
    game.period_shots.some((ps) => /^OT/.test(ps.period)) ||
    (game.overtime_periods ?? 0) > 0;
  const useShortNums = isPlayoff && (game.overtime_periods ?? 0) > 1;
  const shotsPeriods: { id: string; label: string; shortLabel: string }[] = [
    { id: '1', label: '1st', shortLabel: useShortNums ? '1' : '1st' },
    { id: '2', label: '2nd', shortLabel: useShortNums ? '2' : '2nd' },
    { id: '3', label: '3rd', shortLabel: useShortNums ? '3' : '3rd' },
    ...(hasOTShots
      ? isPlayoff
        ? Array.from({ length: game.overtime_periods ?? 1 }, (_, i) => ({
            id: `OT${i + 1}`,
            label: `OT ${i + 1}`,
            shortLabel: `OT${i + 1}`,
          }))
        : [{ id: 'OT', label: 'OT', shortLabel: 'OT' }]
      : []),
  ];

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
  const lastRecordedGoalId = useMemo(() => {
    const periodRank = (period: string) => {
      if (period === '1') return 1;
      if (period === '2') return 2;
      if (period === '3') return 3;
      if (period === 'OT') return 4;
      return 5;
    };
    const toSecs = (time: string | null) => {
      if (!time) return 0;
      const [minutes, seconds] = time.split(':').map(Number);
      return (minutes || 0) * 60 + (seconds || 0);
    };
    return [...goals]
      .sort((a, b) => {
        const periodDiff = periodRank(a.period) - periodRank(b.period);
        if (periodDiff !== 0) return periodDiff;
        const timeDiff = toSecs(a.period_time) - toSecs(b.period_time);
        if (timeDiff !== 0) return timeDiff;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      })
      .at(-1)?.id;
  }, [goals]);
  const lockGoalTimingFields =
    !!editGoal && (editGoal.id !== lastRecordedGoalId || attempts.length > 0);

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

  // ── Goalie Switch modal state ────────────────────────────────────────────
  const [switchGoalieOpen, setSwitchGoalieOpen] = useState(false);

  // Treat the game as in-progress for all edit controls when edit mode is on.
  const isEditInProgress = editable && (isInProgress || isEditMode);

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
  const handleStartGame = async (isoTime: string) => {
    const started = await startGame(isoTime);
    if (!started) return false;

    const starterGoalieIds = new Set(
      lineup
        .filter((entry) => entry.position_slot === 'G')
        .map((entry) => entry.player_id),
    );
    const starterGoalies = [...awayRoster, ...homeRoster].filter((entry) =>
      starterGoalieIds.has(entry.player_id),
    );

    await Promise.all(
      starterGoalies.map((goalie) =>
        upsertGoalieStat({
          goalie_id: goalie.player_id,
          team_id: goalie.team_id,
          shots_against: 0,
        }),
      ),
    );

    return true;
  };

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
    if (nextAction.type === 'end-game' && endGameReadyForStars) {
      setStarsEditMode(false);
      setStarsModalOpen(true);
      return;
    }
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

  // For edit-mode revert: use current_period if set (retained after endGame), else
  // fall back to the highest period that has a score recorded.
  const PERIOD_PRIORITY: CurrentPeriod[] = ['SO', 'OT', '3', '2', '1'];
  const lastPlayedPeriod: CurrentPeriod =
    (game.current_period as CurrentPeriod | null) ??
    PERIOD_PRIORITY.find((p) => game.period_scores.some((ps) => ps.period === p)) ??
    '3';

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
                getPlayerHref={
                  playerHrefBuilder
                    ? (teamId, playerId) => playerHrefBuilder(teamId, playerId)
                    : undefined
                }
                onEdit={
                  editable && isEditMode
                    ? () => {
                        setStarsEditMode(true);
                        setStarsModalOpen(true);
                      }
                    : undefined
                }
              />
            )}

            <ScoringCard
              game={game}
              goals={goals}
              isFinal={isFinal && !isEditMode}
              isInProgress={isEditInProgress}
              isEditMode={isEditMode}
              busy={busy}
              liveAwayScore={liveAwayScore}
              liveHomeScore={liveHomeScore}
              tallyByGoalId={tallyByGoalId}
              lastCurrentPeriodGoalId={lastCurrentPeriodGoalId}
              attempts={attempts}
              soComplete={soComplete}
              deletingAttemptId={deletingAttemptId}
              awayTeamId={game.away_team.id}
              homeTeamId={game.home_team.id}
              setAccordionRef={editable ? setAccordionRef : undefined}
              onScoreGoal={editable ? openGoalModal : undefined}
              onEditGoal={editable ? openEditGoalModal : undefined}
              onDeleteGoal={editable ? deleteGoal : undefined}
              onOpenShotsModal={editable ? openShotsModal : undefined}
              onAddAttempt={editable ? openAttemptModal : undefined}
              onEditAttempt={editable ? openEditAttemptModal : undefined}
              onDeleteAttempt={editable ? handleDeleteAttempt : undefined}
              onGoBackPeriod={isEditInProgress ? (prev) => advancePeriod(prev) : undefined}
              onGoBackOTPeriod={
                isEditInProgress ? (targetNum) => revertOTPeriod(targetNum) : undefined
              }
              getPlayerHref={
                playerHrefBuilder
                  ? (playerId) => {
                      const teamId = playerTeamMap.get(playerId);
                      return teamId ? playerHrefBuilder(teamId, playerId) : '#';
                    }
                  : undefined
              }
            />

            {/* ── Goalie Stats card ── */}
            {(isFinal || isInProgress) && (
              <GoalieStatsCard
                game={game}
                awayRoster={awayRoster}
                homeRoster={homeRoster}
                goalieStats={goalieStats}
                lineup={lineup}
                getPlayerHref={
                  playerHrefBuilder
                    ? (teamId, playerId) => playerHrefBuilder(teamId, playerId)
                    : undefined
                }
                isFinal={editable && isFinal && isEditMode}
                isInProgress={isEditInProgress}
                onSwitchGoalie={isEditInProgress ? () => setSwitchGoalieOpen(true) : undefined}
                updateGoalieStint={editable ? updateGoalieStint : undefined}
                removeGoalieStint={editable ? removeGoalieStint : undefined}
                removeGoalieStat={editable ? removeGoalieStat : undefined}
              />
            )}

            {/* ── Last 5 Games card ── */}
            <LastFiveCard
              game={game}
              gameHrefBuilder={gameHrefBuilder}
            />

            {/* ── Season / Playoff Series card ── */}
            <SeasonSeriesCard
              game={game}
              gameHrefBuilder={gameHrefBuilder}
              liveAwayScore={liveAwayScore}
              liveHomeScore={liveHomeScore}
            />
          </div>
          {/* end summaryLeft */}

          {/* ── Right column: Linescore + Shots + Game Info ── */}
          <div className={styles.summaryRight}>
            <LinescoreCard
              game={game}
              isFinal={isFinal}
              isEditMode={isEditMode}
              busy={busy}
              liveAwayScore={liveAwayScore}
              liveHomeScore={liveHomeScore}
              linescorePeriods={linescorePeriods}
              attempts={attempts}
              rosterReady={rosterReady}
              lineupsReady={lineupsReady}
              canEndGame={
                editable &&
                isInProgress &&
                ['3', 'OT', 'SO'].includes(game.current_period ?? '') &&
                (game.current_period !== 'SO' || soComplete) &&
                (game.current_period !== 'OT' || goals.some((g) => g.period === 'OT')) &&
                (game.current_period !== '3' || liveAwayScore !== liveHomeScore)
              }
              onStartGame={editable ? openStartGameModal : undefined}
              onReschedule={editable ? () => updateStatus('postponed') : undefined}
              onCancel={editable ? () => updateStatus('cancelled') : undefined}
              onDelete={editable ? () => setConfirmDeleteOpen(true) : undefined}
              onEndGame={
                editable
                  ? () => {
                      if (endGameReadyForStars) {
                        setStarsEditMode(false);
                        setStarsModalOpen(true);
                      } else {
                        openShotsModal(
                          game.current_period ?? lastPlayedPeriod,
                          { type: 'end-game' },
                          true,
                        );
                      }
                    }
                  : undefined
              }
              onFinishEditing={editable ? () => setIsEditMode(false) : undefined}
              onDownloadScoreCard={() => setScoreImageOpen(true)}
              onEnterEditMode={
                editable
                  ? () => {
                      setIsEditMode(true);
                      setEndGameReadyForStars(false);
                      if (!game.current_period) revertToEditMode(lastPlayedPeriod);
                    }
                  : undefined
              }
              onExitEditMode={editable ? () => setIsEditMode(false) : undefined}
            />

            {/* ── Shots breakdown card ── */}
            {(game.period_shots.length > 0 || isInProgress || isFinal) && (
              <Card
                title="Shots"
                action={
                  isFinal && isEditMode ? (
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
                      {shotsPeriods.map((p) => (
                        <th
                          key={p.id}
                          className={styles.thPeriod}
                        >
                          {p.shortLabel}
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
                            <TeamLogo
                              logo={row.logo}
                              code={row.code ?? '?'}
                              primaryColor={row.primary}
                              textColor={row.text}
                              size={32}
                              shape="square"
                            />
                            <span className={styles.linescoreCode}>{row.code}</span>
                          </span>
                        </td>
                        {shotsPeriods.map((p) => {
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
              updateGameInfo={
                editable && (isEditMode || game.status === 'scheduled') ? updateGameInfo : undefined
              }
            />
          </div>
        </div>
      </div>

      {/* ── Score Goal Form ── */}
      {editable && goalPeriod !== null && (
        <ScoreGoalModal
          open={goalPeriod !== null}
          period={goalPeriod}
          editGoal={editGoal}
          game={game}
          goals={goals}
          awayRoster={awayRoster}
          homeRoster={homeRoster}
          busy={!!busy}
          lockTimingFields={lockGoalTimingFields}
          onClose={closeGoalModal}
          onAdd={addGoal}
          onUpdate={updateGoal}
        />
      )}

      {/* ── Add / Edit Shootout Attempt ── */}
      {editable && (
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
      )}

      {/* ── Start Game modal ── */}
      {editable && (
        <StartGameModal
          open={startGameModalOpen}
          isStarting={busy === 'in_progress'}
          disabled={!!busy}
          onClose={() => setStartGameModalOpen(false)}
          onStart={handleStartGame}
        />
      )}

      {/* ── 3 Stars modal ── */}
      {editable && (
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
            if (ok) {
              setEndGameReadyForStars(false);
              setIsEditMode(false);
            }
            return ok;
          }}
        />
      )}

      {/* ── Record Shots modal ── */}
      {editable && shotsPeriod !== null && shotsNextAction && (
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
          goals={goals}
          lineup={lineup}
          onClose={() => setShotsPeriod(null)}
          updatePeriodShots={updatePeriodShots}
          upsertGoalieStat={async (data) => {
            await upsertGoalieStat(data);
          }}
          updateGameInfo={updateGameInfo}
          onAdvancePeriod={advancePeriod}
          onNextOTPeriod={() => advanceOTPeriod(game.overtime_periods ?? 1)}
          onEndGameReady={() => {
            setEndGameReadyForStars(true);
            setStarsEditMode(false);
            setStarsModalOpen(true);
          }}
        />
      )}

      {/* ── Shots edit modal (all periods) ── */}
      {editable && shotsEditModalOpen && (
        <ShotsEditModal
          open={shotsEditModalOpen}
          game={game}
          periods={shotsPeriods}
          awayRoster={awayRoster}
          homeRoster={homeRoster}
          goalieStats={goalieStats}
          goals={goals}
          lineup={lineup}
          onClose={() => setShotsEditModalOpen(false)}
          updatePeriodShots={updatePeriodShots}
          upsertGoalieStat={async (data) => {
            await upsertGoalieStat(data);
          }}
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

      {/* ── Goalie Switch modal ── */}
      {editable && (
        <GoalieSwitchModal
          open={switchGoalieOpen}
          game={game}
          awayRoster={awayRoster}
          homeRoster={homeRoster}
          existingStats={goalieStats}
          onClose={() => setSwitchGoalieOpen(false)}
          switchGoalie={switchGoalie}
        />
      )}

      {/* ── Delete Game confirm ── */}
      {editable && (
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
      )}
    </>
  );
};

export default GameSummaryTab;
