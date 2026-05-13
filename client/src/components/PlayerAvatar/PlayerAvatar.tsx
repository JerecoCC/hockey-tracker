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
  /**
   * When set, draws a solid ring of this color around the avatar using box-shadow
   * (no layout impact). Useful when the photo is opaque and the team color needs
   * to be visible as a border ring.
   */
  ringColor?: string | null;
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

const PlayerAvatar = ({
  photo,
  initials,
  primaryColor,
  textColor,
  size,
  className,
  ringColor,
}: Props) => {
  const fontSize = Math.round(size * 0.38);

  // Both photos and initials get the same 20%-white tint over the team color.
  const background = primaryColor ? mixWithWhite(primaryColor, 0.2) : undefined;

  const boxShadow = ringColor ? `0 0 0 2px ${ringColor}` : undefined;

  const wrapperStyle = { width: size, height: size, background, boxShadow, '--avatar-size': size };

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
