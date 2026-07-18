import type { CSSProperties, DragEventHandler, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { faGripLinesVertical } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import TeamLogo from '@jerecocc/tracker-ui/components/TeamLogo/TeamLogo';
import Tooltip from '@jerecocc/tracker-ui/components/Tooltip/Tooltip';
import type { GameType } from '@/hooks/useGames';
import styles from './CalendarGameListItem.module.scss';

type ScoreStatus = 'pending' | 'win' | 'lose' | 'missing';
type ScorePresentation = 'boxed' | 'plain';

const GAME_TYPE_CLASS: Record<GameType, string> = {
  preseason: styles.typePreseason,
  regular: styles.typeRegular,
  playoff: styles.typePlayoff,
};

export interface CalendarGameListItemTeam {
  code: string;
  logo: string | null;
  logoDark?: string | null;
  logoLight?: string | null;
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
  scorePresentation?: ScorePresentation;
  /** Renders a left accent stripe coloured by game type. */
  gameType?: GameType;
  href?: string;
  tooltip?: string;
  topLabel?: ReactNode;
  centerLabel?: ReactNode;
  bottomLabel?: ReactNode;
  live?: boolean;
  dragging?: boolean;
  draggable?: boolean;
  style?: CSSProperties;
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
    status === 'missing' ? styles.scoreMissing : '',
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
  scorePresentation = 'boxed',
  gameType,
  href,
  tooltip,
  topLabel,
  centerLabel,
  bottomLabel,
  live = false,
  dragging = false,
  draggable = false,
  style,
  className,
  onDragStart,
  onDragEnd,
  children,
}: Props) => {
  const scoreVisible = showScore && awayTeam.score != null && homeTeam.score != null;
  const itemClassName = [
    styles.item,
    scorePresentation === 'plain' ? styles.itemPlainScores : '',
    gameType ? GAME_TYPE_CLASS[gameType] : '',
    live ? styles.itemLive : '',
    dragging ? styles.itemDragging : '',
    draggable ? styles.itemDraggable : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      {draggable && (
        <span
          className={styles.dragHandle}
          aria-hidden="true"
        >
          <FontAwesomeIcon icon={faGripLinesVertical} />
        </span>
      )}
      {topLabel != null && <div className={styles.topLabel}>{topLabel}</div>}
      <div className={styles.matchup}>
        <span className={logoClassName(awayTeam.dimmed, 'away')}>
          <TeamLogo
            logo={awayTeam.logo}
            logoDark={awayTeam.logoDark}
            logoLight={awayTeam.logoLight}
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
            logoDark={homeTeam.logoDark}
            logoLight={homeTeam.logoLight}
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
      {children}
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
          style={style}
        >
          {content}
        </Link>
      </Tooltip>
    );
  }

  return (
    <div
      className={itemClassName}
      style={style}
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
    >
      {content}
    </div>
  );
};

export default CalendarGameListItem;
