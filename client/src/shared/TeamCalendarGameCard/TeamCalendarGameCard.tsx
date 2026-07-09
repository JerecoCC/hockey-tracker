import { type CSSProperties, type ReactNode } from 'react';
import TeamLogo from '@jerecocc/tracker-ui/components/TeamLogo/TeamLogo';
import Tooltip from '@jerecocc/tracker-ui/components/Tooltip/Tooltip';
import styles from './TeamCalendarGameCard.module.scss';

interface TeamCalendarGameCardProps {
  variant: 'home' | 'away';
  opponent: {
    name: string;
    code: string;
    logo?: string | null;
    logoDark?: string | null;
    logoLight?: string | null;
    primaryColor?: string | null;
    textColor?: string | null;
  };
  detail: ReactNode;
  topLabel?: ReactNode;
  topLabelAlign?: 'start' | 'center';
  topLabelWeight?: 'normal' | 'bold';
  homePrimaryColor?: string | null;
  logoAccentColor?: string | null;
  logoSize?: number;
  live?: boolean;
  fillContainer?: boolean;
  flush?: boolean;
  transparentBackground?: boolean;
  ariaLabel: string;
  onOpen: () => void;
}

const TeamCalendarGameCard = ({
  variant,
  opponent,
  detail,
  topLabel,
  topLabelAlign = 'start',
  topLabelWeight = 'bold',
  homePrimaryColor,
  logoAccentColor,
  logoSize = 54,
  live = false,
  fillContainer = false,
  flush = false,
  transparentBackground = false,
  ariaLabel,
  onOpen,
}: TeamCalendarGameCardProps) => {
  const isHome = variant === 'home';
  const hasLogo = Boolean(opponent.logo ?? opponent.logoDark ?? opponent.logoLight);
  const cardStyle = {
    '--calendar-primary': homePrimaryColor ?? '#334155',
    '--calendar-logo-accent':
      logoAccentColor ?? homePrimaryColor ?? opponent.primaryColor ?? '#334155',
    '--calendar-home-text': logoAccentColor ?? '#ffffff',
  } as CSSProperties;

  return (
    <Tooltip
      text={opponent.name}
      className={styles.tooltip}
    >
      <div
        className={[
          styles.card,
          isHome ? styles.home : styles.away,
          live ? styles.live : '',
          fillContainer ? styles.fill : '',
          flush ? styles.flush : '',
          transparentBackground ? styles.transparent : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={cardStyle}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onOpen();
        }}
      >
        {topLabel ? (
          <span
            className={[
              styles.topLabel,
              topLabelAlign === 'center' ? styles.topLabelCenter : '',
              topLabelWeight === 'normal' ? styles.topLabelNormal : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {topLabel}
          </span>
        ) : null}
        <div className={styles.body}>
          <div className={styles.logoWrap}>
            <TeamLogo
              logo={opponent.logo}
              logoDark={opponent.logoDark}
              logoLight={opponent.logoLight}
              logoPreference={isHome ? 'theme' : 'light'}
              code={hasLogo ? opponent.code : ''}
              primaryColor={opponent.primaryColor}
              textColor={opponent.textColor}
              size={logoSize}
              shape={hasLogo ? 'square' : 'circle'}
              className={hasLogo ? styles.logoImage : undefined}
            />
          </div>
          <span className={styles.detail}>{detail}</span>
        </div>
      </div>
    </Tooltip>
  );
};

export default TeamCalendarGameCard;
