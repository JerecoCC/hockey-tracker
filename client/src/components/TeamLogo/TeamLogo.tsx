import styles from './TeamLogo.module.scss';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface TeamLogoProps {
  logo?: string | null;
  /** Short team code — shown as fallback text when there is no logo. */
  code: string;
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

const TeamLogo = ({
  logo,
  code,
  primaryColor,
  textColor,
  size,
  shape = 'square',
  className,
}: TeamLogoProps) => {
  // 3-char codes need a slightly smaller ratio than 2-char initials in PlayerAvatar
  const fontSize = Math.round(size * 0.32);
  const shapeClass = shape === 'circle' ? styles.circle : styles.square;

  return (
    <span
      className={[styles.wrapper, shapeClass, className].filter(Boolean).join(' ')}
      style={{ width: size, height: size, background: logo ? 'none' : (primaryColor ?? undefined) }}
    >
      {logo ? (
        <img
          src={logo}
          alt={code}
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
