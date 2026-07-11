import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import InfoTooltip from '@jerecocc/tracker-ui/components/InfoTooltip/InfoTooltip';
import ListItem from '@jerecocc/tracker-ui/components/ListItem/ListItem';
import Section from '@jerecocc/tracker-ui/components/Section/Section';
import Select, { type SelectOption } from '@jerecocc/tracker-ui/components/Select/Select';
import Table, { type Column } from '@jerecocc/tracker-ui/components/Table/Table';
import TeamLogo from '@jerecocc/tracker-ui/components/TeamLogo/TeamLogo';
import { usePageBreadcrumbs } from '@/context/BreadcrumbContext';
import type { GameRecord } from '@/hooks/useGames';
import EmptyMessage from '@/shared/EmptyMessage/EmptyMessage';
import {
  getWatchedTeamSummaries,
  getWatchedYears,
  type TeamWatchSummary,
} from '@/lib/watchedTeams';
import { buildUserWatchedTeamPath } from '@/lib/routeSlugs';
import styles from './UserGamesWatched.module.scss';

const API = import.meta.env.VITE_API_URL || '/api';
const ALL_YEARS = 'all';

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const YOUR_RECORD_TOOLTIP = 'Wins-Losses-OT Losses';

const getTeamName = (team: TeamWatchSummary['team']) => team.team_name || team.name;

const formatRecord = ({ wins, losses, otSoLosses }: TeamWatchSummary['record']) =>
  `${wins}-${losses}-${otSoLosses}`;

const columns: Column<TeamWatchSummary>[] = [
  {
    type: 'custom',
    header: 'Team',
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
    render: ({ record }) => <span className={styles.recordValue}>{formatRecord(record)}</span>,
  },
];

const WatchedTeamsTable = ({
  summaries,
  loading,
  onSelectTeam,
}: {
  summaries: TeamWatchSummary[];
  loading: boolean;
  onSelectTeam: (summary: TeamWatchSummary) => void;
}) => {
  return (
    <Table
      columns={columns}
      data={summaries}
      rowKey={(summary) => summary.team.id}
      loading={loading}
      emptyMessage="No watched games yet."
      onRowClick={onSelectTeam}
    />
  );
};

const WatchedTeamsList = ({
  summaries,
  loading,
  onSelectTeam,
}: {
  summaries: TeamWatchSummary[];
  loading: boolean;
  onSelectTeam: (summary: TeamWatchSummary) => void;
}) => {
  if (loading) return <EmptyMessage>Loading...</EmptyMessage>;
  if (summaries.length === 0) return <EmptyMessage>No watched games yet.</EmptyMessage>;

  return (
    <ul className={styles.teamList}>
      {summaries.map((summary) => {
        const { team, count } = summary;
        const teamName = getTeamName(team);
        const teamLabel = team.place_name ? `${team.place_name} ${teamName}` : teamName;

        return (
          <ListItem
            key={team.id}
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
    </ul>
  );
};

const UserGamesWatched = () => {
  const navigate = useNavigate();
  const [selectedYear, setSelectedYear] = useState(ALL_YEARS);

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
      { value: ALL_YEARS, label: 'All' },
      ...years.map((year) => ({ value: year, label: year })),
    ],
    [years],
  );
  const summaries = useMemo(
    () => getWatchedTeamSummaries(watchedGames, selectedYear),
    [selectedYear, watchedGames],
  );

  useEffect(() => {
    if (selectedYear !== ALL_YEARS && !years.includes(selectedYear)) {
      setSelectedYear(ALL_YEARS);
    }
  }, [selectedYear, years]);

  return (
    <div className={styles.page}>
      <Section
        className={styles.gamesWatchedSection}
        title={<span className={styles.sectionTitle}>Games Watched</span>}
        action={
          <div className={styles.yearFilter}>
            <span className={styles.yearLabel}>Year</span>
            <Select
              value={selectedYear}
              options={yearOptions}
              onChange={setSelectedYear}
              width="content"
            />
          </div>
        }
      >
        <div className={styles.tableView}>
          <WatchedTeamsTable
            summaries={summaries}
            loading={isLoading}
            onSelectTeam={(summary) =>
              navigate(
                buildUserWatchedTeamPath({
                  teamCode: summary.team.code,
                  teamName: getTeamName(summary.team),
                  teamPlaceName: summary.team.place_name,
                  teamId: summary.team.id,
                }),
              )
            }
          />
        </div>
        <div className={styles.mobileListView}>
          <WatchedTeamsList
            summaries={summaries}
            loading={isLoading}
            onSelectTeam={(summary) =>
              navigate(
                buildUserWatchedTeamPath({
                  teamCode: summary.team.code,
                  teamName: getTeamName(summary.team),
                  teamPlaceName: summary.team.place_name,
                  teamId: summary.team.id,
                }),
              )
            }
          />
        </div>
      </Section>
    </div>
  );
};

export default UserGamesWatched;
