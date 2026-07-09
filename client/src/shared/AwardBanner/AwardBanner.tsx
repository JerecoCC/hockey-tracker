import { useId, type CSSProperties, type ReactNode } from 'react';
import Icon from '@jerecocc/tracker-ui/components/Icon/Icon';
import styles from './AwardBanner.module.scss';

export type AwardBannerShape = 'rounded' | 'forked' | 'pointed';

interface AwardBannerShapeConfig {
  className: string;
  height: number;
  outerPath: string;
  innerPath: string;
}

interface AwardBannerProps {
  awardName: ReactNode;
  media: ReactNode;
  seasonName: ReactNode;
  teamName: ReactNode;
  champions?: boolean;
  dateText?: ReactNode;
  placeName?: ReactNode;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  textColor?: string | null;
  shape?: AwardBannerShape;
}

type AwardBannerStyle = CSSProperties & {
  '--award-banner-color'?: string;
  '--award-banner-secondary-color'?: string;
  '--award-banner-text-color'?: string;
};

type AwardBannerFrameStyle = CSSProperties & {
  '--award-banner-height'?: string;
};

const BODY_HEIGHT = 276;
const SEASON_BAND_Y = 218;
const SEASON_BAND_HEIGHT = 40;
const SEASON_BAND_BORDER_INSET = 4;

const SHAPES: Record<AwardBannerShape, AwardBannerShapeConfig> = {
  rounded: {
    className: '',
    height: BODY_HEIGHT,
    outerPath: 'M0 8 Q0 0 8 0 H152 Q160 0 160 8 V250 Q160 276 134 276 H26 Q0 276 0 250 Z',
    innerPath: 'M8 8 H152 V248 Q152 268 132 268 H28 Q8 268 8 248 Z',
  },
  forked: {
    className: styles.awardArenaBannerIndividual,
    height: 310,
    outerPath: 'M0 8 Q0 0 8 0 H152 Q160 0 160 8 V310 L80 282 L0 310 Z',
    innerPath: 'M8 8 H152 V299 L80 274 L8 299 Z',
  },
  pointed: {
    className: styles.awardArenaBannerChampionship,
    height: 318,
    outerPath: 'M0 8 Q0 0 8 0 H152 Q160 0 160 8 V286 L80 318 L0 286 Z',
    innerPath: 'M8 8 H152 V280 L80 308 L8 280 Z',
  },
};

const AwardBanner = ({
  awardName,
  champions,
  dateText,
  media,
  placeName,
  primaryColor,
  seasonName,
  secondaryColor,
  shape = 'rounded',
  teamName,
  textColor,
}: AwardBannerProps) => {
  const reactId = useId().replace(/:/g, '');
  const clipId = `award-banner-clip-${reactId}`;
  const bandClipId = `award-banner-band-clip-${reactId}`;
  const gradientId = `award-banner-gradient-${reactId}`;
  const config = SHAPES[shape];
  const style: AwardBannerStyle = {
    '--award-banner-color': primaryColor ?? undefined,
    '--award-banner-secondary-color': secondaryColor ?? primaryColor ?? undefined,
    '--award-banner-text-color': textColor ?? undefined,
  };

  return (
    <article
      className={[styles.awardArenaBanner, config.className].filter(Boolean).join(' ')}
      style={style}
    >
      <span className={styles.awardBannerRail} />
      <div
        className={styles.awardBannerFrame}
        style={{ '--award-banner-height': `${config.height}px` } as AwardBannerFrameStyle}
      >
        <svg
          className={styles.awardBannerShell}
          viewBox={`0 0 160 ${config.height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <clipPath id={clipId}>
              <path d={config.outerPath} />
            </clipPath>
            <linearGradient
              id={gradientId}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                className={styles.awardBannerGradientStart}
              />
              <stop
                offset="46%"
                className={styles.awardBannerGradientEnd}
              />
            </linearGradient>
          </defs>
          <g clipPath={`url(#${clipId})`}>
            <rect
              width="160"
              height={config.height}
              className={styles.awardBannerBase}
              fill={`url(#${gradientId})`}
            />
          </g>
        </svg>
        <svg
          className={styles.awardBannerBorderOverlay}
          viewBox={`0 0 160 ${config.height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d={config.outerPath}
            className={styles.awardBannerOuter}
          />
          <path
            d={config.innerPath}
            className={styles.awardBannerInner}
          />
        </svg>
        <svg
          className={styles.awardBannerBandOverlay}
          viewBox={`0 0 160 ${config.height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <clipPath id={bandClipId}>
              <path d={config.outerPath} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${bandClipId})`}>
            <rect
              y={SEASON_BAND_Y}
              width="160"
              height={SEASON_BAND_HEIGHT}
              className={styles.awardBannerBand}
            />
            <line
              x1="0"
              x2="160"
              y1={SEASON_BAND_Y + SEASON_BAND_BORDER_INSET}
              y2={SEASON_BAND_Y + SEASON_BAND_BORDER_INSET}
              className={styles.awardBannerBandBorder}
            />
            <line
              x1="0"
              x2="160"
              y1={SEASON_BAND_Y + SEASON_BAND_HEIGHT - SEASON_BAND_BORDER_INSET}
              y2={SEASON_BAND_Y + SEASON_BAND_HEIGHT - SEASON_BAND_BORDER_INSET}
              className={styles.awardBannerBandBorder}
            />
          </g>
        </svg>
        <div className={styles.awardBannerPanel}>
          <div className={styles.awardBannerContent}>
            <span className={styles.awardBannerAward}>
              <span>{awardName}</span>
              {champions && <span className={styles.awardBannerChampions}>Champions</span>}
            </span>
            <span className={styles.awardBannerLogoSlot}>{media}</span>
            <span className={styles.awardBannerTeam}>
              {placeName && <span className={styles.awardBannerTeamPlace}>{placeName}</span>}
              <span className={styles.awardBannerTeamName}>{teamName}</span>
            </span>
            {dateText && <span className={styles.awardBannerDate}>{dateText}</span>}
          </div>
          <span className={styles.awardBannerSeason}>{seasonName}</span>
        </div>
        {champions && (
          <span
            className={styles.awardBannerTrophy}
            aria-hidden="true"
          >
            <Icon
              name="trophy"
              size="1.25rem"
            />
          </span>
        )}
      </div>
    </article>
  );
};

export default AwardBanner;
