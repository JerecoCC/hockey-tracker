import React from 'react';
import { useNavigate } from 'react-router-dom';
import Badge from '@/components/Badge/Badge';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import type { GameRecord, GameStatus } from '@/hooks/useGames';
import styles from './ScoreboardCard.module.scss';

// ── Constants ─────────────────────────────────────────────────────────────────

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const STATUS_LABEL: Record<GameStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  final: 'Final',
  postponed: 'Postponed',
  cancelled: 'Cancelled',
};

const STATUS_INTENT: Record<GameStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  scheduled: 'info',
  in_progress: 'warning',
  final: 'success',
  postponed: 'warning',
  cancelled: 'danger',
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  game: GameRecord;
  isFinal: boolean;
  isInProgress: boolean;
  liveAwayScore: number;
  liveHomeScore: number;
  overtimeSuffix: string;
  /** When omitted, team logo buttons don't navigate anywhere (read-only user view). */
  leagueId?: string;
  onGenerateImage?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

const ScoreboardCard = ({
  game,
  isFinal,
  isInProgress,
  liveAwayScore,
  liveHomeScore,
  overtimeSuffix,
  leagueId,
  onGenerateImage,
}: Props) => {
  const navigate = useNavigate();

  return (
    <Card
      className={styles.scoreboardCard}
      style={{ padding: 0 }}
    >
      <div className={styles.scoreboard}>
        {/* ── Away side ── */}
        <div
          className={[
            styles.teamSide,
            isFinal && liveAwayScore < liveHomeScore ? styles.teamSideLoser : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={
            {
              '--team-primary': game.away_team_primary_color,
              '--team-text': game.away_team_text_color,
            } as React.CSSProperties
          }
        >
          <div className={styles.teamStripe}>
            <div
              className={styles.teamStripePrimary}
              style={{ background: game.away_team_primary_color }}
            />
            <div
              className={styles.teamStripeSecondary}
              style={{ background: game.away_team_text_color }}
            />
            <div
              className={styles.teamStripeSecondary2}
              style={{ background: game.away_team_text_color }}
            />
          </div>
          <button
            type="button"
            className={styles.teamLogoBtn}
            onClick={
              leagueId
                ? () => navigate(`/admin/leagues/${leagueId}/teams/${game.away_team_id}`)
                : undefined
            }
          >
            {game.away_team_logo ? (
              <img
                src={game.away_team_logo}
                alt={game.away_team_code}
                className={styles.teamLogo}
              />
            ) : (
              <span className={styles.teamLogoPlaceholder}>{game.away_team_code.slice(0, 3)}</span>
            )}
            <div className={styles.teamInfo}>
              <span className={styles.teamFullName}>{game.away_team_name}</span>
              <span className={styles.teamSubInfo}>{game.away_team_code}</span>
            </div>
          </button>
          {/* Right stripe — stacked mode only */}
          <div className={`${styles.teamStripe} ${styles.teamStripeRight}`}>
            <div
              className={styles.teamStripePrimary}
              style={{ background: game.away_team_primary_color }}
            />
            <div
              className={styles.teamStripeSecondary}
              style={{ background: game.away_team_text_color }}
            />
            <div
              className={styles.teamStripeSecondary2}
              style={{ background: game.away_team_text_color }}
            />
          </div>
        </div>

        {/* ── Center: score + status ── */}
        <div className={styles.scoreCenter}>
          {(isFinal || isInProgress) && (
            <span
              className={[
                styles.scoreNumber,
                isFinal && liveAwayScore < liveHomeScore ? styles.scoreNumberLoser : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {liveAwayScore}
            </span>
          )}
          <div className={styles.scoreBlock}>
            {isFinal ? (
              <Badge
                label={`Final${overtimeSuffix}`}
                intent="success"
              />
            ) : (
              <Badge
                label={STATUS_LABEL[game.status]}
                intent={STATUS_INTENT[game.status]}
              />
            )}
            {game.scheduled_at && (
              <span className={styles.scoreDate}>
                {DATE_FMT.format(new Date(game.scheduled_at))}
              </span>
            )}
            {isFinal && onGenerateImage && (
              <Button
                variant="ghost"
                intent="neutral"
                icon="download"
                size="sm"
                tooltip="Download score card"
                onClick={onGenerateImage}
              />
            )}
          </div>
          {(isFinal || isInProgress) && (
            <span
              className={[
                styles.scoreNumber,
                isFinal && liveHomeScore < liveAwayScore ? styles.scoreNumberLoser : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {liveHomeScore}
            </span>
          )}
        </div>

        {/* ── Home side ── */}
        <div
          className={[
            styles.teamSide,
            styles.teamSideHome,
            isFinal && liveHomeScore < liveAwayScore ? styles.teamSideLoser : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={
            {
              '--team-primary': game.home_team_primary_color,
              '--team-text': game.home_team_text_color,
            } as React.CSSProperties
          }
        >
          <div className={`${styles.teamStripe} ${styles.teamStripeHome}`}>
            <div
              className={styles.teamStripePrimary}
              style={{ background: game.home_team_primary_color }}
            />
            <div
              className={styles.teamStripeSecondary}
              style={{ background: game.home_team_text_color }}
            />
            <div
              className={styles.teamStripeSecondary2}
              style={{ background: game.home_team_text_color }}
            />
          </div>
          <button
            type="button"
            className={`${styles.teamLogoBtn} ${styles.teamLogoBtnHome}`}
            onClick={
              leagueId
                ? () => navigate(`/admin/leagues/${leagueId}/teams/${game.home_team_id}`)
                : undefined
            }
          >
            <div className={`${styles.teamInfo} ${styles.teamInfoHome}`}>
              <span className={styles.teamFullName}>{game.home_team_name}</span>
              <span className={styles.teamSubInfo}>{game.home_team_code}</span>
            </div>
            {game.home_team_logo ? (
              <img
                src={game.home_team_logo}
                alt={game.home_team_code}
                className={styles.teamLogo}
              />
            ) : (
              <span className={styles.teamLogoPlaceholder}>{game.home_team_code.slice(0, 3)}</span>
            )}
          </button>
          {/* Right stripe — stacked mode only */}
          <div className={`${styles.teamStripe} ${styles.teamStripeRight}`}>
            <div
              className={styles.teamStripePrimary}
              style={{ background: game.home_team_primary_color }}
            />
            <div
              className={styles.teamStripeSecondary}
              style={{ background: game.home_team_text_color }}
            />
            <div
              className={styles.teamStripeSecondary2}
              style={{ background: game.home_team_text_color }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ScoreboardCard;
