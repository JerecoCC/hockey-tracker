/* eslint-disable @typescript-eslint/no-unused-expressions */
import React, { useState, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import ActionOverlay from '../../../components/ActionOverlay/ActionOverlay';
import Badge from '../../../components/Badge/Badge';
import Tooltip from '../../../components/Tooltip/Tooltip';
import Breadcrumbs from '../../../components/Breadcrumbs/Breadcrumbs';
import Icon from '../../../components/Icon/Icon';
import Accordion, { type AccordionAction } from '../../../components/Accordion/Accordion';
import Button from '../../../components/Button/Button';
import Card from '../../../components/Card/Card';
import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal';
import ListItem from '../../../components/ListItem/ListItem';
import Field from '../../../components/Field/Field';
import Modal from '../../../components/Modal/Modal';
import MoreActionsMenu from '../../../components/MoreActionsMenu/MoreActionsMenu';
import Select from '../../../components/Select/Select';
import TimePicker from '../../../components/TimePicker/TimePicker';
import Tabs from '../../../components/Tabs/Tabs';
import TitleRow from '../../../components/TitleRow/TitleRow';
import {
  useGameDetails,
  type CurrentPeriod,
  type GameStatus,
  type GameType,
  type LastFiveGame,
} from '../../../hooks/useGames';
import useTeamPlayers from '../../../hooks/useTeamPlayers';
import useGameLineup from '../../../hooks/useGameLineup';
import useGameRoster, { type GameRosterEntry } from '../../../hooks/useGameRoster';
import useGameGoals, { type GoalRecord } from '../../../hooks/useGameGoals';
import useGameGoalieStats from '../../../hooks/useGameGoalieStats';
import useShootoutAttempts, { type ShootoutAttempt } from '../../../hooks/useShootoutAttempts';
import useTabState from '../../../hooks/useTabState';
import LineupRosterModal from './LineupRosterModal';
import LineupCreatePlayersModal from './LineupCreatePlayersModal';
import SetLineupModal from './SetLineupModal';
import styles from './GameDetailsPage.module.scss';

// ── Helpers ───────────────────────────────────────────────────────────────────

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const DATE_FMT_SHORT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

/** Formats an ISO timestamp as "7:05 PM" (ET). */
const TIME_FMT = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/New_York',
});

/** Converts a stored "HH:MM" 24-hour string to "h:mm AM/PM". */
const formatScheduledTime = (t: string): string => {
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${suffix}`;
};

/** Converts an ISO timestamp to "HH:mm" in Eastern Time (for time picker pre-fill). */
const isoToETHHMM = (iso: string): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  return `${parts.find((p) => p.type === 'hour')!.value}:${parts.find((p) => p.type === 'minute')!.value}`;
};

/** Treats an "HH:mm" string as Eastern Time and returns a UTC ISO string. */
const etHHMMtoISO = (hhmm: string): string => {
  const etDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(
    new Date(),
  );
  // Probe the ET offset (handles DST: EDT = -04:00, EST = -05:00)
  const probe = new Date(`${etDate}T${hhmm}:00-05:00`);
  const tzName =
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      timeZoneName: 'short',
    })
      .formatToParts(probe)
      .find((p) => p.type === 'timeZoneName')?.value ?? 'EST';
  const offset = tzName === 'EDT' ? '-04:00' : '-05:00';
  return new Date(`${etDate}T${hhmm}:00${offset}`).toISOString();
};

const STATUS_LABEL: Record<GameStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  final: 'Final',
  postponed: 'Postponed',
  cancelled: 'Cancelled',
};

const STATUS_INTENT: Record<GameStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  scheduled: 'info',
  in_progress: 'warning',
  final: 'success',
  postponed: 'warning',
  cancelled: 'danger',
};

const PERIOD_IDS = ['1', '2', '3'] as const;
const PERIODS: { num: number; label: string; periodId: CurrentPeriod }[] = [
  { num: 1, label: '1st Period', periodId: '1' },
  { num: 2, label: '2nd Period', periodId: '2' },
  { num: 3, label: '3rd Period', periodId: '3' },
];

const GAME_TYPE_LABEL: Record<GameType, string> = {
  preseason: 'Preseason',
  regular: 'Regular Season',
  playoff: 'Playoffs',
};

const GAME_TYPE_OPTIONS = (Object.entries(GAME_TYPE_LABEL) as [GameType, string][]).map(
  ([value, label]) => ({ value, label }),
);

const PERIOD_LABEL: Record<string, string> = {
  '1': '1st',
  '2': '2nd',
  '3': '3rd',
  OT: 'OT',
  SO: 'SO',
};

const GOAL_TYPES = [
  { value: 'even-strength', label: 'Even Strength' },
  { value: 'power-play', label: 'Power Play' },
  { value: 'shorthanded', label: 'Shorthanded' },
  { value: 'penalty-shot', label: 'Penalty Shot' },
  { value: 'own', label: 'Own Goal' },
];

const POSITION_LABEL: Record<string, string> = {
  C: 'Center',
  LW: 'Left Wing',
  RW: 'Right Wing',
  D: 'Defense',
  G: 'Goalie',
};

/** Goal type → { abbreviation, badge intent }. Even-strength returns null (no badge). */
const GOAL_TYPE_BADGE: Record<
  string,
  {
    label: string;
    tooltip: string;
    intent: 'info' | 'warning' | 'neutral' | 'success' | 'danger';
  } | null
> = {
  'even-strength': null,
  'power-play': { label: 'PP', tooltip: 'Power Play', intent: 'info' },
  shorthanded: { label: 'SH', tooltip: 'Shorthanded', intent: 'warning' },
  'empty-net': { label: 'EN', tooltip: 'Empty Net', intent: 'neutral' },
  'penalty-shot': { label: 'PS', tooltip: 'Penalty Shot', intent: 'success' },
  own: { label: 'OG', tooltip: 'Own Goal', intent: 'danger' },
};

/**
 * Format a player name for goal/assist display.
 * Result: "C. McDavid"  (or "McDavid" when no first name)
 */
const formatPlayerName = (firstName: string | null, lastName: string | null): string => {
  if (!lastName) return '';
  const initial = firstName ? `${firstName.charAt(0)}. ` : '';
  return `${initial}${lastName}`;
};

/**
 * Compute W-OTW-OTL-L form record counts from a last-five array.
 * Wins/losses in overtime or shootout count as OTW/OTL; all others are regulation W/L.
 */
const buildFormRecord = (games: LastFiveGame[]) => {
  let w = 0,
    otw = 0,
    otl = 0,
    l = 0;
  for (const g of games) {
    const isExtra = (g.overtime_periods != null && g.overtime_periods > 0) || g.shootout;
    if (g.result === 'W') {
      isExtra ? otw++ : w++;
    } else if (g.result === 'L') {
      isExtra ? otl++ : l++;
    }
  }
  return { w, otw, otl, l };
};

// ── Component ─────────────────────────────────────────────────────────────────

const GameDetailsPage = () => {
  const { leagueId, seasonId, id } = useParams<{
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

    if (firstAttempts.length < bestOf || secondAttempts.length < bestOf) return false;

    const firstRegGoals = firstAttempts.slice(0, bestOf).filter((a) => a.scored).length;
    const secondRegGoals = secondAttempts.slice(0, bestOf).filter((a) => a.scored).length;

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

    if (firstAttempts.length < bestOf || secondAttempts.length < bestOf) return null;

    const firstRegGoals = firstAttempts.slice(0, bestOf).filter((a) => a.scored).length;
    const secondRegGoals = secondAttempts.slice(0, bestOf).filter((a) => a.scored).length;

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

  // ── Goal form state ───────────────────────────────────────────────────────
  const [goalPeriod, setGoalPeriod] = useState<string | null>(null);
  /** non-null when editing an existing goal; null when adding a new one */
  const [goalEditId, setGoalEditId] = useState<string | null>(null);
  const [goalTeam, setGoalTeam] = useState<'away' | 'home'>('away');
  const [goalPeriodTime, setGoalPeriodTime] = useState('');
  const [goalType, setGoalType] = useState('even-strength');
  const [goalEmptyNet, setGoalEmptyNet] = useState(false);
  const [goalScorerId, setGoalScorerId] = useState('');
  const [goalAssist1Id, setGoalAssist1Id] = useState('');
  const [goalAssist2Id, setGoalAssist2Id] = useState('');
  const [goalSubmitting, setGoalSubmitting] = useState(false);

  // ── Add / Edit Shootout Attempt modal ────────────────────────────────────
  /** null = closed; 'add' = adding new attempt; non-null string = editing attempt with that id */
  const [attemptModalMode, setAttemptModalMode] = useState<null | 'add' | string>(null);
  const [attemptTeam, setAttemptTeam] = useState<'away' | 'home'>('away');
  const [attemptShooterId, setAttemptShooterId] = useState('');
  const [attemptScored, setAttemptScored] = useState(false);
  const [attemptSubmitting, setAttemptSubmitting] = useState(false);

  const openAttemptModal = () => {
    if (!game) return;
    // Determine which team shoots next: alternates firstSide → secondSide → firstSide …
    // based on total recorded attempts (even index = firstSide, odd index = secondSide).
    const firstTeamId = game.shootout_first_team_id;
    const fSide: 'away' | 'home' =
      firstTeamId === game.away_team_id
        ? 'away'
        : firstTeamId === game.home_team_id
          ? 'home'
          : 'away';
    const nextSide: 'away' | 'home' =
      attempts.length % 2 === 0 ? fSide : fSide === 'away' ? 'home' : 'away';
    setAttemptTeam(nextSide);
    setAttemptModalMode('add');
    setAttemptShooterId('');
    setAttemptScored(false);
  };

  const openEditAttemptModal = (attempt: ShootoutAttempt) => {
    if (!game) return;
    setAttemptModalMode(attempt.id);
    setAttemptTeam(attempt.team_id === game.away_team_id ? 'away' : 'home');
    setAttemptShooterId(attempt.shooter_id);
    setAttemptScored(attempt.scored);
  };

  const closeAttemptModal = () => setAttemptModalMode(null);

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
  const [star1Id, setStar1Id] = useState('');
  const [star2Id, setStar2Id] = useState('');
  const [star3Id, setStar3Id] = useState('');

  // ── Shots edit modal (all periods at once, only for final games) ──────────
  type ShotsEditFormValues = { periods: Array<{ away_shots: string; home_shots: string }> };
  const [shotsEditModalOpen, setShotsEditModalOpen] = useState(false);
  const [shotsEditPeriodIds, setShotsEditPeriodIds] = useState<string[]>([]);
  const [shotsEditSubmitting, setShotsEditSubmitting] = useState(false);
  const {
    control: shotsEditControl,
    reset: resetShotsEditForm,
    getValues: getShotsEditFormValues,
  } = useForm<ShotsEditFormValues>({ defaultValues: { periods: [] } });
  const { fields: shotsEditFields } = useFieldArray({ control: shotsEditControl, name: 'periods' });

  const openShotsEditModal = () => {
    if (!game) return;
    const periods = linescorePeriods;
    resetShotsEditForm({
      periods: periods.map((p) => {
        const ps = game.period_shots.find((s) => s.period === p.id);
        return {
          away_shots: ps ? String(ps.away_shots) : '',
          home_shots: ps ? String(ps.home_shots) : '',
        };
      }),
    });
    setShotsEditPeriodIds(periods.map((p) => p.id));
    setShotsEditModalOpen(true);
  };

  const handleShotsEditConfirm = async () => {
    if (!game) return;
    const { periods } = getShotsEditFormValues();
    setShotsEditSubmitting(true);
    for (let i = 0; i < shotsEditPeriodIds.length; i++) {
      const periodId = shotsEditPeriodIds[i];
      const row = periods[i];
      if (!row) continue;
      const away = parseInt(row.away_shots, 10);
      const home = parseInt(row.home_shots, 10);
      if (!isNaN(away) && !isNaN(home)) {
        await updatePeriodShots(periodId, home, away);
      }
    }
    setShotsEditSubmitting(false);
    setShotsEditModalOpen(false);
  };

  // ── Start Game modal ──────────────────────────────────────────────────────
  const [startGameModalOpen, setStartGameModalOpen] = useState(false);
  const {
    control: startGameControl,
    handleSubmit: handleStartGameSubmit,
    reset: resetStartGameForm,
    formState: { isSubmitting: startGameSubmitting },
  } = useForm<{ start_time: string }>({ defaultValues: { start_time: '' } });

  const openStartGameModal = () => {
    resetStartGameForm({ start_time: '' });
    setStartGameModalOpen(true);
  };

  const onStartGameSubmit = handleStartGameSubmit(async (data) => {
    const ok = await startGame(etHHMMtoISO(data.start_time));
    if (ok) setStartGameModalOpen(false);
  });

  // ── Game Info edit modal ──────────────────────────────────────────────────
  const [gameInfoEditOpen, setGameInfoEditOpen] = useState(false);
  const {
    control: gameInfoControl,
    handleSubmit: handleGameInfoSubmit,
    reset: resetGameInfoForm,
    formState: { isSubmitting: gameInfoSubmitting },
  } = useForm<{
    venue: string;
    scheduled_date: string;
    scheduled_time: string;
    game_type: GameType;
    time_start: string;
    time_end: string;
  }>({
    defaultValues: {
      venue: '',
      scheduled_date: '',
      scheduled_time: '',
      game_type: 'regular',
      time_start: '',
      time_end: '',
    },
  });

  const openGameInfoEdit = () => {
    if (!game) return;
    resetGameInfoForm({
      venue: game.venue ?? '',
      scheduled_date: game.scheduled_at ? game.scheduled_at.slice(0, 10) : '',
      scheduled_time: game.scheduled_time ?? '',
      game_type: game.game_type,
      time_start: game.time_start ? isoToETHHMM(game.time_start) : '',
      time_end: game.time_end ? isoToETHHMM(game.time_end) : '',
    });
    setGameInfoEditOpen(true);
  };

  const onGameInfoSubmit = handleGameInfoSubmit(async (data) => {
    const ok = await updateGameInfo({
      venue: data.venue || null,
      scheduled_at: data.scheduled_date || null,
      scheduled_time: data.scheduled_time || null,
      game_type: data.game_type,
      time_start: data.time_start ? etHHMMtoISO(data.time_start) : null,
      time_end: data.time_end ? etHHMMtoISO(data.time_end) : null,
    });
    if (ok) setGameInfoEditOpen(false);
  });

  // ── Shots modal state ─────────────────────────────────────────────────────
  type ShotsNextAction =
    | { type: 'advance'; label: string; next: CurrentPeriod }
    | { type: 'end-game' };

  type ShotsModalFormValues = {
    away_shots: string;
    home_shots: string;
    end_time: string;
    goalies: Array<{ shots_against: string; saves: string }>;
  };

  const [shotsPeriod, setShotsPeriod] = useState<string | null>(null);
  const [shotsSubmitting, setShotsSubmitting] = useState(false);
  const [shotsNextAction, setShotsNextAction] = useState<ShotsNextAction | null>(null);
  const [shotsShowGoalies, setShotsShowGoalies] = useState(false);
  const [shotsShowShootsFirst, setShotsShowShootsFirst] = useState(false);
  /** Which team shoots first — 'away' | 'home' | null (only relevant when shotsShowShootsFirst) */
  const [soFirstTeam, setSoFirstTeam] = useState<'away' | 'home' | null>(null);
  // goalie player_ids in the same order as shotsGoalieFields for cross-referencing
  const [shotsGoalieIds, setShotsGoalieIds] = useState<string[]>([]);

  const {
    control: shotsControl,
    reset: resetShotsForm,
    getValues: getShotsFormValues,
    watch: watchShots,
  } = useForm<ShotsModalFormValues>({
    defaultValues: { away_shots: '', home_shots: '', end_time: '', goalies: [] },
  });
  const { fields: shotsGoalieFields } = useFieldArray({ control: shotsControl, name: 'goalies' });

  const openShotsModal = (
    period: string,
    nextAction: ShotsNextAction,
    showGoalies: boolean,
    showShootsFirst = false,
  ) => {
    if (!game) return;
    const existing = game.period_shots.find((ps) => ps.period === period);
    const goalies = showGoalies
      ? [...awayRoster, ...homeRoster].filter((e) => e.position === 'G')
      : [];
    resetShotsForm({
      away_shots: existing ? String(existing.away_shots) : '',
      home_shots: existing ? String(existing.home_shots) : '',
      end_time: '',
      goalies: goalies.map((g) => {
        const stat = goalieStats.find((gs) => gs.goalie_id === g.player_id);
        return {
          shots_against: stat ? String(stat.shots_against) : '',
          saves: stat ? String(stat.saves) : '',
        };
      }),
    });
    setShotsGoalieIds(goalies.map((g) => g.player_id));
    setShotsNextAction(nextAction);
    setShotsShowGoalies(showGoalies);
    setShotsShowShootsFirst(showShootsFirst);
    setSoFirstTeam(null);
    setShotsPeriod(period);
  };

  const handleShotsConfirm = async () => {
    if (!shotsPeriod || !shotsNextAction || !game) return;
    const { away_shots, home_shots, end_time, goalies: goalieFormValues } = getShotsFormValues();
    const isSOEndGame = shotsPeriod === 'SO' && shotsNextAction.type === 'end-game';
    setShotsSubmitting(true);
    // Skip shots save for SO end-game — the period has no shot counts
    if (!isSOEndGame) {
      const away = parseInt(away_shots, 10);
      const home = parseInt(home_shots, 10);
      if (isNaN(away) || isNaN(home)) {
        setShotsSubmitting(false);
        return;
      }
      const ok = await updatePeriodShots(shotsPeriod, home, away);
      if (!ok) {
        setShotsSubmitting(false);
        return;
      }
    }
    if (shotsShowGoalies) {
      const rosterGoalies = [...awayRoster, ...homeRoster].filter((e) => e.position === 'G');
      for (let i = 0; i < shotsGoalieIds.length; i++) {
        const goalieId = shotsGoalieIds[i];
        const formVal = goalieFormValues[i];
        if (!formVal) continue;
        const shots = parseInt(formVal.shots_against, 10);
        const saves = parseInt(formVal.saves, 10);
        if (!isNaN(shots) && !isNaN(saves)) {
          const entry = rosterGoalies.find((g) => g.player_id === goalieId);
          if (entry) {
            await upsertGoalieStat({
              goalie_id: goalieId,
              team_id: entry.team_id,
              shots_against: shots,
              saves,
            });
          }
        }
      }
    }
    // Save end time when ending the game
    if (shotsNextAction.type === 'end-game' && end_time) {
      await updateGameInfo({ time_end: etHHMMtoISO(end_time) });
    }
    // Save which team shoots first when advancing to the shootout
    if (shotsShowShootsFirst && soFirstTeam) {
      const firstTeamId = soFirstTeam === 'away' ? game.away_team_id : game.home_team_id;
      await updateGameInfo({ shootout_first_team_id: firstTeamId });
    }
    setShotsSubmitting(false);
    setShotsPeriod(null);
    if (shotsNextAction.type === 'advance') {
      advancePeriod(shotsNextAction.next);
    } else {
      setStar1Id('');
      setStar2Id('');
      setStar3Id('');
      setStarsEditMode(false);
      setEndGameReadyForStars(true);
      setStarsModalOpen(true);
    }
  };

  // ── Goalie stats modal state ───────────────────────────────────────────────
  type GoalieStatsFormValues = {
    goalies: Array<{ shots_against: string; saves: string }>;
  };

  const [goalieStatsModalOpen, setGoalieStatsModalOpen] = useState(false);
  const [goalieStatsGoalieIds, setGoalieStatsGoalieIds] = useState<string[]>([]);
  const [goalieStatsSubmitting, setGoalieStatsSubmitting] = useState(false);

  const {
    control: goalieStatsControl,
    reset: resetGoalieStatsForm,
    getValues: getGoalieStatsFormValues,
  } = useForm<GoalieStatsFormValues>({ defaultValues: { goalies: [] } });
  const { fields: goalieStatsFields } = useFieldArray({
    control: goalieStatsControl,
    name: 'goalies',
  });

  const openGoalieStatsModal = () => {
    if (!game) return;
    const allGoalies = [...awayRoster, ...homeRoster].filter((e) => e.position === 'G');
    resetGoalieStatsForm({
      goalies: allGoalies.map((g) => {
        const stat = goalieStats.find((gs) => gs.goalie_id === g.player_id);
        return {
          shots_against: stat ? String(stat.shots_against) : '',
          saves: stat ? String(stat.saves) : '',
        };
      }),
    });
    setGoalieStatsGoalieIds(allGoalies.map((g) => g.player_id));
    setGoalieStatsModalOpen(true);
  };

  const handleGoalieStatsConfirm = async () => {
    if (!game) return;
    const { goalies: goalieFormValues } = getGoalieStatsFormValues();
    const rosterGoalies = [...awayRoster, ...homeRoster].filter((e) => e.position === 'G');
    setGoalieStatsSubmitting(true);
    for (let i = 0; i < goalieStatsGoalieIds.length; i++) {
      const goalieId = goalieStatsGoalieIds[i];
      const formVal = goalieFormValues[i];
      if (!formVal) continue;
      const shots = parseInt(formVal.shots_against, 10);
      const saves = parseInt(formVal.saves, 10);
      if (!isNaN(shots) && !isNaN(saves)) {
        const entry = rosterGoalies.find((g) => g.player_id === goalieId);
        if (entry) {
          await upsertGoalieStat({
            goalie_id: goalieId,
            team_id: entry.team_id,
            shots_against: shots,
            saves,
          });
        }
      }
    }
    setGoalieStatsSubmitting(false);
    setGoalieStatsModalOpen(false);
  };

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

  const [autoFillBusy, setAutoFillBusy] = useState<{ away: boolean; home: boolean }>({
    away: false,
    home: false,
  });
  const [lineupInheritBusy, setLineupInheritBusy] = useState<{ away: boolean; home: boolean }>({
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

  // Both teams must have all 6 position slots covered (inherited entries from the
  // last game count — they represent a real lineup that can be used as-is).
  const lineupsReady = (() => {
    if (!game) return false;
    const SLOTS = ['C', 'LW', 'RW', 'D1', 'D2', 'G'] as const;
    const hasAll = (teamId: string) => {
      const entries = lineup.filter((e) => e.team_id === teamId);
      return SLOTS.every((slot) => entries.some((e) => e.position_slot === slot));
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

  const openGoalModal = (period: 1 | 2 | 3 | 'OT' | 'SO') => {
    setGoalEditId(null);
    setGoalPeriod(String(period));
    setGoalTeam('away');
    setGoalPeriodTime('');
    setGoalType('even-strength');
    setGoalEmptyNet(false);
    setGoalScorerId('');
    setGoalAssist1Id('');
    setGoalAssist2Id('');
  };

  const openEditGoalModal = (goal: GoalRecord) => {
    if (!game) return;
    setGoalEditId(goal.id);
    setGoalPeriod(goal.period);
    setGoalTeam(goal.team_id === game.away_team_id ? 'away' : 'home');
    setGoalPeriodTime(goal.period_time ?? '');
    // Legacy 'empty-net' goal_type → treat as even-strength + empty_net flag
    setGoalType(goal.goal_type === 'empty-net' ? 'even-strength' : goal.goal_type);
    setGoalEmptyNet(goal.empty_net || goal.goal_type === 'empty-net');
    setGoalScorerId(goal.scorer_id);
    setGoalAssist1Id(goal.assist_1_id ?? '');
    setGoalAssist2Id(goal.assist_2_id ?? '');
  };

  const closeGoalModal = () => {
    setGoalPeriod(null);
    setGoalEditId(null);
  };

  const handleTeamChange = (team: 'away' | 'home') => {
    setGoalTeam(team);
    setGoalScorerId('');
    setGoalAssist1Id('');
    setGoalAssist2Id('');
  };

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
      <Card
        className={styles.scoreboardCard}
        style={{ padding: 0 }}
      >
        <div className={styles.scoreboard}>
          {/* ── Away side ── */}
          <div
            className={[
              styles.teamSide,
              isFinal && liveAwayScore < liveHomeScore ? styles.teamSideLoser : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={
              {
                '--team-primary': game.away_team_primary_color,
                '--team-text': game.away_team_text_color,
              } as React.CSSProperties
            }
          >
            <div className={styles.teamStripe}>
              <div
                className={styles.teamStripePrimary}
                style={{ background: game.away_team_primary_color }}
              />
              <div
                className={styles.teamStripeSecondary}
                style={{ background: game.away_team_text_color }}
              />
              <div
                className={styles.teamStripeSecondary2}
                style={{ background: game.away_team_text_color }}
              />
            </div>
            <button
              type="button"
              className={styles.teamLogoBtn}
              onClick={() => navigate(`/admin/leagues/${leagueId}/teams/${game.away_team_id}`)}
            >
              {game.away_team_logo ? (
                <img
                  src={game.away_team_logo}
                  alt={game.away_team_code}
                  className={styles.teamLogo}
                />
              ) : (
                <span className={styles.teamLogoPlaceholder}>
                  {game.away_team_code.slice(0, 3)}
                </span>
              )}
              <div className={styles.teamInfo}>
                <span className={styles.teamFullName}>{game.away_team_name}</span>
                <span className={styles.teamSubInfo}>{game.away_team_code}</span>
              </div>
            </button>
            {/* Right stripe — stacked mode only, mirrors the left stripe */}
            <div className={`${styles.teamStripe} ${styles.teamStripeRight}`}>
              <div
                className={styles.teamStripePrimary}
                style={{ background: game.away_team_primary_color }}
              />
              <div
                className={styles.teamStripeSecondary}
                style={{ background: game.away_team_text_color }}
              />
              <div
                className={styles.teamStripeSecondary2}
                style={{ background: game.away_team_text_color }}
              />
            </div>
          </div>

          {/* ── Center: score + status ── */}
          <div className={styles.scoreCenter}>
            {(isFinal || isInProgress) && (
              <span
                className={[
                  styles.scoreNumber,
                  isFinal && liveAwayScore < liveHomeScore ? styles.scoreNumberLoser : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {liveAwayScore}
              </span>
            )}
            <div className={styles.scoreBlock}>
              {isFinal ? (
                <Badge
                  label={`Final${overtimeSuffix}`}
                  intent="success"
                />
              ) : (
                <Badge
                  label={STATUS_LABEL[game.status]}
                  intent={STATUS_INTENT[game.status]}
                />
              )}
              {game.scheduled_at && (
                <span className={styles.scoreDate}>
                  {DATE_FMT.format(new Date(game.scheduled_at))}
                </span>
              )}
            </div>
            {(isFinal || isInProgress) && (
              <span
                className={[
                  styles.scoreNumber,
                  isFinal && liveHomeScore < liveAwayScore ? styles.scoreNumberLoser : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {liveHomeScore}
              </span>
            )}
          </div>

          {/* ── Home side ── */}
          <div
            className={[
              styles.teamSide,
              styles.teamSideHome,
              isFinal && liveHomeScore < liveAwayScore ? styles.teamSideLoser : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={
              {
                '--team-primary': game.home_team_primary_color,
                '--team-text': game.home_team_text_color,
              } as React.CSSProperties
            }
          >
            <div className={`${styles.teamStripe} ${styles.teamStripeHome}`}>
              <div
                className={styles.teamStripePrimary}
                style={{ background: game.home_team_primary_color }}
              />
              <div
                className={styles.teamStripeSecondary}
                style={{ background: game.home_team_text_color }}
              />
              <div
                className={styles.teamStripeSecondary2}
                style={{ background: game.home_team_text_color }}
              />
            </div>
            <button
              type="button"
              className={`${styles.teamLogoBtn} ${styles.teamLogoBtnHome}`}
              onClick={() => navigate(`/admin/leagues/${leagueId}/teams/${game.home_team_id}`)}
            >
              <div className={`${styles.teamInfo} ${styles.teamInfoHome}`}>
                <span className={styles.teamFullName}>{game.home_team_name}</span>
                <span className={styles.teamSubInfo}>{game.home_team_code}</span>
              </div>
              {game.home_team_logo ? (
                <img
                  src={game.home_team_logo}
                  alt={game.home_team_code}
                  className={styles.teamLogo}
                />
              ) : (
                <span className={styles.teamLogoPlaceholder}>
                  {game.home_team_code.slice(0, 3)}
                </span>
              )}
            </button>
            {/* Right stripe — stacked mode only, mirrors the left stripe */}
            <div className={`${styles.teamStripe} ${styles.teamStripeRight}`}>
              <div
                className={styles.teamStripePrimary}
                style={{ background: game.home_team_primary_color }}
              />
              <div
                className={styles.teamStripeSecondary}
                style={{ background: game.home_team_text_color }}
              />
              <div
                className={styles.teamStripeSecondary2}
                style={{ background: game.home_team_text_color }}
              />
            </div>
          </div>
        </div>
      </Card>

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
                                    setStar1Id(game.star_1_id ?? '');
                                    setStar2Id(game.star_2_id ?? '');
                                    setStar3Id(game.star_3_id ?? '');
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
                                    <span className={styles.starName}>{nameLabel}</span>
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
                    <Card title="Scoring">
                      <div className={styles.periodList}>
                        {PERIODS.map(({ num, label, periodId }, idx) => {
                          const currentIdx = PERIOD_IDS.indexOf(
                            game.current_period as '1' | '2' | '3',
                          );
                          // currentIdx is -1 when current_period is 'OT' or 'SO' (not in PERIOD_IDS).
                          // In that case all regular periods are past, so mark them done.
                          const isPostRegulation =
                            game.current_period === 'OT' || game.current_period === 'SO';
                          const isActive = !isFinal && game.current_period === periodId;
                          const isDone = isFinal || isPostRegulation || currentIdx > idx;

                          return (
                            <Accordion
                              key={num}
                              variant="static"
                              className={isActive ? styles.periodItemActive : undefined}
                              label={<span className={styles.periodLabel}>{label}</span>}
                              hoverActions={
                                isActive
                                  ? ([
                                      {
                                        icon: 'sports_hockey',
                                        tooltip: 'Score Goal',
                                        intent: 'success' as const,
                                        disabled: !!busy,
                                        onClick: () => openGoalModal(num as 1 | 2 | 3),
                                      },
                                      num < 3
                                        ? {
                                            icon: 'flag',
                                            tooltip: 'End Period',
                                            intent: 'danger' as const,
                                            disabled: !!busy,
                                            onClick: () =>
                                              openShotsModal(
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
                                      num === 3
                                        ? {
                                            icon: 'more_time',
                                            tooltip: 'Go to Overtime',
                                            intent: 'accent' as const,
                                            disabled: !!busy,
                                            onClick: () =>
                                              openShotsModal(
                                                '3',
                                                {
                                                  type: 'advance',
                                                  label: 'Go to Overtime',
                                                  next: 'OT',
                                                },
                                                false,
                                              ),
                                          }
                                        : null,
                                      num === 3
                                        ? {
                                            icon: 'flag',
                                            tooltip: 'End Game',
                                            intent: 'danger' as const,
                                            disabled: !!busy,
                                            onClick: () =>
                                              openShotsModal('3', { type: 'end-game' }, true),
                                          }
                                        : null,
                                    ].filter(Boolean) as AccordionAction[])
                                  : undefined
                              }
                            >
                              {(() => {
                                const periodGoals = goals.filter((g) => g.period === periodId);
                                if (periodGoals.length === 0) {
                                  if (isActive || isDone) {
                                    return <p className={styles.noGoalsText}>No goals scored</p>;
                                  }
                                  return null;
                                }
                                return (
                                  <ul className={styles.goalList}>
                                    {periodGoals.map((goal) => {
                                      const tally = tallyByGoalId.get(goal.id);
                                      const scorerName =
                                        formatPlayerName(
                                          goal.scorer_first_name,
                                          goal.scorer_last_name,
                                        ) + (tally ? ` (${tally.scorerGoals})` : '');
                                      const assists = [
                                        goal.assist_1_id
                                          ? formatPlayerName(
                                              goal.assist_1_first_name,
                                              goal.assist_1_last_name,
                                            ) +
                                            (tally?.assist1Assists != null
                                              ? ` (${tally.assist1Assists})`
                                              : '')
                                          : null,
                                        goal.assist_2_id
                                          ? formatPlayerName(
                                              goal.assist_2_first_name,
                                              goal.assist_2_last_name,
                                            ) +
                                            (tally?.assist2Assists != null
                                              ? ` (${tally.assist2Assists})`
                                              : '')
                                          : null,
                                      ].filter(Boolean) as string[];
                                      const primaryBadge =
                                        goal.goal_type === 'empty-net'
                                          ? null
                                          : (GOAL_TYPE_BADGE[goal.goal_type] ?? null);
                                      const showEN =
                                        goal.empty_net || goal.goal_type === 'empty-net';
                                      return (
                                        <li
                                          key={goal.id}
                                          className={styles.goalItem}
                                        >
                                          {/* Time */}
                                          <span className={styles.goalTime}>
                                            {goal.period_time ?? '—'}
                                          </span>

                                          {/* Team logo */}
                                          {goal.team_logo ? (
                                            <img
                                              src={goal.team_logo}
                                              alt={goal.team_code}
                                              className={styles.goalTeamLogo}
                                            />
                                          ) : (
                                            <span
                                              className={styles.goalTeamLogoPlaceholder}
                                              style={{
                                                background: goal.team_primary_color,
                                                color: goal.team_text_color,
                                              }}
                                            >
                                              {goal.team_code?.slice(0, 1)}
                                            </span>
                                          )}

                                          {/* Scorer avatar */}
                                          {goal.scorer_photo ? (
                                            <img
                                              src={goal.scorer_photo}
                                              alt=""
                                              className={styles.goalScorerPhoto}
                                            />
                                          ) : (
                                            <span
                                              className={styles.goalScorerPhotoPlaceholder}
                                              style={{
                                                background: goal.team_primary_color,
                                                color: goal.team_text_color,
                                              }}
                                            >
                                              {goal.scorer_last_name?.charAt(0)}
                                            </span>
                                          )}

                                          {/* Name + assists */}
                                          <div className={styles.goalInfo}>
                                            <span className={styles.goalScorer}>{scorerName}</span>
                                            <span className={styles.goalAssists}>
                                              {assists.length > 0
                                                ? assists.join(', ')
                                                : 'Unassisted'}
                                            </span>
                                          </div>

                                          {/* Goal type badges */}
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

                                          {/* Edit / Delete goal — in-progress only */}
                                          {isInProgress && (
                                            <ActionOverlay className={styles.goalActions}>
                                              <Button
                                                variant="ghost"
                                                intent="neutral"
                                                icon="edit"
                                                size="sm"
                                                tooltip="Edit goal"
                                                onClick={() => openEditGoalModal(goal)}
                                              />
                                              <Button
                                                variant="ghost"
                                                intent="danger"
                                                icon="delete"
                                                size="sm"
                                                tooltip="Delete goal"
                                                onClick={() => deleteGoal(goal.id)}
                                              />
                                            </ActionOverlay>
                                          )}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                );
                              })()}
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
                            // OT is "done" when the game is final, or when play has advanced past OT into SO
                            const isOTDone = isFinal || game.current_period === 'SO';
                            const otGoals = goals.filter((g) => g.period === 'OT');
                            return (
                              <Accordion
                                variant="static"
                                className={isOTActive ? styles.periodItemActive : undefined}
                                label={<span className={styles.periodLabel}>Overtime</span>}
                                hoverActions={
                                  isOTActive
                                    ? ([
                                        {
                                          icon: 'sports_hockey',
                                          tooltip: 'Score Goal',
                                          intent: 'success' as const,
                                          disabled: !!busy,
                                          onClick: () => openGoalModal('OT'),
                                        },
                                        otGoals.length === 0
                                          ? {
                                              icon: 'flag',
                                              tooltip: 'Go to Shootouts',
                                              intent: 'info' as const,
                                              disabled: !!busy,
                                              onClick: () =>
                                                openShotsModal(
                                                  'OT',
                                                  {
                                                    type: 'advance',
                                                    label: 'Go to Shootouts',
                                                    next: 'SO',
                                                  },
                                                  false,
                                                  true, // showShootsFirst
                                                ),
                                            }
                                          : null,
                                        otGoals.length > 0
                                          ? {
                                              icon: 'flag',
                                              tooltip: 'End Game',
                                              intent: 'danger' as const,
                                              disabled: !!busy,
                                              onClick: () =>
                                                openShotsModal('OT', { type: 'end-game' }, true),
                                            }
                                          : null,
                                      ].filter(Boolean) as AccordionAction[])
                                    : undefined
                                }
                              >
                                {(() => {
                                  if (otGoals.length === 0) {
                                    if (isOTActive || isOTDone) {
                                      return <p className={styles.noGoalsText}>No goals scored</p>;
                                    }
                                    return null;
                                  }
                                  return (
                                    <ul className={styles.goalList}>
                                      {otGoals.map((goal) => {
                                        const tally = tallyByGoalId.get(goal.id);
                                        const scorerName =
                                          formatPlayerName(
                                            goal.scorer_first_name,
                                            goal.scorer_last_name,
                                          ) + (tally ? ` (${tally.scorerGoals})` : '');
                                        const assists = [
                                          goal.assist_1_id
                                            ? formatPlayerName(
                                                goal.assist_1_first_name,
                                                goal.assist_1_last_name,
                                              ) +
                                              (tally?.assist1Assists != null
                                                ? ` (${tally.assist1Assists})`
                                                : '')
                                            : null,
                                          goal.assist_2_id
                                            ? formatPlayerName(
                                                goal.assist_2_first_name,
                                                goal.assist_2_last_name,
                                              ) +
                                              (tally?.assist2Assists != null
                                                ? ` (${tally.assist2Assists})`
                                                : '')
                                            : null,
                                        ].filter(Boolean) as string[];
                                        const primaryBadge =
                                          goal.goal_type === 'empty-net'
                                            ? null
                                            : (GOAL_TYPE_BADGE[goal.goal_type] ?? null);
                                        const showEN =
                                          goal.empty_net || goal.goal_type === 'empty-net';
                                        return (
                                          <li
                                            key={goal.id}
                                            className={styles.goalItem}
                                          >
                                            <span className={styles.goalTime}>
                                              {goal.period_time ?? '—'}
                                            </span>
                                            {goal.team_logo ? (
                                              <img
                                                src={goal.team_logo}
                                                alt={goal.team_code}
                                                className={styles.goalTeamLogo}
                                              />
                                            ) : (
                                              <span
                                                className={styles.goalTeamLogoPlaceholder}
                                                style={{
                                                  background: goal.team_primary_color,
                                                  color: goal.team_text_color,
                                                }}
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
                                                style={{
                                                  background: goal.team_primary_color,
                                                  color: goal.team_text_color,
                                                }}
                                              >
                                                {goal.scorer_last_name?.charAt(0)}
                                              </span>
                                            )}
                                            <div className={styles.goalInfo}>
                                              <span className={styles.goalScorer}>
                                                {scorerName}
                                              </span>
                                              <span className={styles.goalAssists}>
                                                {assists.length > 0
                                                  ? assists.join(', ')
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

                                            {/* Edit / Delete goal — in-progress only */}
                                            {isInProgress && (
                                              <ActionOverlay className={styles.goalActions}>
                                                <Button
                                                  variant="ghost"
                                                  intent="neutral"
                                                  icon="edit"
                                                  size="sm"
                                                  tooltip="Edit goal"
                                                  onClick={() => openEditGoalModal(goal)}
                                                />
                                                <Button
                                                  variant="ghost"
                                                  intent="danger"
                                                  icon="delete"
                                                  size="sm"
                                                  tooltip="Delete goal"
                                                  onClick={() => deleteGoal(goal.id)}
                                                />
                                              </ActionOverlay>
                                            )}
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  );
                                })()}
                              </Accordion>
                            );
                          })()}

                        {/* ── Shootouts accordion ── */}
                        {(game.current_period === 'SO' ||
                          goals.some((g) => g.period === 'SO') ||
                          (isFinal && game.shootout)) &&
                          (() => {
                            const isSOActive = !isFinal && game.current_period === 'SO';
                            const isSODone = isFinal;

                            // Determine column order: first team is the one that shot first
                            const firstTeamId = game.shootout_first_team_id;
                            const firstSide =
                              firstTeamId === game.away_team_id
                                ? 'away'
                                : firstTeamId === game.home_team_id
                                  ? 'home'
                                  : 'away'; // default to away if not set
                            const secondSide = firstSide === 'away' ? 'home' : 'away';
                            const firstTeamAttempts = attempts.filter(
                              (a) =>
                                a.team_id ===
                                (firstSide === 'away' ? game.away_team_id : game.home_team_id),
                            );
                            const secondTeamAttempts = attempts.filter(
                              (a) =>
                                a.team_id ===
                                (secondSide === 'away' ? game.away_team_id : game.home_team_id),
                            );
                            const bestOf = game.best_of_shootout ?? 3;

                            // Goals scored during the regulation rounds only (first bestOf per team)
                            const firstRegGoals = firstTeamAttempts
                              .slice(0, bestOf)
                              .filter((a) => a.scored).length;
                            const secondRegGoals = secondTeamAttempts
                              .slice(0, bestOf)
                              .filter((a) => a.scored).length;

                            // Sudden-death extension: when regulation is complete and tied,
                            // keep adding rows one SD round at a time until one team wins a round.
                            const regulationComplete =
                              firstTeamAttempts.length >= bestOf &&
                              secondTeamAttempts.length >= bestOf;
                            const tiedAfterRegulation =
                              regulationComplete && firstRegGoals === secondRegGoals;

                            let sdExtraRounds = 0;
                            if (tiedAfterRegulation) {
                              let sdRound = 0;

                              while (true) {
                                const sdFirst = firstTeamAttempts[bestOf + sdRound];
                                const sdSecond = secondTeamAttempts[bestOf + sdRound];
                                if (!sdFirst && !sdSecond) {
                                  // Neither team has taken this SD round yet — show one blank row
                                  sdExtraRounds = sdRound + 1;
                                  break;
                                }
                                if (!sdFirst || !sdSecond) {
                                  // Round is partially recorded; maxRecorded covers the row
                                  break;
                                }
                                // Both teams have shot this SD round
                                if (sdFirst.scored !== sdSecond.scored) {
                                  // One scored, the other missed — SD winner found, no more rows
                                  break;
                                }
                                // Both scored or both missed — advance to the next SD round
                                sdRound++;
                              }
                            }

                            const roundCount = Math.max(
                              bestOf + sdExtraRounds,
                              firstTeamAttempts.length,
                              secondTeamAttempts.length,
                            );

                            const firstTeamInfo = {
                              code:
                                firstSide === 'away' ? game.away_team_code : game.home_team_code,
                              logo:
                                firstSide === 'away' ? game.away_team_logo : game.home_team_logo,
                              primary:
                                firstSide === 'away'
                                  ? game.away_team_primary_color
                                  : game.home_team_primary_color,
                              text:
                                firstSide === 'away'
                                  ? game.away_team_text_color
                                  : game.home_team_text_color,
                            };
                            const secondTeamInfo = {
                              code:
                                secondSide === 'away' ? game.away_team_code : game.home_team_code,
                              logo:
                                secondSide === 'away' ? game.away_team_logo : game.home_team_logo,
                              primary:
                                secondSide === 'away'
                                  ? game.away_team_primary_color
                                  : game.home_team_primary_color,
                              text:
                                secondSide === 'away'
                                  ? game.away_team_text_color
                                  : game.home_team_text_color,
                            };

                            const renderAttemptCell = (
                              attempt: ShootoutAttempt | undefined,
                              teamInfo: typeof firstTeamInfo,
                              side: 'away' | 'home',
                            ) => {
                              const isAway = side === 'away';
                              if (!attempt) {
                                return <div className={styles.soAttemptCellEmpty}>—</div>;
                              }
                              const shooterName = formatPlayerName(
                                attempt.shooter_first_name,
                                attempt.shooter_last_name,
                              );
                              const jerseyLabel =
                                attempt.shooter_jersey_number != null
                                  ? `#${attempt.shooter_jersey_number}`
                                  : null;

                              const resultBadge = (
                                <span
                                  className={[
                                    styles.soResultBadge,
                                    attempt.scored
                                      ? styles.soResultBadgeScored
                                      : styles.soResultBadgeMissed,
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
                                  style={{
                                    background: teamInfo.primary,
                                    color: teamInfo.text,
                                  }}
                                >
                                  {attempt.shooter_last_name?.charAt(0)}
                                </span>
                              );

                              const playerInfo = (
                                <div
                                  className={[
                                    styles.soAttemptPlayerInfo,
                                    !isAway ? styles.soAttemptPlayerInfoAway : '',
                                  ]
                                    .filter(Boolean)
                                    .join(' ')}
                                >
                                  {jerseyLabel && (
                                    <span className={styles.soAttemptJersey}>{jerseyLabel}</span>
                                  )}
                                  <span className={styles.soAttemptName}>{shooterName}</span>
                                </div>
                              );

                              return (
                                <div
                                  className={[
                                    styles.soAttemptCell,
                                    !isAway ? styles.soAttemptCellAway : '',
                                    attempt.scored
                                      ? styles.soAttemptCellScored
                                      : styles.soAttemptCellMissed,
                                  ]
                                    .filter(Boolean)
                                    .join(' ')}
                                >
                                  {isAway ? (
                                    // Away: [photo] [playerInfo] [badge]
                                    <>
                                      {photo}
                                      {playerInfo}
                                      {resultBadge}
                                    </>
                                  ) : (
                                    // Home: [badge] [playerInfo right-aligned] [photo]
                                    <>
                                      {resultBadge}
                                      {playerInfo}
                                      {photo}
                                    </>
                                  )}
                                  {isInProgress && (
                                    <ActionOverlay className={styles.goalActions}>
                                      <Button
                                        variant="ghost"
                                        intent="neutral"
                                        icon="edit"
                                        size="sm"
                                        tooltip="Edit attempt"
                                        onClick={() => openEditAttemptModal(attempt)}
                                      />
                                      <Button
                                        variant="ghost"
                                        intent="danger"
                                        icon="delete"
                                        size="sm"
                                        tooltip="Delete attempt"
                                        onClick={() => deleteAttempt(attempt.id)}
                                      />
                                    </ActionOverlay>
                                  )}
                                </div>
                              );
                            };

                            return (
                              <Accordion
                                variant="static"
                                className={isSOActive ? styles.periodItemActive : undefined}
                                label={<span className={styles.periodLabel}>Shootout</span>}
                                hoverActions={
                                  isSOActive
                                    ? ([
                                        !soComplete
                                          ? {
                                              icon: 'sports_hockey',
                                              tooltip: 'Add Attempt',
                                              intent: 'success' as const,
                                              disabled: !!busy,
                                              onClick: openAttemptModal,
                                            }
                                          : null,
                                        soComplete
                                          ? {
                                              icon: 'flag',
                                              tooltip: 'End Game',
                                              intent: 'danger' as const,
                                              disabled: !!busy,
                                              onClick: () =>
                                                openShotsModal('SO', { type: 'end-game' }, true),
                                            }
                                          : null,
                                      ].filter(Boolean) as AccordionAction[])
                                    : undefined
                                }
                              >
                                {(isSOActive || isSODone) && (
                                  <div className={styles.soAttemptGrid}>
                                    {/* Header row */}
                                    <div className={styles.soAttemptHeaderRow}>
                                      <div
                                        className={[
                                          styles.soAttemptColHeader,
                                          firstSide === 'home' ? styles.soAttemptColHeaderAway : '',
                                        ]
                                          .filter(Boolean)
                                          .join(' ')}
                                      >
                                        {firstTeamInfo.logo ? (
                                          <img
                                            src={firstTeamInfo.logo}
                                            alt={firstTeamInfo.code}
                                            className={styles.soAttemptColLogo}
                                          />
                                        ) : (
                                          <span
                                            className={styles.soAttemptColLogoPlaceholder}
                                            style={{
                                              background: firstTeamInfo.primary,
                                              color: firstTeamInfo.text,
                                            }}
                                          >
                                            {firstTeamInfo.code.slice(0, 1)}
                                          </span>
                                        )}
                                        <span>{firstTeamInfo.code}</span>
                                      </div>
                                      <div
                                        className={[
                                          styles.soAttemptColHeader,
                                          secondSide === 'home'
                                            ? styles.soAttemptColHeaderAway
                                            : '',
                                        ]
                                          .filter(Boolean)
                                          .join(' ')}
                                      >
                                        {secondTeamInfo.logo ? (
                                          <img
                                            src={secondTeamInfo.logo}
                                            alt={secondTeamInfo.code}
                                            className={styles.soAttemptColLogo}
                                          />
                                        ) : (
                                          <span
                                            className={styles.soAttemptColLogoPlaceholder}
                                            style={{
                                              background: secondTeamInfo.primary,
                                              color: secondTeamInfo.text,
                                            }}
                                          >
                                            {secondTeamInfo.code.slice(0, 1)}
                                          </span>
                                        )}
                                        <span>{secondTeamInfo.code}</span>
                                      </div>
                                    </div>
                                    {/* Round rows — always renders best_of_shootout rows, with empty cells for unplayed rounds */}
                                    {Array.from({ length: roundCount }, (_, i) => (
                                      <div
                                        key={i}
                                        className={styles.soAttemptRow}
                                      >
                                        {renderAttemptCell(
                                          firstTeamAttempts[i],
                                          firstTeamInfo,
                                          firstSide,
                                        )}
                                        {renderAttemptCell(
                                          secondTeamAttempts[i],
                                          secondTeamInfo,
                                          secondSide,
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </Accordion>
                            );
                          })()}
                      </div>
                    </Card>

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
                                  onClick={openGoalieStatsModal}
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
                                  return (
                                    <tr
                                      key={goalie.player_id}
                                      className={styles.goalieRow}
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
                          </Accordion>
                        );

                        return (
                          <Card title="Last 5 Games">
                            <div className={styles.lastFiveList}>
                              {renderTeamAccordion(
                                game.away_team_name,
                                game.away_team_logo,
                                game.away_team_code,
                                game.away_team_primary_color,
                                game.away_team_text_color,
                                awayGames,
                              )}
                              {renderTeamAccordion(
                                game.home_team_name,
                                game.home_team_logo,
                                game.home_team_code,
                                game.home_team_primary_color,
                                game.home_team_text_color,
                                homeGames,
                              )}
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
                                ]}
                              />
                            </>
                          )}
                          {isInProgress &&
                            ['3', 'OT', 'SO'].includes(game.current_period ?? '') &&
                            (game.current_period !== 'SO' || soComplete) && (
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
                                  const rawGoals =
                                    row.teamId === game.away_team_id
                                      ? ps?.away_goals
                                      : ps?.home_goals;
                                  // SO winner gets 1, loser gets 0. The winner is derived from
                                  // attempts because no goal row is written to the goals table for SO.
                                  // This applies for both in-progress and final states.
                                  let goals: number | string = rawGoals ?? (isPeriodDone ? 0 : '—');
                                  if (p.id === 'SO' && soWinnerSide && !ps) {
                                    goals =
                                      (row.teamId === game.away_team_id) ===
                                      (soWinnerSide === 'away')
                                        ? 1
                                        : 0;
                                  }
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
                              onClick={openShotsEditModal}
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
            label: 'Lineup',
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
                    </span>
                  }
                  hoverActions={
                    isFinal
                      ? undefined
                      : [
                          {
                            icon: 'set_lineup',
                            tooltip: 'Set Starting Lineup',
                            intent: 'info' as const,
                            onClick: () => setLineupSetTeam(side),
                          },
                          ...(inheritedLineupMap.size > 0 && lineupMap.size === 0
                            ? [
                                {
                                  icon: 'history',
                                  tooltip: "Use Last Game's Lineup",
                                  intent: 'accent' as const,
                                  disabled: lineupInheritBusy[side],
                                  onClick: () => {
                                    const teamId =
                                      side === 'away' ? game.away_team_id : game.home_team_id;
                                    const slots = Array.from(inheritedLineupMap.values()).map(
                                      (e) => ({
                                        position_slot: e.position_slot,
                                        player_id: e.player_id,
                                      }),
                                    );
                                    setLineupInheritBusy((prev) => ({ ...prev, [side]: true }));
                                    saveTeamLineup(teamId, slots).finally(() =>
                                      setLineupInheritBusy((prev) => ({ ...prev, [side]: false })),
                                    );
                                  },
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
                        const jerseyPart = e.jersey_number != null ? `#${e.jersey_number}` : null;
                        const positionPart = e.position
                          ? (POSITION_LABEL[e.position] ?? e.position)
                          : null;
                        const eyebrow =
                          [jerseyPart, positionPart].filter(Boolean).join(' · ') || undefined;
                        return (
                          <ListItem
                            key={e.id}
                            image={e.photo}
                            image_shape="circle"
                            primaryColor={primaryColor}
                            textColor={textColor}
                            eyebrow={eyebrow}
                            name={`${e.last_name}, ${e.first_name}`}
                            placeholder={`${e.first_name[0]}${e.last_name[0]}`}
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
                  ) : inheritedEntries.length > 0 ? (
                    <div className={styles.autoFillBanner}>
                      <p className={styles.autoFillBannerText}>
                        {inheritedEntries.length} players available from last game's lineup
                      </p>
                      <Button
                        intent="accent"
                        icon="group_add"
                        size="sm"
                        disabled={autoFillBusy[side]}
                        onClick={async () => {
                          const teamId = side === 'away' ? game.away_team_id : game.home_team_id;
                          setAutoFillBusy((prev) => ({ ...prev, [side]: true }));
                          await addToRoster(
                            teamId,
                            inheritedEntries.map((e) => e.player_id),
                          );
                          setAutoFillBusy((prev) => ({ ...prev, [side]: false }));
                        }}
                      >
                        Auto-fill from last game
                      </Button>
                    </div>
                  ) : (
                    <p className={styles.noGoalsText}>No players in lineup yet.</p>
                  )}
                </Accordion>
              );

              return (
                <div className={styles.tabContent}>
                  <Card title="Lineup">
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
      {(() => {
        const teamRoster = goalTeam === 'away' ? awayRoster : homeRoster;
        const playerOptions = teamRoster.map((e) => ({
          value: e.player_id,
          label:
            e.jersey_number != null
              ? `#${e.jersey_number} ${e.first_name} ${e.last_name}`
              : `${e.first_name} ${e.last_name}`,
        }));

        return (
          <Modal
            open={goalPeriod !== null}
            title={goalEditId ? 'Edit Goal' : 'Score Goal'}
            onClose={closeGoalModal}
            confirmLabel={goalSubmitting ? 'Saving…' : goalEditId ? 'Save Changes' : 'Record Goal'}
            confirmDisabled={!!busy || goalSubmitting || !goalScorerId}
            busy={goalSubmitting}
            onConfirm={async () => {
              if (!goalPeriod || !game) return;
              const teamId = goalTeam === 'away' ? game.away_team_id : game.home_team_id;
              const periodTime = goalPeriodTime || '00:00';
              setGoalSubmitting(true);
              try {
                const payload = {
                  team_id: teamId,
                  period: goalPeriod,
                  goal_type: goalType,
                  empty_net: goalEmptyNet,
                  period_time: periodTime,
                  scorer_id: goalScorerId,
                  assist_1_id: goalAssist1Id || null,
                  assist_2_id: goalAssist2Id || null,
                };
                if (goalEditId) {
                  await updateGoal(goalEditId, payload);
                } else {
                  await addGoal(payload);
                }
                closeGoalModal();
              } finally {
                setGoalSubmitting(false);
              }
            }}
          >
            <div className={styles.goalForm}>
              {/* Team segmented control */}
              <div className={styles.teamSegment}>
                <button
                  type="button"
                  className={[
                    styles.teamSegmentBtn,
                    goalTeam === 'away' ? styles.teamSegmentBtnActive : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={goalSubmitting}
                  onClick={() => handleTeamChange('away')}
                >
                  {game.away_team_logo ? (
                    <img
                      src={game.away_team_logo}
                      alt={game.away_team_code}
                      className={styles.teamSegmentLogo}
                    />
                  ) : (
                    <span
                      className={styles.teamSegmentLogoPlaceholder}
                      style={{
                        background: game.away_team_primary_color,
                        color: game.away_team_text_color,
                      }}
                    >
                      {game.away_team_code.slice(0, 1)}
                    </span>
                  )}
                  {game.away_team_code}
                </button>
                <button
                  type="button"
                  className={[
                    styles.teamSegmentBtn,
                    goalTeam === 'home' ? styles.teamSegmentBtnActive : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={goalSubmitting}
                  onClick={() => handleTeamChange('home')}
                >
                  {game.home_team_logo ? (
                    <img
                      src={game.home_team_logo}
                      alt={game.home_team_code}
                      className={styles.teamSegmentLogo}
                    />
                  ) : (
                    <span
                      className={styles.teamSegmentLogoPlaceholder}
                      style={{
                        background: game.home_team_primary_color,
                        color: game.home_team_text_color,
                      }}
                    >
                      {game.home_team_code.slice(0, 1)}
                    </span>
                  )}
                  {game.home_team_code}
                </button>
              </div>

              {/* Period time + Goal type row */}
              <div className={styles.goalFormTimeRow}>
                {/* Period time — MM:SS duration picker */}
                <div className={`${styles.goalFormField} ${styles.goalPeriodTimeField}`}>
                  <label className={styles.goalFormLabel}>
                    Period Time <span className={styles.required}>*</span>
                  </label>
                  <TimePicker
                    mode="duration"
                    value={goalPeriodTime}
                    onChange={setGoalPeriodTime}
                    disabled={goalSubmitting}
                    autoFocus
                  />
                </div>

                {/* Goal type */}
                <div className={`${styles.goalFormField} ${styles.goalTypeField}`}>
                  <label className={styles.goalFormLabel}>Goal Type</label>
                  <Select
                    value={goalType}
                    options={GOAL_TYPES}
                    onChange={setGoalType}
                    disabled={goalSubmitting}
                  />
                </div>

                {/* Empty Net toggle — hidden for penalty shot / own goal */}
                {goalType !== 'penalty-shot' && goalType !== 'own' && (
                  <div className={styles.goalFormField}>
                    <label className={styles.goalFormLabel}>EN</label>
                    <button
                      type="button"
                      className={[
                        styles.emptyNetToggle,
                        goalEmptyNet ? styles.emptyNetToggleOn : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => setGoalEmptyNet((v) => !v)}
                      disabled={goalSubmitting}
                      title="Empty Net"
                    >
                      <Icon
                        name={goalEmptyNet ? 'check_box' : 'check_box_outline_blank'}
                        size="1.25rem"
                      />
                    </button>
                  </div>
                )}
              </div>

              {/* Scorer */}
              <div className={styles.goalFormField}>
                <label className={styles.goalFormLabel}>
                  Scorer <span className={styles.required}>*</span>
                </label>
                <Select
                  value={goalScorerId || null}
                  options={playerOptions}
                  placeholder="— Select scorer —"
                  onChange={setGoalScorerId}
                  searchable
                  disabled={goalSubmitting}
                />
              </div>

              {/* Assists row */}
              <div className={styles.goalFormRow}>
                <div className={styles.goalFormField}>
                  <label className={styles.goalFormLabel}>1st Assist</label>
                  <Select
                    value={goalAssist1Id || null}
                    options={playerOptions}
                    placeholder="— Optional —"
                    onChange={setGoalAssist1Id}
                    searchable
                    disabled={goalSubmitting}
                  />
                </div>
                <div className={styles.goalFormField}>
                  <label className={styles.goalFormLabel}>2nd Assist</label>
                  <Select
                    value={goalAssist2Id || null}
                    options={playerOptions}
                    placeholder="— Optional —"
                    onChange={setGoalAssist2Id}
                    searchable
                    disabled={goalSubmitting}
                  />
                </div>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* ── Add / Edit Shootout Attempt ── */}
      {(() => {
        if (!game) return null;
        const isEditMode = attemptModalMode !== null && attemptModalMode !== 'add';
        const attemptRoster =
          attemptTeam === 'away'
            ? awayRoster.filter((e) => e.position !== 'G')
            : homeRoster.filter((e) => e.position !== 'G');
        const shooterOptions = attemptRoster.map((e) => ({
          value: e.player_id,
          label:
            e.jersey_number != null
              ? `#${e.jersey_number} ${e.first_name} ${e.last_name}`
              : `${e.first_name} ${e.last_name}`,
        }));
        const attemptTeamName = attemptTeam === 'away' ? game.away_team_name : game.home_team_name;
        return (
          <Modal
            open={attemptModalMode !== null}
            title={isEditMode ? 'Edit Attempt' : `Add Attempt — ${attemptTeamName}`}
            onClose={closeAttemptModal}
            confirmLabel={
              attemptSubmitting ? 'Saving…' : isEditMode ? 'Save Changes' : 'Record Attempt'
            }
            confirmDisabled={!!busy || attemptSubmitting || !attemptShooterId}
            busy={attemptSubmitting}
            onConfirm={async () => {
              if (!game) return;
              setAttemptSubmitting(true);
              try {
                const teamId = attemptTeam === 'away' ? game.away_team_id : game.home_team_id;
                if (isEditMode) {
                  await updateAttempt(attemptModalMode as string, {
                    team_id: teamId,
                    shooter_id: attemptShooterId,
                    scored: attemptScored,
                  });
                } else {
                  await addAttempt({
                    team_id: teamId,
                    shooter_id: attemptShooterId,
                    scored: attemptScored,
                  });
                }
                closeAttemptModal();
              } finally {
                setAttemptSubmitting(false);
              }
            }}
          >
            <div className={styles.goalForm}>
              {/* In edit mode show team selector; in add mode team is auto-determined */}
              {isEditMode && (
                <div className={styles.teamSegment}>
                  <button
                    type="button"
                    className={[
                      styles.teamSegmentBtn,
                      attemptTeam === 'away' ? styles.teamSegmentBtnActive : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    disabled={attemptSubmitting}
                    onClick={() => {
                      setAttemptTeam('away');
                      setAttemptShooterId('');
                    }}
                  >
                    {game.away_team_logo ? (
                      <img
                        src={game.away_team_logo}
                        alt={game.away_team_code}
                        className={styles.teamSegmentLogo}
                      />
                    ) : (
                      <span
                        className={styles.teamSegmentLogoPlaceholder}
                        style={{
                          background: game.away_team_primary_color,
                          color: game.away_team_text_color,
                        }}
                      >
                        {game.away_team_code.slice(0, 1)}
                      </span>
                    )}
                    {game.away_team_code}
                  </button>
                  <button
                    type="button"
                    className={[
                      styles.teamSegmentBtn,
                      attemptTeam === 'home' ? styles.teamSegmentBtnActive : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    disabled={attemptSubmitting}
                    onClick={() => {
                      setAttemptTeam('home');
                      setAttemptShooterId('');
                    }}
                  >
                    {game.home_team_logo ? (
                      <img
                        src={game.home_team_logo}
                        alt={game.home_team_code}
                        className={styles.teamSegmentLogo}
                      />
                    ) : (
                      <span
                        className={styles.teamSegmentLogoPlaceholder}
                        style={{
                          background: game.home_team_primary_color,
                          color: game.home_team_text_color,
                        }}
                      >
                        {game.home_team_code.slice(0, 1)}
                      </span>
                    )}
                    {game.home_team_code}
                  </button>
                </div>
              )}

              {/* Shooter */}
              <div className={styles.goalFormField}>
                <label className={styles.goalFormLabel}>
                  Shooter <span className={styles.required}>*</span>
                </label>
                <Select
                  options={shooterOptions}
                  value={attemptShooterId}
                  onChange={setAttemptShooterId}
                  placeholder="Select shooter…"
                  searchable
                  disabled={attemptSubmitting}
                />
              </div>

              {/* Scored toggle */}
              <div className={styles.goalFormField}>
                <label className={styles.goalFormLabel}>Result</label>
                <div className={styles.teamSegment}>
                  <button
                    type="button"
                    className={[
                      styles.teamSegmentBtn,
                      !attemptScored ? styles.teamSegmentBtnActive : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    disabled={attemptSubmitting}
                    onClick={() => setAttemptScored(false)}
                  >
                    <Icon
                      name="cancel"
                      size="1rem"
                    />
                    Miss
                  </button>
                  <button
                    type="button"
                    className={[
                      styles.teamSegmentBtn,
                      attemptScored ? styles.teamSegmentBtnActive : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    disabled={attemptSubmitting}
                    onClick={() => setAttemptScored(true)}
                  >
                    <Icon
                      name="check_circle"
                      size="1rem"
                    />
                    Goal
                  </button>
                </div>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* ── Lineup: Add from Roster ── */}
      {lineupAddTeam !== null && game && (
        <LineupRosterModal
          open={lineupAddTeam !== null}
          onClose={() => setLineupAddTeam(null)}
          teamId={lineupAddTeam === 'away' ? game.away_team_id : game.home_team_id}
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
      <ConfirmModal
        open={!!confirmRemove}
        title="Remove from Lineup"
        body={
          confirmRemove ? (
            <>
              Remove{' '}
              <strong>
                {confirmRemove.entry.first_name} {confirmRemove.entry.last_name}
              </strong>{' '}
              from this game&apos;s lineup?
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Remove"
        confirmIcon="person_remove"
        variant="danger"
        busy={removingFromRoster}
        onConfirm={handleConfirmRemove}
        onCancel={() => setConfirmRemove(null)}
      />

      {/* ── Start Game modal ── */}
      <Modal
        open={startGameModalOpen}
        title="Start Game"
        onClose={() => setStartGameModalOpen(false)}
        confirmLabel={startGameSubmitting || busy === 'in_progress' ? 'Starting…' : 'Start Game'}
        confirmIcon="play_arrow"
        confirmIntent="success"
        confirmForm="start-game-form"
        confirmDisabled={startGameSubmitting || !!busy}
        busy={startGameSubmitting || busy === 'in_progress'}
      >
        <form
          id="start-game-form"
          className={styles.goalForm}
          onSubmit={onStartGameSubmit}
        >
          <Field
            label="Start Time"
            type="timepicker"
            control={startGameControl}
            name="start_time"
            placeholder="Select time…"
            autoFocus
          />
        </form>
      </Modal>

      {/* ── Game Info edit modal ── */}
      <Modal
        open={gameInfoEditOpen}
        title="Edit Game Info"
        onClose={() => setGameInfoEditOpen(false)}
        confirmLabel={gameInfoSubmitting || busy === 'update-info' ? 'Saving…' : 'Save'}
        confirmForm="game-info-edit-form"
        confirmDisabled={gameInfoSubmitting || !!busy}
        busy={gameInfoSubmitting || busy === 'update-info'}
      >
        <form
          id="game-info-edit-form"
          className={styles.formGrid}
          onSubmit={onGameInfoSubmit}
        >
          {/* Row 1 — Game Type (full width) */}
          <div className={styles.formFieldFull}>
            <Field
              label="Game Type"
              type="select"
              control={gameInfoControl}
              name="game_type"
              options={GAME_TYPE_OPTIONS}
              disabled={gameInfoSubmitting}
            />
          </div>
          {/* Row 2 — Date | Scheduled Time */}
          <Field
            label="Date"
            type="datepicker"
            control={gameInfoControl}
            name="scheduled_date"
            placeholder="Select date…"
            autoFocus
          />
          <Field
            label="Scheduled Time"
            type="timepicker"
            control={gameInfoControl}
            name="scheduled_time"
          />
          {/* Row 3 — Start Time | End Time */}
          <Field
            label="Start Time"
            type="timepicker"
            control={gameInfoControl}
            name="time_start"
            disabled={gameInfoSubmitting || game.status === 'scheduled'}
          />
          <Field
            label="End Time"
            type="timepicker"
            control={gameInfoControl}
            name="time_end"
            disabled={gameInfoSubmitting || game.status !== 'final'}
          />
          {/* Row 4 — Venue (full width) */}
          <div className={styles.formFieldFull}>
            <Field
              label="Venue"
              control={gameInfoControl}
              name="venue"
              placeholder="e.g. Scotiabank Arena"
              disabled={gameInfoSubmitting}
            />
          </div>
        </form>
      </Modal>

      {/* ── 3 Stars modal ── */}
      {(() => {
        const allPlayerOptions = roster.map((e) => ({
          value: e.player_id,
          label:
            e.jersey_number != null
              ? `#${e.jersey_number} ${e.first_name} ${e.last_name}`
              : `${e.first_name} ${e.last_name}`,
        }));
        const canConfirm = !!star1Id && !!star2Id && !!star3Id;
        return (
          <Modal
            open={starsModalOpen}
            title={starsEditMode ? 'Edit Three Stars' : 'End Game — 3 Stars'}
            onClose={() => setStarsModalOpen(false)}
            confirmLabel={starsEditMode ? (busy ? 'Saving…' : 'Save') : 'End Game'}
            confirmIcon={starsEditMode ? 'save' : undefined}
            confirmDisabled={!canConfirm || !!busy}
            onConfirm={async () => {
              if (starsEditMode) {
                const ok = await updateStars({ star1: star1Id, star2: star2Id, star3: star3Id });
                if (ok) setStarsModalOpen(false);
              } else {
                const ok = await endGame({ star1: star1Id, star2: star2Id, star3: star3Id });
                if (ok) {
                  setEndGameReadyForStars(false);
                  setStarsModalOpen(false);
                }
              }
            }}
          >
            <div className={styles.goalForm}>
              <div className={styles.goalFormField}>
                <label className={styles.goalFormLabel}>1st Star</label>
                <Select
                  value={star1Id || null}
                  options={allPlayerOptions}
                  placeholder="— Select player —"
                  onChange={setStar1Id}
                  searchable
                  disabled={!!busy}
                />
              </div>
              <div className={styles.goalFormField}>
                <label className={styles.goalFormLabel}>2nd Star</label>
                <Select
                  value={star2Id || null}
                  options={allPlayerOptions}
                  placeholder="— Select player —"
                  onChange={setStar2Id}
                  searchable
                  disabled={!!busy}
                />
              </div>
              <div className={styles.goalFormField}>
                <label className={styles.goalFormLabel}>3rd Star</label>
                <Select
                  value={star3Id || null}
                  options={allPlayerOptions}
                  placeholder="— Select player —"
                  onChange={setStar3Id}
                  searchable
                  disabled={!!busy}
                />
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* ── Record Shots modal ── */}
      {shotsPeriod !== null &&
        game &&
        (() => {
          const isEndGame = shotsNextAction?.type === 'end-game';

          const shotsConfirmLabel = shotsSubmitting
            ? 'Saving…'
            : isEndGame
              ? 'Award Three Stars'
              : (shotsNextAction?.label ?? 'Confirm');

          // Reactive form values for validation
          const goalieFormValues = watchShots('goalies');
          const endTimeValue = watchShots('end_time');

          const teamRows = [
            {
              key: 'away',
              logo: game.away_team_logo,
              code: game.away_team_code,
              name: game.away_team_name,
              primaryColor: game.away_team_primary_color,
              textColor: game.away_team_text_color,
              fieldName: 'away_shots' as const,
            },
            {
              key: 'home',
              logo: game.home_team_logo,
              code: game.home_team_code,
              name: game.home_team_name,
              primaryColor: game.home_team_primary_color,
              textColor: game.home_team_text_color,
              fieldName: 'home_shots' as const,
            },
          ];

          const goalieRosterList = shotsShowGoalies
            ? [...awayRoster, ...homeRoster].filter((e) => e.position === 'G')
            : [];

          // Goalie validation: at least 1 goalie per team must have both SA and SV filled
          const goalieStatsValid =
            !shotsShowGoalies ||
            goalieRosterList.length === 0 ||
            (goalieRosterList.some(
              (g, i) =>
                g.team_id === game.away_team_id &&
                goalieFormValues[i]?.shots_against !== '' &&
                goalieFormValues[i]?.saves !== '',
            ) &&
              goalieRosterList.some(
                (g, i) =>
                  g.team_id === game.home_team_id &&
                  goalieFormValues[i]?.shots_against !== '' &&
                  goalieFormValues[i]?.saves !== '',
              ));

          const endTimeValid = !isEndGame || !!endTimeValue;
          const shootsFirstValid = !shotsShowShootsFirst || !!soFirstTeam;

          const modalTitle = shotsShowShootsFirst
            ? 'Go To Shootout'
            : isEndGame
              ? 'End Game'
              : `Record Shots — ${PERIOD_LABEL[shotsPeriod] ?? shotsPeriod} Period`;

          return (
            <Modal
              open={shotsPeriod !== null}
              title={modalTitle}
              onClose={() => setShotsPeriod(null)}
              confirmLabel={shotsConfirmLabel}
              confirmIcon={isEndGame ? 'star' : 'flag'}
              onConfirm={handleShotsConfirm}
              confirmDisabled={
                shotsSubmitting || !goalieStatsValid || !endTimeValid || !shootsFirstValid
              }
              busy={shotsSubmitting}
            >
              <div className={styles.shotsModalBody}>
                {/* End Time — required when ending the game */}
                {isEndGame && (
                  <Field
                    label="End Time"
                    required
                    type="timepicker"
                    control={shotsControl}
                    name="end_time"
                    disabled={shotsSubmitting}
                    autoFocus
                  />
                )}

                {/* Period Shots — hidden when ending a shootout (SO has no shot counts) */}
                {!(isEndGame && shotsPeriod === 'SO') && (
                  <>
                    <hr className={styles.lineupDivider} />
                    <div className={styles.shotsGoalieHeader}>
                      <span className={styles.goalFormLabel}>Period Shots</span>
                      <span className={styles.shotsSectionColLabel}>SOG</span>
                    </div>

                    {teamRows.map((row, rowIdx) => (
                      <div
                        key={row.key}
                        className={styles.shotsTeamRow}
                      >
                        <span className={styles.shotsTeamInfo}>
                          {row.logo ? (
                            <img
                              src={row.logo}
                              alt={row.code}
                              className={styles.shotsTeamLogo}
                            />
                          ) : (
                            <span
                              className={styles.shotsTeamLogoPlaceholder}
                              style={{ background: row.primaryColor, color: row.textColor }}
                            >
                              {row.code?.slice(0, 1)}
                            </span>
                          )}
                          <span className={styles.shotsTeamName}>{row.name}</span>
                        </span>
                        <div className={styles.shotsFieldWrap}>
                          <Field
                            type="number"
                            control={shotsControl}
                            name={row.fieldName}
                            placeholder="0"
                            min={0}
                            disabled={shotsSubmitting}
                            transform={(v) => v.replace(/[^0-9]/g, '')}
                            autoFocus={!isEndGame && rowIdx === 0}
                          />
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* Who Shoots First — only shown when advancing to shootout */}
                {shotsShowShootsFirst && (
                  <>
                    <hr className={styles.lineupDivider} />
                    <span className={styles.goalFormLabel}>Who Shoots First</span>
                    <div className={styles.teamSegment}>
                      {/* Away team */}
                      <button
                        type="button"
                        className={[
                          styles.teamSegmentBtn,
                          soFirstTeam === 'away' ? styles.teamSegmentBtnActive : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        disabled={shotsSubmitting}
                        onClick={() => setSoFirstTeam('away')}
                      >
                        {game.away_team_logo ? (
                          <img
                            src={game.away_team_logo}
                            alt={game.away_team_code}
                            className={styles.teamSegmentLogo}
                          />
                        ) : (
                          <span
                            className={styles.teamSegmentLogoPlaceholder}
                            style={{
                              background: game.away_team_primary_color,
                              color: game.away_team_text_color,
                            }}
                          >
                            {game.away_team_code.slice(0, 1)}
                          </span>
                        )}
                        {game.away_team_code}
                      </button>
                      {/* Home team */}
                      <button
                        type="button"
                        className={[
                          styles.teamSegmentBtn,
                          soFirstTeam === 'home' ? styles.teamSegmentBtnActive : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        disabled={shotsSubmitting}
                        onClick={() => setSoFirstTeam('home')}
                      >
                        {game.home_team_logo ? (
                          <img
                            src={game.home_team_logo}
                            alt={game.home_team_code}
                            className={styles.teamSegmentLogo}
                          />
                        ) : (
                          <span
                            className={styles.teamSegmentLogoPlaceholder}
                            style={{
                              background: game.home_team_primary_color,
                              color: game.home_team_text_color,
                            }}
                          >
                            {game.home_team_code.slice(0, 1)}
                          </span>
                        )}
                        {game.home_team_code}
                      </button>
                    </div>
                  </>
                )}

                {goalieRosterList.length > 0 && (
                  <>
                    <hr className={styles.lineupDivider} />
                    {/* Header row: title on left, SA/SV column labels aligned with inputs */}
                    <div className={styles.shotsGoalieHeader}>
                      <span className={styles.goalFormLabel}>Goalie Stats</span>
                      <div className={styles.shotsGoalieInputs}>
                        <span className={styles.shotsGoalieColLabel}>SA</span>
                        <span className={styles.shotsGoalieColLabel}>SV</span>
                      </div>
                    </div>
                    {shotsGoalieFields.map((field, i) => {
                      const goalie = goalieRosterList[i];
                      if (!goalie) return null;
                      const isAway = goalie.team_id === game.away_team_id;
                      const logo = isAway ? game.away_team_logo : game.home_team_logo;
                      const code = isAway ? game.away_team_code : game.home_team_code;
                      const primary = isAway
                        ? game.away_team_primary_color
                        : game.home_team_primary_color;
                      const text = isAway ? game.away_team_text_color : game.home_team_text_color;
                      return (
                        <div
                          key={field.id}
                          className={styles.shotsGoalieRow}
                        >
                          <span className={styles.goalieNameCell}>
                            {/* Team logo */}
                            {logo ? (
                              <img
                                src={logo}
                                alt={code}
                                className={styles.goalTeamLogo}
                              />
                            ) : (
                              <span
                                className={styles.goalTeamLogoPlaceholder}
                                style={{ background: primary, color: text }}
                              >
                                {code?.slice(0, 1)}
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
                                style={{ background: primary, color: text }}
                              >
                                {goalie.last_name?.charAt(0)}
                              </span>
                            )}
                            {/* Jersey + name */}
                            <div className={styles.goalInfo}>
                              {goalie.jersey_number != null && (
                                <span className={styles.goalAssists}>#{goalie.jersey_number}</span>
                              )}
                              <span className={styles.goalScorer}>
                                {formatPlayerName(goalie.first_name, goalie.last_name)}
                              </span>
                            </div>
                          </span>
                          <div className={styles.shotsGoalieInputs}>
                            <Field
                              type="number"
                              control={shotsControl}
                              name={`goalies.${i}.shots_against`}
                              placeholder="0"
                              min={0}
                              disabled={shotsSubmitting}
                              transform={(v) => v.replace(/[^0-9]/g, '')}
                            />
                            <Field
                              type="number"
                              control={shotsControl}
                              name={`goalies.${i}.saves`}
                              placeholder="0"
                              min={0}
                              disabled={shotsSubmitting}
                              transform={(v) => v.replace(/[^0-9]/g, '')}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </Modal>
          );
        })()}

      {/* ── Goalie Stats edit modal ── */}
      {goalieStatsModalOpen && game && (
        <Modal
          open={goalieStatsModalOpen}
          title="Goalie Stats"
          onClose={() => setGoalieStatsModalOpen(false)}
          confirmLabel={goalieStatsSubmitting ? 'Saving…' : 'Save'}
          onConfirm={handleGoalieStatsConfirm}
          confirmDisabled={goalieStatsSubmitting}
          busy={goalieStatsSubmitting}
        >
          <div className={styles.shotsModalBody}>
            {/* Column headers */}
            <div className={styles.shotsGoalieHeader}>
              <span />
              <div className={styles.shotsGoalieInputs}>
                <span className={styles.shotsGoalieColLabel}>SA</span>
                <span className={styles.shotsGoalieColLabel}>SV</span>
              </div>
            </div>
            {goalieStatsFields.map((field, i) => {
              const goalieId = goalieStatsGoalieIds[i];
              const goalie = [...awayRoster, ...homeRoster].find((r) => r.player_id === goalieId);
              if (!goalie) return null;
              const isAway = goalie.team_id === game.away_team_id;
              const logo = isAway ? game.away_team_logo : game.home_team_logo;
              const code = isAway ? game.away_team_code : game.home_team_code;
              const primary = isAway ? game.away_team_primary_color : game.home_team_primary_color;
              const text = isAway ? game.away_team_text_color : game.home_team_text_color;
              return (
                <div
                  key={field.id}
                  className={styles.shotsGoalieRow}
                >
                  <span className={styles.goalieNameCell}>
                    {/* Team logo */}
                    {logo ? (
                      <img
                        src={logo}
                        alt={code}
                        className={styles.goalTeamLogo}
                      />
                    ) : (
                      <span
                        className={styles.goalTeamLogoPlaceholder}
                        style={{ background: primary, color: text }}
                      >
                        {code?.slice(0, 1)}
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
                        style={{ background: primary, color: text }}
                      >
                        {goalie.last_name?.charAt(0)}
                      </span>
                    )}
                    {/* Jersey + name */}
                    <div className={styles.goalInfo}>
                      {goalie.jersey_number != null && (
                        <span className={styles.goalAssists}>#{goalie.jersey_number}</span>
                      )}
                      <span className={styles.goalScorer}>
                        {formatPlayerName(goalie.first_name, goalie.last_name)}
                      </span>
                    </div>
                  </span>
                  <div className={styles.shotsGoalieInputs}>
                    <Field
                      type="number"
                      control={goalieStatsControl}
                      name={`goalies.${i}.shots_against`}
                      placeholder="0"
                      min={0}
                      disabled={goalieStatsSubmitting}
                      transform={(v) => v.replace(/[^0-9]/g, '')}
                    />
                    <Field
                      type="number"
                      control={goalieStatsControl}
                      name={`goalies.${i}.saves`}
                      placeholder="0"
                      min={0}
                      disabled={goalieStatsSubmitting}
                      transform={(v) => v.replace(/[^0-9]/g, '')}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Modal>
      )}

      {/* ── Shots edit modal (all periods) ── */}
      {shotsEditModalOpen && game && (
        <Modal
          open={shotsEditModalOpen}
          title="Edit Shots"
          onClose={() => setShotsEditModalOpen(false)}
          confirmLabel={shotsEditSubmitting ? 'Saving…' : 'Save'}
          onConfirm={handleShotsEditConfirm}
          confirmDisabled={shotsEditSubmitting}
          busy={shotsEditSubmitting}
        >
          <table className={`${styles.periodsTable} ${styles.shotsEditTable}`}>
            <thead>
              <tr>
                <th className={styles.thTeam}></th>
                {shotsEditFields.map((field, i) => {
                  const periodId = shotsEditPeriodIds[i];
                  const label = linescorePeriods.find((p) => p.id === periodId)?.label ?? periodId;
                  return (
                    <th
                      key={field.id}
                      className={styles.thPeriod}
                    >
                      {label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  {
                    key: 'away',
                    logo: game.away_team_logo,
                    code: game.away_team_code,
                    primary: game.away_team_primary_color,
                    text: game.away_team_text_color,
                    fieldKey: 'away_shots',
                  },
                  {
                    key: 'home',
                    logo: game.home_team_logo,
                    code: game.home_team_code,
                    primary: game.home_team_primary_color,
                    text: game.home_team_text_color,
                    fieldKey: 'home_shots',
                  },
                ] as const
              ).map((row) => (
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
                  {shotsEditFields.map((field, i) => (
                    <td
                      key={field.id}
                      className={styles.tdShotsInput}
                    >
                      <Field
                        type="number"
                        control={shotsEditControl}
                        name={`periods.${i}.${row.fieldKey}` as const}
                        placeholder="0"
                        min={0}
                        disabled={shotsEditSubmitting}
                        transform={(v) => v.replace(/[^0-9]/g, '')}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </>
  );
};

export default GameDetailsPage;
