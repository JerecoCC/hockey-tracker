import { getScreenSize, SCREEN_BREAKPOINTS } from './screenSize';

describe('screenSize', () => {
  it('uses 425px as the inclusive mobile boundary', () => {
    expect(SCREEN_BREAKPOINTS.phoneMax).toBe(425);
    expect(SCREEN_BREAKPOINTS.mobileMax).toBe(425);
    expect(getScreenSize(425)).toBe('mobile');
    expect(getScreenSize(426)).toBe('tablet');
  });

  it('uses a consistent tablet-to-desktop boundary', () => {
    expect(SCREEN_BREAKPOINTS.tabletMax).toBe(768);
    expect(getScreenSize(768)).toBe('tablet');
    expect(getScreenSize(769)).toBe('desktop');
  });
});
