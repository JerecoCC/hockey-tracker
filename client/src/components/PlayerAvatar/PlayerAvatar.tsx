import styles from './PlayerAvatar.module.scss';

interface Props {
  photo?: string | null;
  /** 1–2 character fallback shown when there is no photo. */
  initials: string;
  primaryColor?: string | null;
  textColor?: string | null;
  /** Diameter in pixels. Both width and height are set to this value. */
  size: number;
  className?: string;
}

/**
 * Blends a hex color toward white by the given ratio (0 = original, 1 = white).
 * Returns the original string unchanged if it isn't a 6-digit hex.
 */
const mixWithWhite = (hex: string, ratio: number): string => {
  const clean = hex.startsWith('#') ? hex.slice(1) : hex;
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const mix = (channel: number) =>
    Math.round(channel + (255 - channel) * ratio)
      .toString(16)
      .padStart(2, '0');
  return `#${mix(r)}${mix(g)}${mix(b)}`;
};

const PlayerAvatar = ({ photo, initials, primaryColor, textColor, size, className }: Props) => {
  const fontSize = Math.round(size * 0.38);

  // When showing a photo: use a white-mixed tint so transparent PNGs get a
  // solid light background. When showing initials: use the full primary color.
  const background = primaryColor
    ? photo
      ? mixWithWhite(primaryColor, 0.2)
      : primaryColor
    : undefined;

  const wrapperStyle = { width: size, height: size, background };

  return (
    <span
      className={[styles.wrapper, className].filter(Boolean).join(' ')}
      style={wrapperStyle}
    >
      {photo ? (
        <img
          src={photo}
          alt=""
          className={styles.img}
        />
      ) : (
        <span
          className={styles.initials}
          style={{ fontSize, color: textColor ?? undefined }}
        >
          {initials}
        </span>
      )}
    </span>
  );
};

export default PlayerAvatar;
