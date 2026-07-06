import { render, screen } from '@testing-library/react';
import { ScheduleCalendarDayCount } from './ScheduleGamesLayout';

describe('ScheduleCalendarDayCount', () => {
  it('renders positive game counts with the shared badge component', () => {
    render(<ScheduleCalendarDayCount count={2} />);

    const badge = screen.getByLabelText('2 games');
    expect(badge).toHaveClass('badge');
    expect(badge).toHaveClass('calendarDayCount');
    expect(badge).toHaveTextContent('2');
  });

  it('can render a count label after the value', () => {
    render(
      <ScheduleCalendarDayCount
        count={2}
        showLabel
      />,
    );

    const badge = screen.getByLabelText('2 games');
    expect(Array.from(badge.children).map((child) => child.textContent)).toEqual(['2', 'games']);
  });

  it('uses the singular label for a single game', () => {
    render(
      <ScheduleCalendarDayCount
        count={1}
        showLabel
      />,
    );

    const badge = screen.getByLabelText('1 game');
    expect(Array.from(badge.children).map((child) => child.textContent)).toEqual(['1', 'game']);
  });

  it('does not render when the count is zero', () => {
    render(<ScheduleCalendarDayCount count={0} />);

    expect(screen.queryByLabelText('0 games')).not.toBeInTheDocument();
  });

});
