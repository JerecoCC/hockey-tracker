import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DatePicker from './DatePicker';

const currentEtMonth = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;

  return `${year}-${month}`;
};

const ControlledDatePicker = ({ initialValue = '2026-05-15' }: { initialValue?: string }) => {
  const [value, setValue] = useState(initialValue);

  return (
    <DatePicker
      value={value}
      onChange={setValue}
    />
  );
};

describe('DatePicker', () => {
  it('supports month granularity with a combined month/year field', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <DatePicker
        value="2026-05"
        onChange={onChange}
        granularity="month"
      />,
    );

    expect(screen.getByDisplayValue('05/2026')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Open calendar'));

    expect(screen.queryByText('Su')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Jun' }));

    expect(onChange).toHaveBeenCalledWith('2026-06');
  });

  it('lets month granularity jump to the current month with Today', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <DatePicker
        value="2024-01"
        onChange={onChange}
        granularity="month"
      />,
    );

    await user.click(screen.getByLabelText('Open calendar'));
    await user.click(screen.getByRole('button', { name: 'Today' }));

    expect(onChange).toHaveBeenCalledWith(currentEtMonth());
  });

  it('supports a button-style trigger label while still opening the calendar', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <DatePicker
        value="2026-05-05"
        onChange={onChange}
        triggerLabel="May 5 – May 11, 2026"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'May 5 – May 11, 2026' }));

    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '10' }));

    expect(onChange).toHaveBeenCalledWith('2026-05-10');
  });

  it('keeps segment editing active after a controlled value update', () => {
    render(<ControlledDatePicker />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.focus();
    input.setSelectionRange(0, 2);
    fireEvent.click(input);

    fireEvent.keyDown(input, { key: '1' });
    fireEvent.keyDown(input, { key: '2' });

    expect(input).toHaveValue('12/15/2026');

    fireEvent.keyDown(input, { key: '2' });
    fireEvent.keyDown(input, { key: '5' });

    expect(input).toHaveValue('12/25/2026');
  });
});
