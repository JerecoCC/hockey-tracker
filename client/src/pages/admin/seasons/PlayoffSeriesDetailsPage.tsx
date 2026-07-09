import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import Section from '@jerecocc/tracker-ui/components/Section/Section';
import Button from '@jerecocc/tracker-ui/components/Button/Button';
import LoadingSpinner from '@jerecocc/tracker-ui/components/LoadingSpinner/LoadingSpinner';
import Skeleton from '@jerecocc/tracker-ui/components/Skeleton/Skeleton';
import { usePageBreadcrumbs } from '@/context/BreadcrumbContext';
import type { TagIntent } from '@jerecocc/tracker-ui/components/Tag/Tag';
import useLeagues from '@/hooks/useLeagues';
import useLeagueDetails from '@/hooks/useLeagueDetails';
import useDocumentIcon from '@/hooks/useDocumentIcon';
import useGames, {
  type GameRecord,
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
import GameListItem from '@/shared/GameListItem';
import GameFormModal, { type GameFormTeam } from './GameFormModal';
import { buildPlayoffSeriesDocumentTitle } from './playoffSeriesDocumentTitle';
import styles from './PlayoffSeriesDetailsPage.module.scss';

const STATUS_LABEL: Record<GameStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  final: 'Final',
  postponed: 'Postponed',
};

const STATUS_INTENT: Record<GameStatus, TagIntent> = {
  scheduled: 'info',
  in_progress: 'warning',
  final: 'success',
  postponed: 'warning',
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

const SeriesGamesSkeleton = ({ count }: { count: number }) => (
  <ul
    className={styles.gameList}
    aria-label="Loading series games"
  >
    {Array.from({ length: count }, (_, index) => (
      <li
        key={index}
        className={styles.gameSkeletonItem}
      >
        <div className={styles.gameSkeletonMain}>
          <Skeleton
            type="text"
            width="5.75rem"
          />
          <div className={styles.gameSkeletonTeamRow}>
            <Skeleton
              type="circle"
              width="1.5rem"
              height="1.5rem"
            />
            <Skeleton
              type="text"
              width="3rem"
            />
          </div>
          <div className={styles.gameSkeletonTeamRow}>
            <Skeleton
              type="circle"
              width="1.5rem"
              height="1.5rem"
            />
            <Skeleton
              type="text"
              width="3rem"
            />
          </div>
        </div>
        <div className={styles.gameSkeletonMiddle}>
          <Skeleton
            type="text"
            width="8rem"
          />
          <Skeleton
            type="text"
            width="12rem"
          />
        </div>
        <Skeleton
          type="tag"
          className={styles.gameSkeletonStatus}
        />
      </li>
    ))}
  </ul>
);

const teamInfoFromSeries = (series: PlayoffSeriesRecord, side: 'home' | 'away'): TeamInfo => {
  const isHome = side === 'home';
  const id = isHome ? series.home_team_id : series.away_team_id;
  const name = isHome ? series.home_team_name : series.away_team_name;
  const placeName = isHome ? series.home_team_place_name : series.away_team_place_name;
  const teamName = isHome ? series.home_team_team_name : series.away_team_team_name;
  const code = isHome ? series.home_team_code : series.away_team_code;
  const logo = isHome ? series.home_team_logo : series.away_team_logo;
  const logoDark = isHome ? series.home_team_logo_dark : series.away_team_logo_dark;
  const logoLight = isHome ? series.home_team_logo_light : series.away_team_logo_light;
  const primary = isHome ? series.home_team_primary_color : series.away_team_primary_color;
  const secondary = isHome ? series.home_team_secondary_color : series.away_team_secondary_color;
  const text = isHome ? series.home_team_text_color : series.away_team_text_color;

  return {
    id: id ?? `${side}-team`,
    name: name ?? code ?? 'TBD',
    place_name: placeName ?? null,
    team_name: teamName ?? null,
    code: code ?? 'TBD',
    logo: logo ?? null,
    logo_dark: logoDark ?? null,
    logo_light: logoLight ?? null,
    primary_color: primary ?? fallbackTeamColor.primary,
    secondary_color: secondary ?? fallbackTeamColor.secondary,
    text_color: text ?? fallbackTeamColor.text,
  };
};

const PlayoffSeriesDetailsPage = () => {
  const {
    leagueSlug = '',
    seasonSlug = '',
    seriesSlug = '',
  } = useParams<{
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
  const {
    series,
    loading: seriesLoading,
    busy: seriesBusy,
    startSeries,
  } = usePlayoffSeries(seasonId);
  const { createGame, updateGame } = useGames({ seasonId });
  const queryClient = useQueryClient();
  const [editTarget, setEditTarget] = useState<GameRecord | null>(null);
  const [startingSeriesId, setStartingSeriesId] = useState<string | null>(null);

  // updateGame only invalidates the games cache; refresh the series so the
  // games list reflects the edit immediately.
  const handleUpdateGame = async (id: string, data: Parameters<typeof updateGame>[1]) => {
    const ok = await updateGame(id, data);
    if (ok && seasonId) {
      await queryClient.invalidateQueries({ queryKey: ['playoff-series', seasonId] });
    }
    return ok;
  };
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
  const handleStartSeries = async () => {
    if (!playoffSeries) return;
    setStartingSeriesId(playoffSeries.id);
    try {
      await startSeries(playoffSeries.id);
    } finally {
      setStartingSeriesId(null);
    }
  };

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
  const title = buildPlayoffSeriesDocumentTitle(playoffSeries, routeSeason);
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
      playoff_matchup_names: playoffSeries.playoff_matchup_names ?? null,
      bracket_slot_key: playoffSeries.bracket_slot_key ?? null,
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
  const visibleGames = playoffSeries.games;
  const isStartingSeries = startingSeriesId === playoffSeries.id || seriesBusy === playoffSeries.id;
  const canStartSeries =
    visibleGames.length === 0 &&
    playoffSeries.status === 'upcoming' &&
    !!playoffSeries.home_team_id &&
    !!playoffSeries.away_team_id;
  const seriesGamesSkeletonCount = Math.max(1, playoffSeries.games_to_win * 2 - 1);
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

  // The form modal edits a small subset of fields (date, time, teams, venue).
  // Both series teams are offered so home/away can be corrected.
  const seriesTeams: GameFormTeam[] = [awayTeam, homeTeam].map((team) => ({
    id: team.id,
    name: team.name,
    code: team.code,
    logo: team.logo,
    logo_dark: team.logo_dark,
    logo_light: team.logo_light,
    home_arena: null,
  }));

  const toEditTarget = (game: SeriesGame): GameRecord =>
    ({
      id: game.id,
      season_id: seasonId ?? '',
      game_type: 'playoff',
      status: game.status,
      scheduled_at: game.scheduled_at,
      scheduled_time: game.scheduled_time,
      venue: game.venue,
      home_team: teamForId(game.home_team_id),
      away_team: teamForId(game.away_team_id),
      home_score: game.home_goals,
      away_score: game.away_goals,
      overtime_periods: game.overtime_periods,
      shootout: game.shootout,
      game_number_in_series: game.game_number_in_series,
      playoff_round: playoffSeries.round,
      notes: null,
    }) as GameRecord;

  return (
    <div className={styles.page}>
      <ScoreboardCard
        game={scoreboardGame}
        isFinal={playoffSeries.status === 'complete'}
        isInProgress={playoffSeries.status === 'active'}
        liveAwayScore={playoffSeries.away_wins}
        liveHomeScore={playoffSeries.home_wins}
        seriesScore={{
          awayWins: playoffSeries.away_wins,
          homeWins: playoffSeries.home_wins,
          winsNeeded: playoffSeries.games_to_win,
        }}
        overtimeSuffix=""
        leagueId={routeLeagueId}
        leagueCode={leagueCode}
        disabled={!playoffSeries.home_team_id || !playoffSeries.away_team_id}
      />

      <Section
        title="Series Games"
        action={
          canStartSeries ? (
            <Button
              variant="filled"
              intent="accent"
              icon="play_arrow"
              disabled={isStartingSeries}
              onClick={handleStartSeries}
            >
              {isStartingSeries ? 'Starting...' : 'Start Series'}
            </Button>
          ) : undefined
        }
      >
        {isStartingSeries ? (
          <SeriesGamesSkeleton count={seriesGamesSkeletonCount} />
        ) : visibleGames.length === 0 ? (
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
                    logoDark: gameAway.logo_dark,
                    logoLight: gameAway.logo_light,
                    code: gameAway.code,
                    primaryColor: gameAway.primary_color,
                    textColor: gameAway.text_color,
                  }}
                  homeTeam={{
                    logo: gameHome.logo,
                    logoDark: gameHome.logo_dark,
                    logoLight: gameHome.logo_light,
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
                  actions={[
                    {
                      icon: 'edit',
                      tooltip: 'Edit game',
                      onClick: () => setEditTarget(toEditTarget(game)),
                    },
                  ]}
                />
              );
            })}
          </ul>
        )}
      </Section>

      <GameFormModal
        open={editTarget !== null}
        seasonId={seasonId ?? ''}
        editTarget={editTarget}
        seasonTeams={seriesTeams}
        createGame={createGame}
        updateGame={handleUpdateGame}
        onClose={() => setEditTarget(null)}
      />
    </div>
  );
};

export default PlayoffSeriesDetailsPage;
