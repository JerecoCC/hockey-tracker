import { getSeasonPhase, seasonPhasePresentation } from './seasonPhase';

describe('season lifecycle', () => {
  it('keeps a season upcoming until it is explicitly started', () => {
    expect(getSeasonPhase({})).toBe('upcoming');
    expect(getSeasonPhase({ started_at: null })).toBe('upcoming');
  });

  it('advances monotonically through the explicit lifecycle markers', () => {
    expect(getSeasonPhase({ started_at: '2026-10-01T00:00:00.000Z' })).toBe('in_progress');
    expect(
      getSeasonPhase({
        started_at: '2026-10-01T00:00:00.000Z',
        playoffs_started: true,
      }),
    ).toBe('playoffs');
    expect(
      getSeasonPhase({
        started_at: '2026-10-01T00:00:00.000Z',
        playoffs_started: true,
        is_ended: true,
      }),
    ).toBe('ended');
  });

  it('provides a distinct label for every phase', () => {
    expect(seasonPhasePresentation('upcoming').label).toBe('Upcoming');
    expect(seasonPhasePresentation('in_progress').label).toBe('In Progress');
    expect(seasonPhasePresentation('playoffs').label).toBe('Playoffs');
    expect(seasonPhasePresentation('ended').label).toBe('Ended');
  });
});
