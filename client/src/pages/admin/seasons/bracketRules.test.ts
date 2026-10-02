import { inferBracketSizeFromSlots } from './bracketRules';

const keys = (...slotKeys: string[]) => slotKeys.map((slot_key) => ({ slot_key }));

describe('inferBracketSizeFromSlots', () => {
  it('sizes the bracket from its Round 1 matchups', () => {
    expect(
      inferBracketSizeFromSlots(
        keys('r1m0team1', 'r1m0team2', 'r1m1team1', 'r1m2team1', 'r1m3team2'),
      ),
    ).toBe(8);
  });

  it('keeps a resized bracket whose new Round 1 matchups are still blank', () => {
    // An 8-team bracket with only two Round 1 matchups configured: blank slots are not
    // saved, but the auto winner slots still reach Round 3.
    expect(
      inferBracketSizeFromSlots(
        keys(
          'r1m0team1',
          'r1m0team2',
          'r1m1team1',
          'r1m1team2',
          'r2m0team1',
          'r2m0team2',
          'r2m1team1',
          'r2m1team2',
          'r3m0team1',
          'r3m0team2',
        ),
      ),
    ).toBe(8);
  });

  it('never goes below a 4-team bracket', () => {
    expect(inferBracketSizeFromSlots([])).toBe(4);
  });
});
