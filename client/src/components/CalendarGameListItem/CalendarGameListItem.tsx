import type { DragEventHandler, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
import Tooltip from '@/components/Tooltip/Tooltip';
import styles from './CalendarGameListItem.module.scss';

type ScoreStatus = 'pending' | 'win' | 'lose';

export interface CalendarGameListItemTeam {
  code: string;
  logo: string | null;
  primaryColor: string;
  textColor: string;
  score?: number | string | null;
  scoreStatus?: ScoreStatus;
  dimmed?: boolean;
  meta?: ReactNode;
}

interface Props {
  awayTeam: CalendarGameListItemTeam;
  homeTeam: CalendarGameListItemTeam;
  showScore?: boolean;
  href?: string;
  tooltip?: string;
  topLabel?: ReactNode;
  centerLabel?: ReactNode;
  bottomLabel?: ReactNode;
  live?: boolean;
  dragging?: boolean;
  draggable?: boolean;
  className?: string;
  onDragStart?: DragEventHandler<HTMLDivElement>;
  onDragEnd?: DragEventHandler<HTMLDivElement>;
  children?: ReactNode;
}

const scoreClassName = (status: ScoreStatus | undefined, side: 'away' | 'home') =>
  [
    styles.score,
    side === 'away' ? styles.scoreAway : styles.scoreHome,
    status === 'win' ? styles.scoreWin : '',
    status === 'lose' ? styles.scoreLose : '',
  ]
    .filter(Boolean)
    .join(' ');

const logoClassName = (dimmed: boolean | undefined, side: 'away' | 'home') =>
  [
    styles.logoSlot,
    side === 'away' ? styles.logoSlotAway : styles.logoSlotHome,
    dimmed ? styles.logoSlotDimmed : '',
  ]
    .filter(Boolean)
    .join(' ');

const CalendarGameListItem = ({
  awayTeam,
  homeTeam,
  showScore = false,
  href,
  tooltip,
  topLabel,
  centerLabel,
  bottomLabel,
  live = false,
  dragging = false,
  draggable = false,
  className,
  onDragStart,
  onDragEnd,
  children,
}: Props) => {
  const scoreVisible = showScore && awayTeam.score != null && homeTeam.score != null;
  const itemClassName = [
    styles.item,
    live ? styles.itemLive : '',
    dragging ? styles.itemDragging : '',
    draggable ? styles.itemDraggable : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      {children}
      {topLabel != null && <div className={styles.topLabel}>{topLabel}</div>}
      <div className={styles.matchup}>
        <span className={logoClassName(awayTeam.dimmed, 'away')}>
          <TeamLogo
            logo={awayTeam.logo}
            code={awayTeam.code}
            primaryColor={awayTeam.primaryColor}
            textColor={awayTeam.textColor}
            size={26}
            shape="circle"
          />
        </span>
        {scoreVisible && (
          <span className={scoreClassName(awayTeam.scoreStatus, 'away')}>{awayTeam.score}</span>
        )}
        <span className={styles.center}>
          {centerLabel != null && <span className={styles.centerLabel}>{centerLabel}</span>}
          <span className={styles.atSymbol}>@</span>
        </span>
        {scoreVisible && (
          <span className={scoreClassName(homeTeam.scoreStatus, 'home')}>{homeTeam.score}</span>
        )}
        <span className={logoClassName(homeTeam.dimmed, 'home')}>
          <TeamLogo
            logo={homeTeam.logo}
            code={homeTeam.code}
            primaryColor={homeTeam.primaryColor}
            textColor={homeTeam.textColor}
            size={26}
            shape="circle"
          />
        </span>
      </div>
      {(awayTeam.meta != null || homeTeam.meta != null) && (
        <div className={styles.metaRow}>
          <span className={styles.awayMeta}>{awayTeam.meta}</span>
          <span className={styles.homeMeta}>{homeTeam.meta}</span>
        </div>
      )}
      {bottomLabel != null && <div className={styles.bottomLabel}>{bottomLabel}</div>}
    </>
  );

  if (href) {
    return (
      <Tooltip
        className={styles.wrap}
        text={tooltip ?? `${awayTeam.code} @ ${homeTeam.code}`}
      >
        <Link
          to={href}
          className={itemClassName}
        >
          {content}
        </Link>
      </Tooltip>
    );
  }

  return (
    <div
      className={itemClassName}
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
    >
      {content}
    </div>
  );
};

export default CalendarGameListItem;
