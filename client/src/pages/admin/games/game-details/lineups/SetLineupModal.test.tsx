import { render, screen, fireEvent, act } from '@testing-library/react';
import SetLineupModal from './SetLineupModal';
import { type LineupEntry } from '@/hooks/useGameLineup';
import { type TeamPlayerRecord } from '@/hooks/useTeamPlayers';

// ── Mock the custom Select so we can drive it with a native <select> ─────
jest.mock('../../../components/Select/Select', () => {
  const MockSelect = ({
    value,
    options,
    onChange,
    placeholder,
  }: {
    value: string;
    options: Array<{ value?: string; label?: string; divider?: true }>;
    onChange: (v: string) => void;
    placeholder?: string;
  }) => (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      aria-label={placeholder}
    >
      <option value="">{placeholder}</option>
      {options
        .filter((o) => !o.divider)
        .map((o) => (
          <option
            key={o.value}
            value={o.value}
          >
            {o.label}
          </option>
        ))}
    </select>
  );
  return { __esModule: true, default: MockSelect };
});

// ── Fixtures ─────────────────────────────────────────────────────────────
const makePlayers = (): TeamPlayerRecord[] =>
  [
    {
      id: 'c1',
      first_name: 'Alice',
      last_name: 'A',
      position: 'C',
      jersey_number: 11,
      team_id: 't1',
    },
    {
      id: 'lw1',
      first_name: 'Bob',
      last_name: 'B',
      position: 'LW',
      jersey_number: 12,
      team_id: 't1',
    },
    {
      id: 'rw1',
      first_name: 'Carol',
      last_name: 'C',
      position: 'RW',
      jersey_number: 13,
      team_id: 't1',
    },
    { id: 'd1', first_name: 'Dan', last_name: 'D', position: 'D', jersey_number: 4, team_id: 't1' },
    { id: 'd2', first_name: 'Eve', last_name: 'E', position: 'D', jersey_number: 5, team_id: 't1' },
    {
      id: 'g1',
      first_name: 'Frank',
      last_name: 'F',
      position: 'G',
      jersey_number: 30,
      team_id: 't1',
    },
  ] as unknown as TeamPlayerRecord[];

const defaultProps = {
  open: true,
  onClose: jest.fn(),
  teamId: 't1',
  teamName: 'Test Team',
  players: makePlayers(),
  lineup: [] as LineupEntry[],
  saveTeamLineup: jest.fn().mockResolvedValue(true),
};

const filledLineup: LineupEntry[] = [
  { id: 'le1', game_id: 'g1', team_id: 't1', player_id: 'c1', position_slot: 'C' },
  { id: 'le2', game_id: 'g1', team_id: 't1', player_id: 'lw1', position_slot: 'LW' },
  { id: 'le3', game_id: 'g1', team_id: 't1', player_id: 'rw1', position_slot: 'RW' },
  { id: 'le4', game_id: 'g1', team_id: 't1', player_id: 'd1', position_slot: 'D1' },
  { id: 'le5', game_id: 'g1', team_id: 't1', player_id: 'd2', position_slot: 'D2' },
  { id: 'le6', game_id: 'g1', team_id: 't1', player_id: 'g1', position_slot: 'G' },
];

beforeEach(() => jest.clearAllMocks());

// ── Visibility ───────────────────────────────────────────────────────────
describe('SetLineupModal – visibility', () => {
  it('renders nothing when open is false', () => {
    render(
      <SetLineupModal
        {...defaultProps}
        open={false}
      />,
    );
    expect(screen.queryByText(/Set Starting Lineup/i)).not.toBeInTheDocument();
  });

  it('renders the modal title with the team name', () => {
    render(<SetLineupModal {...defaultProps} />);
    expect(screen.getByText(/Set Starting Lineup — Test Team/i)).toBeInTheDocument();
  });

  it('renders all position slot labels', () => {
    render(<SetLineupModal {...defaultProps} />);
    expect(screen.getByText('Center')).toBeInTheDocument();
    expect(screen.getByText('Left Wing')).toBeInTheDocument();
    expect(screen.getByText('Right Wing')).toBeInTheDocument();
    // Defence slots are labelled "Left Defense" and "Right Defense"
    expect(screen.getByText('Left Defense')).toBeInTheDocument();
    expect(screen.getByText('Right Defense')).toBeInTheDocument();
    expect(screen.getByText('Goalie')).toBeInTheDocument();
  });
});

// ── Clear button ──────────────────────────────────────────────────────────
describe('SetLineupModal – Clear button', () => {
  it('renders the Clear button', () => {
    render(<SetLineupModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
  });

  it('Clear button is disabled when the draft is empty', () => {
    render(<SetLineupModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: /clear/i })).toBeDisabled();
  });

  it('Clear button is enabled when the draft has a value', () => {
    render(
      <SetLineupModal
        {...defaultProps}
        lineup={filledLineup}
      />,
    );
    expect(screen.getByRole('button', { name: /clear/i })).not.toBeDisabled();
  });

  it('clicking Clear resets all selects to empty', () => {
    render(
      <SetLineupModal
        {...defaultProps}
        lineup={filledLineup}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /clear/i }));
    // After clearing, the Clear button should be disabled again
    expect(screen.getByRole('button', { name: /clear/i })).toBeDisabled();
  });

  it('clicking Clear does NOT call saveTeamLineup', () => {
    render(
      <SetLineupModal
        {...defaultProps}
        lineup={filledLineup}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(defaultProps.saveTeamLineup).not.toHaveBeenCalled();
  });

  it('clicking Clear does NOT call onClose', () => {
    render(
      <SetLineupModal
        {...defaultProps}
        lineup={filledLineup}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });
});

// ── Save button state ─────────────────────────────────────────────────────
describe('SetLineupModal – Save button', () => {
  it('"Save Lineup" button is disabled when draft is empty (not all filled)', () => {
    render(<SetLineupModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: /save lineup/i })).toBeDisabled();
  });

  it('"Save Lineup" button is enabled when all slots are filled and there are changes', () => {
    // Start with a fully filled lineup, then clear one slot to create a "change"
    // The simplest path: start from empty and fill all slots via the mocked selects
    render(<SetLineupModal {...defaultProps} />);
    const selects = screen.getAllByRole('combobox');
    // selects order: C, LW, RW, D1, D2, G
    fireEvent.change(selects[0], { target: { value: 'c1' } });
    fireEvent.change(selects[1], { target: { value: 'lw1' } });
    fireEvent.change(selects[2], { target: { value: 'rw1' } });
    fireEvent.change(selects[3], { target: { value: 'd1' } });
    fireEvent.change(selects[4], { target: { value: 'd2' } });
    fireEvent.change(selects[5], { target: { value: 'g1' } });
    expect(screen.getByRole('button', { name: /save lineup/i })).not.toBeDisabled();
  });

  it('calls saveTeamLineup with correct args when Save is clicked', async () => {
    render(<SetLineupModal {...defaultProps} />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'c1' } });
    fireEvent.change(selects[1], { target: { value: 'lw1' } });
    fireEvent.change(selects[2], { target: { value: 'rw1' } });
    fireEvent.change(selects[3], { target: { value: 'd1' } });
    fireEvent.change(selects[4], { target: { value: 'd2' } });
    fireEvent.change(selects[5], { target: { value: 'g1' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save lineup/i }));
    });
    expect(defaultProps.saveTeamLineup).toHaveBeenCalledWith(
      't1',
      expect.arrayContaining([
        { position_slot: 'C', player_id: 'c1' },
        { position_slot: 'LW', player_id: 'lw1' },
        { position_slot: 'RW', player_id: 'rw1' },
        { position_slot: 'D1', player_id: 'd1' },
        { position_slot: 'D2', player_id: 'd2' },
        { position_slot: 'G', player_id: 'g1' },
      ]),
      'Test Team',
    );
  });

  it('calls onClose after a successful save', async () => {
    render(<SetLineupModal {...defaultProps} />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'c1' } });
    fireEvent.change(selects[1], { target: { value: 'lw1' } });
    fireEvent.change(selects[2], { target: { value: 'rw1' } });
    fireEvent.change(selects[3], { target: { value: 'd1' } });
    fireEvent.change(selects[4], { target: { value: 'd2' } });
    fireEvent.change(selects[5], { target: { value: 'g1' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save lineup/i }));
    });
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });
});

// ── Lineup sync ───────────────────────────────────────────────────────────
describe('SetLineupModal – lineup sync', () => {
  it('pre-fills selects from the provided lineup', () => {
    render(
      <SetLineupModal
        {...defaultProps}
        lineup={filledLineup}
      />,
    );
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    expect(selects[0].value).toBe('c1');
    expect(selects[1].value).toBe('lw1');
    expect(selects[2].value).toBe('rw1');
    expect(selects[3].value).toBe('d1');
    expect(selects[4].value).toBe('d2');
    expect(selects[5].value).toBe('g1');
  });

  it('ignores lineup entries for a different team', () => {
    const otherTeamLineup: LineupEntry[] = [
      { id: 'le1', game_id: 'g1', team_id: 'other', player_id: 'c1', position_slot: 'C' },
    ];
    render(
      <SetLineupModal
        {...defaultProps}
        lineup={otherTeamLineup}
      />,
    );
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    expect(selects[0].value).toBe('');
  });
});

// ── Cancel / close ────────────────────────────────────────────────────────
describe('SetLineupModal – close', () => {
  it('calls onClose when Cancel button is clicked', () => {
    render(<SetLineupModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });
});

// ── Option ordering ───────────────────────────────────────────────────────
// The mock renders options in DOM order (dividers filtered out), so the first
// <option> after the placeholder is the primary-position player.
describe('SetLineupModal – option ordering', () => {
  const getOptionsFor = (selectEl: HTMLSelectElement) =>
    Array.from(selectEl.options)
      .slice(1) // skip the placeholder option
      .map((o) => o.value);

  it('C select lists the center player first, then other non-goalies', () => {
    render(<SetLineupModal {...defaultProps} />);
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const opts = getOptionsFor(selects[0]); // C slot
    expect(opts[0]).toBe('c1'); // Alice (C) is first
    expect(opts).toContain('lw1');
    expect(opts).toContain('rw1');
    expect(opts).toContain('d1');
    expect(opts).not.toContain('g1'); // goalies excluded
  });

  it('LW select lists the left-wing player first, then other non-goalies', () => {
    render(<SetLineupModal {...defaultProps} />);
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const opts = getOptionsFor(selects[1]); // LW slot
    expect(opts[0]).toBe('lw1'); // Bob (LW) is first
    expect(opts).toContain('c1');
    expect(opts).not.toContain('g1');
  });

  it('RW select lists the right-wing player first, then other non-goalies', () => {
    render(<SetLineupModal {...defaultProps} />);
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const opts = getOptionsFor(selects[2]); // RW slot
    expect(opts[0]).toBe('rw1'); // Carol (RW) is first
    expect(opts).toContain('c1');
    expect(opts).not.toContain('g1');
  });

  it('D1 select lists defence players first, then other non-goalies', () => {
    render(<SetLineupModal {...defaultProps} />);
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const opts = getOptionsFor(selects[3]); // D1 slot
    // Both D players should appear before forwards
    const d1Idx = opts.indexOf('d1');
    const d2Idx = opts.indexOf('d2');
    const c1Idx = opts.indexOf('c1');
    expect(d1Idx).toBeLessThan(c1Idx);
    expect(d2Idx).toBeLessThan(c1Idx);
    expect(opts).not.toContain('g1');
  });

  it('D2 select lists defence players first, then other non-goalies', () => {
    render(<SetLineupModal {...defaultProps} />);
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const opts = getOptionsFor(selects[4]); // D2 slot
    const d1Idx = opts.indexOf('d1');
    const c1Idx = opts.indexOf('c1');
    expect(d1Idx).toBeLessThan(c1Idx);
    expect(opts).not.toContain('g1');
  });

  it('G select shows only goalies', () => {
    render(<SetLineupModal {...defaultProps} />);
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const opts = getOptionsFor(selects[5]); // G slot
    expect(opts).toEqual(['g1']);
  });
});
