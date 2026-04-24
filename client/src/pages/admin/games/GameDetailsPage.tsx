import { useState, useMemo } from 'react';
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
import Tabs from '../../../components/Tabs/Tabs';
import TitleRow from '../../../components/TitleRow/TitleRow';
import {
  useGameDetails,
  type CurrentPeriod,
  type GameStatus,
  type GameType,
} from '../../../hooks/useGames';
import useTeamPlayers from '../../../hooks/useTeamPlayers';
import useGameLineup from '../../../hooks/useGameLineup';
import useGameRoster, { type GameRosterEntry } from '../../../hooks/useGameRoster';
import useGameGoals from '../../../hooks/useGameGoals';
import useGameGoalieStats from '../../../hooks/useGameGoalieStats';
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

const STATUS_LABEL: Record<GameStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  final: 'Final',
  postponed: 'Postponed',
  cancelled: 'Cancelled',
};

const STATUS_INTENT: Record<GameStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  scheduled: 'neutral',
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
  { value: 'empty-net', label: 'Empty Net' },
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
    updateStatus,
    advancePeriod,
    endGame,
    updateStars,
    updateGameInfo,
    updatePeriodShots,
  } = useGameDetails(id);
  const { goals, addGoal, deleteGoal } = useGameGoals(id);
  const { goalieStats, upsertGoalieStat, busy: goalieStatsBusy } = useGameGoalieStats(id);

  /**
   * Running goal/assist tallies per player, computed once in goal order
   * (period ASC, created_at ASC). At each goal we record:
   *   - how many goals the scorer has scored so far (including this one)
   *   - how many assists each assistant has accumulated so far
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
      const scorerGoals = (goalCounts.get(goal.scorer_id) ?? 0) + 1;
      goalCounts.set(goal.scorer_id, scorerGoals);

      let assist1Assists: number | null = null;
      if (goal.assist_1_id) {
        const n = (assistCounts.get(goal.assist_1_id) ?? 0) + 1;
        assistCounts.set(goal.assist_1_id, n);
        assist1Assists = n;
      }

      let assist2Assists: number | null = null;
      if (goal.assist_2_id) {
        const n = (assistCounts.get(goal.assist_2_id) ?? 0) + 1;
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

  // ── Goal form state ───────────────────────────────────────────────────────
  const [goalPeriod, setGoalPeriod] = useState<1 | 2 | 3 | 'OT' | null>(null);
  const [goalTeam, setGoalTeam] = useState<'away' | 'home'>('away');
  const [goalTimeMins, setGoalTimeMins] = useState('');
  const [goalTimeSecs, setGoalTimeSecs] = useState('');
  const [goalType, setGoalType] = useState('even-strength');
  const [goalScorerId, setGoalScorerId] = useState('');
  const [goalAssist1Id, setGoalAssist1Id] = useState('');
  const [goalAssist2Id, setGoalAssist2Id] = useState('');
  const [goalSubmitting, setGoalSubmitting] = useState(false);

  // ── End Game / 3-stars modal ──────────────────────────────────────────────
  const [starsModalOpen, setStarsModalOpen] = useState(false);
  /** true = editing stars on a final game; false = ending the game */
  const [starsEditMode, setStarsEditMode] = useState(false);
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

  // ── Game Info edit modal ──────────────────────────────────────────────────
  const [gameInfoEditOpen, setGameInfoEditOpen] = useState(false);
  const {
    control: gameInfoControl,
    handleSubmit: handleGameInfoSubmit,
    reset: resetGameInfoForm,
    formState: { isSubmitting: gameInfoSubmitting },
  } = useForm<{ venue: string; scheduled_date: string; game_type: GameType }>({
    defaultValues: { venue: '', scheduled_date: '', game_type: 'regular' },
  });

  const openGameInfoEdit = () => {
    if (!game) return;
    resetGameInfoForm({
      venue: game.venue ?? '',
      scheduled_date: game.scheduled_at ? game.scheduled_at.slice(0, 10) : '',
      game_type: game.game_type,
    });
    setGameInfoEditOpen(true);
  };

  const onGameInfoSubmit = handleGameInfoSubmit(async (data) => {
    const ok = await updateGameInfo({
      venue: data.venue || null,
      scheduled_at: data.scheduled_date || null,
      game_type: data.game_type,
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
    goalies: Array<{ shots_against: string; saves: string }>;
  };

  const [shotsPeriod, setShotsPeriod] = useState<string | null>(null);
  const [shotsSubmitting, setShotsSubmitting] = useState(false);
  const [shotsNextAction, setShotsNextAction] = useState<ShotsNextAction | null>(null);
  const [shotsShowGoalies, setShotsShowGoalies] = useState(false);
  // goalie player_ids in the same order as shotsGoalieFields for cross-referencing
  const [shotsGoalieIds, setShotsGoalieIds] = useState<string[]>([]);

  const {
    control: shotsControl,
    reset: resetShotsForm,
    getValues: getShotsFormValues,
  } = useForm<ShotsModalFormValues>({
    defaultValues: { away_shots: '', home_shots: '', goalies: [] },
  });
  const { fields: shotsGoalieFields } = useFieldArray({ control: shotsControl, name: 'goalies' });

  const openShotsModal = (period: string, nextAction: ShotsNextAction, showGoalies: boolean) => {
    if (!game) return;
    const existing = game.period_shots.find((ps) => ps.period === period);
    const goalies = showGoalies
      ? [...awayRoster, ...homeRoster].filter((e) => e.position === 'G')
      : [];
    resetShotsForm({
      away_shots: existing ? String(existing.away_shots) : '',
      home_shots: existing ? String(existing.home_shots) : '',
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
    setShotsPeriod(period);
  };

  const handleShotsConfirm = async () => {
    if (!shotsPeriod || !shotsNextAction || !game) return;
    const { away_shots, home_shots, goalies: goalieFormValues } = getShotsFormValues();
    const away = parseInt(away_shots, 10);
    const home = parseInt(home_shots, 10);
    if (isNaN(away) || isNaN(home)) return;
    setShotsSubmitting(true);
    const ok = await updatePeriodShots(shotsPeriod, home, away);
    if (!ok) {
      setShotsSubmitting(false);
      return;
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
    setShotsSubmitting(false);
    setShotsPeriod(null);
    if (shotsNextAction.type === 'advance') {
      advancePeriod(shotsNextAction.next);
    } else {
      setStar1Id('');
      setStar2Id('');
      setStar3Id('');
      setStarsEditMode(false);
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
  const awayRoster = roster.filter((e) => e.team_id === game?.away_team_id);
  const homeRoster = roster.filter((e) => e.team_id === game?.home_team_id);

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

  const handleConfirmRemove = async () => {
    if (!confirmRemove) return;
    setRemovingFromRoster(true);
    await removeFromRoster(confirmRemove.entry.id);
    setRemovingFromRoster(false);
    setConfirmRemove(null);
  };

  const openGoalModal = (period: 1 | 2 | 3 | 'OT') => {
    setGoalPeriod(period);
    setGoalTeam('away');
    setGoalTimeMins('');
    setGoalTimeSecs('');
    setGoalType('even-strength');
    setGoalScorerId('');
    setGoalAssist1Id('');
    setGoalAssist2Id('');
  };
  const closeGoalModal = () => setGoalPeriod(null);

  const handleTeamChange = (team: 'away' | 'home') => {
    setGoalTeam(team);
    setGoalScorerId('');
    setGoalAssist1Id('');
    setGoalAssist2Id('');
  };

  const handleTimeMinsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
    if (val !== '' && parseInt(val, 10) > 20) return;
    setGoalTimeMins(val);
  };

  const handleTimeSecsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
    if (val !== '' && parseInt(val, 10) > 59) return;
    setGoalTimeSecs(val);
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
  const hasPeriods = isFinal && game.period_scores.length > 0;
  const hasStars = isFinal && !!(game.star_1_id && game.star_2_id && game.star_3_id);
  const awayScore = game.away_score ?? 0;
  const homeScore = game.home_score ?? 0;

  // Derive totals from goals table (period_scores) for both in-progress and final games.
  // Stored away_score/home_score columns are NOT auto-updated, so never rely on them for live data.
  const liveAwayScore =
    isInProgress || isFinal
      ? game.period_scores.reduce((sum, ps) => sum + ps.away_goals, 0)
      : awayScore;
  const liveHomeScore =
    isInProgress || isFinal
      ? game.period_scores.reduce((sum, ps) => sum + ps.home_goals, 0)
      : homeScore;

  const overtimeSuffix = game.shootout ? ' (SO)' : (game.overtime_periods ?? 0) > 0 ? ' (OT)' : '';

  // Period columns for the Linescore table (always 1–3, plus OT/SO if applicable).
  const linescorePeriods: { id: string; label: string }[] = [
    { id: '1', label: '1st' },
    { id: '2', label: '2nd' },
    { id: '3', label: '3rd' },
    ...(game.period_scores.some((ps) => ps.period === 'OT') || (game.overtime_periods ?? 0) > 0
      ? [{ id: 'OT', label: 'OT' }]
      : []),
    ...(game.period_scores.some((ps) => ps.period === 'SO') || game.shootout
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
          <div className={styles.teamSide}>
            <div
              className={styles.teamStripe}
              style={{ background: game.away_team_primary_color }}
            />
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
          <div className={`${styles.teamSide} ${styles.teamSideHome}`}>
            <div
              className={`${styles.teamStripe} ${styles.teamStripeHome}`}
              style={{ background: game.home_team_primary_color }}
            />
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
          </div>
        </div>
      </Card>

      {/* ── Tabs ── */}
      <Tabs
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
                                    {player.position !== 'G' && (
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
                          const isActive = !isFinal && game.current_period === periodId;
                          const isDone = isFinal || currentIdx > idx;

                          const isPending = !isActive && !isDone;

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
                                        intent: 'neutral' as const,
                                        disabled: !!busy,
                                        onClick: () => openGoalModal(num as 1 | 2 | 3),
                                      },
                                      num < 3
                                        ? {
                                            icon: 'flag',
                                            tooltip: 'End Period',
                                            intent: 'accent' as const,
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
                                                true,
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
                                      const badge = GOAL_TYPE_BADGE[goal.goal_type] ?? null;
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

                                          {/* Goal type badge */}
                                          {badge && (
                                            <Tooltip text={badge.tooltip}>
                                              <Badge
                                                label={badge.label}
                                                intent={badge.intent}
                                              />
                                            </Tooltip>
                                          )}

                                          {/* Delete goal */}
                                          {isInProgress && (
                                            <ActionOverlay className={styles.goalActions}>
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
                          goals.some((g) => g.period === 'OT') ||
                          (isFinal && (game.overtime_periods ?? 0) > 0)) &&
                          (() => {
                            const isOTActive = !isFinal && game.current_period === 'OT';
                            const isOTDone = isFinal;
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
                                          intent: 'neutral' as const,
                                          disabled: !!busy,
                                          onClick: () => openGoalModal('OT'),
                                        },
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
                                        const badge = GOAL_TYPE_BADGE[goal.goal_type] ?? null;
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
                                            {badge && (
                                              <Tooltip text={badge.tooltip}>
                                                <Badge
                                                  label={badge.label}
                                                  intent={badge.intent}
                                                />
                                              </Tooltip>
                                            )}

                                            {/* Delete goal */}
                                            {isInProgress && (
                                              <ActionOverlay className={styles.goalActions}>
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
                      </div>
                    </Card>

                    {/* ── Goalie Stats card ── */}
                    {(isFinal || isInProgress) &&
                      (() => {
                        const goalies = [...awayRoster, ...homeRoster].filter(
                          (e) => e.position === 'G',
                        );
                        if (goalies.length === 0) return null;
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
                                          {teamLogo ? (
                                            <img
                                              src={teamLogo}
                                              alt={teamCode}
                                              className={styles.goalieLogo}
                                            />
                                          ) : (
                                            <span
                                              className={styles.goalieLogoPlaceholder}
                                              style={{ background: primaryColor, color: textColor }}
                                            >
                                              {teamCode?.slice(0, 1)}
                                            </span>
                                          )}
                                          <span className={styles.goalieNameLabel}>
                                            {goalie.jersey_number != null
                                              ? `#${goalie.jersey_number} `
                                              : ''}
                                            {goalie.first_name} {goalie.last_name}
                                          </span>
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
                  </div>
                  {/* end summaryLeft */}

                  {/* ── Right column: Game Info (final only) + Linescore ── */}
                  <div className={styles.summaryRight}>
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
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Venue</span>
                          <span className={game.venue ? styles.infoValue : styles.infoValueMuted}>
                            {game.venue ?? '—'}
                          </span>
                        </div>
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Type</span>
                          <span className={styles.infoValue}>
                            {GAME_TYPE_LABEL[game.game_type]}
                          </span>
                        </div>
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

                    <Card
                      title="Linescore"
                      action={
                        <div className={styles.linescoreActions}>
                          {game.status === 'scheduled' && (
                            <>
                              <Button
                                variant="filled"
                                intent="accent"
                                icon="play_arrow"
                                size="sm"
                                tooltip="Start Game"
                                disabled={!!busy}
                                onClick={() => updateStatus('in_progress')}
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
                            ['3', 'OT', 'SO'].includes(game.current_period ?? '') && (
                              <Button
                                variant="filled"
                                intent="danger"
                                icon="flag"
                                size="sm"
                                tooltip="End Game"
                                disabled={!!busy}
                                onClick={() =>
                                  openShotsModal(
                                    game.current_period ?? '3',
                                    { type: 'end-game' },
                                    true,
                                  )
                                }
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
                                  const goals = rawGoals ?? (isPeriodDone ? 0 : '—');
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
                                {linescorePeriods.map((p) => {
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
                  </div>
                </div>
              </div>
            ),
          },
          {
            label: 'Lineup',
            content: (() => {
              // Lookup: player_id → starting lineup entry (for italic + position_slot info)
              const awayLineupMap = new Map(
                lineup.filter((e) => e.team_id === game.away_team_id).map((e) => [e.player_id, e]),
              );
              const homeLineupMap = new Map(
                lineup.filter((e) => e.team_id === game.home_team_id).map((e) => [e.player_id, e]),
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
                            onClick: () => setLineupSetTeam(side),
                          },
                          ...(rosterEntries.length < 23
                            ? [
                                {
                                  icon: 'group_add',
                                  tooltip: 'Add from Roster',
                                  onClick: () => setLineupAddTeam(side),
                                },
                                {
                                  icon: 'person_edit',
                                  tooltip: 'Create Player',
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
                        const jerseyPrefix = e.jersey_number != null ? `#${e.jersey_number} ` : '';
                        return (
                          <ListItem
                            key={e.id}
                            image={e.photo}
                            image_shape="circle"
                            primaryColor={primaryColor}
                            textColor={textColor}
                            name={`${jerseyPrefix}${e.last_name}, ${e.first_name}`}
                            placeholder={`${e.first_name[0]}${e.last_name[0]}`}
                            subtitle={
                              e.position ? (POSITION_LABEL[e.position] ?? e.position) : undefined
                            }
                            rightContent={
                              isStarter
                                ? { type: 'tag', label: 'Starter', intent: 'accent' }
                                : undefined
                            }
                            actions={
                              isFinal
                                ? []
                                : [
                                    {
                                      icon: 'person_remove',
                                      intent: 'danger',
                                      tooltip: 'Remove from game roster',
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
                    <p className={styles.noGoalsText}>No players in roster yet.</p>
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
            title="Score Goal"
            onClose={closeGoalModal}
            confirmLabel={goalSubmitting ? 'Saving…' : 'Record Goal'}
            confirmDisabled={!!busy || goalSubmitting || !goalScorerId}
            busy={goalSubmitting}
            onConfirm={async () => {
              if (!goalPeriod || !game) return;
              const teamId = goalTeam === 'away' ? game.away_team_id : game.home_team_id;
              const periodTime = `${(goalTimeMins || '00').padStart(2, '0')}:${(goalTimeSecs || '00').padStart(2, '0')}`;
              setGoalSubmitting(true);
              try {
                await addGoal({
                  team_id: teamId,
                  period: String(goalPeriod),
                  goal_type: goalType,
                  period_time: periodTime,
                  scorer_id: goalScorerId,
                  assist_1_id: goalAssist1Id || null,
                  assist_2_id: goalAssist2Id || null,
                });
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
                {/* Period time — one label, two inputs with colon */}
                <div className={styles.goalFormField}>
                  <label className={styles.goalFormLabel}>
                    Period Time <span className={styles.required}>*</span>
                  </label>
                  <div className={styles.timeInputRow}>
                    <input
                      type="text"
                      className={styles.timeSegmentInput}
                      placeholder="00"
                      value={goalTimeMins}
                      onChange={handleTimeMinsChange}
                      onBlur={() => {
                        if (goalTimeMins) setGoalTimeMins(goalTimeMins.padStart(2, '0'));
                      }}
                      inputMode="numeric"
                      maxLength={2}
                      disabled={goalSubmitting}
                    />
                    <span className={styles.timeColon}>:</span>
                    <input
                      type="text"
                      className={styles.timeSegmentInput}
                      placeholder="00"
                      value={goalTimeSecs}
                      onChange={handleTimeSecsChange}
                      onBlur={() => {
                        if (goalTimeSecs) setGoalTimeSecs(goalTimeSecs.padStart(2, '0'));
                      }}
                      inputMode="numeric"
                      maxLength={2}
                      disabled={goalSubmitting}
                    />
                  </div>
                </div>

                {/* Goal type */}
                <div className={styles.goalFormField}>
                  <label className={styles.goalFormLabel}>Goal Type</label>
                  <Select
                    value={goalType}
                    options={GOAL_TYPES}
                    onChange={setGoalType}
                    disabled={goalSubmitting}
                  />
                </div>
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

      {/* ── Lineup: Remove from Game Roster (confirm) ── */}
      <ConfirmModal
        open={!!confirmRemove}
        title="Remove from Roster"
        body={
          confirmRemove ? (
            <>
              Remove{' '}
              <strong>
                {confirmRemove.entry.first_name} {confirmRemove.entry.last_name}
              </strong>{' '}
              from this game&apos;s roster?
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
          className={styles.goalForm}
          onSubmit={onGameInfoSubmit}
        >
          <Field
            label="Venue"
            control={gameInfoControl}
            name="venue"
            placeholder="e.g. Scotiabank Arena"
            disabled={gameInfoSubmitting}
          />
          <Field
            label="Date"
            type="datepicker"
            control={gameInfoControl}
            name="scheduled_date"
            placeholder="Select date…"
          />
          <Field
            label="Game Type"
            type="select"
            control={gameInfoControl}
            name="game_type"
            options={GAME_TYPE_OPTIONS}
            disabled={gameInfoSubmitting}
          />
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
                if (ok) setStarsModalOpen(false);
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
          const shotsConfirmLabel = shotsSubmitting
            ? 'Saving…'
            : shotsNextAction?.type === 'end-game'
              ? 'Award Three Stars'
              : (shotsNextAction?.label ?? 'Confirm');

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

          return (
            <Modal
              open={shotsPeriod !== null}
              title={`Record Shots — ${PERIOD_LABEL[shotsPeriod] ?? shotsPeriod} Period`}
              onClose={() => setShotsPeriod(null)}
              confirmLabel={shotsConfirmLabel}
              confirmIcon={shotsNextAction?.type === 'end-game' ? 'star' : 'flag'}
              onConfirm={handleShotsConfirm}
              confirmDisabled={shotsSubmitting}
              busy={shotsSubmitting}
            >
              <div className={styles.shotsModalBody}>
                {teamRows.map((row) => (
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
                      />
                    </div>
                  </div>
                ))}

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
                          <span className={styles.shotsTeamInfo}>
                            {logo ? (
                              <img
                                src={logo}
                                alt={code}
                                className={styles.shotsTeamLogo}
                              />
                            ) : (
                              <span
                                className={styles.shotsTeamLogoPlaceholder}
                                style={{ background: primary, color: text }}
                              >
                                {code?.slice(0, 1)}
                              </span>
                            )}
                            <span className={styles.shotsTeamName}>
                              {goalie.jersey_number != null ? `#${goalie.jersey_number} ` : ''}
                              {goalie.first_name} {goalie.last_name}
                            </span>
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
                  <span className={styles.shotsTeamInfo}>
                    {logo ? (
                      <img
                        src={logo}
                        alt={code}
                        className={styles.shotsTeamLogo}
                      />
                    ) : (
                      <span
                        className={styles.shotsTeamLogoPlaceholder}
                        style={{ background: primary, color: text }}
                      >
                        {code?.slice(0, 1)}
                      </span>
                    )}
                    <span className={styles.shotsTeamName}>
                      {goalie.jersey_number != null ? `#${goalie.jersey_number} ` : ''}
                      {goalie.first_name} {goalie.last_name}
                    </span>
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
          <div className={styles.shotsModalBody}>
            {shotsEditFields.map((field, i) => {
              const periodId = shotsEditPeriodIds[i];
              const periodLabel =
                linescorePeriods.find((p) => p.id === periodId)?.label ?? periodId;
              const teamRows = [
                {
                  key: 'away',
                  logo: game.away_team_logo,
                  code: game.away_team_code,
                  name: game.away_team_name,
                  primary: game.away_team_primary_color,
                  text: game.away_team_text_color,
                  fieldName: `periods.${i}.away_shots` as const,
                },
                {
                  key: 'home',
                  logo: game.home_team_logo,
                  code: game.home_team_code,
                  name: game.home_team_name,
                  primary: game.home_team_primary_color,
                  text: game.home_team_text_color,
                  fieldName: `periods.${i}.home_shots` as const,
                },
              ];
              return (
                <div key={field.id}>
                  {i > 0 && <hr className={styles.lineupDivider} />}
                  <p className={styles.shotsEditPeriodLabel}>{periodLabel}</p>
                  {teamRows.map((row) => (
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
                            style={{ background: row.primary, color: row.text }}
                          >
                            {row.code?.slice(0, 1)}
                          </span>
                        )}
                        <span className={styles.shotsTeamName}>{row.name}</span>
                      </span>
                      <div className={styles.shotsFieldWrap}>
                        <Field
                          type="number"
                          control={shotsEditControl}
                          name={row.fieldName}
                          placeholder="0"
                          min={0}
                          disabled={shotsEditSubmitting}
                          transform={(v) => v.replace(/[^0-9]/g, '')}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </Modal>
      )}
    </>
  );
};

export default GameDetailsPage;
