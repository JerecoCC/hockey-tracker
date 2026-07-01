import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import Card from '@/components/Card/Card';
import GameListItem from '@/components/GameListItem';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import Section from '@/components/Section/Section';
import Select, { type SelectOption } from '@/components/Select/Select';
import Tag, { type TagIntent } from '@/components/Tag/Tag';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
import { usePageBreadcrumbs } from '@/context/BreadcrumbContext';
import type { GameRecord, GameStatus } from '@/hooks/useGames';
import { buildUserGameDetailsPath, userWatchedTeamRouteSlug } from '@/lib/routeSlugs';
import {
  getScheduledGameYear,
  getWatchedTeamSummaries,
  getWatchedYears,
  type TeamWatchSummary,
  type WatchedTeam,
} from '@/lib/watchedTeams';
import styles from './UserGamesWatchedTeam.module.scss';

const API = import.meta.env.VITE_API_URL || '/api';
const ALL_YEARS = 'all';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

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
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const DATE_ONLY_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

const getTeamName = (team: WatchedTeam) => team.team_name || team.name;

const formatRecord = ({ wins, losses, otSoLosses }: TeamWatchSummary['record']) =>
  `${wins}-${losses}-${otSoLosses}`;

const parseDateValue = (value: string | null | undefined) => {
  if (!value) return null;
  if (DATE_ONLY_RE.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value: string | null | undefined) => {
  const date = parseDateValue(value);
  if (!date) return undefined;
  return DATE_FMT.format(date);
};

const formatScheduledWatchDate = (value: string | null | undefined) => {
  const date = formatDate(value);
  return date ? `Scheduled watch: ${date}` : undefined;
};

const formatTime = (hhmm: string | null | undefined) => {
  if (!hhmm) return undefined;
  const [hStr, mStr] = hhmm.split(':');
  const hour = Number(hStr);
  const minute = Number(mStr);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return hhmm;
  const period = hour < 12 ? 'AM' : 'PM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
};

const getGameDateValue = (game: GameRecord) =>
  game.scheduled_at ?? game.scheduled_for ?? game.watched_on ?? game.created_at;

const dateSortValue = (game: GameRecord) => parseDateValue(getGameDateValue(game))?.getTime() ?? 0;

const formatStatusLabel = (game: GameRecord) => {
  if (game.status !== 'final') return STATUS_LABEL[game.status];
  if (game.shootout || game.period_scores.some((periodScore) => periodScore.period === 'SO')) {
    return 'Final/SO';
  }
  if (
    (game.overtime_periods ?? 0) > 0 ||
    game.period_scores.some((periodScore) => periodScore.period === 'OT')
  ) {
    return 'Final/OT';
  }
  return 'Final';
};

const gameIncludesTeam = (game: GameRecord, teamId: string) =>
  game.home_team.id === teamId || game.away_team.id === teamId;

const getTeamSlug = (team: WatchedTeam) =>
  userWatchedTeamRouteSlug({
    teamCode: team.code,
    teamName: getTeamName(team),
    teamPlaceName: team.place_name,
    teamId: team.id,
  });

const getLegacyTeamSlug = (team: WatchedTeam) =>
  userWatchedTeamRouteSlug({
    teamCode: team.code,
    teamId: team.id,
  });

const getScrollParent = (el: HTMLElement): HTMLElement => {
  let parent = el.parentElement;
  while (parent) {
    const { overflowY } = window.getComputedStyle(parent);
    if (overflowY === 'auto' || overflowY === 'scroll') return parent;
    parent = parent.parentElement;
  }
  return document.documentElement;
};

const TeamWatchedHero = ({ summary }: { summary: TeamWatchSummary }) => {
  const { team, count, record } = summary;
  const teamName = getTeamName(team);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isStuck, setIsStuck] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const isMobile = () => window.innerWidth <= 768;
    const headerHeight = () => (isMobile() ? 88 : 52);
    const scrollEl = getScrollParent(sentinel);

    const check = () => {
      if (isMobile()) {
        setIsStuck(false);
        return;
      }
      setIsStuck(sentinel.getBoundingClientRect().top <= headerHeight());
    };

    scrollEl.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check, { passive: true });
    check();

    return () => {
      scrollEl.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, []);

  return (
    <>
      <div
        ref={sentinelRef}
        style={{ height: 0 }}
      />
      <Card
        className={[styles.heroCard, isStuck ? styles.heroCardStuck : ''].filter(Boolean).join(' ')}
        style={
          {
            padding: 0,
            '--team-primary': team.primary_color,
            '--team-secondary': team.text_color,
            '--team-text': team.text_color,
          } as CSSProperties
        }
      >
        <section
          className={styles.hero}
          aria-label={`${teamName} watched games summary`}
        >
          <div
            className={styles.heroPrimaryFill}
            data-testid="team-hero-primary-fill"
          />
          <div
            className={`${styles.heroStrip} ${styles.heroStripLeft}`}
            data-testid="team-hero-left-strip"
          >
            <span className={styles.heroStripPrimary} />
            <span className={styles.heroStripSecondary} />
            <span className={styles.heroStripSecondary2} />
          </div>
          <div
            className={`${styles.heroStrip} ${styles.heroStripRight}`}
            data-testid="team-hero-right-strip"
          >
            <span className={styles.heroStripPrimary} />
            <span className={styles.heroStripSecondary} />
            <span className={styles.heroStripSecondary2} />
          </div>

          <div className={styles.heroContent}>
            <TeamLogo
              logo={team.logo}
              logoDark={team.logo_dark}
              logoLight={team.logo_light}
              code={team.code}
              alt={teamName}
              primaryColor={team.primary_color}
              textColor={team.text_color}
              size={60}
              className={styles.heroLogo}
            />
            <div className={styles.heroText}>
              {team.place_name && <span className={styles.heroPlace}>{team.place_name}</span>}
              <h2 className={styles.heroName}>{teamName}</h2>
              <span className={styles.heroMeta}>
                {count} seen <span aria-hidden="true">•</span> {formatRecord(record)}
              </span>
            </div>
          </div>
        </section>
      </Card>
    </>
  );
};

const UserGamesWatchedTeam = () => {
  const { teamSlug = '' } = useParams<{ teamSlug?: string }>();
  const yearFilterLabelId = useId();
  const [selectedYear, setSelectedYear] = useState(ALL_YEARS);

  const { data: watchedGames = [], isLoading } = useQuery<GameRecord[]>({
    queryKey: ['user-games-watched'],
    queryFn: async () => {
      const { data } = await axios.get<GameRecord[]>(`${API}/user/games`, {
        headers: authHeaders(),
        params: { watched: true, all_teams: true },
      });
      return data;
    },
  });

  const allSummaries = useMemo(() => getWatchedTeamSummaries(watchedGames), [watchedGames]);
  const allTeamSummary = useMemo(
    () =>
      allSummaries.find(
        (item) =>
          item.team.id === teamSlug ||
          getTeamSlug(item.team) === teamSlug ||
          getLegacyTeamSlug(item.team) === teamSlug,
      ) ?? null,
    [allSummaries, teamSlug],
  );

  const allTeamGames = useMemo(() => {
    if (!allTeamSummary) return [];
    return watchedGames
      .filter((game) => game.watched_by_user && gameIncludesTeam(game, allTeamSummary.team.id))
      .sort((a, b) => {
        const dateDiff = dateSortValue(b) - dateSortValue(a);
        if (dateDiff !== 0) return dateDiff;
        return b.id.localeCompare(a.id);
      });
  }, [allTeamSummary, watchedGames]);

  const years = useMemo(() => getWatchedYears(allTeamGames), [allTeamGames]);
  const yearOptions = useMemo<SelectOption[]>(
    () => [
      { value: ALL_YEARS, label: 'All' },
      ...years.map((year) => ({ value: year, label: year })),
    ],
    [years],
  );

  const summary = useMemo(() => {
    if (!allTeamSummary) return null;
    if (selectedYear === ALL_YEARS) return allTeamSummary;
    return (
      getWatchedTeamSummaries(allTeamGames, selectedYear).find(
        (item) => item.team.id === allTeamSummary.team.id,
      ) ?? allTeamSummary
    );
  }, [allTeamGames, allTeamSummary, selectedYear]);

  const teamGames = useMemo(
    () =>
      selectedYear === ALL_YEARS
        ? allTeamGames
        : allTeamGames.filter((game) => getScheduledGameYear(game) === selectedYear),
    [allTeamGames, selectedYear],
  );

  const teamName = allTeamSummary ? getTeamName(allTeamSummary.team) : 'Team';

  usePageBreadcrumbs(
    isLoading
      ? null
      : {
          backPath: '/dashboard/games-watched',
          backLabel: 'Back to Games Watched',
          items: [
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Games Watched', path: '/dashboard/games-watched' },
            { label: allTeamSummary ? teamName : 'Not Found' },
          ],
        },
    [allTeamSummary, isLoading, teamName],
  );

  useEffect(() => {
    if (selectedYear !== ALL_YEARS && !years.includes(selectedYear)) {
      setSelectedYear(ALL_YEARS);
    }
  }, [selectedYear, years]);

  useEffect(() => {
    document.title = allTeamSummary ? `${teamName} Games Watched` : 'Games Watched';
    return () => {
      document.title = 'Hockey Tracker';
    };
  }, [allTeamSummary, teamName]);

  if (isLoading) {
    return (
      <LoadingSpinner
        message="Loading watched games..."
        layout="page"
        size="lg"
      />
    );
  }

  if (!allTeamSummary || !summary) {
    return <p className={styles.emptyState}>Watched team not found.</p>;
  }

  return (
    <div className={styles.page}>
      <TeamWatchedHero summary={summary} />

      <Section
        title="Watched Games"
        action={
          <div className={styles.yearFilter}>
            <span
              id={yearFilterLabelId}
              className={styles.yearLabel}
            >
              Year
            </span>
            <Select
              value={selectedYear}
              options={yearOptions}
              onChange={setSelectedYear}
              ariaLabelledBy={yearFilterLabelId}
              width="content"
            />
          </div>
        }
      >
        {teamGames.length === 0 ? (
          <p className={styles.emptyState}>No watched games found for this team.</p>
        ) : (
          <ul className={styles.gameList}>
            {teamGames.map((game) => {
              const showScore = game.status === 'final' || game.status === 'in_progress';
              const roundLabel =
                game.playoff_round != null ? game.playoff_round_names?.[game.playoff_round] : null;

              return (
                <GameListItem
                  key={game.id}
                  href={buildUserGameDetailsPath({
                    gameId: game.id,
                    awayTeamCode: game.away_team.code,
                    homeTeamCode: game.home_team.code,
                    scheduledAt: game.scheduled_at,
                    scheduledTime: game.scheduled_time,
                  })}
                  awayTeam={{
                    logo: game.away_team.logo,
                    logoDark: game.away_team.logo_dark,
                    logoLight: game.away_team.logo_light,
                    code: game.away_team.code,
                    primaryColor: game.away_team.primary_color,
                    textColor: game.away_team.text_color,
                  }}
                  homeTeam={{
                    logo: game.home_team.logo,
                    logoDark: game.home_team.logo_dark,
                    logoLight: game.home_team.logo_light,
                    code: game.home_team.code,
                    primaryColor: game.home_team.primary_color,
                    textColor: game.home_team.text_color,
                  }}
                  awayScore={game.away_score}
                  homeScore={game.home_score}
                  showScore={showScore}
                  isFinal={game.status === 'final'}
                  statusLabel={formatStatusLabel(game)}
                  statusIntent={STATUS_INTENT[game.status]}
                  date={formatDate(getGameDateValue(game))}
                  time={formatTime(game.scheduled_time)}
                  venue={game.venue ?? undefined}
                  supplementalMeta={formatScheduledWatchDate(game.scheduled_for)}
                  round={game.playoff_round}
                  roundLabel={roundLabel}
                  gameNumberInSeries={game.game_number_in_series}
                  gameNumber={game.game_number}
                  gameType={game.game_type}
                />
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
};

export default UserGamesWatchedTeam;
