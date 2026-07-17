import {
  clampDateKeyToRange,
  clampMonthKeyToRange,
  clampWeekStartDateKey,
  firstWeekStartForMonth,
  isDateKeyWithinRange,
  majorityMonthForWeek,
  toEasternDateKey,
  weekBelongsToCalendarMonth,
} from './seasonDateUtils';
import { partitionAutofillingGames } from './seasonGamesAutofillUtils';

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

  it('keeps Postgres midnight placeholder scheduled dates on their stored ET calendar day', () => {
    expect(toEasternDateKey('2026-04-18 00:00:00+00')).toBe('2026-04-18');
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

describe('season games date limits', () => {
  const startDate = '2025-10-07';
  const endDate = '2026-06-21';

  it('includes both season boundaries and excludes dates outside them', () => {
    expect(isDateKeyWithinRange(startDate, startDate, endDate)).toBe(true);
    expect(isDateKeyWithinRange(endDate, startDate, endDate)).toBe(true);
    expect(isDateKeyWithinRange('2025-10-06', startDate, endDate)).toBe(false);
    expect(isDateKeyWithinRange('2026-06-22', startDate, endDate)).toBe(false);
  });

  it('clamps selected dates to the season boundaries', () => {
    expect(clampDateKeyToRange('2025-09-01', startDate, endDate)).toBe(startDate);
    expect(clampDateKeyToRange('2026-07-01', startDate, endDate)).toBe(endDate);
    expect(clampDateKeyToRange('2026-01-15', startDate, endDate)).toBe('2026-01-15');
  });

  it('keeps the final week inside the season while still including the end date', () => {
    expect(clampWeekStartDateKey('2026-06-21', startDate, endDate)).toBe('2026-06-15');
    expect(clampWeekStartDateKey('2025-09-01', startDate, endDate)).toBe(startDate);
  });

  it('clamps calendar navigation to months that intersect the season', () => {
    expect(clampMonthKeyToRange('2025-09', startDate, endDate)).toBe('2025-10');
    expect(clampMonthKeyToRange('2026-07', startDate, endDate)).toBe('2026-06');
    expect(clampMonthKeyToRange('2026-01', startDate, endDate)).toBe('2026-01');
  });
});

describe('season games auto-fill placeholders', () => {
  it('keeps revealed games first and returns one loading game per auto-filling id', () => {
    const games = [
      { id: 'already-visible' },
      { id: 'loading-1' },
      { id: 'also-visible' },
      { id: 'loading-2' },
    ];

    const { revealedGames, loadingGames } = partitionAutofillingGames(
      games,
      new Set(['loading-1', 'loading-2']),
    );

    expect(revealedGames.map((game) => game.id)).toEqual(['already-visible', 'also-visible']);
    expect(loadingGames.map((game) => game.id)).toEqual(['loading-1', 'loading-2']);
  });
});
