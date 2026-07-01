import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SetLineupModal from './SetLineupModal';
import { type LineupEntry } from '@/hooks/useGameLineup';
import { type TeamPlayerRecord } from '@/hooks/useTeamPlayers';

jest.mock('@/components/Icon/Icon', () =>
  function MockIcon({ name }: { name: string }) {
    return <span>{name}</span>;
  },
);

const player = (overrides: Partial<TeamPlayerRecord>): TeamPlayerRecord =>
  ({
    id: 'player-1',
    first_name: 'John',
    last_name: 'Smith',
    photo: null,
    date_of_birth: null,
    birth_city: null,
    birth_country: null,
    height_cm: null,
    weight_lbs: null,
    position: 'C',
    shoots: null,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    player_team_id: 'pt-1',
    jersey_number: 19,
    team_id: 't1',
    team_name: 'Test Team',
    primary_color: '#111111',
    text_color: '#ffffff',
    is_prospect: false,
    ...overrides,
  }) as TeamPlayerRecord;

const makePlayers = (): TeamPlayerRecord[] => [
  player({ id: 'g1', first_name: 'Frank', last_name: 'F', position: 'G', jersey_number: 30 }),
  player({ id: 'rw1', first_name: 'Carol', last_name: 'C', position: 'RW', jersey_number: 13 }),
  player({ id: 'd2', first_name: 'Eve', last_name: 'E', position: 'D', jersey_number: 5 }),
  player({ id: 'c1', first_name: 'Alice', last_name: 'A', position: 'C', jersey_number: 11 }),
  player({ id: 'd1', first_name: 'Dan', last_name: 'D', position: 'D', jersey_number: 4 }),
  player({ id: 'lw1', first_name: 'Bob', last_name: 'B', position: 'LW', jersey_number: 12 }),
];

const makeLineup = (inherited = false): LineupEntry[] => [
  { id: 'le1', game_id: 'g1', team_id: 't1', player_id: 'd1', position_slot: 'F1', inherited },
  { id: 'le2', game_id: 'g1', team_id: 't1', player_id: 'd2', position_slot: 'F2', inherited },
  { id: 'le3', game_id: 'g1', team_id: 't1', player_id: 'c1', position_slot: 'F3', inherited },
  { id: 'le4', game_id: 'g1', team_id: 't1', player_id: 'lw1', position_slot: 'D1', inherited },
  { id: 'le5', game_id: 'g1', team_id: 't1', player_id: 'rw1', position_slot: 'D2', inherited },
  { id: 'le6', game_id: 'g1', team_id: 't1', player_id: 'g1', position_slot: 'G', inherited },
];

const defaultProps = {
  open: true,
  onClose: jest.fn(),
  teamId: 't1',
  teamName: 'Test Team',
  players: makePlayers(),
  lineup: [] as LineupEntry[],
  saveTeamLineup: jest.fn().mockResolvedValue(true),
};

const renderModal = (overrides: Partial<Parameters<typeof SetLineupModal>[0]> = {}) =>
  render(
    <SetLineupModal
      {...defaultProps}
      {...overrides}
    />,
  );

beforeAll(() => {
  Object.defineProperty(window, 'scrollTo', {
    configurable: true,
    value: jest.fn(),
  });
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SetLineupModal', () => {
  it('renders the roster-picking controls and sorts skaters by jersey with goalies last', () => {
    const { container } = renderModal();

    expect(screen.getByText(/Set Starting Lineup - Test Team/i)).toBeInTheDocument();
    expect(screen.getByText(/Starting players/i)).toBeInTheDocument();
    expect(screen.getByText('*')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/jersey numbers/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search players/i)).toBeInTheDocument();

    const rows = Array.from(container.querySelectorAll('li')).map((row) => row.textContent);
    expect(rows).toEqual([
      expect.stringContaining('Dan D'),
      expect.stringContaining('Eve E'),
      expect.stringContaining('Alice A'),
      expect.stringContaining('Bob B'),
      expect.stringContaining('Carol C'),
      expect.stringContaining('Frank F'),
    ]);
  });

  it('uses correction wording when editing a final lineup correction', () => {
    renderModal({ correctionMode: true });

    expect(screen.getByText(/Correct Final Lineup - Test Team/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save correction/i })).toBeInTheDocument();
  });

  it('uses the jersey quick field and saves checked players in jersey order with the goalie last', async () => {
    const user = userEvent.setup();
    const saveTeamLineup = jest.fn().mockResolvedValue(true);
    renderModal({ saveTeamLineup });

    await user.type(screen.getByPlaceholderText(/jersey numbers/i), '30 13 5 11 4 12');
    await user.click(screen.getByRole('button', { name: /apply/i }));
    await user.click(screen.getByRole('button', { name: /save lineup/i }));

    expect(saveTeamLineup).toHaveBeenCalledWith(
      't1',
      [
        { position_slot: 'F1', player_id: 'd1' },
        { position_slot: 'F2', player_id: 'd2' },
        { position_slot: 'F3', player_id: 'c1' },
        { position_slot: 'D1', player_id: 'lw1' },
        { position_slot: 'D2', player_id: 'rw1' },
        { position_slot: 'G', player_id: 'g1' },
      ],
      'Test Team',
    );
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('requires exactly one goalie among the six checked starters', async () => {
    const user = userEvent.setup();
    renderModal({
      players: [
        ...makePlayers().filter((p) => p.id !== 'g1'),
        player({ id: 'f4', first_name: 'Nate', last_name: 'N', position: 'F', jersey_number: 21 }),
      ],
    });

    await user.type(screen.getByPlaceholderText(/jersey numbers/i), '4 5 11 12 13 21');
    await user.click(screen.getByRole('button', { name: /apply/i }));

    expect(screen.getByText(/select exactly one goalie/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save lineup/i })).toBeDisabled();
  });

  it('prefills saved starters and disables save when there are no changes', () => {
    renderModal({ lineup: makeLineup(false) });

    const checkedBoxes = screen
      .getAllByRole('checkbox')
      .filter((checkbox) => checkbox.getAttribute('aria-checked') === 'true');
    expect(checkedBoxes).toHaveLength(6);
    expect(screen.getByRole('button', { name: /save lineup/i })).toBeDisabled();
  });

  it('prefills inherited starters but still allows saving them to the current game', async () => {
    const user = userEvent.setup();
    const saveTeamLineup = jest.fn().mockResolvedValue(true);
    renderModal({
      lineup: makeLineup(true),
      saveTeamLineup,
    });

    const checkedBoxes = screen
      .getAllByRole('checkbox')
      .filter((checkbox) => checkbox.getAttribute('aria-checked') === 'true');
    expect(checkedBoxes).toHaveLength(6);

    await user.click(screen.getByRole('button', { name: /save lineup/i }));

    expect(saveTeamLineup).toHaveBeenCalledTimes(1);
  });

  it('filters the list by search text', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText(/search players/i), 'Frank');

    const list = screen.getByRole('list');
    expect(within(list).getByText('Frank F')).toBeInTheDocument();
    expect(within(list).queryByText('Alice A')).not.toBeInTheDocument();
  });

  it('moves selected players to the top of the list', async () => {
    const user = userEvent.setup();
    const { container } = renderModal();

    await user.click(screen.getByText('Frank F'));

    const rows = Array.from(container.querySelectorAll('li')).map((row) => row.textContent);
    expect(rows[0]).toEqual(expect.stringContaining('Frank F'));
    expect(rows[1]).toEqual(expect.stringContaining('Dan D'));
  });

  it('clears selected players without saving or closing', async () => {
    const user = userEvent.setup();
    renderModal({ lineup: makeLineup(false) });

    await user.click(screen.getByRole('button', { name: /clear/i }));

    const checkedBoxes = screen
      .getAllByRole('checkbox')
      .filter((checkbox) => checkbox.getAttribute('aria-checked') === 'true');
    expect(checkedBoxes).toHaveLength(0);
    expect(screen.getByRole('button', { name: /clear/i })).toBeDisabled();
    expect(defaultProps.saveTeamLineup).not.toHaveBeenCalled();
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });
});
