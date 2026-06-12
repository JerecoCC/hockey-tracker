import { createContext, useContext, type ReactNode } from 'react';
import { type LeagueFullRecord, type LeagueSeasonRecord } from '@/hooks/useLeagueDetails';
import { type PlayerRecord } from '@/hooks/useLeaguePlayers';
import { type TeamRecord } from '@/hooks/useTeams';

interface LeaguePlayersContextValue {
  players: PlayerRecord[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
  seasons: LeagueSeasonRecord[];
  selectedSeasonId: string | null;
  loading: boolean;
  fetching: boolean;
  busy: string | null;
  onPageChange: (page: number) => void;
  onSearchChange: (query: string) => void;
  onSeasonChange: (id: string) => void;
  onAdd: () => void;
  onBulkAdd: () => void;
  onEdit: (player: PlayerRecord) => void;
  onDelete: (playerId: string) => Promise<void>;
}

interface LeagueDetailsContextValue {
  league: LeagueFullRecord;
  teams: TeamRecord[];
  seasons: LeagueSeasonRecord[];
  loading: boolean;
  busy: string | null;
  players: LeaguePlayersContextValue;
  onAddTeam: () => void;
  onEditTeam: (team: TeamRecord) => void;
  onDeleteTeam: (team: TeamRecord) => void;
  onAddSeason: () => void;
  onEditSeason: (season: LeagueSeasonRecord) => void;
  onDeleteSeason: (season: LeagueSeasonRecord) => void;
  onViewSeason: (season: LeagueSeasonRecord) => void;
  getSeasonHref: (season: LeagueSeasonRecord) => string;
}

const LeagueDetailsContext = createContext<LeagueDetailsContextValue | null>(null);

export const LeagueDetailsProvider = ({
  value,
  children,
}: {
  value: LeagueDetailsContextValue;
  children: ReactNode;
}) => <LeagueDetailsContext.Provider value={value}>{children}</LeagueDetailsContext.Provider>;

export const useLeagueDetailsContext = () => {
  const value = useContext(LeagueDetailsContext);
  if (!value) {
    throw new Error('useLeagueDetailsContext must be used within LeagueDetailsProvider');
  }
  return value;
};
