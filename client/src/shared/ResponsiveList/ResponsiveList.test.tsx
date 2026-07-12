import { render, screen } from '@testing-library/react';
import ResponsiveList from './ResponsiveList';

describe('ResponsiveList', () => {
  it('renders a semantic list and forwards list attributes', () => {
    render(
      <ResponsiveList className="customList" aria-label="Games">
        <li>Game one</li>
        <li>Game two</li>
      </ResponsiveList>,
    );

    const list = screen.getByRole('list', { name: 'Games' });

    expect(list).toHaveClass('list', 'customList');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});
