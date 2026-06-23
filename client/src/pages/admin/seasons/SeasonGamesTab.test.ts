import { toEasternDateKey } from './seasonDateUtils';

describe('season games date keys', () => {
  it('keeps date-only scheduled dates on their stored ET calendar day', () => {
    expect(toEasternDateKey('2025-12-01')).toBe('2025-12-01');
  });

  it('keeps midnight placeholder scheduled dates on their stored ET calendar day', () => {
    expect(toEasternDateKey('2025-12-01T00:00:00.000Z')).toBe('2025-12-01');
  });

  it('uses the ET day for real scheduled instants', () => {
    expect(toEasternDateKey('2025-12-01T02:30:00.000Z')).toBe('2025-11-30');
  });
});
