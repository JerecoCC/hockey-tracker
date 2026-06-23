import { useNavigate } from 'react-router-dom';
import Card from '@/components/Card/Card';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
import type { GameRecord, PreviousMeeting } from '@/hooks/useGames';
import styles from './SeasonSeriesCard.module.scss';
import { PERIOD_SUFFIX } from '../constants';
import { formatScheduledDate } from '../formatUtils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  game: GameRecord;
  gameHrefBuilder: (gameId: string) => string;
  liveAwayScore: number;
  liveHomeScore: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DATE_FMT_SERIES = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'America/New_York',
});

const formatStatusLabel = (status: GameRecord['status'], suffix: string | null) => {
  const base = status.replace(/_/g, ' ').toUpperCase();
  return suffix ? `${base}${suffix}` : base;
};

const sortableTime = (value: string | null | undefined) => {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
};

const compareMeetings = (a: PreviousMeeting, b: PreviousMeeting) => {
  const scheduledDiff = sortableTime(a.scheduled_at) - sortableTime(b.scheduled_at);
  if (scheduledDiff !== 0) return scheduledDiff;
  return sortableTime(a.created_at) - sortableTime(b.created_at);
};

// ── Component ─────────────────────────────────────────────────────────────────

const SeasonSeriesCard = ({ game, gameHrefBuilder, liveAwayScore, liveHomeScore }: Props) => {
  const navigate = useNavigate();
  const meetings = game.previous_meetings ?? [];

  const currentMeeting: PreviousMeeting = {
    game_id: game.id,
    scheduled_at: game.scheduled_at,
    created_at: game.created_at,
    status: game.status,
    current_home_was_home: true,
    home_team: game.home_team,
    away_team: game.away_team,
    home_score: liveHomeScore,
    away_score: liveAwayScore,
    overtime_periods: game.overtime_periods,
    shootout: game.shootout,
  };

  const seriesMeetings = [...meetings, currentMeeting].sort(compareMeetings);

  if (seriesMeetings.length === 0) return null;

  const completedMeetings = seriesMeetings.filter((meeting) => meeting.status === 'final');

  // Tally wins from the perspective of current home/away teams
  let homeWins = 0;
  let awayWins = 0;
  completedMeetings.forEach((pm) => {
    const historicalHomeWon = pm.home_score > pm.away_score;
    if (pm.home_team.id === game.home_team.id) {
      if (historicalHomeWon) homeWins++;
      else awayWins++;
    } else if (pm.home_team.id === game.away_team.id) {
      if (historicalHomeWon) awayWins++;
      else homeWins++;
    }
  });

  const seriesLabel =
    homeWins > awayWins
      ? `${game.home_team.code} leads ${homeWins}–${awayWins}`
      : awayWins > homeWins
        ? `${game.away_team.code} leads ${awayWins}–${homeWins}`
        : `Tied ${homeWins}–${awayWins}`;

  const cardTitle = game.game_type === 'playoff' ? 'Playoff Series' : 'Season Series';

  return (
    <Card
      title={cardTitle}
      action={seriesLabel ? <span className={styles.seriesLabel}>{seriesLabel}</span> : undefined}
    >
      <div className={styles.prevMeetingsRows}>
        {seriesMeetings.map((pm: PreviousMeeting) => {
          const isCurrentGame = pm.game_id === game.id;
          const status = pm.status;
          const showScores = status === 'final' || (isCurrentGame && status === 'in_progress');
          const leftNumericScore = pm.away_score;
          const rightNumericScore = pm.home_score;
          const leftScore = showScores ? leftNumericScore : '-';
          const rightScore = showScores ? rightNumericScore : '-';
          const leftLost = !showScores || leftNumericScore < rightNumericScore;
          const rightLost = !showScores || rightNumericScore < leftNumericScore;
          const suffix = pm.shootout
            ? PERIOD_SUFFIX.SHOOTOUT
            : (pm.overtime_periods ?? 0) > 0
              ? PERIOD_SUFFIX.OVERTIME
              : null;

          return (
            <div
              key={pm.game_id}
              className={[styles.prevMeetingRow, !isCurrentGame && styles.prevMeetingRowClickable]
                .filter(Boolean)
                .join(' ')}
              role={isCurrentGame ? undefined : 'button'}
              tabIndex={isCurrentGame ? undefined : 0}
              onClick={isCurrentGame ? undefined : () => navigate(gameHrefBuilder(pm.game_id))}
              onKeyDown={
                isCurrentGame
                  ? undefined
                  : (e) => {
                      if (e.key === 'Enter' || e.key === ' ') navigate(gameHrefBuilder(pm.game_id));
                    }
              }
            >
              <div
                className={[styles.teamInfo, leftLost && styles.teamInfoDim]
                  .filter(Boolean)
                  .join(' ')}
              >
                <TeamLogo
                  logo={pm.away_team.logo}
                  code={pm.away_team.code}
                  primaryColor={pm.away_team.primary_color}
                  textColor={pm.away_team.text_color}
                  size={24}
                  shape={pm.away_team.logo ? 'square' : 'circle'}
                />
                <span className={styles.teamCode}>{pm.away_team.code}</span>
                <span className={styles.teamScore}>{leftScore}</span>
              </div>
              <div
                className={[styles.teamInfo, rightLost && styles.teamInfoDim]
                  .filter(Boolean)
                  .join(' ')}
              >
                <TeamLogo
                  logo={pm.home_team.logo}
                  code={pm.home_team.code}
                  primaryColor={pm.home_team.primary_color}
                  textColor={pm.home_team.text_color}
                  size={24}
                  shape={pm.home_team.logo ? 'square' : 'circle'}
                />
                <span className={styles.teamCode}>{pm.home_team.code}</span>
                <span className={styles.teamScore}>{rightScore}</span>
              </div>
              <div className={styles.gameInfo}>
                <span className={styles.gameStatus}>{formatStatusLabel(status, suffix)}</span>
                {pm.scheduled_at && (
                  <span className={styles.prevMeetingDate}>
                    {formatScheduledDate(pm.scheduled_at, DATE_FMT_SERIES)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default SeasonSeriesCard;
