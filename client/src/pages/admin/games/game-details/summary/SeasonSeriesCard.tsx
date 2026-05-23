import { useNavigate } from 'react-router-dom';
import Card from '@/components/Card/Card';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
import type { GameRecord, PreviousMeeting } from '@/hooks/useGames';
import styles from './SeasonSeriesCard.module.scss';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  game: GameRecord;
  gameHrefBuilder: (gameId: string) => string;
  liveAwayScore: number;
  liveHomeScore: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type TeamMeta = { code: string; logo: string | null; primary: string; text: string };

const DATE_FMT_SERIES = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
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

  const awayTeam: TeamMeta = {
    code: game.away_team.code,
    logo: game.away_team.logo,
    primary: game.away_team.primary_color,
    text: game.away_team.text_color,
  };
  const homeTeam: TeamMeta = {
    code: game.home_team.code,
    logo: game.home_team.logo,
    primary: game.home_team.primary_color,
    text: game.home_team.text_color,
  };

  const currentMeeting: PreviousMeeting = {
    game_id: game.id,
    scheduled_at: game.scheduled_at,
    created_at: game.created_at,
    status: game.status,
    current_home_was_home: true,
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
    if (pm.current_home_was_home) {
      // historical home team === current home team
      if (historicalHomeWon) homeWins++;
      else awayWins++;
    } else {
      // historical home team === current away team
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
          const leftNumericScore = pm.current_home_was_home ? pm.away_score : pm.home_score;
          const rightNumericScore = pm.current_home_was_home ? pm.home_score : pm.away_score;
          const leftScore = showScores ? leftNumericScore : '-';
          const rightScore = showScores ? rightNumericScore : '-';
          const leftLost = !showScores || leftNumericScore < rightNumericScore;
          const rightLost = !showScores || rightNumericScore < leftNumericScore;
          const suffix = pm.shootout ? '/SO' : (pm.overtime_periods ?? 0) > 0 ? '/OT' : null;

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
                  logo={awayTeam.logo}
                  code={awayTeam.code}
                  primaryColor={awayTeam.primary}
                  textColor={awayTeam.text}
                  size={32}
                  shape="circle"
                />
                <span className={styles.teamCode}>{awayTeam.code}</span>
                <span className={styles.teamScore}>{leftScore}</span>
              </div>
              <div
                className={[styles.teamInfo, rightLost && styles.teamInfoDim]
                  .filter(Boolean)
                  .join(' ')}
              >
                <TeamLogo
                  logo={homeTeam.logo}
                  code={homeTeam.code}
                  primaryColor={homeTeam.primary}
                  textColor={homeTeam.text}
                  size={32}
                  shape="circle"
                />
                <span className={styles.teamCode}>{homeTeam.code}</span>
                <span className={styles.teamScore}>{rightScore}</span>
              </div>
              <div className={styles.gameInfo}>
                <span className={styles.gameStatus}>{formatStatusLabel(status, suffix)}</span>
                {pm.scheduled_at && (
                  <span className={styles.prevMeetingDate}>
                    {DATE_FMT_SERIES.format(new Date(pm.scheduled_at))}
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
