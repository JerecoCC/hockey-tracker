import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import MultiSelect from './MultiSelect';

const OPTIONS = [
  { value: 'team-1', label: 'Toronto Maple Leafs', code: 'TOR' },
  { value: 'team-2', label: 'Montreal Canadiens', code: 'MTL' },
];

const MultiSelectHarness = ({
  onChange,
  onExit,
}: {
  onChange: (values: string[]) => void;
  onExit?: () => void;
}) => {
  const [value, setValue] = useState<string[]>([]);

  return (
    <MultiSelect
      value={value}
      options={OPTIONS}
      placeholder="All Teams"
      onChange={(nextValue) => {
        setValue(nextValue);
        onChange(nextValue);
      }}
      onExit={onExit}
      searchable
    />
  );
};

describe('MultiSelect', () => {
  it('selects options from its portaled menu without closing before click', async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();

    render(<MultiSelectHarness onChange={handleChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('button', { name: /Toronto Maple Leafs/ }));
    await user.click(screen.getByRole('button', { name: /Montreal Canadiens/ }));

    expect(handleChange).toHaveBeenLastCalledWith(['team-1', 'team-2']);
  });

  it('reports when the control is closed', async () => {
    const user = userEvent.setup();
    const handleExit = jest.fn();

    render(
      <MultiSelectHarness
        onChange={jest.fn()}
        onExit={handleExit}
      />,
    );

    await user.click(screen.getByRole('combobox'));
    await user.keyboard('{Escape}');

    expect(handleExit).toHaveBeenCalledTimes(1);
  });
});
