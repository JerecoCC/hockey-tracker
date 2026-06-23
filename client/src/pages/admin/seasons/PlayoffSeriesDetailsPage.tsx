import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import Card from '@/components/Card/Card';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { usePageBreadcrumbs } from '@/context/BreadcrumbContext';
import type { BadgeIntent } from '@/components/Badge/Badge';
import useLeagues from '@/hooks/useLeagues';
import useLeagueDetails from '@/hooks/useLeagueDetails';
import useDocumentIcon from '@/hooks/useDocumentIcon';
import {
  type GameStatus,
  type PlayoffSeriesRecord,
  type SeriesGame,
  type TeamInfo,
  usePlayoffSeries,
} from '@/hooks/useGames';
import {
  buildGameDetailsPath,
  buildLeagueDetailsPath,
  buildSeasonDetailsPath,
  playoffSeriesRouteSlug,
  toRouteSlug,
  UUID_PATTERN,
} from '@/lib/routeSlugs';
import ScoreboardCard from '@/pages/admin/games/game-details/ScoreboardCard';
import GameListItem from '@/components/GameListItem';
import styles from './PlayoffSeriesDetailsPage.module.scss';

const STATUS_LABEL: Record<GameStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  final: 'Final',
  postponed: 'Postponed',
  cancelled: 'Cancelled',
};

const STATUS_INTENT: Record<GameStatus, BadgeIntent> = {
  scheduled: 'info',
  in_progress: 'warning',
  final: 'success',
  postponed: 'warning',
  cancelled: 'danger',
};

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const fallbackTeamColor = {
  primary: '#1f2937',
  secondary: '#374151',
  text: '#f9fafb',
};

const formatDate = (scheduledAt: string | null) => {
  if (!scheduledAt) return undefined;
  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) return scheduledAt.slice(0, 10);
  return DATE_FMT.format(date);
};

const formatTime = (hhmm: string | null, scheduledAt: string | null) => {
  if (!hhmm) return undefined;
  const [hStr, mStr] = hhmm.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;

  const period = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const minute = String(m).padStart(2, '0');
  const base = scheduledAt ? new Date(scheduledAt) : new Date();
  const etDatePart = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
  }).format(base);
  const abbr =
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      timeZoneName: 'short',
    })
      .formatToParts(new Date(`${etDatePart}T12:00:00`))
      .find((part) => part.type === 'timeZoneName')?.value ?? 'ET';
  return `${hour12}:${minute} ${period} ${abbr}`;
};

const formatStatusLabel = (game: SeriesGame) => {
  if (game.status !== 'final') return STATUS_LABEL[game.status];
  if (game.shootout) return 'Final/SO';
  if ((game.overtime_periods ?? 0) > 0) return 'Final/OT';
  return 'Final';
};

const seriesStatusToGameStatus = (status: PlayoffSeriesRecord['status']): GameStatus => {
  if (status === 'complete') return 'final';
  if (status === 'active') return 'in_progress';
  return 'scheduled';
};

const teamInfoFromSeries = (
  series: PlayoffSeriesRecord,
  side: 'home' | 'away',
): TeamInfo => {
  const isHome = side === 'home';
  const id = isHome ? series.home_team_id : series.away_team_id;
  const name = isHome ? series.home_team_name : series.away_team_name;
  const code = isHome ? series.home_team_code : series.away_team_code;
  const logo = isHome ? series.home_team_logo : series.away_team_logo;
  const primary = isHome ? series.home_team_primary_color : series.away_team_primary_color;
  const secondary = isHome ? series.home_team_secondary_color : series.away_team_secondary_color;
  const text = isHome ? series.home_team_text_color : series.away_team_text_color;

  return {
    id: id ?? `${side}-team`,
    name: name ?? code ?? 'TBD',
    code: code ?? 'TBD',
    logo: logo ?? null,
    primary_color: primary ?? fallbackTeamColor.primary,
    secondary_color: secondary ?? fallbackTeamColor.secondary,
    text_color: text ?? fallbackTeamColor.text,
  };
};

const PlayoffSeriesDetailsPage = () => {
  const { leagueSlug = '', seasonSlug = '', seriesSlug = '' } = useParams<{
    leagueSlug?: string;
    seasonSlug?: string;
    seriesSlug?: string;
  }>();

  const isLegacyLeagueRoute = UUID_PATTERN.test(leagueSlug);
  const isLegacySeasonRoute = UUID_PATTERN.test(seasonSlug);
  const { leagues, loading: leaguesLoading } = useLeagues();
  const routeLeague = isLegacyLeagueRoute
    ? null
    : leagues.find(
        (item) => toRouteSlug(item.code) === leagueSlug || toRouteSlug(item.name) === leagueSlug,
      );
  const routeLeagueId = isLegacyLeagueRoute ? leagueSlug : routeLeague?.id;
  const { league, seasons, loading: leagueDetailsLoading } = useLeagueDetails(routeLeagueId);
  useDocumentIcon(league?.icon);

  const routeSeason = isLegacySeasonRoute
    ? null
    : seasons.find((item) => toRouteSlug(item.name) === seasonSlug);
  const seasonId = isLegacySeasonRoute ? seasonSlug : routeSeason?.id;
  const { series, loading: seriesLoading } = usePlayoffSeries(seasonId);
  const playoffSeries =
    series.find(
      (item) =>
        item.id === seriesSlug ||
        playoffSeriesRouteSlug({
          awayTeamCode: item.away_team_code,
          homeTeamCode: item.home_team_code,
          seriesId: item.id,
        }) === seriesSlug,
    ) ?? null;

  const leagueCode = league?.code ?? routeLeague?.code ?? leagueSlug;
  const leagueHref = buildLeagueDetailsPath({
    leagueCode,
    leagueId: routeLeagueId,
  });
  const seasonName = routeSeason?.name ?? 'Season';
  const seasonHref = buildSeasonDetailsPath({
    leagueCode,
    leagueId: routeLeagueId,
    seasonName,
    seasonId,
  });
  const loading = leaguesLoading || leagueDetailsLoading || seriesLoading;
  const title = 'Series Details';
  const matchupLabel = playoffSeries
    ? `${playoffSeries.away_team_code ?? 'TBD'} vs ${playoffSeries.home_team_code ?? 'TBD'}`
    : title;

  useEffect(() => {
    document.title = title;
    return () => {
      document.title = 'Hockey Tracker';
    };
  }, [title]);

  usePageBreadcrumbs(
    loading
      ? null
      : {
          backPath: seasonHref,
          backLabel: `Back to ${seasonName}`,
          items: [
            { label: leagueCode, path: leagueHref },
            { label: seasonName, path: seasonHref },
            { label: matchupLabel },
          ],
        },
    [loading, leagueCode, leagueHref, matchupLabel, seasonHref, seasonName],
  );

  const scoreboardGame = useMemo(() => {
    if (!playoffSeries) return null;
    return {
      status: seriesStatusToGameStatus(playoffSeries.status),
      scheduled_at: null,
      scheduled_time: null,
      playoff_round: playoffSeries.round,
      playoff_round_names: playoffSeries.playoff_round_names ?? null,
      game_number_in_series: null,
      home_team: teamInfoFromSeries(playoffSeries, 'home'),
      away_team: teamInfoFromSeries(playoffSeries, 'away'),
    };
  }, [playoffSeries]);

  if (loading) {
    return (
      <LoadingSpinner
        message="Loading playoff series..."
        layout="page"
        size="lg"
      />
    );
  }

  if (!playoffSeries || !scoreboardGame) {
    return <p className={styles.emptyState}>Playoff series not found.</p>;
  }

  const homeTeam = scoreboardGame.home_team;
  const awayTeam = scoreboardGame.away_team;
  const visibleGames = playoffSeries.games.filter((game) => game.status !== 'cancelled');
  const teamForId = (teamId: string) => (teamId === homeTeam.id ? homeTeam : awayTeam);
  const gameHref = (game: SeriesGame) => {
    const gameHome = teamForId(game.home_team_id);
    const gameAway = teamForId(game.away_team_id);
    return buildGameDetailsPath({
      leagueCode,
      leagueId: routeLeagueId,
      seasonName,
      seasonId,
      gameId: game.id,
      awayTeamCode: gameAway.code,
      homeTeamCode: gameHome.code,
      scheduledAt: game.scheduled_at,
    });
  };

  return (
    <div className={styles.page}>
      <ScoreboardCard
        game={scoreboardGame}
        isFinal={playoffSeries.status === 'complete'}
        isInProgress={playoffSeries.status === 'active'}
        liveAwayScore={playoffSeries.away_wins}
        liveHomeScore={playoffSeries.home_wins}
        overtimeSuffix=""
        leagueId={routeLeagueId}
        leagueCode={leagueCode}
        disabled={!playoffSeries.home_team_id || !playoffSeries.away_team_id}
      />

      <Card title="Series Games">
        {visibleGames.length === 0 ? (
          <p className={styles.emptyState}>No games have been generated for this series yet.</p>
        ) : (
          <ul className={styles.gameList}>
            {visibleGames.map((game) => {
              const gameHome = teamForId(game.home_team_id);
              const gameAway = teamForId(game.away_team_id);
              const showScore = game.status === 'final' || game.status === 'in_progress';

              return (
                <GameListItem
                  key={game.id}
                  href={gameHref(game)}
                  awayTeam={{
                    logo: gameAway.logo,
                    code: gameAway.code,
                    primaryColor: gameAway.primary_color,
                    textColor: gameAway.text_color,
                  }}
                  homeTeam={{
                    logo: gameHome.logo,
                    code: gameHome.code,
                    primaryColor: gameHome.primary_color,
                    textColor: gameHome.text_color,
                  }}
                  awayScore={game.away_goals}
                  homeScore={game.home_goals}
                  showScore={showScore}
                  isFinal={game.status === 'final'}
                  statusLabel={formatStatusLabel(game)}
                  statusIntent={STATUS_INTENT[game.status]}
                  date={formatDate(game.scheduled_at)}
                  time={formatTime(game.scheduled_time, game.scheduled_at)}
                  venue={game.venue ?? undefined}
                  gameNumberInSeries={game.game_number_in_series}
                  gameType="playoff"
                />
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
};

export default PlayoffSeriesDetailsPage;
