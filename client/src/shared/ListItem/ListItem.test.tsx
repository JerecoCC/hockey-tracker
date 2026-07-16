import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import ListItem from '@jerecocc/tracker-ui/components/ListItem/ListItem';

const NavigatingListItem = () => {
  const navigate = useNavigate();

  return (
    <ul>
      <ListItem
        name="National Hockey League"
        onClick={() => navigate('/admin/leagues/nhl')}
        ariaLabel="View National Hockey League"
      />
    </ul>
  );
};

describe('ListItem keyboard navigation', () => {
  it('focuses an onClick item before its hover actions and activates it with Enter', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();

    render(
      <MemoryRouter>
        <ul>
          <ListItem
            name="National Hockey League"
            onClick={onClick}
            ariaLabel="View National Hockey League"
            actions={[
              {
                icon: 'edit',
                tooltip: 'Edit league',
                onClick: jest.fn(),
              },
            ]}
          />
        </ul>
      </MemoryRouter>,
    );

    const item = screen.getByRole('button', { name: 'View National Hockey League' });
    const editAction = screen.getByRole('button', { name: 'Edit league' });

    await user.tab();
    expect(item).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);

    await user.tab();
    expect(editAction).toHaveFocus();
  });

  it('does not activate the item onClick when a hover action is used with the keyboard', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    const onEdit = jest.fn();

    render(
      <MemoryRouter>
        <ul>
          <ListItem
            name="National Hockey League"
            onClick={onClick}
            ariaLabel="View National Hockey League"
            actions={[
              {
                icon: 'edit',
                tooltip: 'Edit league',
                onClick: onEdit,
              },
            ]}
          />
        </ul>
      </MemoryRouter>,
    );

    await user.tab();
    await user.tab();
    await user.keyboard('{Enter}');

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('supports an onClick redirect when activated with the keyboard', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={<NavigatingListItem />}
          />
          <Route
            path="/admin/leagues/nhl"
            element={<h1>League details</h1>}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.tab();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('heading', { name: 'League details' })).toBeInTheDocument();
  });
});
