import { type ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import useSeasons from '@/hooks/useSeasons';
import useTeamPlayers, { type TeamPlayerRecord } from '@/hooks/useTeamPlayers';
import TeamPlayersTab from './TeamPlayersTab';

const mockAddPlayersModal = jest.fn(() => null);

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: any) => (
    <a
      href={to}
      {...props}
    >
      {children}
    </a>
  ),
}));
jest.mock('@/hooks/useSeasons', () => jest.fn());
jest.mock('@/hooks/useTeamPlayers', () => jest.fn());
jest.mock('@jerecocc/tracker-ui/components/MoreActionsMenu/MoreActionsMenu', () => {
  interface MockActionItem {
    label: string;
    disabled?: boolean;
    onClick?: () => void;
  }

  interface MockMoreActionsMenuProps {
    items: MockActionItem[];
  }

  const MockMoreActionsMenu = ({ items }: MockMoreActionsMenuProps) => (
    <div>
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          disabled={item.disabled}
          onClick={item.onClick}
        >
          {item.label}
        </button>
      ))}
    </div>
  );

  MockMoreActionsMenu.displayName = 'MockMoreActionsMenu';
  return MockMoreActionsMenu;
});
jest.mock('../games/game-details/lineups/LineupCreatePlayersModal', () => () => null);
jest.mock('./AddPlayersModal', () => {
  type MockAddPlayersModalProps = Record<string, unknown>;

  const MockAddPlayersModal = (props: MockAddPlayersModalProps) => mockAddPlayersModal(props);

  MockAddPlayersModal.displayName = 'MockAddPlayersModal';
  return MockAddPlayersModal;
});
jest.mock('./BulkTradeModal', () => () => null);
jest.mock('./TeamPlayerEditModal', () => () => null);

const mockUseSeasons = useSeasons as jest.Mock;
const mockUseTeamPlayers = useTeamPlayers as jest.Mock;
const latestAddPlayersModalProps = () =>
  mockAddPlayersModal.mock.calls[mockAddPlayersModal.mock.calls.length - 1]?.[0];

const players = [
  {
    id: 'player-1',
    first_name: 'Auston',
    last_name: 'Matthews',
    position: 'C',
    jersey_number: 34,
    is_prospect: false,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    player_team_id: 'player-team-1',
    team_id: 'team-1',
    team_name: 'Toronto Maple Leafs',
    photo: null,
    primary_color: '#00205b',
    text_color: '#ffffff',
  },
  {
    id: 'player-2',
    first_name: 'Morgan',
    last_name: 'Rielly',
    position: 'D',
    jersey_number: 44,
    is_prospect: false,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    player_team_id: 'player-team-2',
    team_id: 'team-1',
    team_name: 'Toronto Maple Leafs',
    photo: null,
    primary_color: '#00205b',
    text_color: '#ffffff',
  },
  {
    id: 'player-3',
    first_name: 'Joseph',
    last_name: 'Woll',
    position: 'G',
    jersey_number: 60,
    is_prospect: false,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    player_team_id: 'player-team-3',
    team_id: 'team-1',
    team_name: 'Toronto Maple Leafs',
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
  it('links the row to player details for click and right-click navigation', () => {
    const { container } = renderTeamPlayersTab();

    const playerLink = container.querySelector(
      'a[href="/admin/leagues/nhl/teams/tor/players/34-auston-matthews"]',
    ) as HTMLAnchorElement;
    fireEvent.contextMenu(playerLink);

    expect(playerLink).toHaveAttribute(
      'href',
      '/admin/leagues/nhl/teams/tor/players/34-auston-matthews',
    );
    expect(screen.queryByRole('button', { name: /view player/i })).not.toBeInTheDocument();
    expect(container.querySelector('.playerHeaderDivider')).not.toBeInTheDocument();
    expect(container.querySelector('.playerHeaderSeasonGroup .vertical')).toBeInTheDocument();
  });

  it('shows a dash jersey chip when a roster player has no jersey number', () => {
    const playersWithoutJersey = [{ ...players[0], jersey_number: null }] as TeamPlayerRecord[];
    mockUseTeamPlayers.mockReturnValue({ ...teamPlayersState, players: playersWithoutJersey });

    renderTeamPlayersTab();

    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('keeps toolbar add players and adds filtered bordered section actions', async () => {
    const user = userEvent.setup();
    renderTeamPlayersTab();

    expect(screen.getByLabelText('Forwards count')).toHaveTextContent('1');
    expect(screen.getByLabelText('Defense count')).toHaveTextContent('1');
    expect(screen.getByLabelText('Goalies count')).toHaveTextContent('1');

    const toolbarAddButton = screen.getByRole('button', { name: 'Add Players' });
    const forwardsAddButton = screen.getByRole('button', { name: 'Add Forwards' });
    const defenseAddButton = screen.getByRole('button', { name: 'Add Defense' });
    const goaliesAddButton = screen.getByRole('button', { name: 'Add Goalies' });

    await user.click(toolbarAddButton);
    expect(latestAddPlayersModalProps()).toEqual(
      expect.objectContaining({
        open: true,
        positionFilter: undefined,
        positionFilterLabel: undefined,
      }),
    );

    await user.click(forwardsAddButton);
    expect(latestAddPlayersModalProps()).toEqual(
      expect.objectContaining({
        open: true,
        positionFilter: ['C', 'LW', 'RW', 'L', 'R', 'F'],
        positionFilterLabel: 'Forwards',
      }),
    );

    await user.click(defenseAddButton);
    expect(latestAddPlayersModalProps()).toEqual(
      expect.objectContaining({
        open: true,
        positionFilter: ['D', 'LD', 'RD'],
        positionFilterLabel: 'Defense',
      }),
    );

    await user.click(goaliesAddButton);
    expect(latestAddPlayersModalProps()).toEqual(
      expect.objectContaining({
        open: true,
        positionFilter: ['G'],
        positionFilterLabel: 'Goalies',
      }),
    );
  });

  it('labels the bulk player movement action as move players', () => {
    renderTeamPlayersTab();

    expect(screen.getByRole('button', { name: 'Move Players' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Trade Players' })).not.toBeInTheDocument();
  });

  it('uses reserve wording for players outside the active roster', async () => {
    const user = userEvent.setup();
    const reservePlayer = { ...players[0], is_prospect: true } as TeamPlayerRecord;
    mockUseTeamPlayers.mockReturnValue({ ...teamPlayersState, players: [reservePlayer] });

    renderTeamPlayersTab();
    await user.click(screen.getByRole('button', { name: 'Reserves' }));

    expect(screen.getByText('Reserve')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search reserves...')).toBeInTheDocument();
    expect(screen.queryByText('Prospect')).not.toBeInTheDocument();
  });

  it('finds players by alternate Maksim and Maxim transliterations', async () => {
    const user = userEvent.setup();
    const islandersPlayers = [
      {
        id: 'player-nyi-1',
        first_name: 'Maxim',
        last_name: 'Tsyplakov',
        position: 'RW',
        jersey_number: 7,
        is_prospect: false,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        player_team_id: 'player-team-nyi-1',
        team_id: 'team-1',
        team_name: 'New York Islanders',
        photo: null,
        primary_color: '#00205b',
        text_color: '#ffffff',
      },
      {
        id: 'player-nyi-2',
        first_name: 'Anders',
        last_name: 'Lee',
        position: 'LW',
        jersey_number: 27,
        is_prospect: false,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        player_team_id: 'player-team-nyi-2',
        team_id: 'team-1',
        team_name: 'New York Islanders',
        photo: null,
        primary_color: '#00205b',
        text_color: '#ffffff',
      },
    ] as TeamPlayerRecord[];
    mockUseTeamPlayers.mockReturnValue({ ...teamPlayersState, players: islandersPlayers });

    renderTeamPlayersTab({ teamName: 'New York Islanders', teamCode: 'NYI' });

    await user.type(screen.getByPlaceholderText('Search players...'), 'Maksim');

    expect(screen.getByText('Maxim Tsyplakov')).toBeInTheDocument();
    expect(screen.queryByText('Anders Lee')).not.toBeInTheDocument();
  });

  it('renders a read-only user roster without admin actions and links the user player route', () => {
    const { container } = renderTeamPlayersTab({ readOnly: true, mode: 'user' });

    expect(mockUseSeasons).toHaveBeenCalledWith('league-1', { mode: 'user' });
    expect(mockUseTeamPlayers).toHaveBeenCalledWith(
      'team-1',
      'season-1',
      expect.objectContaining({ mode: 'user', prospectsOnly: false }),
    );
    expect(screen.queryByText('Add Players')).not.toBeInTheDocument();
    expect(container.querySelector('a')).toHaveAttribute(
      'href',
      '/leagues/nhl/teams/tor/players/34-auston-matthews',
    );
  });
});
