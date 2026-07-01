import { type ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import useSeasons from '@/hooks/useSeasons';
import useTeamPlayers, { type TeamPlayerRecord } from '@/hooks/useTeamPlayers';
import TeamPlayersTab from './TeamPlayersTab';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('@/hooks/useSeasons', () => jest.fn());
jest.mock('@/hooks/useTeamPlayers', () => jest.fn());
jest.mock('../games/game-details/lineups/LineupCreatePlayersModal', () => () => null);
jest.mock('./AddPlayersModal', () => () => null);
jest.mock('./BulkTradeModal', () => () => null);
jest.mock('./TeamPlayerEditModal', () => () => null);

const mockUseSeasons = useSeasons as jest.Mock;
const mockUseTeamPlayers = useTeamPlayers as jest.Mock;

const players = [
  {
    id: 'player-1',
    first_name: 'Auston',
    last_name: 'Matthews',
    position: 'C',
    jersey_number: 34,
    is_prospect: false,
    is_active: true,
    photo: null,
    primary_color: '#00205b',
    text_color: '#ffffff',
  },
] as TeamPlayerRecord[];

const teamPlayersState = {
  players,
  loading: false,
  busy: null,
  addPlayersToRoster: jest.fn(),
  updatePlayer: jest.fn(),
  updatePlayerTeam: jest.fn(),
  updatePlayerRosterRole: jest.fn(),
  removePlayerFromTeam: jest.fn(),
  uploadPlayerPhoto: jest.fn(),
  createAndRosterPlayers: jest.fn(),
  bulkTradePlayers: jest.fn(),
};

const renderTeamPlayersTab = (props: Partial<ComponentProps<typeof TeamPlayersTab>> = {}) =>
  render(
    <TeamPlayersTab
      teamId="team-1"
      teamName="Toronto Maple Leafs"
      leagueId="league-1"
      leagueCode="NHL"
      teamCode="TOR"
      defaultSeasonId="season-1"
      {...props}
    />,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockUseSeasons.mockReturnValue({
    seasons: [{ id: 'season-1', name: '2024-25', is_current: true }],
  });
  mockUseTeamPlayers.mockReturnValue(teamPlayersState);
});

describe('TeamPlayersTab', () => {
  it('opens player details from the row and does not render a view player hover action', async () => {
    const user = userEvent.setup();
    const { container } = renderTeamPlayersTab();

    await user.click(screen.getByRole('button', { name: 'Open Auston Matthews' }));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/admin/leagues/nhl/teams/tor/players/auston-matthews',
    );
    expect(screen.queryByRole('button', { name: /view player/i })).not.toBeInTheDocument();
    expect(container.querySelector('.playerHeaderDivider')).not.toBeInTheDocument();
    expect(container.querySelector('.playerHeaderSeasonGroup .vertical')).toBeInTheDocument();
  });

  it('renders a read-only user roster without admin actions or row navigation', async () => {
    const user = userEvent.setup();
    renderTeamPlayersTab({ readOnly: true, mode: 'user' });

    expect(mockUseSeasons).toHaveBeenCalledWith('league-1', { mode: 'user' });
    expect(mockUseTeamPlayers).toHaveBeenCalledWith(
      'team-1',
      'season-1',
      expect.objectContaining({ mode: 'user', prospectsOnly: false }),
    );
    expect(screen.queryByText('Add Players')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Auston Matthews' })).not.toBeInTheDocument();

    await user.click(screen.getByText('Auston Matthews'));

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
