import { normalizePlayerSearchText, playerSearchTextIncludes } from './playerSearch';

describe('player search text helpers', () => {
  it('matches Maxim and Maksim transliterations', () => {
    expect(normalizePlayerSearchText('Maksim Tsyplakov')).toBe('maxim tsyplakov');
    expect(playerSearchTextIncludes('Maxim Tsyplakov', normalizePlayerSearchText('Maksim'))).toBe(
      true,
    );
    expect(playerSearchTextIncludes('Maksim Tsyplakov', normalizePlayerSearchText('Maxim'))).toBe(
      true,
    );
  });

  it('normalizes case and diacritics', () => {
    expect(playerSearchTextIncludes('Simon Nemec', normalizePlayerSearchText('SIMON'))).toBe(true);
    expect(playerSearchTextIncludes('Šimon Nemec', normalizePlayerSearchText('Simon'))).toBe(true);
  });
});
