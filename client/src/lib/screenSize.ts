/**
 * App-wide viewport boundaries.
 * Keep the matching Sass tokens in styles/_mixins.scss synchronized.
 */
export const SCREEN_BREAKPOINTS = {
  phoneMax: 425,
  mobileMax: 425,
  tabletMax: 768,
} as const;

export type ScreenSize = 'mobile' | 'tablet' | 'desktop';

export const getScreenSize = (width: number): ScreenSize => {
  if (width <= SCREEN_BREAKPOINTS.mobileMax) return 'mobile';
  if (width <= SCREEN_BREAKPOINTS.tabletMax) return 'tablet';
  return 'desktop';
};
