import { createContext, useContext } from 'react';
import type { LeagueFullRecord, LeagueSeasonRecord } from '@/hooks/useLeagueDetails';
import type { PlayerRecord } from '@/hooks/useLeaguePlayers';
import type { TeamRecord } from '@/hooks/useTeams';

interface LeaguePlayersContextValue {
  players: PlayerRecord[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
  warningsOnly: boolean;
  loading: boolean;
  fetching: boolean;
  busy: string | null;
  onPageChange: (page: number) => void;
  onSearchChange: (query: string) => void;
  onWarningsOnlyChange: (warningsOnly: boolean) => void;
  onAdd: () => void;
  onBulkAdd: () => void;
  onEdit: (player: PlayerRecord) => void;
  onDelete: (playerId: string) => Promise<void>;
}

export interface LeagueDetailsContextValue {
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
  getSeasonHref: (season: LeagueSeasonRecord) => string;
}

export const LeagueDetailsContext = createContext<LeagueDetailsContextValue | null>(null);

export const useLeagueDetailsContext = () => {
  const value = useContext(LeagueDetailsContext);
  if (!value) {
    throw new Error('useLeagueDetailsContext must be used within LeagueDetailsProvider');
  }
  return value;
};
