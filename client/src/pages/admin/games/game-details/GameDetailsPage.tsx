import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import Tabs from '@/components/Tabs/Tabs';
import { useGameDetails } from '@/hooks/useGames';
import useGameLineup from '@/hooks/useGameLineup';
import useGameRoster from '@/hooks/useGameRoster';
import useGameGoalieStats from '@/hooks/useGameGoalieStats';
import useShootoutAttempts from '@/hooks/useShootoutAttempts';
import useTabState from '@/hooks/useTabState';
import { useAuth } from '@/context/AuthContext';
import { usePageBreadcrumbs } from '@/context/BreadcrumbContext';
import GameLineupsTab from './lineups/GameLineupsTab';
import GameSummaryTab from './summary/GameSummaryTab';
import ScoreboardCard from './ScoreboardCard';

import styles from './GameDetailsPage.module.scss';
import { DATE_FMT_SHORT } from './formatUtils';

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  mode?: 'admin' | 'user';
}

const GameDetailsPage = ({ mode = 'admin' }: Props) => {
  const {
    leagueId = '',
    seasonId,
    id,
  } = useParams<{
    leagueId: string;
    seasonId: string;
    id: string;
  }>();
  const { user } = useAuth();
  const {
    game,
    loading,
    busy,
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
  } = useGameDetails(id);
  const gameHasStarted = !!game && game.status !== 'scheduled';
  const hasShootout = !!game?.shootout;
  const {
    goalieStats,
    upsertGoalieStat,
    switchGoalie,
    removeGoalieStat,
    updateGoalieStint,
    removeGoalieStint,
  } = useGameGoalieStats(id, { enabled: gameHasStarted });
  // attempts is needed here only for soWinnerSide → liveScore calculation for ScoreboardCard.
  // React Query deduplicates the request; GameSummaryTab also calls this hook.
  const { attempts } = useShootoutAttempts(id, { enabled: hasShootout });
  const [activeTab, handleTabChange] = useTabState(
    mode === 'admin' ? 'tab:game-details' : 'tab:user-game-details',
  );
  const [isEditMode, setIsEditMode] = useState(false);
  const isAdminView = mode === 'admin';
  const isAdminUser = user?.role === 'admin';

  /**
   * Which side ('away' | 'home') won the shootout, or null if not yet decided.
   * Mirrors the soComplete logic but returns the winner identity for score display.
   */
  const soWinnerSide = useMemo((): 'away' | 'home' | null => {
    if (!game) return null;
    const bestOf = game.best_of_shootout ?? 3;
    const firstTeamId = game.shootout_first_team_id;
    const firstSideId =
      firstTeamId === game.away_team.id
        ? game.away_team.id
        : firstTeamId === game.home_team.id
          ? game.home_team.id
          : game.away_team.id;
    const firstSide: 'away' | 'home' = firstSideId === game.away_team.id ? 'away' : 'home';
    const secondSide: 'away' | 'home' = firstSide === 'away' ? 'home' : 'away';
    const secondSideId = firstSideId === game.away_team.id ? game.home_team.id : game.away_team.id;

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

  // ── Game-day rosters ───────────────────────────────────────────────────────
  const { roster, addToRoster, removeFromRoster } = useGameRoster(id);
  // Real entries are persisted to this game; inherited entries are pre-populated
  // from the last finished game and not yet saved.
  const awayRoster = roster.filter((e) => e.team_id === game?.away_team.id && !e.inherited);
  const homeRoster = roster.filter((e) => e.team_id === game?.home_team.id && !e.inherited);
  const awayRosterInherited = roster.filter(
    (e) => e.team_id === game?.away_team.id && !!e.inherited,
  );
  const homeRosterInherited = roster.filter(
    (e) => e.team_id === game?.home_team.id && !!e.inherited,
  );

  // ── Starting lineup data ───────────────────────────────────────────────────
  const { lineup, saveTeamLineup } = useGameLineup(id);

  // Both teams must have at least one persisted (non-inherited) roster entry.
  const rosterReady = awayRoster.length > 0 && homeRoster.length > 0;

  // Both teams must have all 6 position slots covered (saved or inherited) AND every
  // player in those slots must be on the current game's roster.
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
    return hasAll(game.away_team.id) && hasAll(game.home_team.id);
  })();

  const seasonHref = `/admin/leagues/${leagueId}/seasons/${seasonId}`;
  const leagueHref = `/admin/leagues/${leagueId}`;
  const leagueName = game?.league_name ?? 'League';
  const seasonName = game?.season_name ?? 'Season';
  const gameCrumbLabel = game
    ? [
        `${game.away_team.code} @ ${game.home_team.code}`,
        game.scheduled_at ? DATE_FMT_SHORT.format(new Date(game.scheduled_at)) : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Not Found';

  usePageBreadcrumbs(
    loading
      ? null
      : {
          backPath: isAdminView ? seasonHref : '/games',
          backLabel: isAdminView ? `Back to ${seasonName}` : 'Back to Games',
          items: isAdminView
            ? [
                { label: 'Leagues', path: '/admin/leagues' },
                { label: leagueName, path: leagueHref },
                { label: seasonName, path: seasonHref },
                { label: gameCrumbLabel },
              ]
            : [],
        },
    [
      loading,
      isAdminView,
      seasonHref,
      seasonName,
      leagueHref,
      leagueName,
      gameCrumbLabel,
    ],
  );

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
      <p style={{ color: 'var(--text-dim)' }}>Game not found.</p>
    );
  }

  const gameHrefBuilder = (gameId: string) =>
    isAdminView
      ? `/admin/leagues/${leagueId}/seasons/${seasonId}/games/${gameId}`
      : `/games/${gameId}`;
  const playerHrefBuilder = isAdminView
    ? (teamId: string, playerId: string) =>
        `/admin/leagues/${leagueId}/teams/${teamId}/players/${playerId}`
    : undefined;

  const isFinal = game.status === 'final';
  const isInProgress = game.status === 'in_progress';
  // Use the backend-computed score as the canonical base.
  // For an in-progress shootout, the backend intentionally stays on the goal-based tied score,
  // so we still apply a temporary +1 client-side when the current attempts already reveal a winner.
  const hasSoPeriodScore = game.period_scores.some((ps) => ps.period === 'SO');
  const soScoreAdj = !isFinal && soWinnerSide && !hasSoPeriodScore ? 1 : 0;
  const liveAwayScore = game.away_score + (soWinnerSide === 'away' ? soScoreAdj : 0);
  const liveHomeScore = game.home_score + (soWinnerSide === 'home' ? soScoreAdj : 0);

  // Derive OT/SO from period_scores (source of truth); stored columns are a fallback
  // for legacy games created before goal tracking was introduced.
  const overtimeSuffix =
    game.shootout || game.period_scores.some((ps) => ps.period === 'SO')
      ? '/SO'
      : (game.overtime_periods ?? 0) > 0 || game.period_scores.some((ps) => ps.period === 'OT')
        ? '/OT'
        : '';

  // Period columns for the Linescore table (always 1–3, plus OT/SO if applicable).
  // Playoff games expand OT into separate columns: OT1, OT2, …
  const isPlayoff = game.game_type === 'playoff';
  const otCount = game.overtime_periods ?? 1;
  const hasSO =
    !isPlayoff &&
    (game.period_scores.some((ps) => ps.period === 'SO') ||
      game.shootout ||
      game.current_period === 'SO');
  const hasOT =
    !hasSO &&
    (game.period_scores.some((ps) => ps.period === 'OT') ||
      (game.overtime_periods ?? 0) > 0 ||
      game.current_period === 'OT');
  // Compact numeric labels when multiple OT columns are present in a playoff game.
  const useShortNums = isPlayoff && otCount > 1;
  const linescorePeriods: { id: string; label: string; shortLabel: string }[] = [
    { id: '1', label: '1st', shortLabel: useShortNums ? '1' : '1st' },
    { id: '2', label: '2nd', shortLabel: useShortNums ? '2' : '2nd' },
    { id: '3', label: '3rd', shortLabel: useShortNums ? '3' : '3rd' },
    ...(hasOT
      ? isPlayoff
        ? Array.from({ length: otCount }, (_, i) => ({
            id: `OT${i + 1}`,
            label: `Overtime ${i + 1}`,
            shortLabel: `OT${i + 1}`,
          }))
        : [{ id: 'OT', label: 'OT', shortLabel: 'OT' }]
      : []),
    // Shootouts don't exist in playoffs — suppress SO column for playoff games.
    ...(hasSO ? [{ id: 'SO', label: 'SO', shortLabel: 'SO' }] : []),
  ];

  return (
    <>
      {/* ── Scoreboard card ── */}
      <ScoreboardCard
        game={game}
        isFinal={isFinal}
        isInProgress={isInProgress}
        isEditMode={isEditMode}
        liveAwayScore={liveAwayScore}
        liveHomeScore={liveHomeScore}
        overtimeSuffix={overtimeSuffix}
        leagueId={isAdminView ? leagueId : undefined}
      />

      {/* ── Tabs ── */}
      <Tabs
        activeIndex={activeTab}
        onTabChange={handleTabChange}
        tabs={[
          {
            label: 'Summary',
            icon: 'apps',
            content: (
              <GameSummaryTab
                game={game}
                isFinal={isFinal}
                isInProgress={isInProgress}
                isEditMode={isEditMode}
                setIsEditMode={setIsEditMode}
                editable={isAdminView}
                showPlayerDataStatus={isAdminUser}
                busy={busy}
                leagueId={leagueId}
                seasonId={seasonId ?? ''}
                liveAwayScore={liveAwayScore}
                liveHomeScore={liveHomeScore}
                overtimeSuffix={overtimeSuffix}
                gameHrefBuilder={gameHrefBuilder}
                playerHrefBuilder={playerHrefBuilder}
                linescorePeriods={linescorePeriods}
                goalieStats={goalieStats}
                awayRoster={awayRoster}
                homeRoster={homeRoster}
                roster={roster}
                lineup={lineup}
                rosterReady={rosterReady}
                lineupsReady={lineupsReady}
                upsertGoalieStat={upsertGoalieStat}
                switchGoalie={switchGoalie}
                removeGoalieStat={removeGoalieStat}
                updateGoalieStint={updateGoalieStint}
                removeGoalieStint={removeGoalieStint}
                startGame={startGame}
                updateStatus={updateStatus}
                advancePeriod={advancePeriod}
                advanceOTPeriod={advanceOTPeriod}
                revertOTPeriod={revertOTPeriod}
                endGame={endGame}
                updateStars={updateStars}
                updateGameInfo={updateGameInfo}
                updatePeriodShots={updatePeriodShots}
                revertToEditMode={revertToEditMode}
                deleteGame={deleteGame}
              />
            ),
          },
          {
            label: 'Lineups',
            icon: 'set_lineup',
            content: (
              <GameLineupsTab
                game={game}
                isEditMode={isEditMode}
                readOnly={!isAdminView}
                showPlayerDataStatus={isAdminUser}
                isFinal={isFinal}
                leagueId={leagueId}
                seasonId={seasonId}
                playerHrefBuilder={playerHrefBuilder}
                awayRoster={awayRoster}
                homeRoster={homeRoster}
                awayRosterInherited={awayRosterInherited}
                homeRosterInherited={homeRosterInherited}
                lineup={lineup}
                saveTeamLineup={saveTeamLineup}
                addToRoster={addToRoster}
                removeFromRoster={removeFromRoster}
              />
            ),
          },
        ]}
      />
    </>
  );
};

export default GameDetailsPage;
