import { useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import InfoTooltip from '@jerecocc/tracker-ui/components/InfoTooltip/InfoTooltip';
import ListItem from '@jerecocc/tracker-ui/components/ListItem/ListItem';
import SearchInput from '@jerecocc/tracker-ui/components/SearchField/SearchInput';
import Section from '@jerecocc/tracker-ui/components/Section/Section';
import Select, { type SelectOption } from '@jerecocc/tracker-ui/components/Select/Select';
import Table, { type Column } from '@jerecocc/tracker-ui/components/Table/Table';
import TeamLogo from '@jerecocc/tracker-ui/components/TeamLogo/TeamLogo';
import { usePageBreadcrumbs } from '@/context/BreadcrumbContext';
import type { GameRecord } from '@/hooks/useGames';
import EmptyMessage from '@/shared/EmptyMessage/EmptyMessage';
import ResponsiveList from '@/shared/ResponsiveList/ResponsiveList';
import YearFilter from '@/shared/YearFilter/YearFilter';
import {
  getWatchedLeagues,
  getWatchedSeasons,
  getWatchedTeamName as getTeamName,
  getWatchedTeamSummaries,
  getWatchedYears,
  searchTeamWatchSummaries,
  sortTeamWatchSummaries,
  type TeamWatchSortKey,
  type TeamWatchSummary,
} from '@/lib/watchedTeams';
import { buildUserWatchedTeamPath } from '@/lib/routeSlugs';
import styles from './UserGamesWatched.module.scss';

import { API, authHeaders } from '@/lib/apiClient';
const ALL = 'all';

const YOUR_RECORD_TOOLTIP = 'Wins-Losses-OT Losses';

type SortDirection = 'asc' | 'desc';

// Names read A to Z first; counts read highest first.
const DEFAULT_SORT_DIRECTION: Record<TeamWatchSortKey, SortDirection> = {
  team: 'asc',
  seen: 'desc',
  wins: 'desc',
};

// The mobile list has no column headers, so it sorts from a select.
const MOBILE_SORT_OPTIONS: SelectOption[] = [
  { value: 'seen', label: 'Most seen' },
  { value: 'wins', label: 'Most wins' },
  { value: 'team', label: 'Team name' },
];

// A filter select labelled for screen readers; its value shows what it filters.
const FilterSelect = ({
  label,
  className,
  value,
  options,
  onChange,
}: {
  label: string;
  className?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) => {
  const labelId = useId();
  return (
    <div className={[styles.filterSelect, className].filter(Boolean).join(' ')}>
      <span
        id={labelId}
        className={styles.visuallyHidden}
      >
        {label}
      </span>
      <Select
        value={value}
        options={options}
        onChange={onChange}
        ariaLabelledBy={labelId}
        width="full"
      />
    </div>
  );
};

const formatRecord = ({ wins, losses, otSoLosses }: TeamWatchSummary['record']) =>
  `${wins}-${losses}-${otSoLosses}`;

const columns: Column<TeamWatchSummary>[] = [
  {
    type: 'custom',
    header: 'Team',
    sortable: true,
    sortKey: 'team',
    render: ({ team }) => {
      const teamName = getTeamName(team);

      return (
        <span className={styles.teamCell}>
          <TeamLogo
            logo={team.logo}
            logoDark={team.logo_dark}
            logoLight={team.logo_light}
            code={team.code}
            alt={teamName}
            primaryColor={team.primary_color}
            textColor={team.text_color}
            size={32}
            className={styles.teamLogo}
          />
          <span className={styles.teamText}>
            {team.place_name && <span className={styles.teamPlace}>{team.place_name}</span>}
            <span className={styles.teamName}>{teamName}</span>
          </span>
        </span>
      );
    },
  },
  {
    type: 'custom',
    header: 'Seen',
    align: 'center',
    sortable: true,
    sortKey: 'seen',
    render: ({ count }) => (
      <span
        className={styles.seenCount}
        aria-label={`${count} watched ${count === 1 ? 'game' : 'games'}`}
      >
        {count}x
      </span>
    ),
  },
  {
    type: 'custom',
    header: (
      <span className={styles.recordHeader}>
        Your Record
        <InfoTooltip
          text={YOUR_RECORD_TOOLTIP}
          ariaLabel="How your watched record is calculated"
          size="0.85rem"
        />
      </span>
    ),
    align: 'right',
    // Sorts by wins.
    sortable: true,
    sortKey: 'wins',
    render: ({ record }) => <span className={styles.recordValue}>{formatRecord(record)}</span>,
  },
];

const WatchedTeamsTable = ({
  summaries,
  loading,
  emptyMessage,
  sortKey,
  sortDirection,
  onSort,
  onSelectTeam,
}: {
  summaries: TeamWatchSummary[];
  loading: boolean;
  emptyMessage: string;
  sortKey: TeamWatchSortKey;
  sortDirection: SortDirection;
  onSort: (key: string, dir: SortDirection) => void;
  onSelectTeam: (summary: TeamWatchSummary) => void;
}) => {
  return (
    <Table
      columns={columns}
      rows={summaries}
      getRowKey={(summary) => summary.team.id}
      loading={loading}
      emptyMessage={emptyMessage}
      activeSortKey={sortKey}
      sortDirection={sortDirection}
      onSort={onSort}
      onRowClick={onSelectTeam}
    />
  );
};

const WatchedTeamsList = ({
  summaries,
  loading,
  emptyMessage,
  onSelectTeam,
}: {
  summaries: TeamWatchSummary[];
  loading: boolean;
  emptyMessage: string;
  onSelectTeam: (summary: TeamWatchSummary) => void;
}) => {
  if (loading) return <EmptyMessage>Loading...</EmptyMessage>;
  if (summaries.length === 0) return <EmptyMessage>{emptyMessage}</EmptyMessage>;

  return (
    <ResponsiveList>
      {summaries.map((summary) => {
        const { team, count } = summary;
        const teamName = getTeamName(team);
        const teamLabel = team.place_name ? `${team.place_name} ${teamName}` : teamName;

        return (
          <ListItem
            key={team.id}
            fullWidth
            image={team.logo}
            imageDark={team.logo_dark}
            imageLight={team.logo_light}
            imageSize={40}
            eyebrow={team.place_name || undefined}
            name={teamName}
            rightContent={
              <span
                className={styles.mobileSeenValue}
                aria-label={`${count} watched ${count === 1 ? 'game' : 'games'}`}
              >
                {count}x
              </span>
            }
            primaryColor={team.primary_color}
            textColor={team.text_color}
            onClick={() => onSelectTeam(summary)}
            ariaLabel={`View ${teamLabel} games watched`}
          />
        );
      })}
    </ResponsiveList>
  );
};

const UserGamesWatched = () => {
  const navigate = useNavigate();
  const [selectedYear, setSelectedYear] = useState(ALL);
  const [leagueId, setLeagueId] = useState(ALL);
  const [seasonId, setSeasonId] = useState(ALL);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: TeamWatchSortKey; dir: SortDirection }>({
    key: 'seen',
    dir: 'desc',
  });

  usePageBreadcrumbs(
    {
      backPath: '/dashboard',
      backLabel: 'Back to Dashboard',
      items: [{ label: 'Dashboard', path: '/dashboard' }, { label: 'Games Watched' }],
    },
    [],
  );

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

  const years = useMemo(() => getWatchedYears(watchedGames), [watchedGames]);
  const yearOptions = useMemo<SelectOption[]>(
    () => [
      { value: ALL, label: 'All' },
      ...years.map((year) => ({ value: year, label: year })),
    ],
    [years],
  );
  const leagues = useMemo(() => getWatchedLeagues(watchedGames), [watchedGames]);
  const leagueOptions = useMemo<SelectOption[]>(
    () => [
      { value: ALL, label: 'All Leagues' },
      ...leagues.map((league) => ({ value: league.id, label: league.code, logo: league.logo })),
    ],
    [leagues],
  );
  // Seasons follow the league; across all leagues each is named with its league.
  const seasons = useMemo(() => getWatchedSeasons(watchedGames, leagueId), [leagueId, watchedGames]);
  const seasonOptions = useMemo<SelectOption[]>(
    () => [
      { value: ALL, label: 'All Seasons' },
      ...seasons.map((season) => ({
        value: season.id,
        label: leagueId === ALL ? `${season.leagueCode} ${season.name}` : season.name,
      })),
    ],
    [leagueId, seasons],
  );
  const summaries = useMemo(
    () =>
      sortTeamWatchSummaries(
        searchTeamWatchSummaries(
          getWatchedTeamSummaries(watchedGames, { year: selectedYear, leagueId, seasonId }),
          search,
        ),
        sort.key,
        sort.dir,
      ),
    [leagueId, search, seasonId, selectedYear, sort, watchedGames],
  );
  const isFiltered =
    !!search.trim() || selectedYear !== ALL || leagueId !== ALL || seasonId !== ALL;
  const emptyMessage = isFiltered ? 'No teams match these filters.' : 'No watched games yet.';

  useEffect(() => {
    if (selectedYear !== ALL && !years.includes(selectedYear)) {
      setSelectedYear(ALL);
    }
  }, [selectedYear, years]);

  // A season from another league no longer applies once the league changes.
  useEffect(() => {
    if (seasonId !== ALL && !seasons.some((season) => season.id === seasonId)) {
      setSeasonId(ALL);
    }
  }, [seasonId, seasons]);

  const handleSort = (key: string, dir: SortDirection) =>
    setSort({ key: key as TeamWatchSortKey, dir });

  const openTeam = (summary: TeamWatchSummary) =>
    navigate(
      buildUserWatchedTeamPath({
        teamCode: summary.team.code,
        teamName: getTeamName(summary.team),
        teamPlaceName: summary.team.place_name,
        teamId: summary.team.id,
      }),
    );

  return (
    <div className={styles.page}>
      <Section
        className={styles.gamesWatchedSection}
        title={<span className={styles.sectionTitle}>Games Watched</span>}
        action={
          <YearFilter
            value={selectedYear}
            options={yearOptions}
            onChange={setSelectedYear}
          />
        }
      >
        <div
          className={styles.filters}
          role="group"
          aria-label="Filter watched teams"
        >
          <SearchInput
            className={styles.search}
            placeholder="Search teams..."
            aria-label="Search teams"
            value={search}
            onChange={setSearch}
          />
          <FilterSelect
            label="League"
            value={leagueId}
            options={leagueOptions}
            onChange={setLeagueId}
          />
          <FilterSelect
            label="Season"
            value={seasonId}
            options={seasonOptions}
            onChange={setSeasonId}
          />
          <FilterSelect
            label="Sort teams"
            className={styles.mobileSort}
            value={sort.key}
            options={MOBILE_SORT_OPTIONS}
            onChange={(key) => handleSort(key, DEFAULT_SORT_DIRECTION[key as TeamWatchSortKey])}
          />
        </div>
        <div className={styles.tableView}>
          <WatchedTeamsTable
            summaries={summaries}
            loading={isLoading}
            emptyMessage={emptyMessage}
            sortKey={sort.key}
            sortDirection={sort.dir}
            onSort={handleSort}
            onSelectTeam={openTeam}
          />
        </div>
        <div className={styles.mobileListView}>
          <WatchedTeamsList
            summaries={summaries}
            loading={isLoading}
            emptyMessage={emptyMessage}
            onSelectTeam={openTeam}
          />
        </div>
      </Section>
    </div>
  );
};

export default UserGamesWatched;
