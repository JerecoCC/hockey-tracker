import { type ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useProjectedLineup } from '@/hooks/useProjectedLineup';
import useTeamPlayers, { type TeamPlayerRecord } from '@/hooks/useTeamPlayers';
import TeamPlayersTab from './TeamPlayersTab';

const mockProjectedLineupModal = jest.fn(() => null);
const mockMoreActionsMenu = jest.fn();

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
jest.mock('@/hooks/useProjectedLineup', () => ({ useProjectedLineup: jest.fn() }));
jest.mock('@/hooks/useTeamPlayers', () => jest.fn());
jest.mock('@jerecocc/tracker-ui/components/MoreActionsMenu/MoreActionsMenu', () => {
  interface MockActionItem {
    label: string;
    disabled?: boolean;
    onClick?: () => void;
  }

  interface MockMoreActionsMenuProps {
    items: MockActionItem[];
    iconHeight?: 'default' | 'button' | 'field';
    iconSize?: string;
  }

  const MockMoreActionsMenu = (props: MockMoreActionsMenuProps) => {
    mockMoreActionsMenu(props);

    return (
      <div>
        {props.items.map((item) => (
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
  };

  MockMoreActionsMenu.displayName = 'MockMoreActionsMenu';
  return MockMoreActionsMenu;
});
jest.mock('../games/game-details/lineups/LineupCreatePlayersModal', () => () => null);
jest.mock('./BulkTradeModal', () => () => null);
jest.mock('./TeamPlayerEditModal', () => () => null);
jest.mock('./ProjectedLineupModal', () => {
  type MockProjectedLineupModalProps = Record<string, unknown>;

  const MockProjectedLineupModal = (props: MockProjectedLineupModalProps) =>
    mockProjectedLineupModal(props);

  MockProjectedLineupModal.displayName = 'MockProjectedLineupModal';
  return MockProjectedLineupModal;
});

const mockUseProjectedLineup = jest.mocked(useProjectedLineup);
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
  resetRoster: jest.fn().mockResolvedValue(true),
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
      scope="season"
      seasonId="season-1"
      {...props}
    />,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockUseProjectedLineup.mockReturnValue({
    slots: [],
    loading: false,
    saving: false,
    save: jest.fn(),
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
  });

  it('shows a dash jersey chip when a roster player has no jersey number', () => {
    const playersWithoutJersey = [{ ...players[0], jersey_number: null }] as TeamPlayerRecord[];
    mockUseTeamPlayers.mockReturnValue({ ...teamPlayersState, players: playersWithoutJersey });

    renderTeamPlayersTab();

    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('removes add-player actions and offers roster reset under more actions', () => {
    renderTeamPlayersTab();

    expect(screen.getByLabelText('Players total count')).toHaveTextContent('3');
    expect(screen.getByLabelText('Players total count')).toHaveTextContent('players');
    expect(screen.getByLabelText('Forwards count')).toHaveTextContent('1');
    expect(screen.getByLabelText('Forwards count')).toHaveTextContent('player');
    expect(screen.getByLabelText('Defense count')).toHaveTextContent('1');
    expect(screen.getByLabelText('Defense count')).toHaveTextContent('player');
    expect(screen.getByLabelText('Goalies count')).toHaveTextContent('1');
    expect(screen.getByLabelText('Goalies count')).toHaveTextContent('player');

    const projectedLineupButton = screen.getByRole('button', { name: 'Projected Lineup' });

    expect(mockMoreActionsMenu).toHaveBeenLastCalledWith(
      expect.objectContaining({ iconHeight: 'button', iconSize: '1.25rem' }),
    );
    expect(projectedLineupButton).toHaveClass('filledAccent');
    expect(projectedLineupButton.querySelector('svg')).toBeInTheDocument();
    expect(mockMoreActionsMenu.mock.calls.at(-1)?.[0].items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ label: 'Projected Lineup' })]),
    );
    expect(mockMoreActionsMenu.mock.calls.at(-1)?.[0].items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Reset Roster', icon: 'restart_alt' }),
      ]),
    );
    expect(
      screen.queryByRole('button', { name: /add (players|forwards|defense|goalies)/i }),
    ).not.toBeInTheDocument();
  });

  it('confirms a roster reset and switches to reserves after success', async () => {
    const user = userEvent.setup();
    renderTeamPlayersTab();

    await user.click(screen.getByRole('button', { name: 'Reset Roster' }));
    const resetButtons = screen.getAllByRole('button', { name: 'Reset Roster' });
    await user.click(resetButtons.at(-1)!);

    expect(teamPlayersState.resetRoster).toHaveBeenCalledTimes(1);
    expect(screen.getByPlaceholderText('Search reserves...')).toBeInTheDocument();
  });

  it('labels the bulk player movement action as move players', () => {
    renderTeamPlayersTab();

    expect(screen.getByRole('button', { name: 'Move Players' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Trade Players' })).not.toBeInTheDocument();
  });

  it('includes reserve players in the projected lineup modal', async () => {
    const user = userEvent.setup();
    const reservePlayer = {
      ...players[0],
      id: 'reserve-1',
      first_name: 'Reserve',
      last_name: 'Forward',
      is_prospect: true,
    } as TeamPlayerRecord;
    mockUseTeamPlayers.mockReturnValue({ ...teamPlayersState, players: [reservePlayer] });

    renderTeamPlayersTab();
    const projectedLineupButton = screen.getByRole('button', { name: 'Projected Lineup' });

    expect(projectedLineupButton).toBeEnabled();
    await user.click(projectedLineupButton);
    expect(mockProjectedLineupModal).toHaveBeenLastCalledWith(
      expect.objectContaining({ players: [reservePlayer] }),
    );
  });

  it('does not show roster-status tags for reserves', async () => {
    const user = userEvent.setup();
    const reservePlayer = { ...players[0], is_prospect: true } as TeamPlayerRecord;
    mockUseTeamPlayers.mockReturnValue({ ...teamPlayersState, players: [reservePlayer] });

    renderTeamPlayersTab();
    await user.click(screen.getByRole('button', { name: 'Reserves' }));

    expect(screen.queryByText('Reserve')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search reserves...')).toBeInTheDocument();
    expect(screen.queryByText('Prospect')).not.toBeInTheDocument();
  });

  it('labels only players included in the selected season projected lineup', () => {
    mockUseProjectedLineup.mockReturnValue({
      slots: [
        {
          id: 'projected-1',
          season_id: 'season-1',
          team_id: 'team-1',
          player_id: 'player-1',
          slot_key: 'F1_C',
          sort_order: 0,
        },
      ],
      loading: false,
      saving: false,
      save: jest.fn(),
    });

    renderTeamPlayersTab();

    expect(screen.getByText('Projected')).toBeInTheDocument();
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
    expect(screen.queryByText('Inactive')).not.toBeInTheDocument();
    expect(screen.queryByText('Reserve')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset Roster' })).not.toBeInTheDocument();
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
    expect(mockUseProjectedLineup).toHaveBeenCalledWith('team-1', 'season-1', { mode: 'user' });
  });

  it('combines current players and shows their latest associated season in the all view', async () => {
    const user = userEvent.setup();
    const historicalPlayers = [
      {
        ...players[0],
        end_date: null,
        latest_associated_season_name: '2026-27',
        latest_associated_season_is_current: true,
      },
      {
        ...players[1],
        end_date: null,
        is_prospect: true,
        latest_associated_season_name: '2025-26',
      },
      {
        ...players[2],
        end_date: '2025-06-30',
        latest_associated_season_name: '2024-25',
      },
    ] as TeamPlayerRecord[];
    mockUseTeamPlayers.mockReturnValue({ ...teamPlayersState, players: historicalPlayers });

    renderTeamPlayersTab({ scope: 'team', seasonId: null, readOnly: true });

    expect(screen.getByText('Auston Matthews')).toBeInTheDocument();
    expect(screen.getByText('Morgan Rielly')).toBeInTheDocument();
    expect(screen.queryByText('Joseph Woll')).not.toBeInTheDocument();
    expect(screen.getByText('Roster')).toBeInTheDocument();
    expect(screen.getByText('Reserve')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText('Auston Matthews')).toBeInTheDocument();
    expect(screen.getByText('Morgan Rielly')).toBeInTheDocument();
    expect(screen.getByText('Joseph Woll')).toBeInTheDocument();
    expect(screen.getByText('2026-27')).toHaveClass('success');
    expect(screen.getByText('2025-26')).toBeInTheDocument();
    expect(screen.getByText('2024-25')).toBeInTheDocument();
    expect(screen.queryByText(/Last played/)).not.toBeInTheDocument();
    expect(screen.queryByText('Roster')).not.toBeInTheDocument();
    expect(screen.queryByText('Reserve')).not.toBeInTheDocument();
  });

  it('leaves the all-view right content empty without a season association', async () => {
    const user = userEvent.setup();
    mockUseTeamPlayers.mockReturnValue({
      ...teamPlayersState,
      players: [{ ...players[0], end_date: null }],
    });

    renderTeamPlayersTab({ scope: 'team', seasonId: null, readOnly: true });
    await user.click(screen.getByRole('button', { name: 'All' }));

    expect(screen.queryByText('No games played')).not.toBeInTheDocument();
    expect(screen.queryByText('Roster')).not.toBeInTheDocument();
  });
});
