import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SetLineupModal from './SetLineupModal';
import { type LineupEntry } from '@/hooks/useGameLineup';
import { type TeamPlayerRecord } from '@/hooks/useTeamPlayers';

jest.mock('@jerecocc/tracker-ui/components/Icon/Icon', () =>
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
  player({ id: 'g2', first_name: 'Gina', last_name: 'G', position: 'G', jersey_number: 35 }),
  player({ id: 'rw1', first_name: 'Carol', last_name: 'C', position: 'RW', jersey_number: 13 }),
  player({ id: 'd2', first_name: 'Eve', last_name: 'E', position: 'D', jersey_number: 5 }),
  player({ id: 'c1', first_name: 'Alice', last_name: 'A', position: 'C', jersey_number: 11 }),
  player({ id: 'd1', first_name: 'Dan', last_name: 'D', position: 'D', jersey_number: 4 }),
  player({ id: 'lw1', first_name: 'Bob', last_name: 'B', position: 'LW', jersey_number: 12 }),
];

const makeLineup = (inherited = false): LineupEntry[] => [
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
  it('renders only the goalie list with cancel and save actions', () => {
    const { container } = renderModal();

    expect(screen.getByText(/Set Starting Goalie - Test Team/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/goalie jersey number/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/search goalies/i)).not.toBeInTheDocument();

    const rows = Array.from(container.querySelectorAll('[data-radio-list-option="true"]')).map(
      (row) => row.textContent,
    );
    expect(rows).toEqual([
      expect.stringContaining('Frank F'),
      expect.stringContaining('Gina G'),
    ]);
    expect(rows).not.toEqual(expect.arrayContaining([expect.stringContaining('Carol C')]));
  });

  it('uses correction wording when editing a final lineup correction', () => {
    renderModal({ correctionMode: true });

    expect(screen.getByText(/Correct Final Starting Goalie - Test Team/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save correction/i })).toBeInTheDocument();
  });

  it('saves the checked goalie', async () => {
    const user = userEvent.setup();
    const saveTeamLineup = jest.fn().mockResolvedValue(true);
    renderModal({ saveTeamLineup });

    await user.click(screen.getByText('Frank F'));
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(saveTeamLineup).toHaveBeenCalledWith(
      't1',
      [{ position_slot: 'G', player_id: 'g1' }],
      'Test Team',
    );
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('prefills saved starters and disables save when there are no changes', () => {
    renderModal({ lineup: makeLineup(false) });

    const checkedRadios = screen
      .getAllByRole('radio')
      .filter((radio) => radio.getAttribute('aria-checked') === 'true');
    expect(checkedRadios).toHaveLength(1);
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('prefills inherited starters but still allows saving them to the current game', async () => {
    const user = userEvent.setup();
    const saveTeamLineup = jest.fn().mockResolvedValue(true);
    renderModal({
      lineup: makeLineup(true),
      saveTeamLineup,
    });

    const checkedRadios = screen
      .getAllByRole('radio')
      .filter((radio) => radio.getAttribute('aria-checked') === 'true');
    expect(checkedRadios).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(saveTeamLineup).toHaveBeenCalledTimes(1);
  });

  it('changes directly from one selected goalie to another', async () => {
    const user = userEvent.setup();
    const saveTeamLineup = jest.fn().mockResolvedValue(true);
    renderModal({
      lineup: makeLineup(false),
      saveTeamLineup,
    });

    await user.click(screen.getByText('Gina G'));
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(saveTeamLineup).toHaveBeenCalledWith(
      't1',
      [{ position_slot: 'G', player_id: 'g2' }],
      'Test Team',
    );
  });

  it('keeps goalie order when selecting a different goalie', async () => {
    const user = userEvent.setup();
    const { container } = renderModal();

    await user.click(screen.getByText('Gina G'));

    const rows = Array.from(container.querySelectorAll('[data-radio-list-option="true"]')).map(
      (row) => row.textContent,
    );
    expect(rows[0]).toEqual(expect.stringContaining('Frank F'));
    expect(rows[1]).toEqual(expect.stringContaining('Gina G'));
  });
});
