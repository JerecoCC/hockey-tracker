import {
  firstWeekStartForMonth,
  majorityMonthForWeek,
  toEasternDateKey,
  weekBelongsToCalendarMonth,
} from './seasonDateUtils';

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

describe('season games date keys', () => {
  it('keeps date-only scheduled dates on their stored ET calendar day', () => {
    expect(toEasternDateKey('2025-12-01')).toBe('2025-12-01');
  });

  it('keeps midnight placeholder scheduled dates on their stored ET calendar day', () => {
    expect(toEasternDateKey('2025-12-01T00:00:00.000Z')).toBe('2025-12-01');
  });

  it('uses the ET day for real scheduled instants', () => {
    expect(toEasternDateKey('2025-12-01T02:30:00.000Z')).toBe('2025-11-30');
  });
});

describe('season games view date sync', () => {
  it('uses the first week of the selected calendar month when switching to week view', () => {
    expect(dateKey(firstWeekStartForMonth(new Date(2025, 11, 15)))).toBe('2025-12-01');
  });

  it('keeps the majority month when a selected week spans two months', () => {
    expect(monthKey(majorityMonthForWeek(new Date(2026, 0, 28)))).toBe('2026-01');
  });

  it('uses the next month when it has most days in the selected week', () => {
    expect(monthKey(majorityMonthForWeek(new Date(2026, 0, 30)))).toBe('2026-02');
  });

  it('keeps the selected week when it already belongs to the calendar month', () => {
    expect(weekBelongsToCalendarMonth(new Date(2026, 0, 28), new Date(2026, 0, 1))).toBe(true);
  });

  it('detects when the calendar month moved away from the selected week', () => {
    expect(weekBelongsToCalendarMonth(new Date(2026, 0, 28), new Date(2026, 1, 1))).toBe(false);
  });
});
