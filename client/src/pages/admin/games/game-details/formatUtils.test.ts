import {
  DATE_FMT_SHORT,
  etAbbrForDate,
  etHHMMtoISO,
  formatScheduledDate,
  formatScheduledTime,
} from './formatUtils';

describe('game detail time utilities', () => {
  it('uses EDT for dates during daylight saving time', () => {
    expect(etAbbrForDate('2026-06-01')).toBe('EDT');
    expect(etHHMMtoISO('19:30', '2026-06-01')).toBe('2026-06-01T23:30:00.000Z');
    expect(formatScheduledTime('19:30', '2026-06-01')).toBe('7:30 PM EDT');
  });

  it('uses EST for dates outside daylight saving time', () => {
    expect(etAbbrForDate('2026-01-15')).toBe('EST');
    expect(etHHMMtoISO('19:30', '2026-01-15')).toBe('2026-01-16T00:30:00.000Z');
    expect(formatScheduledTime('19:30', '2026-01-15')).toBe('7:30 PM EST');
  });

  it('uses the ET calendar day when an ISO timestamp is provided', () => {
    expect(formatScheduledTime('19:30', '2026-06-01T00:00:00.000Z')).toBe('7:30 PM EDT');
  });

  it('keeps date-only scheduled dates on their stored ET calendar day', () => {
    expect(formatScheduledDate('2025-12-01', DATE_FMT_SHORT)).toBe('Dec 1, 2025');
  });

  it('keeps midnight placeholder scheduled dates on their stored ET calendar day', () => {
    expect(formatScheduledDate('2025-12-01T00:00:00.000Z', DATE_FMT_SHORT)).toBe('Dec 1, 2025');
  });

  it('formats real instants by their ET calendar day', () => {
    expect(formatScheduledDate('2025-12-01T02:30:00.000Z', DATE_FMT_SHORT)).toBe('Nov 30, 2025');
  });
});
