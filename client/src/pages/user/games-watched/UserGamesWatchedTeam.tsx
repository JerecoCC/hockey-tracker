import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import Card from '@jerecocc/tracker-ui/components/Card/Card';
import InfoTooltip from '@jerecocc/tracker-ui/components/InfoTooltip/InfoTooltip';
import MetricTag from '@jerecocc/tracker-ui/components/MetricTag/MetricTag';
import GameCard from '@/shared/GameCard/GameCard';
import Section from '@jerecocc/tracker-ui/components/Section/Section';
import SegmentedControl from '@jerecocc/tracker-ui/components/SegmentedControl/SegmentedControl';
import { type SelectOption } from '@jerecocc/tracker-ui/components/Select/Select';
import Skeleton from '@jerecocc/tracker-ui/components/Skeleton/Skeleton';
import StickyHeroCard from '@jerecocc/tracker-ui/components/StickyHeroCard/StickyHeroCard';
import TeamLogo from '@jerecocc/tracker-ui/components/TeamLogo/TeamLogo';
import { usePageBreadcrumbs } from '@/context/BreadcrumbContext';
import type { GameRecord, GameStatus } from '@/hooks/useGames';
import useTeams, { type TeamRecord } from '@/hooks/useTeams';
import { buildUserGameDetailsPath, userWatchedTeamRouteSlug } from '@/lib/routeSlugs';
import EmptyMessage from '@/shared/EmptyMessage/EmptyMessage';
import FilterSelect from '@/shared/FilterSelect/FilterSelect';
import ResponsiveList from '@/shared/ResponsiveList/ResponsiveList';
import useResponsiveFilters from '@/shared/ResponsiveFilters/useResponsiveFilters';
import { ScheduleFilterSlot } from '@/shared/ScheduleGamesLayout/ScheduleGamesLayout';
import {
  getScheduledGameYear,
  getWatchedSeasons,
  getWatchedTeamSummaries,
  getWatchedYears,
  type TeamWatchSummary,
  type WatchedTeam,
} from '@/lib/watchedTeams';
import styles from './UserGamesWatchedTeam.module.scss';

import { API, authHeaders } from '@/lib/apiClient';
import { SCREEN_BREAKPOINTS } from '@/lib/screenSize';
const ALL_YEARS = 'all';
const ALL_SEASONS = 'all';
const RECORD_TOOLTIP = 'Wins-Losses-OT Losses';
const HERO_STICKY_TOP = 52;

type TeamSide = 'all' | 'home' | 'away';

const SIDE_OPTIONS: { value: TeamSide; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'home', label: 'Home' },
  { value: 'away', label: 'Away' },
];

const getScrollContainer = (element: HTMLElement) => {
  let parent = element.parentElement;

  while (parent) {
    const { overflowY } = window.getComputedStyle(parent);
    if (overflowY === 'auto' || overflowY === 'scroll') return parent;
    parent = parent.parentElement;
  }

  return document.documentElement;
};

// Personal games have no details page, so their cards don't link anywhere.
const getGamePath = (game: GameRecord) =>
  game.is_personal
    ? undefined
    : buildUserGameDetailsPath({
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

// The hero shows the team's record over the games currently shown, so it follows the filters.
const TeamWatchedHero = ({
  team,
  record,
}: {
  team: WatchedTeam;
  record: TeamWatchSummary['record'];
}) => {
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
            </div>
          </div>
          <div
            className={styles.heroRecord}
            data-testid="team-hero-record"
          >
            <span className={styles.heroRecordValue}>{formatRecord(record)}</span>
            <InfoTooltip
              text={RECORD_TOOLTIP}
              ariaLabel="What the record shows"
              size="0.85rem"
            />
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
            </div>
          </div>
          <div className={styles.heroRecord}>
            <Skeleton
              variant="title"
              width={120}
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
  const [seasonId, setSeasonId] = useState(ALL_SEASONS);
  const [side, setSide] = useState<TeamSide>('all');
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
      { value: ALL_YEARS, label: 'All Years' },
      ...years.map((year) => ({ value: year, label: year })),
    ],
    [years],
  );

  // Seasons the team was watched in, named with their league when it played in more than one.
  const seasons = useMemo(() => getWatchedSeasons(allTeamGames), [allTeamGames]);
  const seasonOptions = useMemo<SelectOption[]>(() => {
    const multipleLeagues = new Set(seasons.map((season) => season.leagueId)).size > 1;
    return [
      { value: ALL_SEASONS, label: 'All Seasons' },
      ...seasons.map((season) => ({
        value: season.id,
        label: multipleLeagues ? `${season.leagueCode} ${season.name}` : season.name,
      })),
    ];
  }, [seasons]);

  const teamGames = useMemo(() => {
    const teamId = allTeamSummary?.team.id;
    return allTeamGames.filter(
      (game) =>
        (selectedYear === ALL_YEARS || getScheduledGameYear(game) === selectedYear) &&
        (seasonId === ALL_SEASONS || game.season_id === seasonId) &&
        (side === 'all' || (side === 'home') === (game.home_team.id === teamId)),
    );
  }, [allTeamGames, allTeamSummary, seasonId, selectedYear, side]);

  // The record over the games shown, so it matches the count and follows the filters.
  const shownRecord = useMemo(() => {
    const teamId = allTeamSummary?.team.id;
    return (
      getWatchedTeamSummaries(teamGames).find((summary) => summary.team.id === teamId)?.record ?? {
        wins: 0,
        losses: 0,
        otSoLosses: 0,
      }
    );
  }, [allTeamSummary, teamGames]);

  const teamName = allTeamSummary ? getTeamName(allTeamSummary.team) : 'Team';
  const isLoading = watchedGamesLoading || teamsLoading;

  // Year, season and home/away share one row on desktop, like the games page's filters.
  const { toggle: filtersToggle, filters } = useResponsiveFilters((screenSize) => (
    <>
      <FilterSelect
        label="Year"
        value={selectedYear}
        options={yearOptions}
        onChange={setSelectedYear}
      />
      <FilterSelect
        label="Season"
        value={seasonId}
        options={seasonOptions}
        onChange={setSeasonId}
      />
      <ScheduleFilterSlot fixed={screenSize === 'desktop'}>
        <SegmentedControl
          value={side}
          onChange={(value) => setSide(value as TeamSide)}
          options={SIDE_OPTIONS}
          fullWidth={screenSize !== 'desktop'}
        />
      </ScheduleFilterSlot>
    </>
  ));

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
      <TeamWatchedHero
        team={allTeamSummary.team}
        record={shownRecord}
      />

      <Section
        title={<span className={styles.sectionTitle}>Team Games Watched</span>}
        titleAccessory={
          <MetricTag
            value={teamGames.length}
            label={teamGames.length === 1 ? 'Game' : 'Games'}
            position="postfix"
            aria-label={`${teamGames.length} watched ${teamGames.length === 1 ? 'game' : 'games'} shown`}
          />
        }
        action={filtersToggle}
      >
        {filters}
        {teamGames.length === 0 ? (
          <EmptyMessage>
            {allTeamGames.length > 0 ? 'No watched games match these filters.' : 'No watched games.'}
          </EmptyMessage>
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
