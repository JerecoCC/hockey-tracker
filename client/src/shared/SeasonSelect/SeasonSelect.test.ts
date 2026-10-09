import {
  getActiveOrLatestEndedSeasonId,
  getLatestEndedSeasonId,
  getLatestSeasonId,
  isSeasonEnded,
  type SeasonSelectRecord,
} from '@/lib/seasonSelection';

const seasons: SeasonSelectRecord[] = [
  {
    id: 'season-2026',
    name: '2025-26',
    start_date: '2025-10-01',
    end_date: '2026-06-15',
    created_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'season-2027',
    name: '2026-27',
    start_date: '2026-10-01',
    end_date: '2027-06-15',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'season-2025',
    name: '2024-25',
    start_date: '2024-10-01',
    end_date: '2025-06-15',
    created_at: '2024-01-01T00:00:00Z',
  },
];

describe('SeasonSelect season helpers', () => {
  it('keeps the existing latest-season helper based on season order', () => {
    expect(getLatestSeasonId(seasons)).toBe('season-2027');
  });

  it('returns the latest season that has already ended', () => {
    expect(getLatestEndedSeasonId(seasons, '2026-07-07')).toBe('season-2026');
  });

  it('counts explicitly ended seasons even without an end date', () => {
    expect(
      getLatestEndedSeasonId(
        [
          { id: 'season-open', name: 'Open', start_date: '2027-10-01', is_ended: false },
          { id: 'season-ended', name: 'Ended', start_date: '2026-10-01', is_ended: true },
        ],
        '2026-07-07',
      ),
    ).toBe('season-ended');
  });

  it('does not fall back to current or future seasons when none have ended', () => {
    expect(
      getLatestEndedSeasonId(
        [
          { id: 'season-current', name: 'Current', start_date: '2026-10-01' },
          { id: 'season-future', name: 'Future', start_date: '2027-10-01' },
        ],
        '2026-07-07',
      ),
    ).toBeNull();
  });

  it('treats a season ending on the as-of date as ended', () => {
    expect(
      isSeasonEnded(
        { id: 'season-ending-today', name: 'Ending Today', end_date: '2026-07-07' },
        '2026-07-07',
      ),
    ).toBe(true);
  });
});

describe('getActiveOrLatestEndedSeasonId', () => {
  const ended = {
    id: 'season-ended',
    name: '2025-26',
    start_date: '2025-10-07',
    preseason_start_date: '2025-09-20',
    started_at: '2025-10-07T00:00:00Z',
    is_ended: true,
  };
  const next = {
    id: 'season-next',
    name: '2026-27',
    start_date: '2026-10-06',
    preseason_start_date: '2026-09-19',
    started_at: null,
    is_ended: false,
  };

  it('picks the season in preseason', () => {
    expect(getActiveOrLatestEndedSeasonId([ended, next], new Date(2026, 8, 25))).toBe(
      'season-next',
    );
  });

  it('picks a started season, including once its playoffs begin', () => {
    const started = { ...next, started_at: '2026-10-06T00:00:00Z' };
    expect(getActiveOrLatestEndedSeasonId([ended, started], new Date(2026, 10, 1))).toBe(
      'season-next',
    );
    expect(
      getActiveOrLatestEndedSeasonId(
        [ended, { ...started, playoffs_started: true }],
        new Date(2027, 3, 20),
      ),
    ).toBe('season-next');
  });

  it('falls back to the latest ended season before preseason begins', () => {
    expect(getActiveOrLatestEndedSeasonId([ended, next], new Date(2026, 7, 1))).toBe(
      'season-ended',
    );
  });
});
