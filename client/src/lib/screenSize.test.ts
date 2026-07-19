import { getScreenSize, SCREEN_BREAKPOINTS } from './screenSize';

describe('screenSize', () => {
  it('uses the sidenav drawer breakpoint as the mobile boundary', () => {
    expect(SCREEN_BREAKPOINTS.mobileMax).toBe(768);
    expect(getScreenSize(768)).toBe('mobile');
    expect(getScreenSize(769)).toBe('tablet');
  });

  it('uses a consistent tablet-to-desktop boundary', () => {
    expect(getScreenSize(1024)).toBe('tablet');
    expect(getScreenSize(1025)).toBe('desktop');
  });
});
