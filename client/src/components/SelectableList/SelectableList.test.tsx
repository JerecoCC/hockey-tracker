import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SelectableList from './SelectableList';

const items = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Beta' },
  { id: 'c', name: 'Gamma' },
];

const Harness = () => {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  return (
    <SelectableList
      items={items}
      getItemKey={(item) => item.id}
      isSelected={(item) => selected.has(item.id)}
      onToggle={(item) =>
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(item.id)) next.delete(item.id);
          else next.add(item.id);
          return next;
        })
      }
      filterItem={(item, query) => item.name.toLowerCase().includes(query.toLowerCase())}
      searchPlaceholder="Find players"
      searchRightContent={<button type="button">Search slot</button>}
      emptyMessage="No players"
      getItemProps={(item) => ({
        hideImage: true,
        name: item.name,
      })}
      getItemRightContent={(item) => (selected.has(item.id) ? <span>Picked</span> : undefined)}
    />
  );
};

describe('SelectableList', () => {
  it('searches, renders slots, and moves selected items first', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByPlaceholderText('Find players')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search slot' })).toBeInTheDocument();

    const list = screen.getByRole('list');
    const names = () =>
      within(list)
        .getAllByRole('listitem')
        .map((item) => {
          if (item.textContent?.includes('Alpha')) return 'Alpha';
          if (item.textContent?.includes('Beta')) return 'Beta';
          if (item.textContent?.includes('Gamma')) return 'Gamma';
          return '';
        });

    expect(names()).toEqual(['Alpha', 'Beta', 'Gamma']);

    await user.click(screen.getByText('Gamma'));

    expect(names()).toEqual(['Gamma', 'Alpha', 'Beta']);
    expect(within(within(list).getAllByRole('listitem')[0]).getByText('Picked')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Find players'), 'bet');

    expect(names()).toEqual(['Beta']);
  });
});
