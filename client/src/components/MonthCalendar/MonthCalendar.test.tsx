import { render, screen } from '@testing-library/react';
import MonthCalendar from './MonthCalendar';

describe('MonthCalendar', () => {
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
});
