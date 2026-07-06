import { useState } from 'react';
import useLeaguePlayers from '@/hooks/useLeaguePlayers';
import {
  LeaguePlayersListSection,
  LeaguePlayersTabSkeleton,
} from '../leagues/LeaguePlayersTab';

interface Props {
  leagueId: string;
  leagueCode: string;
  seasonId: string;
  seasonName: string;
}

const SEASON_PLAYERS_PAGE_SIZE = 15;

const SeasonPlayersTab = ({ leagueId, leagueCode, seasonId, seasonName }: Props) => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const {
    players,
    total,
    loading,
    fetching,
    busy,
  } = useLeaguePlayers(leagueId, seasonId, {
    page,
    pageSize: SEASON_PLAYERS_PAGE_SIZE,
    search,
    includeInactive: true,
    includeProspects: true,
  });

  if (loading) return <LeaguePlayersTabSkeleton showActionSkeleton={false} />;

  return (
    <LeaguePlayersListSection
      league={{ id: leagueId, code: leagueCode }}
      players={players}
      total={total}
      page={page}
      pageSize={SEASON_PLAYERS_PAGE_SIZE}
      search={search}
      fetching={fetching}
      busy={busy}
      selectedSeasonId={seasonId}
      emptyMessage={`No players in ${seasonName} yet.`}
      onPageChange={setPage}
      onSearchChange={(query) => {
        setPage(1);
        setSearch(query);
      }}
    />
  );
};

export default SeasonPlayersTab;
