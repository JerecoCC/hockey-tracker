import { contrastRatio, ensureContrast, mixHex } from './color';

// Theme colors from index.scss team tints build on: the surface, then the deeper page
// background (dark) or white (light).
const TEAM_TINT_THEME_BASES = {
  dark: ['#1e293b', '#0f172a'],
  light: ['#f5f9ff', '#ffffff'],
};
// Primary shares to try, closest to the default tint first. The cap keeps the tint apart from
// the team's solid primary.
const TEAM_TINT_PRIMARY_SHARES = [0.3, 0.35, 0.4, 0.45, 0.25, 0.2];
const TEAM_TINT_MIN_TEXT_CONTRAST = 4.5;
// How far the tint must sit from the solid primary (e.g. a header or outline beside it).
const TEAM_TINT_MIN_PRIMARY_CONTRAST = 1.3;

/**
 * A team-colored background and text color for the current theme. The background is the
 * theme surface tinted with the team's primary, as long as the team's text reads on it and it
 * stays distinguishable from the solid primary; otherwise other tints of the theme are tried.
 * If the team's text can't read on any distinct tint, it's lightened or darkened just enough
 * to read, keeping its hue.
 */
export const getTeamTintColors = (primary: string, text: string, isDarkMode: boolean) => {
  const bases = isDarkMode ? TEAM_TINT_THEME_BASES.dark : TEAM_TINT_THEME_BASES.light;
  const candidates = bases.flatMap((base) =>
    TEAM_TINT_PRIMARY_SHARES.map((share) => mixHex(primary, base, share)),
  );
  // Non-hex team colors can't be measured, so use the default tint as given.
  if (candidates.some((candidate) => !candidate) || !mixHex(text, text, 1)) {
    return {
      background: `color-mix(in srgb, ${primary} 30%, var(--app-surface, ${bases[0]}))`,
      text,
    };
  }
  const tints = candidates as string[];
  const distinct = (tint: string) =>
    contrastRatio(tint, primary) >= TEAM_TINT_MIN_PRIMARY_CONTRAST;
  const fitting = tints.find(
    (tint) => distinct(tint) && contrastRatio(text, tint) >= TEAM_TINT_MIN_TEXT_CONTRAST,
  );
  if (fitting) return { background: fitting, text };

  const background =
    tints.find(distinct) ??
    tints.reduce((best, tint) =>
      contrastRatio(tint, primary) > contrastRatio(best, primary) ? tint : best,
    );
  return { background, text: ensureContrast(text, background, TEAM_TINT_MIN_TEXT_CONTRAST) };
};
