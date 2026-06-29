import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PlayerCard, { formatPlayerPosition } from './PlayerCard';

describe('PlayerCard', () => {
  it('formats known position codes as full names', () => {
    expect(formatPlayerPosition('C')).toBe('Center');
    expect(formatPlayerPosition('LW')).toBe('Left Wing');
    expect(formatPlayerPosition('F')).toBe('Forward');
    expect(formatPlayerPosition('G')).toBe('Goalie');
  });

  it('renders player info in team, jersey number, position order', () => {
    const { container } = render(
      <PlayerCard
        name="John Smith"
        initials="JS"
        jerseyNumber={19}
        position="C"
        teamCode="TOR"
        teamPrimaryColor="#003e7e"
        teamTextColor="#ffffff"
      />,
    );

    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('#19')).toBeInTheDocument();
    expect(screen.getByText('Center')).toBeInTheDocument();
    expect(screen.getAllByText('TOR').length).toBeGreaterThanOrEqual(1);

    const metaItems = container.querySelectorAll('.metaItem');
    expect(metaItems).toHaveLength(3);
    expect(metaItems[0]).toHaveTextContent('TOR');
    expect(metaItems[1]).toHaveTextContent('#19');
    expect(metaItems[2]).toHaveTextContent('Center');
    expect(screen.getByText('JS').parentElement).toHaveStyle(
      ['box-shadow: 0 0 0 3px #003e7e,', '0 0 0 4px rgba(0, 0, 0, 0.45)'].join(' '),
    );
  });

  it('renders the list variant as a list item with the same player info', () => {
    const { container } = render(
      <ul>
        <PlayerCard
          as="li"
          variant="list"
          name="Jane Smith"
          initials="JS"
          jerseyNumber={27}
          position="LW"
          teamCode="BOS"
          teamPrimaryColor="#fcb514"
        />
      </ul>,
    );

    const item = screen.getByText('Jane Smith').closest('li');
    expect(item).toHaveClass('card', 'list');

    const metaItems = container.querySelectorAll('.metaItem');
    expect(metaItems).toHaveLength(3);
    expect(metaItems[0]).toHaveTextContent('BOS');
    expect(metaItems[1]).toHaveTextContent('#27');
    expect(metaItems[2]).toHaveTextContent('Left Wing');
    expect(screen.getByText('JS').parentElement).toHaveStyle(
      ['box-shadow: 0 0 0 2px #fcb514,', '0 0 0 3px rgba(0, 0, 0, 0.45)'].join(' '),
    );
  });

  it('renders a linked team card when href and team kind are provided', () => {
    render(
      <MemoryRouter>
        <PlayerCard
          kind="team"
          name="Toronto"
          teamCode="TOR"
          href="/teams/toronto"
          subtitle="Champion"
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'View Toronto' })).toHaveAttribute(
      'href',
      '/teams/toronto',
    );
    expect(screen.getByText('Champion')).toBeInTheDocument();
  });
});
