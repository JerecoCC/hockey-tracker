import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Select from './Select';

describe('Select', () => {
  it('does not auto-open a searchable menu when autofocus focuses the input', async () => {
    render(
      <Select
        value={null}
        options={[
          { value: '1', label: 'Player One' },
          { value: '2', label: 'Player Two' },
        ]}
        onChange={() => {}}
        placeholder="Select shooter…"
        searchable
        autoFocus
      />,
    );

    const input = screen.getByPlaceholderText('Select shooter…');

    await waitFor(() => expect(input).toHaveFocus());
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('opens a searchable menu when the user starts typing after autofocus', async () => {
    const user = userEvent.setup();

    render(
      <Select
        value={null}
        options={[
          { value: '1', label: 'Player One' },
          { value: '2', label: 'Player Two' },
        ]}
        onChange={() => {}}
        placeholder="Select shooter…"
        searchable
        autoFocus
      />,
    );

    const input = screen.getByPlaceholderText('Select shooter…');
    await waitFor(() => expect(input).toHaveFocus());

    await user.type(input, 'Pla');

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Player One' })).toBeInTheDocument();
  });

  it('focuses the input when clicking the searchable trigger outside the input', async () => {
    const user = userEvent.setup();

    render(
      <Select
        value={null}
        options={[
          { value: '1', label: 'Player One' },
          { value: '2', label: 'Player Two' },
        ]}
        onChange={() => {}}
        placeholder="Select shooterâ€¦"
        searchable
      />,
    );

    const input = screen.getByPlaceholderText('Select shooterâ€¦');
    const trigger = input.parentElement;

    expect(trigger).not.toBeNull();

    await user.click(trigger!);

    expect(input).toHaveFocus();
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.keyboard('Two');

    expect(screen.queryByRole('button', { name: 'Player One' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Player Two' })).toBeInTheDocument();
  });
});
