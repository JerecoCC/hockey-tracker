import { getSeasonPhase, getSeasonTagPhase, seasonPhasePresentation } from './seasonPhase';

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

  it('shows preseason from the preseason start date until the season start date', () => {
    const season = { preseason_start_date: '2026-09-20', start_date: '2026-10-07' };
    expect(getSeasonTagPhase(season, new Date(2026, 8, 19))).toBe('upcoming');
    expect(getSeasonTagPhase(season, new Date(2026, 8, 20))).toBe('preseason');
    expect(getSeasonTagPhase(season, new Date(2026, 9, 6))).toBe('preseason');
    expect(getSeasonTagPhase(season, new Date(2026, 9, 7))).toBe('upcoming');
    expect(
      getSeasonTagPhase(
        { ...season, started_at: '2026-09-20T00:00:00.000Z' },
        new Date(2026, 9, 1),
      ),
    ).toBe('preseason');
    expect(
      getSeasonTagPhase(
        { ...season, started_at: '2026-09-20T00:00:00.000Z' },
        new Date(2026, 9, 7),
      ),
    ).toBe('in_progress');
    expect(seasonPhasePresentation('preseason').label).toBe('Preseason');
  });

  it('ignores preseason once playoffs start or the season ends', () => {
    const season = { preseason_start_date: '2026-09-20', start_date: '2026-10-07' };
    const today = new Date(2026, 8, 25);
    expect(getSeasonTagPhase({ ...season, playoffs_started: true }, today)).toBe('playoffs');
    expect(getSeasonTagPhase({ ...season, is_ended: true }, today)).toBe('ended');
  });
});
