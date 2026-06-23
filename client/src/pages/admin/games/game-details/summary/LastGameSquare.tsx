import TeamCalendarGameCard from '@/components/TeamCalendarGameCard/TeamCalendarGameCard';
import type { LastFiveGame } from '@/hooks/useGames';
import { DATE_FMT_SHORT, formatScheduledDate } from '../formatUtils';
import { PERIOD_PAREN_SUFFIX } from '../constants';

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
  const suffix = isSO
    ? PERIOD_PAREN_SUFFIX.SHOOTOUT
    : isOT
      ? PERIOD_PAREN_SUFFIX.OVERTIME
      : null;

  const detail = `${lg.result} ${lg.away_score} - ${lg.home_score}${suffix ? ` ${suffix}` : ''}`;
  const opponentName = lg.opponent_name ?? lg.opponent_code;

  return (
    <TeamCalendarGameCard
      variant={lg.is_home ? 'home' : 'away'}
      opponent={{
        name: opponentName,
        code: lg.opponent_code,
        logo: lg.opponent_logo,
        logoDark: lg.opponent_logo_dark,
        logoLight: lg.opponent_logo_light,
        primaryColor: teamPrimary,
        textColor: teamText,
      }}
      detail={detail}
      topLabel={formatScheduledDate(lg.scheduled_at, DATE_FMT_SHORT) ?? undefined}
      topLabelAlign="center"
      topLabelWeight="normal"
      homePrimaryColor={teamPrimary}
      fillContainer
      ariaLabel={`Open game ${lg.is_home ? 'vs' : 'at'} ${opponentName}`}
      onOpen={() => onNavigate(lg.game_id)}
    />
  );
}
