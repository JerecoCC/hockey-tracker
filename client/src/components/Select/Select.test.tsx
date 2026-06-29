import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Select from './Select';

describe('Select', () => {
  it('applies content-width styling when requested', () => {
    render(
      <Select
        value="2025-26"
        options={[{ value: '2025-26', label: '2025-26' }]}
        onChange={() => {}}
        width="content"
      />,
    );

    const trigger = screen.getByRole('combobox');

    expect(trigger.parentElement).toHaveClass('wrapperContent');
    expect(trigger).toHaveClass('triggerContentWidth');
  });

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

  it('portals and flips the menu above the trigger near the viewport bottom', async () => {
    const user = userEvent.setup();
    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      writable: true,
      value: 500,
    });

    render(
      <Select
        value={null}
        options={[
          { value: '1', label: 'First' },
          { value: '2', label: 'Second' },
        ]}
        onChange={() => {}}
      />,
    );

    const trigger = screen.getByRole('combobox');
    jest.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      x: 12,
      y: 450,
      top: 450,
      bottom: 492,
      left: 12,
      right: 212,
      width: 200,
      height: 42,
      toJSON: () => ({}),
    });

    await user.click(trigger);

    const listbox = screen.getByRole('listbox');
    expect(listbox.parentElement).toBe(document.body);
    expect(listbox).toHaveStyle({ bottom: '54px', width: '200px' });
    expect(listbox.style.top).toBe('');

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      writable: true,
      value: originalInnerHeight,
    });
  });
});
