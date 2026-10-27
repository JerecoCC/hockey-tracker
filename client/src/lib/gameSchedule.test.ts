import {
  getEasternDateKey,
  getOriginalGameDateKey,
  getScheduledInstant,
  getScheduledWatchDateKey,
  isInvalidWatchScheduleDate,
  sortUserDayGames,
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

  it('keeps a midnight Eastern start on its own date', () => {
    const game = { scheduled_at: '2026-11-14T00:00:00.000Z', scheduled_time: '00:00' };

    expect(getEasternDateKey(game.scheduled_at, game.scheduled_time)).toBe('2026-11-14');
    expect(getScheduledInstant(game.scheduled_at, game.scheduled_time)?.toISOString()).toBe(
      '2026-11-14T05:00:00.000Z',
    );
    expect(getOriginalGameDateKey(game, 'ET')).toBe('2026-11-14');
  });

  it('orders a day by start instant across two Eastern dates', () => {
    // Both start on Nov 13 in Manila: 8:00 AM, then 10:00 PM.
    const evening = { scheduled_at: '2026-11-12T00:00:00.000Z', scheduled_time: '19:00' };
    const morning = { scheduled_at: '2026-11-13T00:00:00.000Z', scheduled_time: '09:00' };

    expect([morning, evening].sort(sortUserDayGames)).toEqual([evening, morning]);
  });

  it('orders tied games the same way whatever order they arrive in', () => {
    // Same status and start, like personal games bulk-added for one time slot.
    const tied = (id: string, away: string) => ({
      id,
      league_code: 'MMGHL',
      away_team: { code: away },
      home_team: { code: 'MON' },
      scheduled_at: '2026-10-27T00:00:00.000Z',
      scheduled_time: '11:00',
      scheduled_for: '2026-10-28',
    });
    const srg = tied('b', 'SRG');
    const str = tied('a', 'STR');
    const nhl = { ...tied('c', 'AAA'), league_code: 'NHL' };

    expect([str, nhl, srg].sort(sortUserDayGames)).toEqual([srg, str, nhl]);
    expect([nhl, srg, str].sort(sortUserDayGames)).toEqual([srg, str, nhl]);
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
