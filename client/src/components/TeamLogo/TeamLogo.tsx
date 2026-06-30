import { useContext } from 'react';
import { ThemeContext } from '@/context/ThemeContext';
import styles from './TeamLogo.module.scss';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface TeamLogoProps {
  logo?: string | null;
  logoDark?: string | null;
  logoLight?: string | null;
  logoPreference?: 'theme' | 'dark' | 'light';
  /** Short team code — shown as fallback text when there is no logo. */
  code: string;
  /** Overrides the image alt text. Defaults to the team code. */
  alt?: string;
  primaryColor?: string | null;
  textColor?: string | null;
  /** Width AND height in pixels. */
  size: number;
  /**
   * `'square'` (default) — matches how team crests are designed.
   * `'circle'` — for contexts where a round avatar is needed.
   */
  shape?: 'square' | 'circle';
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

const normalizeLogo = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const TeamLogo = ({
  logo,
  logoDark,
  logoLight,
  logoPreference = 'theme',
  code,
  alt,
  primaryColor,
  textColor,
  size,
  shape = 'square',
  className,
}: TeamLogoProps) => {
  // 3-char codes need a slightly smaller ratio than 2-char initials in PlayerAvatar
  const themeContext = useContext(ThemeContext);
  const isLightLogoPreferred =
    logoPreference === 'light' || (logoPreference === 'theme' && themeContext?.theme === 'light');
  const primaryLogo = normalizeLogo(logo);
  const darkLogo = normalizeLogo(logoDark);
  const lightLogo = normalizeLogo(logoLight);
  const selectedLogo =
    logoPreference === 'light'
      ? (lightLogo ?? primaryLogo ?? darkLogo)
      : logoPreference === 'dark'
        ? (darkLogo ?? primaryLogo ?? lightLogo)
        : isLightLogoPreferred
          ? (lightLogo ?? primaryLogo ?? darkLogo)
          : (primaryLogo ?? darkLogo ?? lightLogo);
  const fontSize = Math.round(size * 0.32);
  const shapeClass = shape === 'circle' ? styles.circle : styles.square;

  return (
    <span
      className={[styles.wrapper, shapeClass, className].filter(Boolean).join(' ')}
      style={{ width: size, height: size, background: selectedLogo ? 'none' : (primaryColor ?? undefined) }}
    >
      {selectedLogo ? (
        <img
          src={selectedLogo}
          alt={alt ?? code}
          className={styles.img}
        />
      ) : (
        <span
          className={styles.code}
          style={{ fontSize, color: textColor ?? undefined }}
        >
          {code.slice(0, 3)}
        </span>
      )}
    </span>
  );
};

export default TeamLogo;
