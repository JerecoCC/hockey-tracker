import { render, screen } from '@testing-library/react';
import { ScheduleCalendarDayCount } from './ScheduleGamesLayout';

describe('ScheduleCalendarDayCount', () => {
  it('renders positive game counts with the shared badge component', () => {
    render(<ScheduleCalendarDayCount count={2} />);

    const badge = screen.getByLabelText('2 games');
    expect(badge).toHaveClass('badge');
    expect(badge).not.toHaveClass('calendarDayCount');
    expect(badge).toHaveTextContent('2');
  });

  it('can render a count label after the value', () => {
    render(
      <ScheduleCalendarDayCount
        count={2}
        label="games"
      />,
    );

    const badge = screen.getByLabelText('2 games');
    expect(Array.from(badge.children).map((child) => child.textContent)).toEqual(['2', 'games']);
  });

  it('does not render when the count is zero', () => {
    render(<ScheduleCalendarDayCount count={0} />);

    expect(screen.queryByLabelText('0 games')).not.toBeInTheDocument();
  });
});
