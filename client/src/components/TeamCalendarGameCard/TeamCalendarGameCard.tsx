import { type CSSProperties, type ReactNode } from 'react';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
import Tooltip from '@/components/Tooltip/Tooltip';
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
  logoSize?: number;
  live?: boolean;
  fillContainer?: boolean;
  flush?: boolean;
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
  logoSize = 54,
  live = false,
  fillContainer = false,
  flush = false,
  ariaLabel,
  onOpen,
}: TeamCalendarGameCardProps) => {
  const isHome = variant === 'home';
  const logo = isHome
    ? (opponent.logo ?? opponent.logoDark ?? opponent.logoLight ?? null)
    : (opponent.logoLight ?? opponent.logo ?? opponent.logoDark ?? null);

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
        ]
          .filter(Boolean)
          .join(' ')}
        style={
          isHome
            ? ({ '--calendar-primary': homePrimaryColor ?? '#334155' } as CSSProperties)
            : undefined
        }
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
              logo={logo}
              code={logo ? opponent.code : ''}
              primaryColor={opponent.primaryColor}
              textColor={opponent.textColor}
              size={logoSize}
              shape={logo ? 'square' : 'circle'}
              className={logo ? styles.logoImage : undefined}
            />
          </div>
          <span className={styles.detail}>{detail}</span>
        </div>
      </div>
    </Tooltip>
  );
};

export default TeamCalendarGameCard;
