import { getDraftPickStartDate } from './draftDates';

const draftDates = [
  {
    draft_year: 2026,
    start_round: 1,
    end_round: 2,
    draft_date: '2026-06-26',
  },
  {
    draft_year: 2026,
    start_round: 3,
    end_round: 7,
    draft_date: '2026-06-27',
  },
  {
    draft_year: 2027,
    start_round: 1,
    end_round: 7,
    draft_date: '2027-06-25',
  },
];

describe('getDraftPickStartDate', () => {
  it('uses the date whose configured round range contains the pick round', () => {
    expect(getDraftPickStartDate({ year: 2026, round: 1 }, draftDates)).toBe('2026-06-26');
    expect(getDraftPickStartDate({ year: 2026, round: 'Round 4' }, draftDates)).toBe(
      '2026-06-27',
    );
  });

  it('supports one-day drafts configured as one full round range', () => {
    expect(getDraftPickStartDate({ year: 2027, round: 6 }, draftDates)).toBe('2027-06-25');
  });

  it('returns null when no configured range matches', () => {
    expect(getDraftPickStartDate({ year: 2025, round: 1 }, draftDates)).toBeNull();
    expect(getDraftPickStartDate({ year: 2026, round: 8 }, draftDates)).toBeNull();
  });
});
