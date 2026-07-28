import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import Badge from '@jerecocc/tracker-ui/components/Badge/Badge';
import Card from '@jerecocc/tracker-ui/components/Card/Card';
import Divider from '@jerecocc/tracker-ui/components/Divider/Divider';
import GameCard from '@/shared/GameCard/GameCard';
import Section from '@jerecocc/tracker-ui/components/Section/Section';
import { type SelectOption } from '@jerecocc/tracker-ui/components/Select/Select';
import Skeleton from '@jerecocc/tracker-ui/components/Skeleton/Skeleton';
import StickyHeroCard from '@jerecocc/tracker-ui/components/StickyHeroCard/StickyHeroCard';
import TeamLogo from '@jerecocc/tracker-ui/components/TeamLogo/TeamLogo';
import { usePageBreadcrumbs } from '@/context/BreadcrumbContext';
import type { GameRecord, GameStatus } from '@/hooks/useGames';
import useTeams, { type TeamRecord } from '@/hooks/useTeams';
import { buildUserGameDetailsPath, userWatchedTeamRouteSlug } from '@/lib/routeSlugs';
import EmptyMessage from '@/shared/EmptyMessage/EmptyMessage';
import ResponsiveList from '@/shared/ResponsiveList/ResponsiveList';
import YearFilter from '@/shared/YearFilter/YearFilter';
import {
  getScheduledGameYear,
  getWatchedTeamSummaries,
  getWatchedYears,
  type TeamWatchSummary,
  type WatchedTeam,
} from '@/lib/watchedTeams';
import styles from './UserGamesWatchedTeam.module.scss';

import { API, authHeaders } from '@/lib/apiClient';
import { SCREEN_BREAKPOINTS } from '@/lib/screenSize';
const ALL_YEARS = 'all';
const HERO_STICKY_TOP = 52;

const getScrollContainer = (element: HTMLElement) => {
  let parent = element.parentElement;

  while (parent) {
    const { overflowY } = window.getComputedStyle(parent);
    if (overflowY === 'auto' || overflowY === 'scroll') return parent;
    parent = parent.parentElement;
  }

  return document.documentElement;
};

const getGamePath = (game: GameRecord) =>
  buildUserGameDetailsPath({
    gameId: game.id,
    awayTeamCode: game.away_team.code,
    homeTeamCode: game.home_team.code,
    scheduledAt: game.scheduled_at,
    scheduledTime: game.scheduled_time,
  });

const STATUS_LABEL: Record<GameStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  final: 'Final',
  postponed: 'Postponed',
};

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const DATE_ONLY_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const SKELETON_GAME_ROWS = 4;

const getTeamName = (team: WatchedTeam | TeamRecord) => team.team_name || team.name;

const formatRecord = ({ wins, losses, otSoLosses }: TeamWatchSummary['record']) =>
  `${wins}-${losses}-${otSoLosses}`;

const toWatchedTeam = (team: WatchedTeam | TeamRecord): WatchedTeam => ({
  id: team.id,
  name: team.name,
  place_name: team.place_name,
  team_name: team.team_name,
  code: team.code,
  logo: team.logo,
  logo_dark: team.logo_dark,
  logo_light: team.logo_light,
  primary_color: team.primary_color,
  secondary_color: team.secondary_color,
  text_color: team.text_color,
});

const createEmptySummary = (team: WatchedTeam | TeamRecord): TeamWatchSummary => ({
  team: toWatchedTeam(team),
  count: 0,
  record: {
    wins: 0,
    losses: 0,
    otSoLosses: 0,
  },
});

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
  return date ? `Watched on ${date}` : undefined;
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

const getTeamSlug = (team: WatchedTeam | TeamRecord) =>
  userWatchedTeamRouteSlug({
    teamCode: team.code,
    teamName: getTeamName(team),
    teamPlaceName: team.place_name,
    teamId: team.id,
  });

const getLegacyTeamSlug = (team: WatchedTeam | TeamRecord) =>
  userWatchedTeamRouteSlug({
    teamCode: team.code,
    teamId: team.id,
  });

const teamMatchesSlug = (team: WatchedTeam | TeamRecord, teamSlug: string) =>
  team.id === teamSlug || getTeamSlug(team) === teamSlug || getLegacyTeamSlug(team) === teamSlug;

const TeamWatchedHero = ({ summary }: { summary: TeamWatchSummary }) => {
  const { team, count, record } = summary;
  const teamName = getTeamName(team);
  const heroCardRef = useRef<HTMLDivElement>(null);
  const [isTabletStuck, setIsTabletStuck] = useState(false);

  useEffect(() => {
    const heroCard = heroCardRef.current;
    if (!heroCard) return;

    const scrollContainer = getScrollContainer(heroCard);
    const updateTabletStuckState = () => {
      const isTablet =
        window.innerWidth > SCREEN_BREAKPOINTS.mobileMax &&
        window.innerWidth <= SCREEN_BREAKPOINTS.tabletMax;
      const nextIsStuck =
        isTablet &&
        scrollContainer.scrollTop > 0 &&
        heroCard.getBoundingClientRect().top <= HERO_STICKY_TOP;
      setIsTabletStuck((current) => (current === nextIsStuck ? current : nextIsStuck));
    };

    scrollContainer.addEventListener('scroll', updateTabletStuckState, { passive: true });
    window.addEventListener('resize', updateTabletStuckState, { passive: true });
    updateTabletStuckState();

    return () => {
      scrollContainer.removeEventListener('scroll', updateTabletStuckState);
      window.removeEventListener('resize', updateTabletStuckState);
    };
  }, []);

  return (
    <StickyHeroCard
      ref={heroCardRef}
      className={`${styles.heroCard} ${isTabletStuck ? styles.heroCardStuck : ''}`}
      stuckClassName={styles.heroCardStuck}
      stickyTopPx={HERO_STICKY_TOP}
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
          className={`${styles.heroPrimaryFill} ${styles.heroPrimaryFillLeft}`}
          data-testid="team-hero-primary-fill"
        />
        <div
          className={`${styles.heroPrimaryFill} ${styles.heroPrimaryFillRight}`}
          data-testid="team-hero-right-primary-fill"
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
          <div className={styles.heroTeamInfo}>
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
              <span className={`${styles.heroTeamMeta} ${styles.heroTeamMetaDesktop}`}>
                {formatRecord(record)}
              </span>
            </div>
          </div>
          <div className={`${styles.heroSeen} ${styles.heroSeenDesktop}`}>
            <span className={styles.heroSeenValue}>{count}x</span>
          </div>
          <div
            className={styles.heroStats}
            data-testid="team-hero-stats"
          >
            <div className={styles.heroSeen}>
              <span className={styles.heroSeenValue}>{count}x</span>
            </div>
            <Divider
              orientation="vertical"
              className={styles.heroStatsDivider}
              data-testid="team-hero-stats-divider"
            />
            <span className={styles.heroTeamMeta}>{formatRecord(record)}</span>
          </div>
        </div>
      </section>
    </StickyHeroCard>
  );
};

const UserGamesWatchedTeamSkeleton = () => (
  <div
    className={styles.page}
    aria-label="Loading watched games"
  >
    <Card
      className={styles.heroCard}
      style={{ padding: 0 }}
    >
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroTeamInfo}>
            <Skeleton
              variant="picture"
              width={60}
              height={60}
              className={styles.heroLogo}
            />
            <div className={styles.heroText}>
              <Skeleton
                variant="subtitle"
                width={92}
              />
              <Skeleton
                variant="title"
                width={220}
                height={28}
              />
              <Skeleton
                variant="subtitle"
                width={64}
              />
            </div>
          </div>
          <div className={styles.heroSeen}>
            <Skeleton
              variant="title"
              width={76}
              height={44}
            />
          </div>
        </div>
      </section>
    </Card>

    <Section
      title="Watched Games"
      titleAccessory={
        <Skeleton
          variant="tag"
          width={36}
        />
      }
      action={
        <Skeleton
          variant="block"
          width={104}
          height={36}
        />
      }
    >
      <ResponsiveList>
        {Array.from({ length: SKELETON_GAME_ROWS }, (_, index) => `game-skeleton-${index}`).map(
          (rowKey) => (
            <li
              key={rowKey}
              className={styles.skeletonGameItem}
            >
              <Skeleton
                variant="card"
                className={styles.skeletonGameCard}
              />
            </li>
          ),
        )}
      </ResponsiveList>
    </Section>
  </div>
);

const UserGamesWatchedTeam = () => {
  const { teamSlug = '' } = useParams<{ teamSlug?: string }>();
  const [selectedYear, setSelectedYear] = useState(ALL_YEARS);
  const { teams, loading: teamsLoading } = useTeams();

  const { data: watchedGames = [], isLoading: watchedGamesLoading } = useQuery<GameRecord[]>({
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
  const watchedSummary = useMemo(
    () => allSummaries.find((item) => teamMatchesSlug(item.team, teamSlug)) ?? null,
    [allSummaries, teamSlug],
  );
  const selectedTeam = useMemo(
    () => watchedSummary?.team ?? teams.find((team) => teamMatchesSlug(team, teamSlug)) ?? null,
    [teams, teamSlug, watchedSummary],
  );
  const allTeamSummary = useMemo(() => {
    if (watchedSummary) return watchedSummary;
    return selectedTeam ? createEmptySummary(selectedTeam) : null;
  }, [selectedTeam, watchedSummary]);

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

  const teamGames = useMemo(
    () =>
      selectedYear === ALL_YEARS
        ? allTeamGames
        : allTeamGames.filter((game) => getScheduledGameYear(game) === selectedYear),
    [allTeamGames, selectedYear],
  );

  const teamName = allTeamSummary ? getTeamName(allTeamSummary.team) : 'Team';
  const isLoading = watchedGamesLoading || teamsLoading;

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
    return <UserGamesWatchedTeamSkeleton />;
  }

  if (!allTeamSummary) {
    return <EmptyMessage>Watched team not found.</EmptyMessage>;
  }

  return (
    <div className={styles.page}>
      <TeamWatchedHero summary={allTeamSummary} />

      <Section
        title={<span className={styles.sectionTitle}>Team Games Watched</span>}
        titleAccessory={
          <Badge
            value={teamGames.length}
            aria-label={`${teamGames.length} watched ${teamGames.length === 1 ? 'game' : 'games'} shown`}
          />
        }
        action={
          <YearFilter
            value={selectedYear}
            options={yearOptions}
            onChange={setSelectedYear}
          />
        }
      >
        {teamGames.length === 0 ? (
          <EmptyMessage>No watched games.</EmptyMessage>
        ) : (
          <>
            <ResponsiveList className={styles.gameListItems}>
              {teamGames.map((game) => {
                const showScore = game.status === 'final' || game.status === 'in_progress';

                return (
                  <GameCard
                    key={game.id}
                    variant="list-item"
                    game={game}
                    tzPref="local"
                    href={getGamePath(game)}
                    showScore={showScore}
                    statusLabel={formatStatusLabel(game)}
                    originalDateLabel={formatDate(getGameDateValue(game))}
                    timeLabel={formatTime(game.scheduled_time)}
                    supplementalMeta={formatScheduledWatchDate(game.scheduled_for)}
                  />
                );
              })}
            </ResponsiveList>
            <div className={styles.gameCardGrid}>
              {teamGames.map((game) => (
                <GameCard
                  key={game.id}
                  variant="card"
                  game={game}
                  tzPref="local"
                  href={getGamePath(game)}
                  showScore={game.status === 'final' || game.status === 'in_progress'}
                  originalDateLabel={formatDate(getGameDateValue(game))}
                  timeLabel={formatTime(game.scheduled_time)}
                  showWatchedBanner={false}
                  showTypeIndicator
                />
              ))}
            </div>
          </>
        )}
      </Section>
    </div>
  );
};

export default UserGamesWatchedTeam;
