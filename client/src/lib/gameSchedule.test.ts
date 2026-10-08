import {
  getEasternDateKey,
  getOriginalGameDateKey,
  getScheduledInstant,
  getScheduledWatchDateKey,
  isInvalidWatchScheduleDate,
  toDateKeyInZone,
  isGameOverdueForFinal,
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

describe('isGameOverdueForFinal', () => {
  // 7:00 PM ET on Oct 10, 2026 is 23:00 UTC.
  const game = {
    status: 'scheduled',
    scheduled_at: '2026-10-10T00:00:00.000Z',
    scheduled_time: '19:00',
  };

  it('flags a game still not final more than 3 hours after its start', () => {
    expect(isGameOverdueForFinal(game, new Date('2026-10-11T02:01:00Z'))).toBe(true);
    expect(isGameOverdueForFinal({ ...game, status: 'in_progress' }, new Date('2026-10-11T02:01:00Z'))).toBe(true);
  });

  it('waits until 3 hours have passed', () => {
    expect(isGameOverdueForFinal(game, new Date('2026-10-11T01:59:00Z'))).toBe(false);
  });

  it('never flags final or postponed games, or games without a start time', () => {
    const late = new Date('2026-10-12T00:00:00Z');
    expect(isGameOverdueForFinal({ ...game, status: 'final' }, late)).toBe(false);
    expect(isGameOverdueForFinal({ ...game, status: 'postponed' }, late)).toBe(false);
    expect(isGameOverdueForFinal({ ...game, scheduled_time: null }, late)).toBe(false);
  });
});
