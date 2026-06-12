import { lastFiveOpponentLogo } from './gameUtils';

describe('lastFiveOpponentLogo', () => {
  it('prefers the light logo for away games', () => {
    expect(
      lastFiveOpponentLogo({
        is_home: false,
        opponent_logo: '/logos/default.png',
        opponent_logo_dark: '/logos/dark.png',
        opponent_logo_light: '/logos/light.png',
      }),
    ).toBe('/logos/light.png');
  });

  it('falls back to the available default logo for away games', () => {
    expect(
      lastFiveOpponentLogo({
        is_home: false,
        opponent_logo: '/logos/default.png',
        opponent_logo_dark: '/logos/dark.png',
        opponent_logo_light: null,
      }),
    ).toBe('/logos/default.png');
  });

  it('keeps the default logo for home games', () => {
    expect(
      lastFiveOpponentLogo({
        is_home: true,
        opponent_logo: '/logos/default.png',
        opponent_logo_dark: '/logos/dark.png',
        opponent_logo_light: '/logos/light.png',
      }),
    ).toBe('/logos/default.png');
  });
});
