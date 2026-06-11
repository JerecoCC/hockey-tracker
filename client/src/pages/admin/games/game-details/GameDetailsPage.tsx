import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Tabs from '@/components/Tabs/Tabs';
import { useGameDetails, useGameRouteLookup } from '@/hooks/useGames';
import useLeagueDetails from '@/hooks/useLeagueDetails';
import useLeagues from '@/hooks/useLeagues';
import useGameLineup from '@/hooks/useGameLineup';
import useGameRoster from '@/hooks/useGameRoster';
import useGameGoalieStats from '@/hooks/useGameGoalieStats';
import useShootoutAttempts from '@/hooks/useShootoutAttempts';
import useTabState from '@/hooks/useTabState';
import { usePageBreadcrumbs } from '@/context/BreadcrumbContext';
import GameLineupsTab from './lineups/GameLineupsTab';
import GameSummaryTab from './summary/GameSummaryTab';
import ScoreboardCard from './ScoreboardCard';

import styles from './GameDetailsPage.module.scss';
import { PERIOD, PERIOD_SUFFIX, otPeriodId } from './constants';
import { DATE_FMT_SHORT } from './formatUtils';
import {
  buildGameDetailsPath,
  buildLeagueDetailsPath,
  buildPlayerDetailsPath,
  buildSeasonDetailsPath,
  gameDateRouteSlug,
  gameRouteSlug,
  UUID_PATTERN,
  toRouteSlug,
} from '@/lib/routeSlugs';
import useDocumentIcon from '@/hooks/useDocumentIcon';

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  mode?: 'admin' | 'user';
}

const HEAD_DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
});

const teamTitleName = (team?: { name: string; team_name?: string | null }) =>
  team?.team_name?.trim() || team?.name || '';

const formatHeadDate = (scheduledAt?: string | null) => {
  if (!scheduledAt) return null;
  const match = scheduledAt.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return HEAD_DATE_FMT.format(new Date(scheduledAt));
  const [, year, month, day] = match;
  return HEAD_DATE_FMT.format(new Date(Number(year), Number(month) - 1, Number(day)));
};

const GameDetailsPage = ({ mode = 'admin' }: Props) => {
  const {
    leagueSlug: routeLeagueSlug,
    leagueId: legacyLeagueId = '',
    seasonSlug: routeSeasonSlug,
    seasonId: legacySeasonId,
    id: legacyGameId,
    gameDateSlug,
    gameSlug: routeGameSlug,
  } = useParams<{
    leagueSlug?: string;
    leagueId?: string;
    seasonSlug?: string;
    seasonId?: string;
    id?: string;
    gameDateSlug?: string;
    gameSlug?: string;
  }>();
  const leagueSlug = routeLeagueSlug ?? legacyLeagueId;
  const seasonSlug = routeSeasonSlug ?? legacySeasonId;
  const gameSlug = routeGameSlug ?? legacyGameId;
  const navigate = useNavigate();
  const isAdminView = mode === 'admin';
  const isDatedGameRoute = !!gameDateSlug && !!routeGameSlug && routeGameSlug.includes('-vs-');
  const isLegacyGameRoute =
    (!!legacyGameId && !routeGameSlug) ||
    (!!gameSlug && !isDatedGameRoute) ||
    (!!gameSlug && UUID_PATTERN.test(gameSlug));
  const isLegacyLeagueRoute =
    (!!legacyLeagueId && !routeLeagueSlug) || (!!leagueSlug && UUID_PATTERN.test(leagueSlug));
  const isLegacySeasonRoute =
    (!!legacySeasonId && !routeSeasonSlug) || (!!seasonSlug && UUID_PATTERN.test(seasonSlug));
  const { leagues: allLeagues, loading: leaguesLoading } = useLeagues();
  const routeLeague = isLegacyLeagueRoute
    ? null
    : allLeagues.find(
        (item) => toRouteSlug(item.code) === leagueSlug || toRouteSlug(item.name) === leagueSlug,
      );
  const routeLeagueId = isLegacyLeagueRoute ? leagueSlug : routeLeague?.id;
  const {
    league,
    seasons: routeSeasons,
    loading: leagueDetailsLoading,
  } = useLeagueDetails(routeLeagueId);
  useDocumentIcon(league?.icon);
  const routeSeason = isLegacySeasonRoute
    ? null
    : routeSeasons.find((item) => toRouteSlug(item.name) === seasonSlug);
  const routeSeasonId = isLegacySeasonRoute ? seasonSlug : routeSeason?.id;
  const shouldResolveGameRoute =
    isAdminView && isDatedGameRoute && !isLegacyGameRoute && !!routeSeasonId && !!gameSlug;
  const {
    gameId: routeGameId,
    loading: routeGameLookupLoading,
    notFound: routeGameLookupNotFound,
    failed: routeGameLookupFailed,
  } = useGameRouteLookup({
    seasonId: routeSeasonId,
    gameDateSlug,
    gameSlug,
    enabled: shouldResolveGameRoute,
  });
  const gameId = isLegacyGameRoute ? gameSlug : (routeGameId ?? undefined);
  const {
    game,
    loading: gameDetailsLoading,
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
    notFound: gameNotFound,
    failed: gameLoadFailed,
  } = useGameDetails(gameId, { mode });

  useEffect(() => {
    if (!game) return;
    const matchup = [teamTitleName(game.away_team), teamTitleName(game.home_team)]
      .filter(Boolean)
      .join(' - ');
    const date = formatHeadDate(game.scheduled_at);
    document.title = [matchup, date].filter(Boolean).join(' · ');
    return () => {
      document.title = 'Hockey Tracker';
    };
  }, [game]);

  const loading =
    gameDetailsLoading ||
    (!isLegacyLeagueRoute && leaguesLoading) ||
    (!isLegacySeasonRoute && leagueDetailsLoading) ||
    routeGameLookupLoading;
  const gameHasStarted = !!game && game.status !== 'scheduled';
  const hasShootout = !!game?.shootout;
  const shouldFetchShootoutAttempts =
    !!game &&
    (hasShootout || game.current_period === PERIOD.SHOOTOUT || !!game.shootout_first_team_id);
  const {
    goalieStats,
    upsertGoalieStat,
    switchGoalie,
    removeGoalieStat,
    updateGoalieStint,
    removeGoalieStint,
  } = useGameGoalieStats(gameId, { enabled: gameHasStarted });
  // attempts is needed here only for soWinnerSide → liveScore calculation for ScoreboardCard.
  // React Query deduplicates the request; GameSummaryTab also calls this hook.
  const { attempts } = useShootoutAttempts(gameId, { enabled: shouldFetchShootoutAttempts });
  const [activeTab, handleTabChange] = useTabState(
    mode === 'admin' ? 'tab:game-details' : 'tab:user-game-details',
  );
  const [isEditMode, setIsEditMode] = useState(false);

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
  const { roster, addToRoster, removeFromRoster } = useGameRoster(gameId);
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
  const { lineup, saveTeamLineup } = useGameLineup(gameId);

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

  const leagueId = game?.league_id ?? leagueSlug;
  const seasonId = game?.season_id ?? seasonSlug;
  const seasonHref = buildSeasonDetailsPath({
    leagueCode: game?.league_code,
    leagueId,
    seasonName: game?.season_name,
    seasonId,
  });
  const fallbackHref = (() => {
    if (!isAdminView) return '/games';
    if (!isLegacyLeagueRoute && !routeLeague) return '/admin/leagues';
    if (!isLegacySeasonRoute && !routeSeason) {
      return buildLeagueDetailsPath({
        leagueCode: routeLeague?.code ?? game?.league_code,
        leagueId: routeLeagueId ?? game?.league_id,
      });
    }
    return buildSeasonDetailsPath({
      leagueCode: routeLeague?.code ?? game?.league_code ?? leagueSlug,
      leagueId: routeLeagueId ?? game?.league_id ?? leagueId,
      seasonName: routeSeason?.name ?? game?.season_name ?? seasonSlug,
      seasonId: routeSeasonId ?? game?.season_id ?? seasonId,
    });
  })();
  const leagueHref = buildLeagueDetailsPath({
    leagueCode: game?.league_code,
    leagueId,
  });
  const leagueCrumbLabel = game?.league_code ?? 'League';
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
                { label: leagueCrumbLabel, path: leagueHref },
                { label: seasonName, path: seasonHref },
                { label: gameCrumbLabel },
              ]
            : [],
        },
    [loading, isAdminView, seasonHref, seasonName, leagueHref, leagueCrumbLabel, gameCrumbLabel],
  );

  useEffect(() => {
    if (!isAdminView || !game || !gameId) return;
    const canonicalPath = buildGameDetailsPath({
      leagueCode: game.league_code,
      leagueId: game.league_id,
      seasonName: game.season_name,
      seasonId: game.season_id,
      gameId,
      awayTeamCode: game.away_team.code,
      homeTeamCode: game.home_team.code,
      scheduledAt: game.scheduled_at,
    });
    if (
      leagueSlug !== toRouteSlug(game.league_code) ||
      seasonSlug !== toRouteSlug(game.season_name) ||
      gameSlug !==
        gameRouteSlug({
          awayTeamCode: game.away_team.code,
          homeTeamCode: game.home_team.code,
        }) ||
      gameDateSlug !== gameDateRouteSlug(game.scheduled_at)
    ) {
      navigate(canonicalPath, { replace: true });
    }
  }, [game, gameDateSlug, gameId, gameSlug, isAdminView, leagueSlug, navigate, seasonSlug]);

  useEffect(() => {
    if (loading || game) return;
    if (!gameNotFound && !routeGameLookupNotFound) return;
    navigate(fallbackHref, { replace: true });
  }, [fallbackHref, game, gameNotFound, loading, navigate, routeGameLookupNotFound]);

  if (loading) {
    return (
      <div className={styles.loaderWrapper}>
        <span className={styles.spinner} />
        <p className={styles.loaderText}>Loading game…</p>
      </div>
    );
  }

  if (!game && (gameLoadFailed || routeGameLookupFailed)) {
    return <p style={{ color: 'var(--text-dim)' }}>Failed to load game.</p>;
  }

  if (!game) {
    return <p style={{ color: 'var(--text-dim)' }}>Game not found.</p>;
  }

  const gameHrefBuilder = (gameId: string) =>
    isAdminView
      ? buildGameDetailsPath({
          leagueCode: game.league_code,
          leagueId: game.league_id,
          seasonName: game.season_name,
          seasonId: game.season_id,
          gameId,
        })
      : `/games/${gameId}`;
  const playerHrefBuilder = isAdminView
    ? (
        teamId: string,
        _playerId: string,
        firstName: string | null | undefined,
        lastName: string | null | undefined,
      ) => {
        const team =
          teamId === game.away_team.id
            ? game.away_team
            : teamId === game.home_team.id
              ? game.home_team
              : null;
        return buildPlayerDetailsPath({
          leagueCode: game.league_code,
          teamCode: team?.code,
          firstName,
          lastName,
        });
      }
    : undefined;

  const isFinal = game.status === 'final';
  const isInProgress = game.status === 'in_progress';
  // Use the backend-computed score as the canonical base.
  // For an in-progress shootout, the backend intentionally stays on the goal-based tied score,
  // so we still apply a temporary +1 client-side when the current attempts already reveal a winner.
  const hasSoPeriodScore = game.period_scores.some((ps) => ps.period === PERIOD.SHOOTOUT);
  const soScoreAdj = !isFinal && soWinnerSide && !hasSoPeriodScore ? 1 : 0;
  const liveAwayScore = game.away_score + (soWinnerSide === 'away' ? soScoreAdj : 0);
  const liveHomeScore = game.home_score + (soWinnerSide === 'home' ? soScoreAdj : 0);

  // Derive OT/SO from period_scores (source of truth); stored columns are a fallback
  // for legacy games created before goal tracking was introduced.
  const overtimeSuffix =
    game.shootout || game.period_scores.some((ps) => ps.period === PERIOD.SHOOTOUT)
      ? PERIOD_SUFFIX.SHOOTOUT
      : (game.overtime_periods ?? 0) > 0 ||
          game.period_scores.some((ps) => ps.period === PERIOD.OVERTIME)
        ? PERIOD_SUFFIX.OVERTIME
        : '';

  // Period columns for the Linescore table (always 1–3, plus OT/SO if applicable).
  // Playoff games expand OT into separate columns: OT1, OT2, …
  const isPlayoff = game.game_type === 'playoff';
  const otCount = game.overtime_periods ?? 1;
  const hasSO =
    !isPlayoff &&
    (game.period_scores.some((ps) => ps.period === PERIOD.SHOOTOUT) ||
      game.shootout ||
      game.current_period === PERIOD.SHOOTOUT);
  const hasOT =
    !hasSO &&
    (game.period_scores.some((ps) => ps.period === PERIOD.OVERTIME) ||
      (game.overtime_periods ?? 0) > 0 ||
      game.current_period === PERIOD.OVERTIME);
  // Compact numeric labels when multiple OT columns are present in a playoff game.
  const useShortNums = isPlayoff && otCount > 1;
  const linescorePeriods: { id: string; label: string; shortLabel: string }[] = [
    { id: '1', label: '1st', shortLabel: useShortNums ? '1' : '1st' },
    { id: '2', label: '2nd', shortLabel: useShortNums ? '2' : '2nd' },
    { id: '3', label: '3rd', shortLabel: useShortNums ? '3' : '3rd' },
    ...(hasOT
      ? isPlayoff
        ? Array.from({ length: otCount }, (_, i) => ({
            id: otPeriodId(i + 1),
            label: `Overtime ${i + 1}`,
            shortLabel: otPeriodId(i + 1),
          }))
        : [{ id: PERIOD.OVERTIME, label: PERIOD.OVERTIME, shortLabel: PERIOD.OVERTIME }]
      : []),
    // Shootouts don't exist in playoffs — suppress SO column for playoff games.
    ...(hasSO
      ? [{ id: PERIOD.SHOOTOUT, label: PERIOD.SHOOTOUT, shortLabel: PERIOD.SHOOTOUT }]
      : []),
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
        leagueCode={game.league_code}
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
                showPlayerDataStatus={isAdminView}
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
                showPlayerDataStatus={isAdminView}
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
