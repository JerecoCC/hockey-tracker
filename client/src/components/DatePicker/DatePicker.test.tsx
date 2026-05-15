import { render, screen } from '@testing-library/react';
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
});
