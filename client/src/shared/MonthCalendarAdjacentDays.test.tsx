import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MonthCalendar, {
  type MonthCalendarDayArgs,
} from '@jerecocc/tracker-ui/components/MonthCalendar/MonthCalendar';

// September 2026 starts on a Tuesday and ends on a Wednesday.
const SEPTEMBER_2026 = new Date(2026, 8, 1);

const renderCalendar = (showAdjacentMonthDays: boolean) => {
  const renderedDays: MonthCalendarDayArgs[] = [];
  const { container } = render(
    <MemoryRouter>
      <MonthCalendar
        month={SEPTEMBER_2026}
        showAdjacentMonthDays={showAdjacentMonthDays}
        getDayProps={({ dateKey }) => ({ 'data-date-key': dateKey } as never)}
        renderDayContent={(args) => {
          renderedDays.push(args);
          return null;
        }}
      />
    </MemoryRouter>,
  );
  return { container, renderedDays };
};

describe('MonthCalendar adjacent month days', () => {
  it('fills the first and last weeks with the neighbouring months’ days', () => {
    const { container, renderedDays } = renderCalendar(true);

    const outside = renderedDays.filter((day) => day.outsideMonth).map((day) => day.dateKey);
    expect(outside).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ]);
    expect(renderedDays.filter((day) => !day.outsideMonth)).toHaveLength(30);
    expect(container.querySelectorAll('[data-outside-month="true"]')).toHaveLength(5);
    expect(container.querySelector('[data-date-key="2026-08-30"]')).toHaveAttribute(
      'data-outside-month',
      'true',
    );
    expect(container.querySelector('[data-date-key="2026-09-01"]')).not.toHaveAttribute(
      'data-outside-month',
    );
  });

  it('keeps empty cells by default', () => {
    const { container, renderedDays } = renderCalendar(false);

    expect(renderedDays.every((day) => !day.outsideMonth)).toBe(true);
    expect(renderedDays).toHaveLength(30);
    expect(container.querySelectorAll('[data-outside-month="true"]')).toHaveLength(0);
  });
});
