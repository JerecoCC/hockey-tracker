import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import Tooltip from '@/components/Tooltip/Tooltip';
import Breadcrumbs from '@/components/Breadcrumbs/Breadcrumbs';
import Icon from '@/components/Icon/Icon';
import Accordion from '@/components/Accordion/Accordion';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import ListItem from '@/components/ListItem/ListItem';
import MoreActionsMenu from '@/components/MoreActionsMenu/MoreActionsMenu';
import Tabs from '@/components/Tabs/Tabs';
import TitleRow from '@/components/TitleRow/TitleRow';
import { useGameDetails, type LastFiveGame, type PreviousMeeting } from '@/hooks/useGames';
import useTeamPlayers from '@/hooks/useTeamPlayers';
import useGameLineup from '@/hooks/useGameLineup';
import useGameRoster, { type GameRosterEntry } from '@/hooks/useGameRoster';
import useGameGoals, { type GoalRecord } from '@/hooks/useGameGoals';
import useGameGoalieStats from '@/hooks/useGameGoalieStats';
import useShootoutAttempts, { type ShootoutAttempt } from '@/hooks/useShootoutAttempts';
import useTabState from '@/hooks/useTabState';
import LineupRosterModal from '../LineupRosterModal';
import LineupCreatePlayersModal from '../LineupCreatePlayersModal';
import SetLineupModal from '../SetLineupModal';
import RemoveFromLineupModal from './RemoveFromLineupModal';
import StartGameModal from './StartGameModal';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import GameInfoEditModal from './GameInfoEditModal';
import ThreeStarsModal from './ThreeStarsModal';
import ScoreGoalModal from './ScoreGoalModal';
import ShootoutAttemptModal from './ShootoutAttemptModal';
import GoalieStatsEditModal from './GoalieStatsEditModal';
import ShotsEditModal from './ShotsEditModal';
import RecordShotsModal, { type ShotsNextAction } from './RecordShotsModal';
import ScoreboardCard from './ScoreboardCard';
import ScoreImageModal from './ScoreImageModal';
import ScoringCard from './ScoringCard';

import styles from './GameDetailsPage.module.scss';
import { DATE_FMT_SHORT, TIME_FMT, formatScheduledTime, formatPlayerName } from './formatUtils';
import { buildFormRecord } from './gameUtils';
import { PERIOD_IDS, GAME_TYPE_LABEL, POSITION_LABEL } from './constants';

// ── Component ─────────────────────────────────────────────────────────────────

const GameDetailsPage = () => {
  const {
    leagueId = '',
    seasonId,
    id,
  } = useParams<{
    leagueId: string;
    seasonId: string;
    id: string;
  }>();
  const navigate = useNavigate();
  const {
    game,
    loading,
    busy,
    startGame,
    updateStatus,
    advancePeriod,
    endGame,
    updateStars,
    updateGameInfo,
    updatePeriodShots,
    deleteGame,
  } = useGameDetails(id);
  const { goals, addGoal, updateGoal, deleteGoal } = useGameGoals(id);
  const { goalieStats, upsertGoalieStat } = useGameGoalieStats(id);
  const { attempts, addAttempt, updateAttempt, deleteAttempt } = useShootoutAttempts(id);
  const [activeTab, handleTabChange] = useTabState('tab:game-details');

  /**
   * Running goal/assist tallies per player, computed once in goal order
   * (period ASC, created_at ASC). At each goal we record:
   *   - cumulative goals the scorer has scored including prior games + up to this goal
   *   - cumulative assists each assistant has accumulated including prior games + up to this goal
   *
   * Prior-game baselines (finalized games in same season before this game's scheduled_at)
   * are fetched from the server and seeded on first encounter of each player.
   *
   * Keyed by goal.id for O(1) lookup during render.
   */
  const tallyByGoalId = useMemo(() => {
    const goalCounts = new Map<string, number>();
    const assistCounts = new Map<string, number>();

    const map = new Map<
      string,
      {
        scorerGoals: number;
        assist1Assists: number | null;
        assist2Assists: number | null;
      }
    >();

    for (const goal of goals) {
      // Seed from prior-game baseline on first encounter
      if (!goalCounts.has(goal.scorer_id)) {
        goalCounts.set(goal.scorer_id, goal.scorer_prior_goals ?? 0);
      }
      const scorerGoals = goalCounts.get(goal.scorer_id)! + 1;
      goalCounts.set(goal.scorer_id, scorerGoals);

      let assist1Assists: number | null = null;
      if (goal.assist_1_id) {
        if (!assistCounts.has(goal.assist_1_id)) {
          assistCounts.set(goal.assist_1_id, goal.assist_1_prior_assists ?? 0);
        }
        const n = assistCounts.get(goal.assist_1_id)! + 1;
        assistCounts.set(goal.assist_1_id, n);
        assist1Assists = n;
      }

      let assist2Assists: number | null = null;
      if (goal.assist_2_id) {
        if (!assistCounts.has(goal.assist_2_id)) {
          assistCounts.set(goal.assist_2_id, goal.assist_2_prior_assists ?? 0);
        }
        const n = assistCounts.get(goal.assist_2_id)! + 1;
        assistCounts.set(goal.assist_2_id, n);
        assist2Assists = n;
      }

      map.set(goal.id, { scorerGoals, assist1Assists, assist2Assists });
    }

    return map;
  }, [goals]);

  /** Final G/A totals per player for the whole game (used in the 3-stars card). */
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

  /**
   * True when the shootout has a winner and "End Game" can be offered.
   * Conditions:
   *   - Early clinch: within regulation, one team's lead is already unassailable
   *     (the other team cannot tie even if they score every remaining attempt), OR
   *   - All regulation rounds recorded AND one team leads, OR
   *   - Tied after regulation AND a sudden-death round has produced a decisive result
   *     (one team scored while the other missed in the same SD round).
   */
  const soComplete = useMemo(() => {
    if (!game) return false;
    const bestOf = game.best_of_shootout ?? 3;
    const firstTeamId = game.shootout_first_team_id;
    const firstSideId =
      firstTeamId === game.away_team_id
        ? game.away_team_id
        : firstTeamId === game.home_team_id
          ? game.home_team_id
          : game.away_team_id;
    const secondSideId = firstSideId === game.away_team_id ? game.home_team_id : game.away_team_id;

    const firstAttempts = attempts.filter((a) => a.team_id === firstSideId);
    const secondAttempts = attempts.filter((a) => a.team_id === secondSideId);

    const firstRegGoals = firstAttempts.slice(0, bestOf).filter((a) => a.scored).length;
    const secondRegGoals = secondAttempts.slice(0, bestOf).filter((a) => a.scored).length;
    const firstRemaining = Math.max(0, bestOf - firstAttempts.length);
    const secondRemaining = Math.max(0, bestOf - secondAttempts.length);

    // Early clinch: one team is already guaranteed to win within regulation
    if (firstRegGoals > secondRegGoals + secondRemaining) return true;
    if (secondRegGoals > firstRegGoals + firstRemaining) return true;

    if (firstAttempts.length < bestOf || secondAttempts.length < bestOf) return false;

    if (firstRegGoals !== secondRegGoals) return true; // regulation winner

    // Tied — check each SD round for a decisive result
    let sdRound = 0;
    while (true) {
      const sdFirst = firstAttempts[bestOf + sdRound];
      const sdSecond = secondAttempts[bestOf + sdRound];
      if (!sdFirst || !sdSecond) return false; // round incomplete
      if (sdFirst.scored !== sdSecond.scored) return true; // decisive SD round
      sdRound++;
    }
  }, [game, attempts]);

  /**
   * Which side ('away' | 'home') won the shootout, or null if not yet decided.
   * Mirrors the soComplete logic but returns the winner identity for score display.
   */
  const soWinnerSide = useMemo((): 'away' | 'home' | null => {
    if (!game) return null;
    const bestOf = game.best_of_shootout ?? 3;
    const firstTeamId = game.shootout_first_team_id;
    const firstSideId =
      firstTeamId === game.away_team_id
        ? game.away_team_id
        : firstTeamId === game.home_team_id
          ? game.home_team_id
          : game.away_team_id;
    const firstSide: 'away' | 'home' = firstSideId === game.away_team_id ? 'away' : 'home';
    const secondSide: 'away' | 'home' = firstSide === 'away' ? 'home' : 'away';
    const secondSideId = firstSideId === game.away_team_id ? game.home_team_id : game.away_team_id;

    const firstAttempts = attempts.filter((a) => a.team_id === firstSideId);
    const secondAttempts = attempts.filter((a) => a.team_id === secondSideId);

    const firstRegGoals = firstAttempts.slice(0, bestOf).filter((a) => a.scored).length;
    const secondRegGoals = secondAttempts.slice(0, bestOf).filter((a) => a.scored).length;
    const firstRemaining = Math.max(0, bestOf - firstAttempts.length);
    const secondRemaining = Math.max(0, bestOf - secondAttempts.length);

    // Early clinch: one team's lead is unassailable within regulation
    if (firstRegGoals > secondRegGoals + secondRemaining) return firstSide;
    if (secondRegGoals > firstRegGoals + firstRemaining) return secondSide;

    if (firstAttempts.length < bestOf || secondAttempts.length < bestOf) return null;

    if (firstRegGoals !== secondRegGoals)
      return firstRegGoals > secondRegGoals ? firstSide : secondSide;

    // Tied — check each SD round for a decisive result
    let sdRound = 0;
    while (true) {
      const sdFirst = firstAttempts[bestOf + sdRound];
      const sdSecond = secondAttempts[bestOf + sdRound];
      if (!sdFirst || !sdSecond) return null; // round incomplete
      if (sdFirst.scored && !sdSecond.scored) return firstSide;
      if (!sdFirst.scored && sdSecond.scored) return secondSide;
      sdRound++;
    }
  }, [game, attempts]);

  // ── Goal modal state ──────────────────────────────────────────────────────
  const [goalPeriod, setGoalPeriod] = useState<string | null>(null);
  const [editGoal, setEditGoal] = useState<GoalRecord | null>(null);

  // ── Shootout Attempt modal state ──────────────────────────────────────────
  /** null = closed; 'add' = adding new attempt; non-null string = editing attempt with that id */
  const [attemptModalMode, setAttemptModalMode] = useState<null | 'add' | string>(null);
  const [attemptInitialTeam, setAttemptInitialTeam] = useState<'away' | 'home'>('away');
  const [attemptInitialShooterId, setAttemptInitialShooterId] = useState('');
  const [attemptInitialScored, setAttemptInitialScored] = useState<boolean | null>(null);
  /** ID of the attempt currently being deleted; null when idle. */
  const [deletingAttemptId, setDeletingAttemptId] = useState<string | null>(null);

  const openAttemptModal = () => {
    if (!game) return;
    const firstTeamId = game.shootout_first_team_id;
    const fSide: 'away' | 'home' =
      firstTeamId === game.away_team_id
        ? 'away'
        : firstTeamId === game.home_team_id
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
    if (!game) return;
    setAttemptInitialTeam(attempt.team_id === game.away_team_id ? 'away' : 'home');
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

  // ── End Game / 3-stars modal ──────────────────────────────────────────────
  const [starsModalOpen, setStarsModalOpen] = useState(false);
  /** true = editing stars on a final game; false = ending the game */
  const [starsEditMode, setStarsEditMode] = useState(false);
  /**
   * True when the end-game shots/goalie modal was submitted but the 3-stars
   * modal was closed before awarding stars. Clicking "End Game" again will
   * skip the shots modal and go straight to the 3-stars modal.
   */
  const [endGameReadyForStars, setEndGameReadyForStars] = useState(false);

  // ── Shots edit modal ──────────────────────────────────────────────────────
  const [shotsEditModalOpen, setShotsEditModalOpen] = useState(false);

  // ── Last 5 Games view mode ────────────────────────────────────────────────
  const [lastFiveView, setLastFiveView] = useState<'square' | 'list'>('list');

  // ── Score image modal ─────────────────────────────────────────────────────
  const [scoreImageOpen, setScoreImageOpen] = useState(false);

  // ── Start Game modal ──────────────────────────────────────────────────────
  const [startGameModalOpen, setStartGameModalOpen] = useState(false);
  const openStartGameModal = () => setStartGameModalOpen(true);

  // ── Delete Game confirm ───────────────────────────────────────────────────
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // ── Game Info edit modal ──────────────────────────────────────────────────
  const [gameInfoEditOpen, setGameInfoEditOpen] = useState(false);
  const openGameInfoEdit = () => setGameInfoEditOpen(true);

  // ── Record Shots modal state ──────────────────────────────────────────────
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

  // ── Goalie stats edit modal ───────────────────────────────────────────────
  const [goalieStatsModalOpen, setGoalieStatsModalOpen] = useState(false);

  // Season rosters — used as player pool for "Add from Roster" / "Create Player" modals
  const { createAndRosterPlayers: createAndRosterAway } = useTeamPlayers(
    game?.away_team_id,
    seasonId,
  );
  const { createAndRosterPlayers: createAndRosterHome } = useTeamPlayers(
    game?.home_team_id,
    seasonId,
  );

  // ── Game-day rosters ───────────────────────────────────────────────────────
  const { roster, addToRoster, removeFromRoster } = useGameRoster(id);
  // Real entries are persisted to this game; inherited entries are pre-populated
  // from the last finished game and not yet saved.
  const awayRoster = roster.filter((e) => e.team_id === game?.away_team_id && !e.inherited);
  const homeRoster = roster.filter((e) => e.team_id === game?.home_team_id && !e.inherited);
  const awayRosterInherited = roster.filter(
    (e) => e.team_id === game?.away_team_id && !!e.inherited,
  );
  const homeRosterInherited = roster.filter(
    (e) => e.team_id === game?.home_team_id && !!e.inherited,
  );

  // Map player_id → team_id for building player detail links
  const playerTeamMap = useMemo(
    () => new Map(roster.map((e) => [e.player_id, e.team_id])),
    [roster],
  );

  const [autoFillBusy, setAutoFillBusy] = useState<{ away: boolean; home: boolean }>({
    away: false,
    home: false,
  });

  // ── Lineup modal state ────────────────────────────────────────────────────
  const [lineupAddTeam, setLineupAddTeam] = useState<'away' | 'home' | null>(null);
  const [lineupCreateTeam, setLineupCreateTeam] = useState<'away' | 'home' | null>(null);
  const [lineupSetTeam, setLineupSetTeam] = useState<'away' | 'home' | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{
    entry: GameRosterEntry;
  } | null>(null);
  const [removingFromRoster, setRemovingFromRoster] = useState(false);

  // ── Starting lineup data ───────────────────────────────────────────────────
  const { lineup, saveTeamLineup } = useGameLineup(id);

  // Both teams must have at least one persisted (non-inherited) roster entry.
  const rosterReady = awayRoster.length > 0 && homeRoster.length > 0;

  // Both teams must have all 6 position slots covered (saved or inherited) AND every
  // player in those slots must be on the current game's roster. If a traded/injured
  // player is in the inherited lineup but not rostered, the guard fires and the admin
  // must explicitly fix the lineup before starting.
  const lineupsReady = (() => {
    if (!game) return false;
    const SLOTS = ['C', 'LW', 'RW', 'D1', 'D2', 'G'] as const;
    const rosterIds = new Set(roster.map((e) => e.player_id));
    const hasAll = (teamId: string) => {
      const entries = lineup.filter((e) => e.team_id === teamId);
      return SLOTS.every((slot) =>
        entries.some((e) => e.position_slot === slot && rosterIds.has(e.player_id)),
      );
    };
    return hasAll(game.away_team_id) && hasAll(game.home_team_id);
  })();

  const handleConfirmRemove = async () => {
    if (!confirmRemove) return;
    setRemovingFromRoster(true);
    await removeFromRoster(confirmRemove.entry.id);
    setRemovingFromRoster(false);
    setConfirmRemove(null);
  };

  // Refs for each period accordion so we can restore focus after the goal modal closes.
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

  // Focuses the Score Goal action (or first enabled action) in the current period's accordion.
  const focusCurrentPeriodAction = useCallback(() => {
    if (!game?.current_period) return;
    const accordionEl = periodAccordionRefs.current.get(game.current_period);
    const firstBtn = accordionEl?.querySelector<HTMLButtonElement>(
      '[data-hover-actions] button:not([disabled])',
    );
    firstBtn?.focus();
  }, [game?.current_period]);

  // After the Score Goal modal closes, restore focus to the current period's action.
  const prevGoalPeriodRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevGoalPeriodRef.current;
    prevGoalPeriodRef.current = goalPeriod;
    if (prev !== null && goalPeriod === null && game?.current_period) {
      focusCurrentPeriodAction();
    }
  }, [goalPeriod, game?.current_period, focusCurrentPeriodAction]);

  // On page load and whenever the current period advances, mark a focus as pending.
  // We defer the actual focus until `busy` clears, because `advancePeriod` sets
  // `busy = 'advance-period'` which disables all action buttons — querying for
  // `button:not([disabled])` would return nothing if we focused immediately.
  const pendingFocusRef = useRef(false);
  const prevCurrentPeriodRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const prev = prevCurrentPeriodRef.current;
    const cur = game?.current_period ?? null;
    prevCurrentPeriodRef.current = cur;
    if (game?.status !== 'in_progress' || cur === null) return;
    if (prev === undefined || prev !== cur) {
      pendingFocusRef.current = true;
    }
  }, [game?.status, game?.current_period]);

  // Fire the pending focus as soon as busy clears (covers the period-advance case
  // where the buttons are disabled while the API call is in flight).
  useEffect(() => {
    if (!busy && pendingFocusRef.current) {
      pendingFocusRef.current = false;
      focusCurrentPeriodAction();
    }
  }, [busy, focusCurrentPeriodAction]);

  const seasonHref = `/admin/leagues/${leagueId}/seasons/${seasonId}`;

  if (loading) {
    return (
      <div className={styles.loaderWrapper}>
        <span className={styles.spinner} />
        <p className={styles.loaderText}>Loading game…</p>
      </div>
    );
  }

  if (!game) {
    return (
      <>
        <Breadcrumbs
          items={[
            { label: 'Leagues', path: '/admin/leagues' },
            { label: 'Season', path: seasonHref },
            { label: 'Not Found' },
          ]}
        />
        <p style={{ color: 'var(--text-dim)' }}>Game not found.</p>
      </>
    );
  }

  const leagueName = game.league_name ?? 'League';
  const seasonName = game.season_name ?? 'Season';
  const leagueHref = `/admin/leagues/${leagueId}`;

  const isFinal = game.status === 'final';
  const isInProgress = game.status === 'in_progress';
  // Only the last recorded goal in the active period can be edited or deleted.
  const currentPeriodGoals = goals.filter((g) => g.period === game.current_period);
  const lastCurrentPeriodGoalId = currentPeriodGoals[currentPeriodGoals.length - 1]?.id;
  const hasStars = isFinal && !!(game.star_1_id && game.star_2_id && game.star_3_id);
  // Scores are always derived from the goals table (period_scores); the DB columns were removed.
  // The SO winner's +1 is never written as a goal row, so period_scores has no SO entry.
  // Apply a client-side adjustment whenever the winner is known from attempts and no SO goal
  // exists in the goals table — this covers both in-progress and final states.
  const hasSoPeriodScore = game.period_scores.some((ps) => ps.period === 'SO');
  const soScoreAdj = soWinnerSide && !hasSoPeriodScore ? 1 : 0;
  const liveAwayScore =
    game.period_scores.reduce((sum, ps) => sum + ps.away_goals, 0) +
    (soWinnerSide === 'away' ? soScoreAdj : 0);
  const liveHomeScore =
    game.period_scores.reduce((sum, ps) => sum + ps.home_goals, 0) +
    (soWinnerSide === 'home' ? soScoreAdj : 0);

  // Derive OT/SO from period_scores (source of truth); stored columns are a fallback
  // for legacy games created before goal tracking was introduced.
  const overtimeSuffix =
    game.shootout || game.period_scores.some((ps) => ps.period === 'SO')
      ? '/SO'
      : (game.overtime_periods ?? 0) > 0 || game.period_scores.some((ps) => ps.period === 'OT')
        ? '/OT'
        : '';

  // Period columns for the Linescore table (always 1–3, plus OT/SO if applicable).
  const linescorePeriods: { id: string; label: string }[] = [
    { id: '1', label: '1st' },
    { id: '2', label: '2nd' },
    { id: '3', label: '3rd' },
    ...(game.period_scores.some((ps) => ps.period === 'OT') ||
    (game.overtime_periods ?? 0) > 0 ||
    game.current_period === 'OT' ||
    game.current_period === 'SO'
      ? [{ id: 'OT', label: 'OT' }]
      : []),
    ...(game.period_scores.some((ps) => ps.period === 'SO') ||
    game.shootout ||
    game.current_period === 'SO'
      ? [{ id: 'SO', label: 'SO' }]
      : []),
  ];

  return (
    <>
      <TitleRow
        left={
          <Button
            variant="outlined"
            intent="neutral"
            icon="arrow_back"
            tooltip={`Back to ${seasonName}`}
            onClick={() => navigate(seasonHref)}
          />
        }
        right={
          <Breadcrumbs
            items={[
              { label: 'Leagues', path: '/admin/leagues' },
              { label: leagueName, path: leagueHref },
              { label: seasonName, path: seasonHref },
              {
                label: [
                  `${game.away_team_code} @ ${game.home_team_code}`,
                  game.scheduled_at ? DATE_FMT_SHORT.format(new Date(game.scheduled_at)) : null,
                ]
                  .filter(Boolean)
                  .join(' · '),
              },
            ]}
          />
        }
      />

      {/* ── Scoreboard card ── */}
      <ScoreboardCard
        game={game}
        isFinal={isFinal}
        isInProgress={isInProgress}
        liveAwayScore={liveAwayScore}
        liveHomeScore={liveHomeScore}
        overtimeSuffix={overtimeSuffix}
        leagueId={leagueId}
        onGenerateImage={isFinal ? () => setScoreImageOpen(true) : undefined}
      />

      {/* ── Tabs ── */}
      <Tabs
        activeIndex={activeTab}
        onTabChange={handleTabChange}
        tabs={[
          {
            label: 'Summary',
            content: (
              <div className={styles.tabContent}>
                <div className={styles.summaryGrid}>
                  {/* ── Left column: Three Stars + Scoring ── */}
                  <div className={styles.summaryLeft}>
                    {hasStars &&
                      (() => {
                        const starDefs = [
                          { starCount: 1, playerId: game.star_1_id! },
                          { starCount: 2, playerId: game.star_2_id! },
                          { starCount: 3, playerId: game.star_3_id! },
                        ];
                        return (
                          <Card
                            title="Three Stars"
                            action={
                              isFinal ? (
                                <Button
                                  variant="outlined"
                                  intent="neutral"
                                  icon="edit"
                                  size="sm"
                                  tooltip="Edit three stars"
                                  onClick={() => {
                                    setStarsEditMode(true);
                                    setStarsModalOpen(true);
                                  }}
                                />
                              ) : undefined
                            }
                          >
                            <div className={styles.starsRow}>
                              {starDefs.map(({ starCount, playerId }) => {
                                const player = roster.find((e) => e.player_id === playerId);
                                if (!player) return null;
                                const isAway = player.team_id === game.away_team_id;
                                const teamCode = isAway ? game.away_team_code : game.home_team_code;
                                const primaryColor = isAway
                                  ? game.away_team_primary_color
                                  : game.home_team_primary_color;
                                const textColor = isAway
                                  ? game.away_team_text_color
                                  : game.home_team_text_color;
                                const stats = playerGameStats.get(playerId) ?? {
                                  goals: 0,
                                  assists: 0,
                                };
                                const nameLabel = `${player.first_name} ${player.last_name}`;
                                const subLabel = [
                                  player.jersey_number != null ? `#${player.jersey_number}` : null,
                                  teamCode,
                                  player.position ?? null,
                                ]
                                  .filter(Boolean)
                                  .join(' • ');
                                return (
                                  <div
                                    key={starCount}
                                    className={styles.starItem}
                                  >
                                    {player.photo ? (
                                      <img
                                        src={player.photo}
                                        alt=""
                                        className={styles.starPhoto}
                                      />
                                    ) : (
                                      <span
                                        className={styles.starPhotoPlaceholder}
                                        style={{ background: primaryColor, color: textColor }}
                                      >
                                        {player.first_name[0]}
                                        {player.last_name[0]}
                                      </span>
                                    )}
                                    <span className={styles.starIcons}>
                                      {Array.from({ length: starCount }).map((_, i) => (
                                        <Icon
                                          key={i}
                                          name="stars"
                                        />
                                      ))}
                                    </span>
                                    <Link
                                      to={`/admin/leagues/${leagueId}/teams/${player.team_id}/players/${playerId}`}
                                      className={`${styles.starName} ${styles.playerLink}`}
                                    >
                                      {nameLabel}
                                    </Link>
                                    <span className={styles.starTeam}>{subLabel}</span>
                                    {player.position === 'G' ? (
                                      (() => {
                                        const gs = goalieStats.find(
                                          (s) => s.goalie_id === playerId,
                                        );
                                        return gs ? (
                                          <span className={styles.starStats}>
                                            SA: {gs.shots_against} | SV: {gs.saves}
                                          </span>
                                        ) : null;
                                      })()
                                    ) : (
                                      <span className={styles.starStats}>
                                        G: {stats.goals} | A: {stats.assists}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </Card>
                        );
                      })()}
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
                    {(isFinal || isInProgress) &&
                      (() => {
                        const goalies = [...awayRoster, ...homeRoster].filter(
                          (e) => e.position === 'G',
                        );
                        // Only show the card if at least one goalie has recorded stats
                        const goaliesWithStats = goalies.filter((g) =>
                          goalieStats.some((gs) => gs.goalie_id === g.player_id),
                        );
                        if (goaliesWithStats.length === 0) return null;
                        return (
                          <Card
                            title="Goalie Stats"
                            action={
                              isFinal ? (
                                <Button
                                  variant="outlined"
                                  intent="neutral"
                                  icon="edit"
                                  size="sm"
                                  tooltip="Edit goalie stats"
                                  onClick={() => setGoalieStatsModalOpen(true)}
                                />
                              ) : undefined
                            }
                          >
                            <table className={styles.goalieTable}>
                              <thead>
                                <tr>
                                  <th className={styles.goalieThTeam}></th>
                                  <th className={styles.goalieTh}>SA</th>
                                  <th className={styles.goalieTh}>SV</th>
                                  <th className={styles.goalieTh}>SV%</th>
                                </tr>
                              </thead>
                              <tbody>
                                {goalies.map((goalie) => {
                                  const stat = goalieStats.find(
                                    (gs) => gs.goalie_id === goalie.player_id,
                                  );
                                  // Only show goalies that have recorded SA/SVS for this game
                                  if (!stat) return null;
                                  const isAway = goalie.team_id === game.away_team_id;
                                  const primaryColor = isAway
                                    ? game.away_team_primary_color
                                    : game.home_team_primary_color;
                                  const textColor = isAway
                                    ? game.away_team_text_color
                                    : game.home_team_text_color;
                                  const teamLogo = isAway
                                    ? game.away_team_logo
                                    : game.home_team_logo;
                                  const teamCode = isAway
                                    ? game.away_team_code
                                    : game.home_team_code;
                                  const svPct =
                                    stat && stat.shots_against > 0
                                      ? (stat.saves / stat.shots_against)
                                          .toFixed(3)
                                          .replace(/^0/, '')
                                      : stat
                                        ? '1.000'
                                        : '—';
                                  const playerHref = `/admin/leagues/${leagueId}/teams/${goalie.team_id}/players/${goalie.player_id}`;
                                  return (
                                    <tr
                                      key={goalie.player_id}
                                      className={styles.goalieRow}
                                      style={{ cursor: 'pointer' }}
                                      onClick={() => navigate(playerHref)}
                                    >
                                      <td className={styles.goalieTdName}>
                                        <span className={styles.goalieNameCell}>
                                          {/* Team logo — same size as goal entries */}
                                          {teamLogo ? (
                                            <img
                                              src={teamLogo}
                                              alt={teamCode}
                                              className={styles.goalTeamLogo}
                                            />
                                          ) : (
                                            <span
                                              className={styles.goalTeamLogoPlaceholder}
                                              style={{ background: primaryColor, color: textColor }}
                                            >
                                              {teamCode?.slice(0, 1)}
                                            </span>
                                          )}
                                          {/* Player photo */}
                                          {goalie.photo ? (
                                            <img
                                              src={goalie.photo}
                                              alt=""
                                              className={styles.goalScorerPhoto}
                                            />
                                          ) : (
                                            <span
                                              className={styles.goalScorerPhotoPlaceholder}
                                              style={{ background: primaryColor, color: textColor }}
                                            >
                                              {goalie.last_name?.charAt(0)}
                                            </span>
                                          )}
                                          {/* Jersey + name */}
                                          <div className={styles.goalInfo}>
                                            {goalie.jersey_number != null && (
                                              <span className={styles.goalAssists}>
                                                #{goalie.jersey_number}
                                              </span>
                                            )}
                                            <span className={styles.goalScorer}>
                                              {formatPlayerName(
                                                goalie.first_name,
                                                goalie.last_name,
                                              )}
                                            </span>
                                          </div>
                                        </span>
                                      </td>
                                      <td className={styles.goalieTd}>
                                        {stat?.shots_against ?? '—'}
                                      </td>
                                      <td className={styles.goalieTd}>{stat?.saves ?? '—'}</td>
                                      <td className={styles.goalieTd}>{svPct}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </Card>
                        );
                      })()}

                    {/* ── Previous Meetings card ── */}
                    {game.previous_meetings && game.previous_meetings.length > 0 && (
                      <Card title="Previous Meetings">
                        <div className={styles.prevMeetingsRows}>
                          {game.previous_meetings.map((pm: PreviousMeeting) => {
                            const isOT = pm.overtime_periods != null && pm.overtime_periods > 0;
                            const isSO = pm.shootout;
                            const suffix = isSO ? '(SO)' : isOT ? '(OT)' : null;
                            // Left = historical away team, right = historical home team.
                            // current_home_was_home tells us which current team played which role.
                            const leftTeam = pm.current_home_was_home
                              ? {
                                  code: game.away_team_code,
                                  logo: game.away_team_logo,
                                  primary: game.away_team_primary_color,
                                  text: game.away_team_text_color,
                                }
                              : {
                                  code: game.home_team_code,
                                  logo: game.home_team_logo,
                                  primary: game.home_team_primary_color,
                                  text: game.home_team_text_color,
                                };
                            const rightTeam = pm.current_home_was_home
                              ? {
                                  code: game.home_team_code,
                                  logo: game.home_team_logo,
                                  primary: game.home_team_primary_color,
                                  text: game.home_team_text_color,
                                }
                              : {
                                  code: game.away_team_code,
                                  logo: game.away_team_logo,
                                  primary: game.away_team_primary_color,
                                  text: game.away_team_text_color,
                                };
                            // pm.away_score / pm.home_score are always from the historical game's perspective
                            const homeWon = pm.home_score > pm.away_score;
                            const renderTeamLogo = (team: typeof leftTeam) =>
                              team.logo ? (
                                <img
                                  src={team.logo}
                                  alt={team.code}
                                  className={styles.prevMeetingLogo}
                                />
                              ) : (
                                <span
                                  className={styles.prevMeetingLogoPlaceholder}
                                  style={{ background: team.primary, color: team.text }}
                                >
                                  {team.code?.slice(0, 3)}
                                </span>
                              );
                            return (
                              <div
                                key={pm.game_id}
                                className={styles.prevMeetingRow}
                                role="button"
                                tabIndex={0}
                                onClick={() =>
                                  navigate(
                                    `/admin/leagues/${leagueId}/seasons/${seasonId}/games/${pm.game_id}`,
                                  )
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ')
                                    navigate(
                                      `/admin/leagues/${leagueId}/seasons/${seasonId}/games/${pm.game_id}`,
                                    );
                                }}
                              >
                                {pm.scheduled_at && (
                                  <span className={styles.prevMeetingDate}>
                                    {DATE_FMT_SHORT.format(new Date(pm.scheduled_at))}
                                  </span>
                                )}
                                {/* Historical away team — always left */}
                                <span className={styles.prevMeetingTeam}>
                                  {renderTeamLogo(leftTeam)}
                                  <span className={styles.prevMeetingCode}>{leftTeam.code}</span>
                                </span>
                                {/* Score: historical away – historical home */}
                                <span className={styles.prevMeetingScore}>
                                  <span
                                    className={
                                      homeWon
                                        ? styles.prevMeetingScoreDim
                                        : styles.prevMeetingScoreBright
                                    }
                                  >
                                    {pm.away_score}
                                  </span>
                                  <span className={styles.prevMeetingScoreSep}>–</span>
                                  <span
                                    className={
                                      homeWon
                                        ? styles.prevMeetingScoreBright
                                        : styles.prevMeetingScoreDim
                                    }
                                  >
                                    {pm.home_score}
                                  </span>
                                  {suffix && (
                                    <span className={styles.prevMeetingSuffix}>{suffix}</span>
                                  )}
                                </span>
                                {/* Historical home team — always right */}
                                <span
                                  className={`${styles.prevMeetingTeam} ${styles.prevMeetingTeamRight}`}
                                >
                                  <span className={styles.prevMeetingCode}>{rightTeam.code}</span>
                                  {renderTeamLogo(rightTeam)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    )}

                    {/* ── Last 5 Games card ── */}
                    {(game.home_last_five || game.away_last_five) &&
                      (() => {
                        const awayGames = game.away_last_five ?? [];
                        const homeGames = game.home_last_five ?? [];

                        const renderSquare = (
                          lg: LastFiveGame,
                          teamPrimary: string,
                          teamText: string,
                        ) => {
                          const isOT = lg.overtime_periods != null && lg.overtime_periods > 0;
                          const isSO = lg.shootout;
                          const suffix = isSO ? '(SO)' : isOT ? '(OT)' : null;

                          return (
                            <div
                              key={lg.game_id}
                              className={[
                                styles.lastFiveSquare,
                                lg.is_home ? styles.lastFiveSquareHome : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                              style={
                                lg.is_home
                                  ? ({ '--square-primary': teamPrimary } as React.CSSProperties)
                                  : undefined
                              }
                              role="button"
                              tabIndex={0}
                              onClick={() =>
                                navigate(
                                  `/admin/leagues/${leagueId}/seasons/${seasonId}/games/${lg.game_id}`,
                                )
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ')
                                  navigate(
                                    `/admin/leagues/${leagueId}/seasons/${seasonId}/games/${lg.game_id}`,
                                  );
                              }}
                            >
                              {lg.scheduled_at && (
                                <span className={styles.lastFiveDate}>
                                  {DATE_FMT_SHORT.format(new Date(lg.scheduled_at))}
                                </span>
                              )}
                              <Tooltip text={lg.opponent_name ?? lg.opponent_code}>
                                <span
                                  className={`${styles.lastFiveLogoCircle} ${lg.is_home ? styles.lastFiveLogoCircleHome : styles.lastFiveLogoCircleAway}`}
                                  style={
                                    lg.is_home
                                      ? ({ '--circle-text': teamText } as React.CSSProperties)
                                      : undefined
                                  }
                                >
                                  {lg.opponent_logo ? (
                                    <img
                                      src={lg.opponent_logo}
                                      alt={lg.opponent_code}
                                      className={styles.lastFiveOpponentLogo}
                                    />
                                  ) : (
                                    <span className={styles.lastFiveOpponentPlaceholder}>
                                      {lg.opponent_code?.slice(0, 3)}
                                    </span>
                                  )}
                                </span>
                              </Tooltip>
                              <div className={styles.lastFiveScore}>
                                <span className={styles.lastFiveResult}>{lg.result}</span>
                                <span className={styles.lastFiveScoreText}>
                                  {lg.away_score}-{lg.home_score}
                                </span>
                                {suffix && <span className={styles.lastFiveOT}>{suffix}</span>}
                              </div>
                            </div>
                          );
                        };

                        const renderListRow = (lg: LastFiveGame) => {
                          const isOT = lg.overtime_periods != null && lg.overtime_periods > 0;
                          const isSO = lg.shootout;
                          const suffix = isSO ? '(SO)' : isOT ? '(OT)' : null;
                          const resultLabel = lg.result;
                          const resultClass =
                            lg.result === 'W'
                              ? styles.lastFiveListResultW
                              : lg.result === 'L'
                                ? styles.lastFiveListResultL
                                : styles.lastFiveListResultT;

                          return (
                            <div
                              key={lg.game_id}
                              className={styles.lastFiveListRow}
                              role="button"
                              tabIndex={0}
                              onClick={() =>
                                navigate(
                                  `/admin/leagues/${leagueId}/seasons/${seasonId}/games/${lg.game_id}`,
                                )
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ')
                                  navigate(
                                    `/admin/leagues/${leagueId}/seasons/${seasonId}/games/${lg.game_id}`,
                                  );
                              }}
                            >
                              <span className={`${styles.lastFiveListResult} ${resultClass}`}>
                                {resultLabel}
                              </span>
                              <span className={styles.lastFiveListLogo}>
                                {lg.opponent_logo ? (
                                  <img
                                    src={lg.opponent_logo}
                                    alt={lg.opponent_code}
                                    className={styles.lastFiveListLogoImg}
                                  />
                                ) : (
                                  <span className={styles.lastFiveListLogoPlaceholder}>
                                    {lg.opponent_code?.slice(0, 3)}
                                  </span>
                                )}
                              </span>
                              <span className={styles.lastFiveListOpp}>
                                {lg.is_home ? 'vs' : '@'} {lg.opponent_name ?? lg.opponent_code}
                              </span>
                              <span className={styles.lastFiveListScore}>
                                {lg.away_score}–{lg.home_score}
                                {suffix && (
                                  <span className={styles.lastFiveListSuffix}>{suffix}</span>
                                )}
                              </span>
                              {lg.scheduled_at && (
                                <span className={styles.lastFiveListDate}>
                                  {DATE_FMT_SHORT.format(new Date(lg.scheduled_at))}
                                </span>
                              )}
                            </div>
                          );
                        };

                        const renderTeamAccordion = (
                          label: string,
                          logo: string | null,
                          code: string,
                          primary: string,
                          text: string,
                          games: LastFiveGame[],
                        ) => (
                          <Accordion
                            variant="static"
                            label={
                              <span className={styles.linescoreTeam}>
                                {logo ? (
                                  <img
                                    src={logo}
                                    alt={code}
                                    className={styles.linescoreLogo}
                                  />
                                ) : (
                                  <span
                                    className={styles.goalTeamLogoPlaceholder}
                                    style={{ background: primary, color: text }}
                                  >
                                    {code?.slice(0, 1)}
                                  </span>
                                )}
                                <span>{label}</span>
                              </span>
                            }
                            headerRight={(() => {
                              const { w, otw, otl, l } = buildFormRecord(games);
                              return (
                                <span className={styles.lastFiveForm}>
                                  <Tooltip text="Wins">
                                    <span>{w}</span>
                                  </Tooltip>
                                  <span className={styles.lastFiveFormSep}>-</span>
                                  <Tooltip text="OT/SO Wins">
                                    <span>{otw}</span>
                                  </Tooltip>
                                  <span className={styles.lastFiveFormSep}>-</span>
                                  <Tooltip text="OT/SO Losses">
                                    <span>{otl}</span>
                                  </Tooltip>
                                  <span className={styles.lastFiveFormSep}>-</span>
                                  <Tooltip text="Losses">
                                    <span>{l}</span>
                                  </Tooltip>
                                </span>
                              );
                            })()}
                          >
                            {lastFiveView === 'list' ? (
                              <div className={styles.lastFiveListRows}>
                                {games.length === 0 ? (
                                  <p className={styles.noGoalsText}>No recent games</p>
                                ) : (
                                  games.map((lg) => renderListRow(lg))
                                )}
                              </div>
                            ) : (
                              <div
                                className={[
                                  styles.lastFiveGames,
                                  games.length === 0 ? styles.lastFiveGamesEmpty : '',
                                ]
                                  .join(' ')
                                  .trim()}
                              >
                                {games.length === 0 ? (
                                  <p className={styles.noGoalsText}>No recent games</p>
                                ) : (
                                  games.map((lg) => renderSquare(lg, primary, text))
                                )}
                              </div>
                            )}
                          </Accordion>
                        );

                        return (
                          <Card
                            title="Last 5 Games"
                            action={
                              <div className={styles.lastFiveViewToggle}>
                                <Button
                                  variant="ghost"
                                  intent={lastFiveView === 'list' ? 'accent' : 'neutral'}
                                  icon="view_list"
                                  size="sm"
                                  tooltip="List view"
                                  onClick={() => setLastFiveView('list')}
                                />
                                <Button
                                  variant="ghost"
                                  intent={lastFiveView === 'square' ? 'accent' : 'neutral'}
                                  icon="grid_view"
                                  size="sm"
                                  tooltip="Grid view"
                                  onClick={() => setLastFiveView('square')}
                                />
                              </div>
                            }
                          >
                            <div className={styles.lastFiveList}>
                              <div className={styles.lastFiveTeamCol}>
                                {renderTeamAccordion(
                                  game.away_team_name,
                                  game.away_team_logo,
                                  game.away_team_code,
                                  game.away_team_primary_color,
                                  game.away_team_text_color,
                                  awayGames,
                                )}
                              </div>
                              <div className={styles.lastFiveTeamCol}>
                                {renderTeamAccordion(
                                  game.home_team_name,
                                  game.home_team_logo,
                                  game.home_team_code,
                                  game.home_team_primary_color,
                                  game.home_team_text_color,
                                  homeGames,
                                )}
                              </div>
                            </div>
                          </Card>
                        );
                      })()}
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
                            (game.current_period !== 'OT' ||
                              goals.some((g) => g.period === 'OT')) &&
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
                                    openShotsModal(
                                      game.current_period ?? '3',
                                      { type: 'end-game' },
                                      true,
                                    );
                                  }
                                }}
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
                                teamId: game.away_team_id,
                                teamCode: game.away_team_code,
                                teamLogo: game.away_team_logo,
                                primaryColor: game.away_team_primary_color,
                                textColor: game.away_team_text_color,
                                total: liveAwayScore,
                                isLoser: isFinal && liveAwayScore < liveHomeScore,
                              },
                              {
                                teamId: game.home_team_id,
                                teamCode: game.home_team_code,
                                teamLogo: game.home_team_logo,
                                primaryColor: game.home_team_primary_color,
                                textColor: game.home_team_text_color,
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
                                        style={{
                                          background: row.primaryColor,
                                          color: row.textColor,
                                        }}
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
                                  // Period is "done" (played) when:
                                  //   - game is final (all periods are done), OR
                                  //   - it's a regular period whose index is before the current period, OR
                                  //   - it's OT/SO (pIdx === -1) which only appears when it's been played
                                  const isPeriodDone =
                                    isFinal || (pIdx >= 0 ? currentPeriodIdx > pIdx : true);

                                  // SO column: show goals/attempts instead of the raw goal value
                                  if (p.id === 'SO') {
                                    const teamAttempts = attempts.filter(
                                      (a) => a.team_id === row.teamId,
                                    );
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
                                    row.teamId === game.away_team_id
                                      ? ps?.away_goals
                                      : ps?.home_goals;
                                  const goals: number | string =
                                    rawGoals ?? (isPeriodDone ? 0 : '—');
                                  return (
                                    <td
                                      key={p.id}
                                      className={styles.tdGoals}
                                    >
                                      {goals}
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
                                logo: game.away_team_logo,
                                code: game.away_team_code,
                                primary: game.away_team_primary_color,
                                text: game.away_team_text_color,
                              },
                              {
                                key: 'home',
                                isAway: false,
                                logo: game.home_team_logo,
                                code: game.home_team_code,
                                primary: game.home_team_primary_color,
                                text: game.home_team_text_color,
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

                    <Card
                      title="Game Info"
                      action={
                        <Button
                          variant="outlined"
                          intent="neutral"
                          icon="edit"
                          size="sm"
                          tooltip="Edit game info"
                          onClick={openGameInfoEdit}
                        />
                      }
                    >
                      <div className={styles.infoGrid}>
                        {/* Row 1 — Game Type (full width) */}
                        <div className={`${styles.infoItem} ${styles.infoItemFull}`}>
                          <span className={styles.infoLabel}>Type</span>
                          <span className={styles.infoValue}>
                            {GAME_TYPE_LABEL[game.game_type]}
                          </span>
                        </div>
                        {/* Row 2 — Scheduled Date | Scheduled Time */}
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Scheduled Date</span>
                          <span
                            className={game.scheduled_at ? styles.infoValue : styles.infoValueMuted}
                          >
                            {game.scheduled_at
                              ? DATE_FMT_SHORT.format(new Date(game.scheduled_at))
                              : '—'}
                          </span>
                        </div>
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Scheduled Time</span>
                          <span
                            className={
                              game.scheduled_time ? styles.infoValue : styles.infoValueMuted
                            }
                          >
                            {game.scheduled_time ? formatScheduledTime(game.scheduled_time) : '—'}
                          </span>
                        </div>
                        {/* Row 3 — Start Time | End Time */}
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Start Time</span>
                          <span
                            className={game.time_start ? styles.infoValue : styles.infoValueMuted}
                          >
                            {game.time_start ? TIME_FMT.format(new Date(game.time_start)) : '—'}
                          </span>
                        </div>
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>End Time</span>
                          <span
                            className={game.time_end ? styles.infoValue : styles.infoValueMuted}
                          >
                            {game.time_end ? TIME_FMT.format(new Date(game.time_end)) : '—'}
                          </span>
                        </div>
                        {/* Row 4 — Venue (full width) */}
                        <div className={`${styles.infoItem} ${styles.infoItemFull}`}>
                          <span className={styles.infoLabel}>Venue</span>
                          <span className={game.venue ? styles.infoValue : styles.infoValueMuted}>
                            {game.venue ?? '—'}
                          </span>
                        </div>
                        {/* Optional extras */}
                        {game.game_number != null && (
                          <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Game #</span>
                            <span className={styles.infoValue}>{game.game_number}</span>
                          </div>
                        )}
                        {game.notes && (
                          <div className={`${styles.infoItem} ${styles.infoItemFull}`}>
                            <span className={styles.infoLabel}>Notes</span>
                            <span className={styles.infoValue}>{game.notes}</span>
                          </div>
                        )}
                      </div>
                    </Card>
                  </div>
                </div>
              </div>
            ),
          },
          {
            label: 'Lineups',
            content: (() => {
              // Saved lineup entries for this game (non-inherited).
              const awayLineupMap = new Map(
                lineup
                  .filter((e) => e.team_id === game.away_team_id && !e.inherited)
                  .map((e) => [e.player_id, e]),
              );
              const homeLineupMap = new Map(
                lineup
                  .filter((e) => e.team_id === game.home_team_id && !e.inherited)
                  .map((e) => [e.player_id, e]),
              );
              // Inherited lineup entries (from the team's last finished game).
              const awayInheritedLineupMap = new Map(
                lineup
                  .filter((e) => e.team_id === game.away_team_id && !!e.inherited)
                  .map((e) => [e.player_id, e]),
              );
              const homeInheritedLineupMap = new Map(
                lineup
                  .filter((e) => e.team_id === game.home_team_id && !!e.inherited)
                  .map((e) => [e.player_id, e]),
              );

              const renderTeamAccordion = (
                side: 'away' | 'home',
                teamName: string,
                teamCode: string,
                teamLogo: string | null | undefined,
                primaryColor: string,
                textColor: string,
                rosterEntries: GameRosterEntry[],
                lineupMap: typeof awayLineupMap,
                inheritedLineupMap: typeof awayInheritedLineupMap,
                inheritedEntries: GameRosterEntry[],
              ) => (
                <Accordion
                  variant="static"
                  label={
                    <span className={styles.accordionTeamLabel}>
                      {teamLogo ? (
                        <img
                          src={teamLogo}
                          alt={teamCode}
                          className={styles.accordionTeamLogo}
                        />
                      ) : (
                        <span className={styles.accordionTeamLogoPlaceholder}>
                          {teamCode.slice(0, 3)}
                        </span>
                      )}
                      {teamName}
                      <span className={styles.accordionTeamCount}>({rosterEntries.length}/23)</span>
                    </span>
                  }
                  hoverActions={
                    isFinal
                      ? []
                      : [
                          ...(inheritedEntries.length > 0 && rosterEntries.length === 0
                            ? [
                                {
                                  icon: 'clone',
                                  tooltip: 'Auto-fill from Last Game',
                                  intent: 'accent' as const,
                                  disabled: autoFillBusy[side],
                                  onClick: async () => {
                                    const teamId =
                                      side === 'away' ? game.away_team_id : game.home_team_id;
                                    setAutoFillBusy((prev) => ({ ...prev, [side]: true }));
                                    await addToRoster(
                                      teamId,
                                      inheritedEntries.map((e) => e.player_id),
                                    );
                                    setAutoFillBusy((prev) => ({ ...prev, [side]: false }));
                                  },
                                },
                              ]
                            : []),

                          ...(rosterEntries.length > 0
                            ? [
                                {
                                  icon: 'set_lineup',
                                  tooltip: 'Set Starting Lineup',
                                  intent: 'info' as const,
                                  onClick: () => setLineupSetTeam(side),
                                },
                              ]
                            : []),
                          ...(rosterEntries.length < 23
                            ? [
                                {
                                  icon: 'group_add',
                                  tooltip: 'Add from Season Roster',
                                  intent: 'neutral' as const,
                                  onClick: () => setLineupAddTeam(side),
                                },
                                {
                                  icon: 'person_edit',
                                  tooltip: 'Create Player',
                                  intent: 'neutral' as const,
                                  onClick: () => setLineupCreateTeam(side),
                                },
                              ]
                            : []),
                        ]
                  }
                >
                  {rosterEntries.length > 0 ? (
                    (() => {
                      const byJersey = (a: GameRosterEntry, b: GameRosterEntry) => {
                        if (a.jersey_number == null && b.jersey_number == null) return 0;
                        if (a.jersey_number == null) return 1;
                        if (b.jersey_number == null) return -1;
                        return a.jersey_number - b.jersey_number;
                      };
                      const skaters = rosterEntries
                        .filter((e) => e.position !== 'G')
                        .sort(byJersey);
                      const goalies = rosterEntries
                        .filter((e) => e.position === 'G')
                        .sort(byJersey);

                      const renderPlayer = (e: GameRosterEntry) => {
                        const isStarter = lineupMap.has(e.player_id);
                        const isInheritedStarter =
                          !isStarter && inheritedLineupMap.has(e.player_id);
                        const positionPart = e.position
                          ? (POSITION_LABEL[e.position] ?? e.position)
                          : undefined;
                        return (
                          <ListItem
                            key={e.id}
                            image={e.photo}
                            image_shape="circle"
                            primaryColor={primaryColor}
                            textColor={textColor}
                            jerseyNumber={e.jersey_number ?? null}
                            eyebrow={positionPart}
                            name={`${e.last_name}, ${e.first_name}`}
                            placeholder={`${e.first_name[0]}${e.last_name[0]}`}
                            href={`/admin/leagues/${leagueId}/teams/${e.team_id}/players/${e.player_id}`}
                            rightContent={
                              isStarter
                                ? { type: 'tag', label: 'Starter', intent: 'accent' }
                                : isInheritedStarter
                                  ? { type: 'tag', label: 'Last Game', intent: 'neutral' }
                                  : undefined
                            }
                            actions={
                              isFinal
                                ? []
                                : [
                                    {
                                      icon: 'person_remove',
                                      intent: 'danger',
                                      tooltip: 'Remove from lineup',
                                      onClick: () => setConfirmRemove({ entry: e }),
                                    },
                                  ]
                            }
                          />
                        );
                      };

                      return (
                        <>
                          <ul className={styles.lineupPlayerList}>{skaters.map(renderPlayer)}</ul>
                          {goalies.length > 0 && (
                            <>
                              <div className={styles.lineupDivider} />
                              <ul className={styles.lineupPlayerList}>
                                {goalies.map(renderPlayer)}
                              </ul>
                            </>
                          )}
                        </>
                      );
                    })()
                  ) : (
                    <p className={styles.noGoalsText}>No players in lineup yet.</p>
                  )}
                </Accordion>
              );

              return (
                <div className={styles.tabContent}>
                  <Card title="Lineups">
                    <div className={styles.lineupGrid}>
                      {renderTeamAccordion(
                        'away',
                        game.away_team_name,
                        game.away_team_code,
                        game.away_team_logo,
                        game.away_team_primary_color,
                        game.away_team_text_color,
                        awayRoster,
                        awayLineupMap,
                        awayInheritedLineupMap,
                        awayRosterInherited,
                      )}
                      {renderTeamAccordion(
                        'home',
                        game.home_team_name,
                        game.home_team_code,
                        game.home_team_logo,
                        game.home_team_primary_color,
                        game.home_team_text_color,
                        homeRoster,
                        homeLineupMap,
                        homeInheritedLineupMap,
                        homeRosterInherited,
                      )}
                    </div>
                  </Card>
                </div>
              );
            })(),
          },
        ]}
      />

      {/* ── Score Goal Form ── */}
      {goalPeriod !== null && game && (
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
      {game && (
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

      {/* ── Lineup: Add from Roster ── */}
      {lineupAddTeam !== null && game && (
        <LineupRosterModal
          open={lineupAddTeam !== null}
          onClose={() => setLineupAddTeam(null)}
          teamId={lineupAddTeam === 'away' ? game.away_team_id : game.home_team_id}
          seasonId={seasonId!}
          teamName={lineupAddTeam === 'away' ? game.away_team_name : game.home_team_name}
          existingPlayerIds={
            new Set((lineupAddTeam === 'away' ? awayRoster : homeRoster).map((e) => e.player_id))
          }
          addToGameRoster={(playerIds) =>
            addToRoster(lineupAddTeam === 'away' ? game.away_team_id : game.home_team_id, playerIds)
          }
        />
      )}

      {/* ── Lineup: Create Player ── */}
      {lineupCreateTeam !== null && game && (
        <LineupCreatePlayersModal
          open={lineupCreateTeam !== null}
          onClose={() => setLineupCreateTeam(null)}
          teamId={lineupCreateTeam === 'away' ? game.away_team_id : game.home_team_id}
          seasonId={seasonId!}
          teamName={lineupCreateTeam === 'away' ? game.away_team_name : game.home_team_name}
          existingCount={(lineupCreateTeam === 'away' ? awayRoster : homeRoster).length}
          existingGoalieCount={
            (lineupCreateTeam === 'away' ? awayRoster : homeRoster).filter(
              (e) => e.position === 'G',
            ).length
          }
          existingRoster={(lineupCreateTeam === 'away' ? awayRoster : homeRoster).map((e) => ({
            first_name: e.first_name,
            last_name: e.last_name,
            jersey_number: e.jersey_number ?? null,
          }))}
          createAndRosterPlayers={
            lineupCreateTeam === 'away' ? createAndRosterAway : createAndRosterHome
          }
          onPlayersCreated={(playerIds) =>
            addToRoster(
              lineupCreateTeam === 'away' ? game.away_team_id : game.home_team_id,
              playerIds,
            ).then(() => {})
          }
        />
      )}

      {/* ── Lineup: Set Starting Lineup ── */}
      {lineupSetTeam !== null &&
        game &&
        (() => {
          // Map game roster entries to the shape SetLineupModal expects (id = player_id)
          const rosterForSide = (lineupSetTeam === 'away' ? awayRoster : homeRoster).map((e) => ({
            ...e,
            id: e.player_id,
          }));
          return (
            <SetLineupModal
              open={lineupSetTeam !== null}
              onClose={() => setLineupSetTeam(null)}
              teamId={lineupSetTeam === 'away' ? game.away_team_id : game.home_team_id}
              teamName={lineupSetTeam === 'away' ? game.away_team_name : game.home_team_name}
              players={rosterForSide as unknown as Parameters<typeof SetLineupModal>[0]['players']}
              lineup={lineup}
              saveTeamLineup={saveTeamLineup}
            />
          );
        })()}

      {/* ── Lineup: Remove from Lineup (confirm) ── */}
      <RemoveFromLineupModal
        entry={confirmRemove?.entry ?? null}
        busy={removingFromRoster}
        onConfirm={handleConfirmRemove}
        onCancel={() => setConfirmRemove(null)}
      />

      {/* ── Start Game modal ── */}
      <StartGameModal
        open={startGameModalOpen}
        isStarting={busy === 'in_progress'}
        disabled={!!busy}
        onClose={() => setStartGameModalOpen(false)}
        onStart={startGame}
      />

      {/* ── Game Info edit modal ── */}
      <GameInfoEditModal
        open={gameInfoEditOpen}
        game={game}
        isSaving={busy === 'update-info'}
        disabled={!!busy}
        onClose={() => setGameInfoEditOpen(false)}
        onSave={updateGameInfo}
      />

      {/* ── 3 Stars modal ── */}
      <ThreeStarsModal
        open={starsModalOpen}
        editMode={starsEditMode}
        roster={roster}
        busy={!!busy}
        awayTeam={{
          id: game.away_team_id,
          code: game.away_team_code,
          logo: game.away_team_logo,
          primaryColor: game.away_team_primary_color,
          textColor: game.away_team_text_color,
        }}
        homeTeam={{
          id: game.home_team_id,
          code: game.home_team_code,
          logo: game.home_team_logo,
          primaryColor: game.home_team_primary_color,
          textColor: game.home_team_text_color,
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
      {shotsPeriod !== null && game && shotsNextAction && (
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

      {/* ── Goalie Stats edit modal ── */}
      {goalieStatsModalOpen && game && (
        <GoalieStatsEditModal
          open={goalieStatsModalOpen}
          game={game}
          awayRoster={awayRoster}
          homeRoster={homeRoster}
          goalieStats={goalieStats}
          lineup={lineup}
          onClose={() => setGoalieStatsModalOpen(false)}
          upsertGoalieStat={async (data) => {
            await upsertGoalieStat(data);
          }}
        />
      )}

      {/* ── Shots edit modal (all periods) ── */}
      {shotsEditModalOpen && game && (
        <ShotsEditModal
          open={shotsEditModalOpen}
          game={game}
          periods={linescorePeriods}
          onClose={() => setShotsEditModalOpen(false)}
          updatePeriodShots={updatePeriodShots}
        />
      )}

      {/* ── Score image modal ── */}
      {scoreImageOpen && game && (
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
      {game && (
        <ConfirmModal
          open={confirmDeleteOpen}
          title="Delete Game"
          body={`Delete ${game.away_team_code} @ ${game.home_team_code}? This will remove all goals, lineups, and related data. This cannot be undone.`}
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

export default GameDetailsPage;
