import { render, screen, fireEvent, within } from '@testing-library/react';
import StatsLeaderCard, { type StatsLeaderItem } from './StatsLeaderCard';

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

describe('StatsLeaderCard empty', () => {
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

describe('StatsLeaderCard featured player', () => {
  it('renders the featured player first name and last name', () => {
    render(<StatsLeaderCard {...defaultProps} />);
    expect(screen.getAllByText('John Smith').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the stat label', () => {
    render(<StatsLeaderCard {...defaultProps} />);
    expect(screen.getByText('Points')).toBeInTheDocument();
  });

  it('renders the featured stat value', () => {
    render(<StatsLeaderCard {...defaultProps} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders featured stat info in a separate non-interactable card', () => {
    const onSelectItem = jest.fn();
    render(
      <StatsLeaderCard
        {...defaultProps}
        onSelectItem={onSelectItem}
      />,
    );

    const statCard = screen.getByText('Points').closest('.statCard');
    expect(statCard).toBeInTheDocument();
    expect(statCard?.tagName).toBe('DIV');
    expect(statCard?.closest('button')).toBeNull();
    expect(statCard?.previousElementSibling).toHaveClass('divider');
    expect(statCard?.previousElementSibling).toHaveClass('horizontal');

    fireEvent.click(statCard as HTMLElement);

    expect(onSelectItem).not.toHaveBeenCalled();
  });

  it('renders a photo <img> when photo is set', () => {
    const withPhoto = [makePlayer({ player_id: 'p1', photo: 'https://example.com/player.jpg' })];
    const { container } = render(
      <StatsLeaderCard
        {...defaultProps}
        items={withPhoto}
      />,
    );
    expect(container.querySelector('img.img')).toBeInTheDocument();
  });

  it('renders initials placeholder when photo is null', () => {
    render(<StatsLeaderCard {...defaultProps} />);
    expect(screen.getByText('JS')).toBeInTheDocument();
  });

  it('renders the team code in meta', () => {
    render(<StatsLeaderCard {...defaultProps} />);
    expect(screen.getAllByText('TOR').length).toBeGreaterThanOrEqual(1);
  });

  it('renders jersey number in meta', () => {
    render(<StatsLeaderCard {...defaultProps} />);
    expect(screen.getByText('#19')).toBeInTheDocument();
  });

  it('renders position in meta', () => {
    render(<StatsLeaderCard {...defaultProps} />);
    expect(screen.getByText('Center')).toBeInTheDocument();
  });

  it('dot-separates player info in the featured subtitle', () => {
    render(<StatsLeaderCard {...defaultProps} />);
    expect(screen.getAllByText('•').length).toBe(2);
  });

  it('shows the second player as featured when featuredIdx=1', () => {
    render(
      <StatsLeaderCard
        {...defaultProps}
        featuredIdx={1}
      />,
    );
    expect(screen.getAllByText('Jane Doe').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('42')).toBeInTheDocument();
  });
});

describe('StatsLeaderCard ranked list', () => {
  it('renders all player names in the list', () => {
    render(<StatsLeaderCard {...defaultProps} />);
    expect(screen.getAllByText('John Smith').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Bob Lee')).toBeInTheDocument();
  });

  it('renders tie-rank prefixes without trailing dot', () => {
    render(<StatsLeaderCard {...defaultProps} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.queryByText('1.')).not.toBeInTheDocument();
  });

  it('renders tie prefix e.g. "T1" when tieRanks contains it', () => {
    render(
      <StatsLeaderCard
        {...defaultProps}
        tieRanks={['T1', 'T1', '3']}
      />,
    );
    expect(screen.getAllByText('T1').length).toBe(2);
  });

  it('renders ranked players as compact list items', () => {
    render(<StatsLeaderCard {...defaultProps} />);

    const firstRankedItem = screen.getByText('1').closest('li');
    expect(firstRankedItem).toHaveClass('itemCompact');
    expect(firstRankedItem).not.toHaveClass('itemPlain');
    expect(firstRankedItem).toHaveClass('leaderItem');
    expect(firstRankedItem?.querySelector('.logoPlaceholder')).toBeNull();
    expect(firstRankedItem?.querySelector('.subtitle')).toBeNull();
    expect(screen.getByText('1')).toHaveClass('rankText');
    expect(screen.getByText('1').parentElement).toHaveClass('rankSlot');
    expect(firstRankedItem?.querySelector('.divider.vertical')).toBeInTheDocument();
    expect(screen.getByText('1')).not.toHaveAttribute('style');
    expect(within(firstRankedItem as HTMLElement).queryByText('TOR')).not.toBeInTheDocument();
  });

  it('calls onHover with the correct index on mouseEnter', () => {
    const onHover = jest.fn();
    render(
      <StatsLeaderCard
        {...defaultProps}
        onHover={onHover}
      />,
    );
    const rankedItems = screen.getAllByRole('listitem');
    fireEvent.mouseEnter(rankedItems[1]);
    expect(onHover).toHaveBeenCalledWith(1);
  });
});

describe('StatsLeaderCard selectable items', () => {
  it('calls onSelectItem when the featured player is clicked', () => {
    const onSelectItem = jest.fn();
    render(
      <StatsLeaderCard
        {...defaultProps}
        onSelectItem={onSelectItem}
      />,
    );

    fireEvent.click(screen.getAllByRole('button')[0]);

    expect(onSelectItem).toHaveBeenCalledWith(items[0]);
  });

  it('calls onSelectItem when a ranked player is clicked', () => {
    const onSelectItem = jest.fn();
    render(
      <StatsLeaderCard
        {...defaultProps}
        onSelectItem={onSelectItem}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /jane doe/i }));

    expect(onSelectItem).toHaveBeenCalledWith(items[1]);
  });
});
