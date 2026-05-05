import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Breadcrumbs from '@/components/Breadcrumbs/Breadcrumbs';
import Button from '@/components/Button/Button';
import Tabs from '@/components/Tabs/Tabs';
import TitleRow from '@/components/TitleRow/TitleRow';
import { useGameDetails } from '@/hooks/useGames';
import useGameLineup from '@/hooks/useGameLineup';
import useGameRoster from '@/hooks/useGameRoster';
import useGameGoalieStats from '@/hooks/useGameGoalieStats';
import useShootoutAttempts from '@/hooks/useShootoutAttempts';
import useTabState from '@/hooks/useTabState';
import GameLineupsTab from './lineups/GameLineupsTab';
import GameSummaryTab from './summary/GameSummaryTab';
import ScoreboardCard from './ScoreboardCard';

import styles from './GameDetailsPage.module.scss';
import { DATE_FMT_SHORT } from './formatUtils';

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
  const { goalieStats, upsertGoalieStat, switchGoalie, removeGoalieStat } = useGameGoalieStats(id);
  // attempts is needed here only for soWinnerSide → liveScore calculation for ScoreboardCard.
  // React Query deduplicates the request; GameSummaryTab also calls this hook.
  const { attempts } = useShootoutAttempts(id);
  const [activeTab, handleTabChange] = useTabState('tab:game-details');

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
                  `${game.away_team.code} @ ${game.home_team.code}`,
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
      />

      {/* ── Tabs ── */}
      <Tabs
        activeIndex={activeTab}
        onTabChange={handleTabChange}
        tabs={[
          {
            label: 'Summary',
            content: (
              <GameSummaryTab
                game={game}
                isFinal={isFinal}
                isInProgress={isInProgress}
                busy={busy}
                leagueId={leagueId}
                seasonId={seasonId ?? ''}
                liveAwayScore={liveAwayScore}
                liveHomeScore={liveHomeScore}
                overtimeSuffix={overtimeSuffix}
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
                startGame={startGame}
                updateStatus={updateStatus}
                advancePeriod={advancePeriod}
                endGame={endGame}
                updateStars={updateStars}
                updateGameInfo={updateGameInfo}
                updatePeriodShots={updatePeriodShots}
                deleteGame={deleteGame}
              />
            ),
          },
          {
            label: 'Lineups',
            content: (
              <GameLineupsTab
                game={game}
                isFinal={isFinal}
                leagueId={leagueId}
                seasonId={seasonId}
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
