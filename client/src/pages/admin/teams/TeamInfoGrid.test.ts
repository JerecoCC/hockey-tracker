import { seasonLabel } from '@/pages/admin/teams/TeamInfoGrid';

// seasonLabel(startDate, endDate, name) derives a short display label:
//   - no startDate           → team name (fallback)
//   - same year start & end  → single year string "2024"
//   - no endDate             → start year only "2024"
//   - cross-year             → "2024-25"

describe('seasonLabel', () => {
  it('returns the team name when startDate is null', () => {
    expect(seasonLabel(null, null, 'Ottawa Senators')).toBe('Ottawa Senators');
  });

  it('returns the team name when startDate is empty string', () => {
    expect(seasonLabel('', null, 'Ottawa Senators')).toBe('Ottawa Senators');
  });

  it('returns just the start year when endDate is null', () => {
    expect(seasonLabel('2024-09-01', null, 'Leafs')).toBe('2024');
  });

  it('returns just the start year when start and end are in the same year', () => {
    expect(seasonLabel('2025-01-01', '2025-06-30', 'Leafs')).toBe('2025');
  });

  it('returns a cross-year label for different start and end years', () => {
    expect(seasonLabel('2024-09-01', '2025-04-30', 'Leafs')).toBe('2024-25');
  });

  it('handles century-boundary years correctly', () => {
    expect(seasonLabel('2099-09-01', '2100-04-30', 'Leafs')).toBe('2099-00');
  });
});
