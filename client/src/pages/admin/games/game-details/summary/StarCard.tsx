import { Link } from 'react-router-dom';
import Icon from '@/components/Icon/Icon';
import PlayerAvatar from '@/components/PlayerAvatar/PlayerAvatar';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
import Tooltip from '@/components/Tooltip/Tooltip';
import type { GameRosterEntry } from '@/hooks/useGameRoster';
import styles from './ThreeStarsCard.module.scss';
import { playerDataComplete } from '../gameUtils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  starCount: number;
  player: GameRosterEntry;
  playerHref?: string;
  primaryColor: string;
  textColor: string;
  teamCode: string;
  teamLogo?: string | null;
  teamName?: string;
  stats: { goals: number; assists: number };
  goalieStatRecord?: { shots_against: number; saves: number } | null;
  showPlayerDataStatus?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

const StarCard = ({
  starCount,
  player,
  playerHref,
  primaryColor,
  textColor,
  teamCode,
  teamLogo,
  teamName,
  stats,
  goalieStatRecord,
  showPlayerDataStatus = false,
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

      {playerHref ? (
        <Link
          to={playerHref}
          className={`${styles.starName} ${styles.playerLink}`}
        >
          {nameLabel}
          {playerDataComplete(
            player.date_of_birth,
            player.start_date,
            player.acquisition_type,
            showPlayerDataStatus,
          )}
        </Link>
      ) : (
        <span className={styles.starName}>{nameLabel}</span>
      )}

      <span className={styles.starTeam}>
        <Tooltip text={teamName ?? teamCode}>
          <TeamLogo
            logo={teamLogo}
            code={teamCode}
            primaryColor={primaryColor}
            textColor={textColor}
            size={20}
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
