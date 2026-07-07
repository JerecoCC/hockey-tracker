import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MonthCalendar from './MonthCalendar';

describe('MonthCalendar', () => {
  it('renders day numbers as two-digit chips', () => {
    render(
      <MonthCalendar
        month={new Date(2026, 0, 1)}
        renderDayContent={() => null}
      />,
    );

    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('09')).toBeInTheDocument();
    expect(screen.getByText('31')).toBeInTheDocument();
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('renders full mobile day labels for responsive agenda layouts', () => {
    render(
      <MonthCalendar
        month={new Date(2026, 0, 1)}
        renderDayContent={() => null}
      />,
    );

    expect(screen.getByText('Thu, Jan 1')).toBeInTheDocument();
    expect(screen.getByText('Fri, Jan 9')).toBeInTheDocument();
  });

  it('renders its built-in skeleton grid while loading', () => {
    const renderDayContent = jest.fn(() => <span>Loaded day</span>);

    render(
      <MonthCalendar
        month={new Date(2026, 0, 1)}
        loading
        renderDayContent={renderDayContent}
      />,
    );

    expect(screen.getAllByLabelText(/^Loading (calendar slot|games for)/)).toHaveLength(35);
    expect(screen.queryByText('Loaded day')).not.toBeInTheDocument();
    expect(renderDayContent).not.toHaveBeenCalled();
  });

  it('can render a day number as a link', () => {
    render(
      <MemoryRouter>
        <MonthCalendar
          month={new Date(2026, 0, 1)}
          getDayNumberLink={({ dateKey }) =>
            dateKey === '2026-01-09'
              ? {
                  href: '/admin/leagues/nhl/seasons/2025-26/days/01-09-2026',
                  ariaLabel: 'View games on January 9',
                }
              : undefined
          }
          renderDayContent={() => null}
        />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: 'View games on January 9' });
    expect(link).toHaveAttribute(
      'href',
      '/admin/leagues/nhl/seasons/2025-26/days/01-09-2026',
    );
    expect(link).toHaveTextContent('09');
  });
});
