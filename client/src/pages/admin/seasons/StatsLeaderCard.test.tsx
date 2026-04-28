import { render, screen, fireEvent } from '@testing-library/react';
import StatsLeaderCard, { type StatsLeaderItem } from '@/pages/admin/seasons/StatsLeaderCard';

const makePlayer = (overrides: Partial<StatsLeaderItem> = {}): StatsLeaderItem => ({
  player_id: 'p1',
  first_name: 'John',
  last_name: 'Smith',
  photo: null,
  team_primary_color: '#0033cc',
  team_text_color: '#ffffff',
  team_logo: null,
  team_code: 'TOR',
  jersey_number: 19,
  position: 'C',
  ...overrides,
});

const items: StatsLeaderItem[] = [
  makePlayer({ player_id: 'p1', first_name: 'John', last_name: 'Smith', jersey_number: 19 }),
  makePlayer({ player_id: 'p2', first_name: 'Jane', last_name: 'Doe', jersey_number: 22 }),
  makePlayer({ player_id: 'p3', first_name: 'Bob', last_name: 'Lee', jersey_number: 7 }),
];

const defaultProps = {
  items,
  featuredIdx: 0,
  onHover: jest.fn(),
  tieRanks: ['1', '2', '3'],
  statLabel: 'Points',
  getFeaturedStat: () => '42',
  getRowStat: (_: StatsLeaderItem, i?: number) => String(i ?? 0),
};

beforeEach(() => jest.clearAllMocks());

// ── Empty state ─────────────────────────────────────────────────────────
describe('StatsLeaderCard – empty', () => {
  it('returns null when items is empty', () => {
    const { container } = render(
      <StatsLeaderCard
        {...defaultProps}
        items={[]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});

// ── Featured player ─────────────────────────────────────────────────────
describe('StatsLeaderCard – featured player', () => {
  it('renders the featured player first name and last name', () => {
    render(<StatsLeaderCard {...defaultProps} />);
    // The name appears in the list row as "John Smith" (single text node)
    expect(screen.getByText('John Smith')).toBeInTheDocument();
  });

  it('renders the stat label', () => {
    render(<StatsLeaderCard {...defaultProps} />);
    expect(screen.getByText('Points')).toBeInTheDocument();
  });

  it('renders the featured stat value', () => {
    render(<StatsLeaderCard {...defaultProps} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders a photo <img> when photo is set', () => {
    const withPhoto = [makePlayer({ player_id: 'p1', photo: 'https://example.com/player.jpg' })];
    const { container } = render(
      <StatsLeaderCard
        {...defaultProps}
        items={withPhoto}
      />,
    );
    // alt="" gives the img role "presentation"; use DOM query instead
    expect(container.querySelector('img.photo')).toBeInTheDocument();
  });

  it('renders initials placeholder when photo is null', () => {
    render(<StatsLeaderCard {...defaultProps} />);
    // Initials span contains "J" + "S"
    expect(screen.getByText('JS')).toBeInTheDocument();
  });

  it('renders the team code in meta', () => {
    render(<StatsLeaderCard {...defaultProps} />);
    expect(screen.getAllByText('TOR').length).toBeGreaterThanOrEqual(1);
  });

  it('renders jersey number in meta', () => {
    render(<StatsLeaderCard {...defaultProps} />);
    expect(screen.getByText('• #19')).toBeInTheDocument();
  });

  it('renders position in meta', () => {
    render(<StatsLeaderCard {...defaultProps} />);
    expect(screen.getByText('• C')).toBeInTheDocument();
  });

  it('shows the second player as featured when featuredIdx=1', () => {
    render(
      <StatsLeaderCard
        {...defaultProps}
        featuredIdx={1}
      />,
    );
    // "Jane Doe" appears in the list row; the featured stat value (42) is still shown
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });
});

// ── Ranked list ─────────────────────────────────────────────────────────
describe('StatsLeaderCard – ranked list', () => {
  it('renders all player names in the list', () => {
    render(<StatsLeaderCard {...defaultProps} />);
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Bob Lee')).toBeInTheDocument();
  });

  it('renders tie-rank prefixes with trailing dot', () => {
    render(<StatsLeaderCard {...defaultProps} />);
    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('2.')).toBeInTheDocument();
    expect(screen.getByText('3.')).toBeInTheDocument();
  });

  it('renders tie prefix e.g. "T1." when tieRanks contains it', () => {
    render(
      <StatsLeaderCard
        {...defaultProps}
        tieRanks={['T1', 'T1', '3']}
      />,
    );
    expect(screen.getAllByText('T1.').length).toBe(2);
  });

  it('calls onHover with the correct index on mouseEnter', () => {
    const onHover = jest.fn();
    const { container } = render(
      <StatsLeaderCard
        {...defaultProps}
        onHover={onHover}
      />,
    );
    // Target the ranked-list entry divs directly (they have onMouseEnter).
    // CSS modules return the property name unchanged in the test env (identity-obj-proxy),
    // so styles.entry === "entry". Use :not to exclude entryName/entryStat spans.
    const entryDivs = container.querySelectorAll('div.entry');
    // entryDivs[0]=John Smith row, entryDivs[1]=Jane Doe row
    fireEvent.mouseEnter(entryDivs[1]);
    expect(onHover).toHaveBeenCalledWith(1);
  });
});

// ── All Leaders ──────────────────────────────────────────────────────────
describe('StatsLeaderCard – All Leaders button', () => {
  it('renders "All Leaders" button when onAllLeaders is provided', () => {
    render(
      <StatsLeaderCard
        {...defaultProps}
        onAllLeaders={jest.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /all leaders/i })).toBeInTheDocument();
  });

  it('does NOT render "All Leaders" button when onAllLeaders is not provided', () => {
    render(<StatsLeaderCard {...defaultProps} />);
    expect(screen.queryByRole('button', { name: /all leaders/i })).not.toBeInTheDocument();
  });

  it('calls onAllLeaders when the button is clicked', () => {
    const onAllLeaders = jest.fn();
    render(
      <StatsLeaderCard
        {...defaultProps}
        onAllLeaders={onAllLeaders}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /all leaders/i }));
    expect(onAllLeaders).toHaveBeenCalledTimes(1);
  });
});
