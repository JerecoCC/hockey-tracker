import {
  getEasternDateKey,
  getOriginalGameDateKey,
  getScheduledInstant,
  getScheduledWatchDateKey,
  isInvalidWatchScheduleDate,
  toDateKeyInZone,
} from './gameSchedule';

describe('game schedule time utilities', () => {
  it('preserves date-only values and midnight placeholders', () => {
    expect(getEasternDateKey('2026-11-15', null)).toBe('2026-11-15');
    expect(getEasternDateKey('2026-11-15T00:00:00Z', '19:30')).toBe('2026-11-15');
    expect(getScheduledWatchDateKey('2026-11-18T00:00:00Z')).toBe('2026-11-18');
  });

  it('converts true instants to the requested calendar date', () => {
    const instant = new Date('2026-07-18T02:30:00Z');

    expect(toDateKeyInZone(instant, 'America/New_York')).toBe('2026-07-17');
    expect(toDateKeyInZone(instant, 'Asia/Manila')).toBe('2026-07-18');
  });

  it('combines a league date and scheduled time using the correct Eastern DST offset', () => {
    expect(getScheduledInstant('2026-07-18T00:00:00Z', '19:30')?.toISOString()).toBe(
      '2026-07-18T23:30:00.000Z',
    );
    expect(getScheduledInstant('2026-12-18T00:00:00Z', '19:30')?.toISOString()).toBe(
      '2026-12-19T00:30:00.000Z',
    );
  });

  it('derives original game dates in Eastern or an explicit local timezone', () => {
    const game = {
      scheduled_at: '2026-07-18T02:30:00Z',
      scheduled_time: null,
    };

    expect(getOriginalGameDateKey(game, 'ET')).toBe('2026-07-17');
    expect(toDateKeyInZone(getScheduledInstant(game.scheduled_at, null)!, 'Asia/Manila')).toBe(
      '2026-07-18',
    );
  });

  it('only permits watch dates after the original game date', () => {
    const game = { scheduled_at: '2026-07-18', scheduled_time: null };

    expect(isInvalidWatchScheduleDate(game, '2026-07-18', 'ET')).toBe(true);
    expect(isInvalidWatchScheduleDate(game, '2026-07-19', 'ET')).toBe(false);
    expect(isInvalidWatchScheduleDate(game, null, 'ET')).toBe(false);
  });
});
