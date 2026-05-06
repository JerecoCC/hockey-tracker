import { type CSSProperties } from 'react';
import Tooltip from '@/components/Tooltip/Tooltip';
import type { LastFiveGame } from '@/hooks/useGames';
import { DATE_FMT_SHORT } from '../formatUtils';
import styles from './LastFiveCard.module.scss';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  lg: LastFiveGame;
  teamPrimary: string;
  teamText: string;
  onNavigate: (gameId: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LastGameSquare({ lg, teamPrimary, teamText, onNavigate }: Props) {
  const isOT = lg.overtime_periods != null && lg.overtime_periods > 0;
  const isSO = lg.shootout;
  const suffix = isSO ? '(SO)' : isOT ? '(OT)' : null;

  return (
    <div
      className={[styles.lastFiveSquare, lg.is_home ? styles.lastFiveSquareHome : '']
        .filter(Boolean)
        .join(' ')}
      style={lg.is_home ? ({ '--square-primary': teamPrimary } as CSSProperties) : undefined}
      role="button"
      tabIndex={0}
      onClick={() => onNavigate(lg.game_id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onNavigate(lg.game_id);
      }}
    >
      {lg.scheduled_at && (
        <span className={styles.lastFiveDate}>
          {DATE_FMT_SHORT.format(new Date(lg.scheduled_at))}
        </span>
      )}
      <Tooltip text={lg.opponent_name ?? lg.opponent_code}>
        <span
          className={`${styles.lastFiveLogoCircle} ${lg.is_home ? styles.lastFiveLogoCircleHome : styles.lastFiveLogoCircleAway}`}
          style={lg.is_home ? ({ '--circle-text': teamText } as CSSProperties) : undefined}
        >
          {lg.opponent_logo ? (
            <img
              src={lg.opponent_logo}
              alt={lg.opponent_code}
              className={styles.lastFiveOpponentLogo}
            />
          ) : (
            <span className={styles.lastFiveOpponentPlaceholder}>
              {lg.opponent_code?.slice(0, 3)}
            </span>
          )}
        </span>
      </Tooltip>
      <div className={styles.lastFiveScore}>
        <span className={styles.lastFiveResult}>{lg.result}</span>
        <span className={styles.lastFiveScoreText}>
          {lg.away_score}-{lg.home_score}
        </span>
        {suffix && <span className={styles.lastFiveOT}>{suffix}</span>}
      </div>
    </div>
  );
}
