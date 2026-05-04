import { useNavigate } from 'react-router-dom';
import Card from '@/components/Card/Card';
import type { GameRecord, PreviousMeeting } from '@/hooks/useGames';
import { DATE_FMT_SHORT } from '../formatUtils';
import styles from './PreviousMeetingsCard.module.scss';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  game: GameRecord;
  leagueId: string;
  seasonId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type TeamMeta = { code: string; logo: string | null; primary: string; text: string };

const TeamLogo = ({ team }: { team: TeamMeta }) =>
  team.logo ? (
    <img src={team.logo} alt={team.code} className={styles.prevMeetingLogo} />
  ) : (
    <span
      className={styles.prevMeetingLogoPlaceholder}
      style={{ background: team.primary, color: team.text }}
    >
      {team.code?.slice(0, 3)}
    </span>
  );

// ── Component ─────────────────────────────────────────────────────────────────

const PreviousMeetingsCard = ({ game, leagueId, seasonId }: Props) => {
  const navigate = useNavigate();
  const meetings = game.previous_meetings;

  if (!meetings || meetings.length === 0) return null;

  const awayTeam: TeamMeta = {
    code: game.away_team_code,
    logo: game.away_team_logo,
    primary: game.away_team_primary_color,
    text: game.away_team_text_color,
  };
  const homeTeam: TeamMeta = {
    code: game.home_team_code,
    logo: game.home_team_logo,
    primary: game.home_team_primary_color,
    text: game.home_team_text_color,
  };

  return (
    <Card title="Previous Meetings">
      <div className={styles.prevMeetingsRows}>
        {meetings.map((pm: PreviousMeeting) => {
          const isOT = pm.overtime_periods != null && pm.overtime_periods > 0;
          const isSO = pm.shootout;
          const suffix = isSO ? '(SO)' : isOT ? '(OT)' : null;
          const homeWon = pm.home_score > pm.away_score;

          // Perspective: always show the current away team on the left
          const leftTeam = pm.current_home_was_home ? awayTeam : homeTeam;
          const rightTeam = pm.current_home_was_home ? homeTeam : awayTeam;

          return (
            <div
              key={pm.game_id}
              className={styles.prevMeetingRow}
              role="button"
              tabIndex={0}
              onClick={() =>
                navigate(`/admin/leagues/${leagueId}/seasons/${seasonId}/games/${pm.game_id}`)
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ')
                  navigate(`/admin/leagues/${leagueId}/seasons/${seasonId}/games/${pm.game_id}`);
              }}
            >
              {pm.scheduled_at && (
                <span className={styles.prevMeetingDate}>
                  {DATE_FMT_SHORT.format(new Date(pm.scheduled_at))}
                </span>
              )}
              <span className={styles.prevMeetingTeam}>
                <TeamLogo team={leftTeam} />
                <span className={styles.prevMeetingCode}>{leftTeam.code}</span>
              </span>
              <span className={styles.prevMeetingScore}>
                <span className={homeWon ? styles.prevMeetingScoreDim : styles.prevMeetingScoreBright}>
                  {pm.away_score}
                </span>
                <span className={styles.prevMeetingScoreSep}>–</span>
                <span className={homeWon ? styles.prevMeetingScoreBright : styles.prevMeetingScoreDim}>
                  {pm.home_score}
                </span>
                {suffix && <span className={styles.prevMeetingSuffix}>{suffix}</span>}
              </span>
              <span className={`${styles.prevMeetingTeam} ${styles.prevMeetingTeamRight}`}>
                <span className={styles.prevMeetingCode}>{rightTeam.code}</span>
                <TeamLogo team={rightTeam} />
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default PreviousMeetingsCard;
