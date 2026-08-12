import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MonthCalendar from '@jerecocc/tracker-ui/components/MonthCalendar/MonthCalendar';
import {
  ScheduleCalendarDayCount,
  ScheduleWeekList,
  ScheduleWeekSummary,
} from './ScheduleGamesLayout';

afterEach(() => {
  jest.useRealTimers();
});

const renderWeekList = () =>
  render(
    <MemoryRouter>
      <ScheduleWeekList
        days={[
          [
            '2026-03-28',
            [
              { id: 'game-1' },
              { id: 'game-2' },
            ],
          ],
        ]}
        formatHeading={() => 'Saturday, March 28'}
        getDayTitleLink={(_, dayGames) => ({
          href: '/admin/leagues/nhl/seasons/2025-26/games/03-28-2026',
          ariaLabel: `View ${dayGames.length} games on Saturday, March 28`,
        })}
        renderDayContent={() => <div>Day games</div>}
      />
    </MemoryRouter>,
  );

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

describe('MonthCalendar', () => {
  it('marks the current day with an accessible default indicator', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 2, 28, 12));

    render(
      <MonthCalendar
        month={new Date(2026, 2, 1)}
        renderDayContent={() => null}
      />,
    );

    const currentDay = screen.getByText('28').closest('[aria-current="date"]');
    expect(currentDay).toHaveClass('today');
    expect(currentDay).not.toHaveTextContent('Today');
  });
});

describe('ScheduleWeekList', () => {
  it('renders day titles as real links when a day title link is provided', () => {
    renderWeekList();

    expect(
      screen.getByRole('link', { name: 'View 2 games on Saturday, March 28' }),
    ).toHaveAttribute('href', '/admin/leagues/nhl/seasons/2025-26/games/03-28-2026');
  });

  it('renders an external-link indicator inside linked day titles', () => {
    const { container } = renderWeekList();

    expect(container.querySelector('.dayTitleLinkIndicator svg')).toBeInTheDocument();
  });

  it('marks the current day card with the shared indicator', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 2, 28, 12));

    renderWeekList();

    expect(screen.getByText('Today').closest('[aria-current="date"]')).toBeInTheDocument();
  });

  it('marks the current day in the compact week summary', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 2, 28, 12));

    render(
      <ScheduleWeekSummary
        days={[['2026-03-28', [{ id: 'game-1' }]]]}
        loading={false}
        onSelectDate={jest.fn()}
        formatDate={() => 'Mar 28'}
        formatWeekday={() => 'Saturday'}
        formatHeading={() => 'Saturday, March 28'}
      />,
    );

    expect(screen.getByRole('button', { name: /Jump to Saturday, March 28/i })).toHaveAttribute(
      'aria-current',
      'date',
    );
    expect(screen.getByText('Today')).toHaveClass('tag', 'outlined', 'accent');
  });

  it('adds the mobile sticky modifier when requested', () => {
    const { container } = render(
      <ScheduleWeekSummary
        days={[['2026-03-28', [{ id: 'game-1' }]]]}
        loading={false}
        stickyOnMobile
        onSelectDate={jest.fn()}
        formatDate={() => 'Mar 28'}
        formatWeekday={() => 'Saturday'}
        formatHeading={() => 'Saturday, March 28'}
      />,
    );

    expect(container.querySelector('.weekSummaryCard')).toHaveClass(
      'weekSummaryCardMobileSticky',
    );
  });

  it('opts into fitting all week summary days within the mobile viewport', () => {
    const { container } = render(
      <ScheduleWeekSummary
        days={[['2026-03-28', [{ id: 'game-1' }]]]}
        loading={false}
        fitMobileViewport
        onSelectDate={jest.fn()}
        formatDate={() => 'Mar 28'}
        formatWeekday={() => 'Saturday'}
        formatHeading={() => 'Saturday, March 28'}
      />,
    );

    expect(container.querySelector('.weekSummaryCard')).toHaveAttribute(
      'data-mobile-layout',
      'fit',
    );
    expect(container.querySelector('.weekSummaryCountMetric')).toHaveClass('metricTag');
    expect(container.querySelector('.weekSummaryCountMetric')).toHaveTextContent(/1\s*Game/);
    expect(container.querySelector('.weekSummaryCountBadge')).toHaveTextContent('1');
  });
});
