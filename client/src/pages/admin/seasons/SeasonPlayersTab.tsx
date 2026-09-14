import { useMemo, useState } from 'react';
import Pagination from '@jerecocc/tracker-ui/components/Pagination/Pagination';
import PlayerAvatar from '@jerecocc/tracker-ui/components/PlayerAvatar/PlayerAvatar';
import SearchableList from '@jerecocc/tracker-ui/components/SearchableList/SearchableList';
import Section from '@jerecocc/tracker-ui/components/Section/Section';
import Table, { type Column } from '@jerecocc/tracker-ui/components/Table/Table';
import Tag from '@jerecocc/tracker-ui/components/Tag/Tag';
import TeamLogo from '@jerecocc/tracker-ui/components/TeamLogo/TeamLogo';
import useLeaguePlayers, { type PlayerRecord } from '@/hooks/useLeaguePlayers';
import { buildLeaguePlayerDetailsPath } from '@/lib/routeSlugs';
import { formatPlayerPosition } from '@/lib/playerPosition';
import { getPlayerStatus, PLAYER_STATUS_LABELS, type PlayerStatus } from '@/lib/playerStatus';
import styles from './SeasonPlayersTab.module.scss';

interface Props {
  leagueId: string;
  leagueCode: string;
  seasonId: string;
  seasonName: string;
}

const SEASON_PLAYERS_PAGE_SIZE = 15;
const PLAYER_SEARCH_DEBOUNCE_MS = 350;
const PLAYER_SEARCH_MIN_LENGTH = 3;
const PLAYER_STATUS_TAG_INTENTS: Record<PlayerStatus, 'success' | 'neutral' | 'warning'> = {
  active: 'success',
  inactive: 'neutral',
  retired: 'warning',
};

const formatHeight = (heightCm: number | null) => {
  if (!heightCm) return '-';
  const totalInches = Math.round(heightCm / 2.54);
  return `${Math.floor(totalInches / 12)}'${totalInches % 12}" (${heightCm} cm)`;
};

const formatBirthplace = (player: PlayerRecord) =>
  [player.birth_city, player.birth_country].filter(Boolean).join(', ') || '-';

const getPlayerName = (player: PlayerRecord) =>
  `${player.first_name} ${player.last_name}`.trim();

const getSeasonPlayerColumns = (): Column<PlayerRecord>[] => [
  {
    type: 'custom',
    header: 'Player',
    render: (player) => {
      const name = getPlayerName(player);
      const initials = `${player.first_name[0] ?? ''}${player.last_name[0] ?? ''}` || '?';

      return (
        <span className={styles.playerCell}>
          <PlayerAvatar
            photo={player.photo}
            initials={initials}
            primaryColor={player.primary_color}
            textColor={player.text_color}
            size={40}
          />
          <span className={styles.playerName}>{name}</span>
        </span>
      );
    },
  },
  {
    type: 'custom',
    header: 'Position',
    render: (player) => formatPlayerPosition(player.position) ?? '-',
  },
  {
    type: 'custom',
    header: 'Team',
    render: (player) => {
      const teamName = player.team_name ?? player.team_code;
      if (!teamName) return '-';

      return (
        <span className={styles.teamCell}>
          <TeamLogo
            logo={player.team_logo}
            logoDark={player.team_logo_dark}
            logoLight={player.team_logo_light}
            code={player.team_code ?? teamName.slice(0, 3).toUpperCase()}
            alt={teamName}
            primaryColor={player.primary_color}
            textColor={player.text_color}
            size={32}
          />
          <span className={styles.teamName}>{teamName}</span>
        </span>
      );
    },
  },
  {
    type: 'custom',
    header: 'Jersey Number',
    align: 'center',
    render: (player) => player.jersey_number ?? '-',
  },
  {
    type: 'custom',
    header: 'Height',
    render: (player) => formatHeight(player.height_cm),
  },
  {
    type: 'custom',
    header: 'Weight',
    render: (player) => (player.weight_lbs ? `${player.weight_lbs} lbs` : '-'),
  },
  {
    type: 'custom',
    header: 'Birthplace',
    render: formatBirthplace,
  },
  {
    type: 'custom',
    header: 'Status',
    render: (player) => {
      const status = getPlayerStatus(player);
      return (
        <Tag
          label={PLAYER_STATUS_LABELS[status]}
          intent={PLAYER_STATUS_TAG_INTENTS[status]}
        />
      );
    },
  },
];

const SeasonPlayersTab = ({ leagueId, leagueCode, seasonId, seasonName }: Props) => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const { players, total, loading, fetching } = useLeaguePlayers(leagueId, seasonId, {
    page,
    pageSize: SEASON_PLAYERS_PAGE_SIZE,
    search,
    includeInactive: true,
    includeProspects: true,
  });

  const columns = useMemo(() => getSeasonPlayerColumns(), []);
  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => getPlayerName(a).localeCompare(getPlayerName(b))),
    [players],
  );
  const pagination = (
    <Pagination
      page={page}
      pageSize={SEASON_PLAYERS_PAGE_SIZE}
      total={total}
      onPageChange={setPage}
    />
  );
  const table = (rows: PlayerRecord[], isLoading = false) => (
    <Table
      columns={columns}
      rows={rows}
      getRowKey={(player) => player.id}
      minWidth={1040}
      loading={isLoading}
      emptyMessage={`No players in ${seasonName} yet.`}
      getRowHref={(player) =>
        buildLeaguePlayerDetailsPath({
          leagueCode,
          leagueId,
          leaguePlayerNumber: player.league_player_number,
          firstName: player.first_name,
          lastName: player.last_name,
        })
      }
    />
  );

  return (
    <Section title="Players">
      <SearchableList
        items={sortedPlayers}
        filterItem={() => true}
        renderItems={(filteredPlayers) => (
          <>
            {table(filteredPlayers)}
            {pagination}
          </>
        )}
        placeholder="Search players..."
        onQueryChange={(query) => {
          setPage(1);
          setSearch(query);
        }}
        searchDebounceMs={PLAYER_SEARCH_DEBOUNCE_MS}
        minSearchLength={PLAYER_SEARCH_MIN_LENGTH}
        disableClientFilter
        loading={loading || fetching}
        loadingContent={
          <>
            {table([], true)}
            {pagination}
          </>
        }
        emptyMessage={`No players in ${seasonName} yet.`}
        getNoResultsMessage={(query) => `No players match "${query}".`}
      />
    </Section>
  );
};

export default SeasonPlayersTab;
