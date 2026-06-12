import TeamLogo from '@/components/TeamLogo/TeamLogo';
import type { LastFiveGame } from '@/hooks/useGames';
import { DATE_FMT_SHORT } from '../formatUtils';
import { PERIOD_PAREN_SUFFIX } from '../constants';
import { lastFiveOpponentLogo } from '../gameUtils';
import styles from './LastFiveCard.module.scss';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  lg: LastFiveGame;
  onNavigate: (gameId: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LastGameList({ lg, onNavigate }: Props) {
  const isOT = lg.overtime_periods != null && lg.overtime_periods > 0;
  const isSO = lg.shootout;
  const suffix = isSO
    ? PERIOD_PAREN_SUFFIX.SHOOTOUT
    : isOT
      ? PERIOD_PAREN_SUFFIX.OVERTIME
      : null;
  const resultClass =
    lg.result === 'W'
      ? styles.lastFiveListResultW
      : lg.result === 'L'
        ? styles.lastFiveListResultL
        : styles.lastFiveListResultT;
  const opponentLogo = lastFiveOpponentLogo(lg);

  return (
    <div
      className={styles.lastFiveListRow}
      role="button"
      tabIndex={0}
      onClick={() => onNavigate(lg.game_id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onNavigate(lg.game_id);
      }}
    >
      <span className={`${styles.lastFiveListResult} ${resultClass}`}>{lg.result}</span>
      <span className={styles.lastFiveListLogo}>
        <TeamLogo
          logo={opponentLogo}
          code={lg.opponent_code}
          size={24}
          shape="square"
        />
      </span>
      <span className={styles.lastFiveListOpp}>
        {lg.is_home ? 'vs' : '@'} {lg.opponent_name ?? lg.opponent_code}
      </span>
      <span className={styles.lastFiveListScore}>
        {lg.away_score}–{lg.home_score}
        {suffix && <span className={styles.lastFiveListSuffix}>{suffix}</span>}
      </span>
      {lg.scheduled_at && (
        <span className={styles.lastFiveListDate}>
          {DATE_FMT_SHORT.format(new Date(lg.scheduled_at))}
        </span>
      )}
    </div>
  );
}
