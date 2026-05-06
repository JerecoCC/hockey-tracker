import { Link } from 'react-router-dom';
import Icon from '@/components/Icon/Icon';
import type { GameRosterEntry } from '@/hooks/useGameRoster';
import styles from './ThreeStarsCard.module.scss';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  starCount: number;
  player: GameRosterEntry;
  leagueId: string;
  primaryColor: string;
  textColor: string;
  teamCode: string;
  stats: { goals: number; assists: number };
  goalieStatRecord?: { shots_against: number; saves: number } | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

const StarCard = ({
  starCount,
  player,
  leagueId,
  primaryColor,
  textColor,
  teamCode,
  stats,
  goalieStatRecord,
}: Props) => {
  const nameLabel = `${player.first_name} ${player.last_name}`;
  const subLabel = [
    player.jersey_number != null ? `#${player.jersey_number}` : null,
    teamCode,
    player.position ?? null,
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <div className={styles.starItem}>
      {player.photo ? (
        <img src={player.photo} alt="" className={styles.starPhoto} />
      ) : (
        <span
          className={styles.starPhotoPlaceholder}
          style={{ background: primaryColor, color: textColor }}
        >
          {player.first_name[0]}
          {player.last_name[0]}
        </span>
      )}

      <span className={styles.starIcons}>
        {Array.from({ length: starCount }).map((_, i) => (
          <Icon key={i} name="stars" />
        ))}
      </span>

      <Link
        to={`/admin/leagues/${leagueId}/teams/${player.team_id}/players/${player.player_id}`}
        className={`${styles.starName} ${styles.playerLink}`}
      >
        {nameLabel}
      </Link>

      <span className={styles.starTeam}>{subLabel}</span>

      {player.position === 'G' ? (
        goalieStatRecord ? (
          <span className={styles.starStats}>
            SA: {goalieStatRecord.shots_against} | SV: {goalieStatRecord.saves}
          </span>
        ) : null
      ) : (
        <span className={styles.starStats}>
          G: {stats.goals} | A: {stats.assists}
        </span>
      )}
    </div>
  );
};

export default StarCard;
