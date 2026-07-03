import { mixWithWhite } from '@/lib/color';
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

const PlayerAvatar = ({
  photo,
  initials,
  primaryColor,
  textColor,
  size,
  className,
}: Props) => {
  const fontSize = Math.round(size * 0.38);

  // Both photos and initials get the same 20%-white tint over the team color.
  const background = primaryColor ? mixWithWhite(primaryColor, 0.2) : undefined;
  const border = primaryColor ? `2px solid ${primaryColor}` : undefined;

  const wrapperStyle = { width: size, height: size, background, border };

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
