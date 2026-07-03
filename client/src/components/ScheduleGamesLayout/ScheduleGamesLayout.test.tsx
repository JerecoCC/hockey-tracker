import { render, screen } from '@testing-library/react';
import { ScheduleCalendarDayCount } from './ScheduleGamesLayout';

describe('ScheduleCalendarDayCount', () => {
  it('renders positive game counts with the shared badge component', () => {
    render(<ScheduleCalendarDayCount count={2} />);

    const badge = screen.getByLabelText('2 games');
    expect(badge).toHaveClass('badge', 'calendarDayCount');
    expect(badge).toHaveTextContent('2');
  });

  it('does not render when the count is zero', () => {
    render(<ScheduleCalendarDayCount count={0} />);

    expect(screen.queryByLabelText('0 games')).not.toBeInTheDocument();
  });
});
