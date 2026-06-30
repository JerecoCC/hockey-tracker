import { shotPeriodOrdinal, sumVisiblePeriodShots } from './shotPeriods';

describe('shot period utilities', () => {
  it('orders playoff overtime shot periods and excludes shootout attempts', () => {
    expect(shotPeriodOrdinal('1')).toBe(1);
    expect(shotPeriodOrdinal('OT')).toBe(4);
    expect(shotPeriodOrdinal('OT1')).toBe(4);
    expect(shotPeriodOrdinal('OT2')).toBe(5);
    expect(shotPeriodOrdinal('SO')).toBeNull();
  });

  it('sums only the visible shot periods', () => {
    const visiblePeriods = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: 'OT1' }];
    const periodShots = [
      { period: '1', away_shots: 8, home_shots: 10 },
      { period: '2', away_shots: 7, home_shots: 9 },
      { period: '3', away_shots: 9, home_shots: 11 },
      { period: 'OT1', away_shots: 2, home_shots: 7 },
      { period: 'OT2', away_shots: 20, home_shots: 20 },
      { period: 'SO', away_shots: 5, home_shots: 5 },
    ];

    expect(sumVisiblePeriodShots(visiblePeriods, periodShots, 'away')).toBe(26);
    expect(sumVisiblePeriodShots(visiblePeriods, periodShots, 'home')).toBe(37);
  });
});
