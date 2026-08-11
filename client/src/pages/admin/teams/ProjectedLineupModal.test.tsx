import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { type TeamPlayerRecord } from '@/hooks/useTeamPlayers';
import { useProjectedLineup } from '@/hooks/useProjectedLineup';
import ProjectedLineupModal from './ProjectedLineupModal';

jest.mock('@/hooks/useProjectedLineup', () => ({
  useProjectedLineup: jest.fn(),
}));

jest.mock('@jerecocc/tracker-ui/components/Modal/Modal', () => ({
  __esModule: true,
  default: ({ children, title, onConfirm }: any) => (
    <div role="dialog" aria-label={title}>
      {children}
      <button type="button" onClick={onConfirm}>Save Projection</button>
    </div>
  ),
}));

jest.mock('@jerecocc/tracker-ui/components/Tabs/Tabs', () => ({
  __esModule: true,
  default: ({ tabs }: any) => (
    <div>
      {tabs.map((tab: any) => (
        <section key={tab.label} aria-label={`${tab.label} tab`}>
          <h2>{tab.label}</h2>
          {tab.content}
        </section>
      ))}
    </div>
  ),
}));

jest.mock('@jerecocc/tracker-ui/components/PlayerAvatar/PlayerAvatar', () => ({
  __esModule: true,
  default: ({ initials }: any) => <span>{initials}</span>,
}));

jest.mock('@jerecocc/tracker-ui/components/Button/Button', () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => {
    const {
      intent: _intent,
      icon: _icon,
      iconHeight: _iconHeight,
      iconSize: _iconSize,
      tooltip: _tooltip,
      tooltipClassName: _tooltipClassName,
      tooltipIntent: _tooltipIntent,
      variant: _variant,
      ...buttonProps
    } = props;
    return <button type="button" {...buttonProps}>{children}</button>;
  },
}));

const mockUseProjectedLineup = jest.mocked(useProjectedLineup);
const save = jest.fn().mockResolvedValue(true);

const players = [
  { id: 'forward-1', first_name: 'Alex', last_name: 'Wing', position: 'LW', jersey_number: 11 },
  { id: 'forward-2', first_name: 'Casey', last_name: 'Center', position: 'C', jersey_number: 19 },
  { id: 'forward-3', first_name: 'Zane', last_name: 'Able', position: 'RW', jersey_number: 88 },
  { id: 'defense-1', first_name: 'Dana', last_name: 'Blue', position: 'D', jersey_number: 4 },
  { id: 'goalie-1', first_name: 'Grace', last_name: 'Starter', position: 'G', jersey_number: 30 },
  { id: 'goalie-2', first_name: 'Blair', last_name: 'Backup', position: 'G', jersey_number: 35 },
  { id: 'goalie-3', first_name: 'Terry', last_name: 'Third', position: 'G', jersey_number: 40 },
].map((player) => ({
  ...player,
  photo: null,
  primary_color: '#123456',
  text_color: '#ffffff',
  is_prospect: false,
  is_active: true,
  created_at: '2026-01-01T00:00:00.000Z',
  player_team_id: `team-${player.id}`,
  team_id: 'team-1',
  team_name: 'Test Team',
})) as TeamPlayerRecord[];

const renderModal = () => render(
  <ProjectedLineupModal
    open
    onClose={jest.fn()}
    teamId="team-1"
    seasonId="season-1"
    teamName="Test Team"
    players={players}
  />,
);

const dropPlayer = (playerId: string, slotKey: string) => {
  const dataTransfer = {
    getData: jest.fn(() => playerId),
    setData: jest.fn(),
    effectAllowed: 'move',
  };
  fireEvent.drop(screen.getByTestId(`lineup-slot-${slotKey}`), { dataTransfer });
};

beforeEach(() => {
  jest.clearAllMocks();
  save.mockResolvedValue(true);
  mockUseProjectedLineup.mockReturnValue({ slots: [], loading: false, saving: false, save });
});

describe('ProjectedLineupModal', () => {
  it('uses layout-matched skeletons while the projection initially loads', () => {
    mockUseProjectedLineup.mockReturnValue({ slots: [], loading: true, saving: false, save });

    const { container } = renderModal();

    expect(container.querySelectorAll('.slotSkeleton')).toHaveLength(21);
    expect(container.querySelectorAll('.playerSkeleton')).toHaveLength(15);
    expect(screen.getByLabelText('Loading forwards projection')).toBeInTheDocument();
    expect(screen.queryByText(/Loading projected lineup/)).not.toBeInTheDocument();
  });

  it('renders a 12-slot forward grid, 6-slot defense grid, and 3-slot goalie grid', () => {
    renderModal();

    expect(screen.getAllByTestId(/^lineup-slot-F/)).toHaveLength(12);
    expect(screen.getAllByTestId(/^lineup-slot-D/)).toHaveLength(6);
    expect(screen.getAllByTestId(/^lineup-slot-G/)).toHaveLength(3);
    expect(screen.getByText('Left Wing', { selector: '.columnHeaders > span' })).toBeInTheDocument();
    expect(screen.getByText('Center', { selector: '.columnHeaders > span' })).toBeInTheDocument();
    expect(screen.getByText('Right Wing', { selector: '.columnHeaders > span' })).toBeInTheDocument();
    expect(screen.getByText('Left Defense', { selector: '.columnHeaders > span' })).toBeInTheDocument();
    expect(screen.getByText('Right Defense', { selector: '.columnHeaders > span' })).toBeInTheDocument();
    expect(screen.queryByText('Goaltender')).not.toBeInTheDocument();
    expect(screen.queryByText('Line 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Pairing 1')).not.toBeInTheDocument();
    expect(screen.getByTestId('lineup-slot-G1').parentElement).toHaveClass('slotGridG');
    expect(screen.getByTestId('lineup-slot-G1').parentElement?.children).toHaveLength(3);
  });

  it('filters the available player list with the tracker-ui search field', () => {
    renderModal();

    fireEvent.change(screen.getByPlaceholderText('Search forwards...'), {
      target: { value: 'Casey' },
    });

    expect(screen.getByLabelText('Casey Center')).toBeInTheDocument();
    expect(screen.queryByLabelText('Alex Wing')).not.toBeInTheDocument();
  });

  it('indicates and applies jersey-number or last-name sorting', () => {
    renderModal();
    const forwardsTab = screen.getByRole('region', { name: 'Forwards tab' });
    const playerNames = () => within(forwardsTab)
      .getAllByLabelText(/^(Alex Wing|Casey Center|Zane Able)$/)
      .map((item) => item.getAttribute('aria-label'));

    expect(within(forwardsTab).getByRole('button', { name: 'Sort by jersey number' }))
      .toHaveAttribute('data-active', 'true');
    expect(playerNames()).toEqual(['Alex Wing', 'Casey Center', 'Zane Able']);

    fireEvent.click(within(forwardsTab).getByRole('button', { name: 'Sort by last name' }));

    expect(within(forwardsTab).getByRole('button', { name: 'Sort by last name' }))
      .toHaveAttribute('data-active', 'true');
    expect(playerNames()).toEqual(['Zane Able', 'Casey Center', 'Alex Wing']);
  });

  it('matches the schedule-watch drag feedback and rejects invalid targets', () => {
    renderModal();
    const source = screen.getByLabelText('Alex Wing').closest('[draggable="true"]') as HTMLElement;
    const validTarget = screen.getByTestId('lineup-slot-F1_LW');
    const invalidTarget = screen.getByTestId('lineup-slot-D1_LD');
    const dataTransfer = {
      store: {} as Record<string, string>,
      effectAllowed: 'all',
      dropEffect: 'move',
      setData(type: string, value: string) {
        this.store[type] = value;
      },
      getData(type: string) {
        return this.store[type] ?? '';
      },
    };

    expect(source.querySelector('[data-icon="grip-lines-vertical"]')).toBeInTheDocument();
    fireEvent.dragStart(source, { dataTransfer });
    expect(source).toHaveClass('draggingPlayer');

    fireEvent.dragOver(validTarget, { dataTransfer });
    expect(validTarget).toHaveClass('slotDropTarget');
    expect(dataTransfer.dropEffect).toBe('move');

    fireEvent.dragOver(invalidTarget, { dataTransfer });
    expect(dataTransfer.dropEffect).toBe('none');
    expect(validTarget).not.toHaveClass('slotDropTarget');
    expect(invalidTarget).not.toHaveClass('slotDropTarget');

    fireEvent.dragEnd(source, { dataTransfer });
    expect(source).not.toHaveClass('draggingPlayer');
  });

  it('disables player dragging and lineup drop targets while saving', async () => {
    mockUseProjectedLineup.mockReturnValue({
      slots: [
        { id: 'slot-1', season_id: 'season-1', team_id: 'team-1', player_id: 'forward-1', slot_key: 'F1_LW', sort_order: 0 },
      ],
      loading: false,
      saving: true,
      save,
    });

    renderModal();

    await waitFor(() => {
      expect(within(screen.getByTestId('lineup-slot-F1_LW')).getByLabelText('Alex Wing'))
        .toBeInTheDocument();
    });
    const assignedPlayer = screen.getByLabelText('Alex Wing').closest('[aria-disabled="true"]');
    const availablePlayer = screen.getByLabelText('Casey Center').closest('[aria-disabled="true"]');

    expect(assignedPlayer).toHaveAttribute('draggable', 'false');
    expect(availablePlayer).toHaveAttribute('draggable', 'false');
    expect(screen.getByTestId('lineup-slot-F1_C')).toHaveAttribute('aria-disabled', 'true');
    expect(within(screen.getByRole('region', { name: 'Forwards tab' }))
      .getByRole('button', { name: 'Sort by jersey number' })).toBeDisabled();
  });

  it('saves a player dropped into a specific forward line slot', async () => {
    renderModal();
    dropPlayer('forward-1', 'F1_LW');
    const assignedPlayer = within(screen.getByTestId('lineup-slot-F1_LW'));

    expect(assignedPlayer.getByText('Alex')).toHaveClass('eyebrow');
    expect(assignedPlayer.getByText('Wing')).toHaveClass('name');
    expect(assignedPlayer.getByText('11')).toBeInTheDocument();
    expect(assignedPlayer.queryByText('Left Wing')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save Projection' }));

    await waitFor(() => expect(save).toHaveBeenCalledWith([
      { slot_key: 'F1_LW', player_id: 'forward-1' },
    ]));
  });

  it('keeps the third goalie slot disabled until starter and backup are filled', () => {
    renderModal();
    const thirdSlot = screen.getByTestId('lineup-slot-G3');

    expect(thirdSlot).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('lineup-slot-G1')).toHaveTextContent('Drop starter here');
    expect(screen.getByTestId('lineup-slot-G2')).toHaveTextContent('Drop backup here');
    expect(thirdSlot).toHaveTextContent('Drop third goalie here');
    dropPlayer('goalie-3', 'G3');
    expect(thirdSlot).toHaveTextContent('Drop third goalie here');

    dropPlayer('goalie-1', 'G1');
    dropPlayer('goalie-2', 'G2');
    expect(thirdSlot).toHaveAttribute('aria-disabled', 'false');

    dropPlayer('goalie-3', 'G3');
    expect(within(thirdSlot).getByLabelText('Terry Third')).toBeInTheDocument();
  });

  it('maps legacy numbered slots into the new line and pairing positions', async () => {
    mockUseProjectedLineup.mockReturnValue({
      slots: [
        { id: 'slot-1', season_id: 'season-1', team_id: 'team-1', player_id: 'forward-1', slot_key: 'F1', sort_order: 0 },
        { id: 'slot-2', season_id: 'season-1', team_id: 'team-1', player_id: 'defense-1', slot_key: 'D1', sort_order: 1 },
      ],
      loading: false,
      saving: false,
      save,
    });

    renderModal();

    await waitFor(() => {
      expect(within(screen.getByTestId('lineup-slot-F1_LW')).getByLabelText('Alex Wing')).toBeInTheDocument();
      expect(within(screen.getByTestId('lineup-slot-D1_LD')).getByLabelText('Dana Blue')).toBeInTheDocument();
    });
  });
});
