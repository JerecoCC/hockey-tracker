import {
  formatGameTime,
  getOriginalGameDateKey,
  getScheduledInstant,
} from './gameSchedule';

// Personal games come back like league games: the Eastern date as a midnight placeholder, with
// the Eastern start time. Their dates and times are entered in ET and shown in local time.
const personalGame = {
  scheduled_at: '2026-10-10T00:00:00.000Z',
  scheduled_time: '22:00',
};

describe('personal game times', () => {
  it('reads the date and time as Eastern', () => {
    // 10 PM EDT on Oct 10 is 02:00 UTC on Oct 11.
    expect(getScheduledInstant(personalGame.scheduled_at, personalGame.scheduled_time)?.toISOString()).toBe(
      '2026-10-11T02:00:00.000Z',
    );
    expect(getOriginalGameDateKey(personalGame, 'ET')).toBe('2026-10-10');
  });

  it("shows the viewer's local date and time", () => {
    const instant = new Date('2026-10-11T02:00:00.000Z');
    const localDate = `${instant.getFullYear()}-${String(instant.getMonth() + 1).padStart(2, '0')}-${String(instant.getDate()).padStart(2, '0')}`;
    expect(getOriginalGameDateKey(personalGame, 'local')).toBe(localDate);
    expect(
      formatGameTime(personalGame.scheduled_at, personalGame.scheduled_time, 'local'),
    ).toBe(new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(instant));
  });

  it('keeps a game without a start time on its entered date', () => {
    expect(getOriginalGameDateKey({ ...personalGame, scheduled_time: null }, 'local')).toBe('2026-10-10');
  });
});
