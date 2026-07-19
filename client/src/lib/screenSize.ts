/**
 * App-wide viewport boundaries. Mobile follows the sidenav drawer breakpoint.
 * Keep the matching Sass tokens in styles/_mixins.scss synchronized.
 */
export const SCREEN_BREAKPOINTS = {
  phoneMax: 640,
  mobileMax: 768,
  tabletMax: 1024,
} as const;

export type ScreenSize = 'mobile' | 'tablet' | 'desktop';

export const getScreenSize = (width: number): ScreenSize => {
  if (width <= SCREEN_BREAKPOINTS.mobileMax) return 'mobile';
  if (width <= SCREEN_BREAKPOINTS.tabletMax) return 'tablet';
  return 'desktop';
};
