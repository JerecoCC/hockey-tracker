import { render, screen, fireEvent } from '@testing-library/react';
import TimePicker from '@/components/TimePicker/TimePicker';

// ── Test helpers ──────────────────────────────────────────────────────────────

beforeEach(() => {
  // jsdom does not implement these DOM methods
  Element.prototype.scrollIntoView = jest.fn();
  (Element.prototype.getBoundingClientRect as jest.Mock) = jest.fn().mockReturnValue({
    bottom: 100,
    left: 0,
    top: 80,
    right: 200,
    width: 200,
    height: 20,
  });
});

const renderPicker = (value: string, onChange = jest.fn()) => {
  render(
    <TimePicker
      value={value}
      onChange={onChange}
    />,
  );
  return { onChange };
};

const getInput = () => screen.getByRole('textbox');
const openDropdown = () =>
  fireEvent.click(screen.getByRole('button', { name: /open time picker/i }));

/** Navigates from the initial hour segment to the ampm segment via Tab. */
const focusAmPm = (input: HTMLElement) => {
  fireEvent.focus(input); // activates 'hour'
  fireEvent.keyDown(input, { key: 'Tab' }); // hour → minute
  fireEvent.keyDown(input, { key: 'Tab' }); // minute → ampm
};

// ── Display ───────────────────────────────────────────────────────────────────

describe('TimePicker – display', () => {
  it('shows placeholder "--:-- --" when value is empty', () => {
    renderPicker('');
    expect(getInput()).toHaveValue('--:-- --');
  });

  it('converts 24h "19:30" to "07:30 PM"', () => {
    renderPicker('19:30');
    expect(getInput()).toHaveValue('07:30 PM');
  });

  it('converts "00:00" (midnight) to "12:00 AM"', () => {
    renderPicker('00:00');
    expect(getInput()).toHaveValue('12:00 AM');
  });

  it('converts "12:00" (noon) to "12:00 PM"', () => {
    renderPicker('12:00');
    expect(getInput()).toHaveValue('12:00 PM');
  });

  it('converts "01:05" to "01:05 AM"', () => {
    renderPicker('01:05');
    expect(getInput()).toHaveValue('01:05 AM');
  });

  it('updates display when value prop changes', () => {
    const { rerender } = render(
      <TimePicker
        value="07:00"
        onChange={jest.fn()}
      />,
    );
    expect(getInput()).toHaveValue('07:00 AM');
    rerender(
      <TimePicker
        value="20:45"
        onChange={jest.fn()}
      />,
    );
    expect(getInput()).toHaveValue('08:45 PM');
  });
});

// ── Keyboard – hour segment ───────────────────────────────────────────────────

describe('TimePicker – keyboard: hour segment', () => {
  it('types a single digit > 1 and commits it immediately as the hour', () => {
    renderPicker('');
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: '7' }); // 7 > 1 → early commit
    expect(input).toHaveValue('07:-- --');
  });

  it('waits for a second digit when first digit is 1 (could be 10–12)', () => {
    renderPicker('');
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: '1' }); // partial – could be 10, 11, 12
    expect(input).toHaveValue('1-:-- --');
    fireEvent.keyDown(input, { key: '2' }); // → 12
    expect(input).toHaveValue('12:-- --');
  });

  it('rejects an out-of-range hour (13) and clears the buffer', () => {
    renderPicker('');
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: '1' });
    fireEvent.keyDown(input, { key: '3' }); // 13 > 12 → invalid
    expect(input).toHaveValue('--:-- --');
  });

  it('ArrowUp increments hour (1 → 2)', () => {
    renderPicker('01:00');
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveValue('02:00 AM');
  });

  it('ArrowUp wraps hour from 12 back to 1', () => {
    renderPicker('12:00');
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveValue('01:00 PM');
  });

  it('ArrowDown wraps hour from 1 back to 12', () => {
    renderPicker('01:00');
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveValue('12:00 AM');
  });

  it('Tab moves focus to minute segment', () => {
    renderPicker('01:30');
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'Tab' });
    // Next ArrowUp should affect minute, not hour
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveValue('01:31 AM');
  });
});

// ── Keyboard – ampm segment ───────────────────────────────────────────────────

describe('TimePicker – keyboard: ampm segment', () => {
  it('"p" key sets AM → PM', () => {
    renderPicker('07:00'); // 07:00 AM
    const input = getInput();
    focusAmPm(input);
    fireEvent.keyDown(input, { key: 'p' });
    expect(input).toHaveValue('07:00 PM');
  });

  it('"a" key sets PM → AM', () => {
    renderPicker('19:00'); // 07:00 PM
    const input = getInput();
    focusAmPm(input);
    fireEvent.keyDown(input, { key: 'a' });
    expect(input).toHaveValue('07:00 AM');
  });

  it('ArrowUp toggles AM → PM', () => {
    renderPicker('07:00');
    const input = getInput();
    focusAmPm(input);
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveValue('07:00 PM');
  });

  it('ArrowDown toggles PM → AM', () => {
    renderPicker('19:00');
    const input = getInput();
    focusAmPm(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveValue('07:00 AM');
  });

  it('ArrowLeft moves back to minute segment', () => {
    renderPicker('07:30');
    const input = getInput();
    focusAmPm(input);
    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    // now in minute segment — ArrowUp should affect minute
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveValue('07:31 AM');
  });
});

// ── onChange emits 24-hour HH:MM ─────────────────────────────────────────────

describe('TimePicker – onChange', () => {
  it('emits "19:30" when user enters 7 → 30 → PM', () => {
    const onChange = jest.fn();
    render(
      <TimePicker
        value=""
        onChange={onChange}
      />,
    );
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: '7' }); // hour=7 (>1, commits) → moves to minute
    fireEvent.keyDown(input, { key: '3' }); // partial minute buf
    fireEvent.keyDown(input, { key: '0' }); // minute=30 → moves to ampm
    fireEvent.keyDown(input, { key: 'p' }); // PM → emits "19:30"
    expect(onChange).toHaveBeenCalledWith('19:30');
  });

  it('emits "00:00" when user enters 12 → 00 → AM', () => {
    const onChange = jest.fn();
    render(
      <TimePicker
        value=""
        onChange={onChange}
      />,
    );
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: '1' });
    fireEvent.keyDown(input, { key: '2' }); // hour=12 → moves to minute
    fireEvent.keyDown(input, { key: '0' });
    fireEvent.keyDown(input, { key: '0' }); // minute=00 → moves to ampm
    fireEvent.keyDown(input, { key: 'a' }); // AM → emits "00:00"
    expect(onChange).toHaveBeenCalledWith('00:00');
  });

  it('emits "12:00" when user enters 12 → 00 → PM', () => {
    const onChange = jest.fn();
    render(
      <TimePicker
        value=""
        onChange={onChange}
      />,
    );
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: '1' });
    fireEvent.keyDown(input, { key: '2' }); // hour=12 → moves to minute
    fireEvent.keyDown(input, { key: '0' });
    fireEvent.keyDown(input, { key: '0' }); // minute=00 → moves to ampm
    fireEvent.keyDown(input, { key: 'p' }); // PM → emits "12:00"
    expect(onChange).toHaveBeenCalledWith('12:00');
  });
});

// ── Dropdown ─────────────────────────────────────────────────────────────────

describe('TimePicker – dropdown', () => {
  it('opens when the clock button is clicked', () => {
    renderPicker('');
    openDropdown();
    expect(screen.getByRole('button', { name: 'Now' })).toBeInTheDocument();
  });

  it('shows hour buttons 1–12 but not 0 or 13+', () => {
    renderPicker('');
    openDropdown();
    // 01, 07, 12 are unique to the hour column (not multiples of 5)
    expect(screen.getByRole('button', { name: '01' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '07' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '12' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '13' })).toBeNull();
  });

  it('shows AM and PM buttons', () => {
    renderPicker('');
    openDropdown();
    expect(screen.getByRole('button', { name: 'AM' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PM' })).toBeInTheDocument();
  });

  it('clicking a minute button emits the updated time and closes dropdown', () => {
    const onChange = jest.fn();
    render(
      <TimePicker
        value="07:00"
        onChange={onChange}
      />,
    );
    openDropdown();
    fireEvent.mouseDown(screen.getByRole('button', { name: '30' }));
    expect(onChange).toHaveBeenCalledWith('07:30');
    expect(screen.queryByRole('button', { name: 'Now' })).toBeNull();
  });

  it('clicking PM emits the 24h equivalent and closes dropdown', () => {
    const onChange = jest.fn();
    render(
      <TimePicker
        value="07:00"
        onChange={onChange}
      />,
    );
    openDropdown();
    fireEvent.mouseDown(screen.getByRole('button', { name: 'PM' }));
    expect(onChange).toHaveBeenCalledWith('19:00');
    expect(screen.queryByRole('button', { name: 'Now' })).toBeNull();
  });

  it('clicking AM emits the 24h equivalent and closes dropdown', () => {
    const onChange = jest.fn();
    render(
      <TimePicker
        value="19:00"
        onChange={onChange}
      />,
    );
    openDropdown();
    fireEvent.mouseDown(screen.getByRole('button', { name: 'AM' }));
    expect(onChange).toHaveBeenCalledWith('07:00');
    expect(screen.queryByRole('button', { name: 'Now' })).toBeNull();
  });
});

// ── Clear button ──────────────────────────────────────────────────────────────

describe('TimePicker – clear button', () => {
  it('is not shown when value is empty', () => {
    renderPicker('');
    expect(screen.queryByRole('button', { name: /clear/i })).toBeNull();
  });

  it('is shown when a value is set', () => {
    renderPicker('07:30');
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
  });

  it('calls onChange("") when clicked', () => {
    const onChange = jest.fn();
    render(
      <TimePicker
        value="07:30"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(onChange).toHaveBeenCalledWith('');
  });
});

// ── Disabled state ────────────────────────────────────────────────────────────

describe('TimePicker – disabled', () => {
  it('renders the input as readOnly', () => {
    render(
      <TimePicker
        value="07:30"
        onChange={jest.fn()}
        disabled
      />,
    );
    expect(getInput()).toHaveAttribute('readOnly');
  });

  it('disables the clock icon button', () => {
    render(
      <TimePicker
        value=""
        onChange={jest.fn()}
        disabled
      />,
    );
    expect(screen.getByRole('button', { name: /open time picker/i })).toBeDisabled();
  });

  it('does not render the clear button', () => {
    render(
      <TimePicker
        value="07:30"
        onChange={jest.fn()}
        disabled
      />,
    );
    expect(screen.queryByRole('button', { name: /clear/i })).toBeNull();
  });
});
