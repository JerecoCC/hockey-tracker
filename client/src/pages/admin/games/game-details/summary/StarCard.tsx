import { Link } from 'react-router-dom';
import Icon from '@/components/Icon/Icon';
import PlayerAvatar from '@/components/PlayerAvatar/PlayerAvatar';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
import Tooltip from '@/components/Tooltip/Tooltip';
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
  teamLogo?: string | null;
  teamName?: string;
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
  teamLogo,
  teamName,
  stats,
  goalieStatRecord,
}: Props) => {
  const nameLabel = `${player.first_name} ${player.last_name}`;
  const subLabel = [
    player.jersey_number != null ? `#${player.jersey_number}` : null,
    player.position ?? null,
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <div className={styles.starItem}>
      <PlayerAvatar
        photo={player.photo}
        initials={`${player.first_name[0]}${player.last_name[0]}`}
        primaryColor={primaryColor}
        textColor={textColor}
        ringColor={primaryColor}
        size={80}
      />
      <span className={styles.starIcons}>
        {Array.from({ length: starCount }).map((_, i) => (
          <Icon
            key={i}
            name="stars"
          />
        ))}
      </span>

      <Link
        to={`/admin/leagues/${leagueId}/teams/${player.team_id}/players/${player.player_id}`}
        className={`${styles.starName} ${styles.playerLink}`}
      >
        {nameLabel}
      </Link>

      <span className={styles.starTeam}>
        <Tooltip text={teamName ?? teamCode}>
          <TeamLogo
            logo={teamLogo}
            code={teamCode}
            primaryColor={primaryColor}
            textColor={textColor}
            size={24}
          />
        </Tooltip>
        {' • '}
        {subLabel && <span>{subLabel}</span>}
      </span>

      {player.position === 'G' ? (
        goalieStatRecord ? (
          <span className={styles.starStats}>
            SA: {goalieStatRecord.shots_against} | SV: {goalieStatRecord.saves} | SV%:{' '}
            {(goalieStatRecord.saves / goalieStatRecord.shots_against).toFixed(3).replace(/^0/, '')}
          </span>
        ) : null
      ) : (
        <span className={styles.starStats}>
          G: {stats.goals} | A: {stats.assists} | P: {stats.goals + stats.assists}
        </span>
      )}
    </div>
  );
};

export default StarCard;
