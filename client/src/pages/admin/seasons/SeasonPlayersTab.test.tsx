import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import useLeaguePlayers, { type PlayerRecord } from '@/hooks/useLeaguePlayers';
import SeasonPlayersTab from './SeasonPlayersTab';

jest.mock('@/hooks/useLeaguePlayers', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockUseLeaguePlayers = useLeaguePlayers as jest.Mock;

const player: PlayerRecord = {
  id: 'player-1',
  league_player_number: '101',
  first_name: 'Taylor',
  last_name: 'Morgan',
  photo: '/taylor.png',
  date_of_birth: '1998-04-12',
  birth_city: 'Toronto',
  birth_country: 'CAN',
  height_cm: 185,
  weight_lbs: 195,
  position: 'C',
  shoots: 'L',
  status: 'active',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  jersey_number: 19,
  team_id: 'team-1',
  team_name: 'Maple Leafs',
  team_code: 'TOR',
  team_logo: '/toronto.png',
};

const renderTab = (players: PlayerRecord[] = [player]) => {
  mockUseLeaguePlayers.mockReturnValue({
    players,
    total: players.length,
    loading: false,
    fetching: false,
    busy: null,
  });

  return render(
    <MemoryRouter>
      <SeasonPlayersTab
        leagueId="league-1"
        leagueCode="NHL"
        seasonId="season-1"
        seasonName="2026-27"
      />
    </MemoryRouter>,
  );
};

describe('SeasonPlayersTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders season players in a table with roster and biographical columns', () => {
    renderTab();

    expect(screen.getByRole('table')).toBeInTheDocument();
    [
      'Player',
      'Position',
      'Team',
      'Jersey Number',
      'Height',
      'Weight',
      'Birthplace',
      'Status',
    ].forEach((column) => {
      expect(screen.getByRole('columnheader', { name: column })).toBeInTheDocument();
    });

    expect(screen.getByText('Taylor Morgan')).toBeInTheDocument();
    expect(screen.getByText('Center')).toBeInTheDocument();
    expect(screen.getByText('Maple Leafs')).toBeInTheDocument();
    expect(screen.getByText('19')).toBeInTheDocument();
    expect(screen.getByText(`6'1" (185 cm)`)).toBeInTheDocument();
    expect(screen.getByText('195 lbs')).toBeInTheDocument();
    expect(screen.getByText('Toronto, CAN')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows placeholders for unavailable player details', () => {
    renderTab([
      {
        ...player,
        id: 'player-2',
        first_name: 'Jordan',
        last_name: 'Lee',
        position: null,
        team_name: null,
        team_code: null,
        team_logo: null,
        jersey_number: null,
        height_cm: null,
        weight_lbs: null,
        birth_city: null,
        birth_country: null,
        status: 'inactive',
        is_active: false,
      },
    ]);

    expect(screen.getByText('Jordan Lee')).toBeInTheDocument();
    expect(screen.getAllByText('-')).toHaveLength(6);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });
});
