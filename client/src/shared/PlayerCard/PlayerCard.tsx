import { Link } from 'react-router-dom';
import type { ReactElement, ReactNode } from 'react';
import Divider from '@jerecocc/tracker-ui/Divider';
import PlayerAvatar from '@jerecocc/tracker-ui/PlayerAvatar';
import TeamLogo from '@jerecocc/tracker-ui/TeamLogo';
import { formatPlayerPosition, PLAYER_POSITION_LABELS } from '@/lib/playerPosition';
import styles from './PlayerCard.module.scss';

export { formatPlayerPosition, PLAYER_POSITION_LABELS };

interface Props {
  name: string;
  kind?: 'player' | 'team';
  variant?: 'card' | 'list';
  photo?: string | null;
  initials?: string;
  teamLogo?: string | null;
  teamLogoDark?: string | null;
  teamLogoLight?: string | null;
  teamCode?: string | null;
  teamPrimaryColor?: string | null;
  teamTextColor?: string | null;
  jerseyNumber?: number | null;
  position?: string | null;
  topContent?: ReactNode;
  nameSuffix?: ReactNode;
  subtitle?: ReactNode;
  imageSize?: number;
  compact?: boolean;
  href?: string;
  onClick?: () => void;
  footer?: ReactNode;
  className?: string;
  as?: 'div' | 'li';
}

const fallbackInitials = (name: string) => {
  const parts = name.split(' ').filter(Boolean);
  return parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : name.slice(0, 2);
};

const PlayerCard = ({
  name,
  kind = 'player',
  variant = 'card',
  photo,
  initials,
  teamLogo,
  teamLogoDark,
  teamLogoLight,
  teamCode,
  teamPrimaryColor,
  teamTextColor,
  jerseyNumber,
  position,
  topContent,
  nameSuffix,
  subtitle,
  imageSize,
  compact = false,
  href,
  onClick,
  footer,
  className,
  as = 'div',
}: Props) => {
  const isTeam = kind === 'team';
  const isList = variant === 'list';
  const resolvedImageSize = imageSize ?? (isList ? 48 : compact ? 64 : 88);
  const positionLabel = formatPlayerPosition(position);
  const metaItems = [
    teamCode ? (
      <span className={styles.metaTeam}>
        <TeamLogo
          logo={teamLogo}
          logoDark={teamLogoDark}
          logoLight={teamLogoLight}
          code={teamCode}
          primaryColor={teamPrimaryColor}
          textColor={teamTextColor}
          size={16}
          shape="square"
        />
        <span>{teamCode}</span>
      </span>
    ) : null,
    jerseyNumber != null ? <span>#{jerseyNumber}</span> : null,
    positionLabel ? <span>{positionLabel}</span> : null,
  ].filter((item): item is ReactElement => Boolean(item));
  const renderedSubtitle =
    subtitle ??
    (metaItems.length > 0 ? (
      <span className={styles.meta}>
        {metaItems.map((item, index) => (
          <span
            key={index}
            className={styles.metaItem}
          >
            {index > 0 && (
              <span
                className={styles.metaSeparator}
                aria-hidden="true"
              >
                &bull;
              </span>
            )}
            {item}
          </span>
        ))}
      </span>
    ) : null);
  const cardClassName = [
    styles.card,
    isList ? styles.list : '',
    compact ? styles.compact : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const clickable = href || onClick;

  const content = (
    <>
      {href && (
        <Link
          to={href}
          className={styles.cardLink}
          aria-label={`View ${name}`}
        />
      )}

      {topContent && (
        <div className={styles.topContent}>
          {topContent}
          <Divider className={styles.topDivider} />
        </div>
      )}

      <div className={styles.content}>
        <div className={styles.profile}>
          <div className={styles.imageWrap}>
            {isTeam ? (
              <TeamLogo
                logo={teamLogo}
                logoDark={teamLogoDark}
                logoLight={teamLogoLight}
                code={teamCode ?? 'T'}
                primaryColor={teamPrimaryColor}
                textColor={teamTextColor}
                size={resolvedImageSize}
                className={styles.teamLogo}
              />
            ) : (
              <PlayerAvatar
                photo={photo}
                initials={initials ?? fallbackInitials(name)}
                primaryColor={teamPrimaryColor}
                textColor={teamTextColor}
                size={resolvedImageSize}
              />
            )}
          </div>

          <div className={styles.info}>
            <strong>
              {name}
              {nameSuffix && <span className={styles.nameSuffix}>{nameSuffix}</span>}
            </strong>
            {renderedSubtitle && <span className={styles.subtitle}>{renderedSubtitle}</span>}
          </div>
        </div>

        {footer}
      </div>
    </>
  );

  if (onClick && !href) {
    return (
      <button
        type="button"
        className={[cardClassName, styles.clickable].join(' ')}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  const Root = as;

  return (
    <Root className={[cardClassName, clickable ? styles.clickable : ''].filter(Boolean).join(' ')}>
      {content}
    </Root>
  );
};

export default PlayerCard;
