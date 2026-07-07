import { useEffect, useMemo, useState } from 'react';
import { mixWithWhite } from '@/lib/color';
import FitText from '@/components/FitText/FitText';
import styles from './PlayerAvatar.module.scss';

interface Props {
  photo?: string | null;
  fallbackPhoto?: string | null;
  /** 1–2 character fallback shown when there is no photo. */
  initials: string;
  primaryColor?: string | null;
  textColor?: string | null;
  /** Diameter in pixels. Both width and height are set to this value. */
  size: number;
  className?: string;
}

export const getNhlLatestMugFallback = (photo?: string | null) => {
  const src = photo?.trim();
  if (!src) return null;
  try {
    const url = new URL(src);
    if (url.origin.toLowerCase() !== 'https://assets.nhle.com') return null;
    const match = url.pathname.match(/^\/mugs\/nhl\/(?!latest\/)[^/]+\/[^/]+\/([^/]+\.png)$/i);
    return match ? `${url.origin}/mugs/nhl/latest/${match[1]}` : null;
  } catch {
    return null;
  }
};

const PlayerAvatar = ({
  photo,
  fallbackPhoto,
  initials,
  primaryColor,
  textColor,
  size,
  className,
}: Props) => {
  const fontSize = Math.round(size * 0.38);
  const minFontSize = Math.min(fontSize, Math.max(4, Math.floor(fontSize * 0.65)));
  const initialImageSrc = photo?.trim() || null;
  const imageFallback = useMemo(
    () => fallbackPhoto?.trim() || getNhlLatestMugFallback(initialImageSrc),
    [fallbackPhoto, initialImageSrc],
  );
  const [imageSrc, setImageSrc] = useState(initialImageSrc);

  useEffect(() => {
    setImageSrc(initialImageSrc);
  }, [initialImageSrc]);

  const handleImageError = () => {
    if (imageSrc === initialImageSrc && imageFallback && imageFallback !== initialImageSrc) {
      setImageSrc(imageFallback);
      return;
    }
    setImageSrc(null);
  };

  // Both photos and initials get the same 20%-white tint over the team color.
  const background = primaryColor ? mixWithWhite(primaryColor, 0.2) : undefined;
  const border = primaryColor ? `2px solid ${primaryColor}` : undefined;

  const wrapperStyle = { width: size, height: size, background, border };

  return (
    <span
      className={[styles.wrapper, className].filter(Boolean).join(' ')}
      style={wrapperStyle}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt=""
          className={styles.img}
          onError={handleImageError}
        />
      ) : (
        <FitText
          className={styles.initials}
          minFontSize={minFontSize}
          maxFontSize={fontSize}
          style={{ fontSize, color: textColor ?? undefined }}
        >
          {initials}
        </FitText>
      )}
    </span>
  );
};

export default PlayerAvatar;
