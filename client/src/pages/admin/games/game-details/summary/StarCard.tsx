import Icon from '@jerecocc/tracker-ui/components/Icon/Icon';
import PlayerCard from '@/shared/PlayerCard/PlayerCard';
import StatItem from '@jerecocc/tracker-ui/components/StatItem/StatItem';
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
  teamLogoDark?: string | null;
  teamLogoLight?: string | null;
  teamName?: string;
  stats: { goals: number; assists: number };
  goalieStatRecord?: { shots_against: number; saves: number } | null;
  showPlayerDataStatus?: boolean;
}

interface StarStat {
  label: string;
  value: number | string;
}

const formatSavePct = (saves: number | null | undefined, shotsAgainst: number | null | undefined) =>
  saves != null && shotsAgainst != null && shotsAgainst > 0
    ? (saves / shotsAgainst).toFixed(3).replace(/^0/, '')
    : '—';

const StarStats = ({ stats }: { stats: StarStat[] }) => (
  <div className={styles.starStatsGrid}>
    {stats.map((stat) => (
      <StatItem
        key={stat.label}
        as="span"
        label={stat.label}
        value={stat.value}
      />
    ))}
  </div>
);

// ── Component ─────────────────────────────────────────────────────────────────

const StarCard = ({
  starCount,
  player,
  playerHref,
  primaryColor,
  textColor,
  teamCode,
  teamLogo,
  teamLogoDark,
  teamLogoLight,
  stats,
  goalieStatRecord,
  showPlayerDataStatus = false,
}: Props) => {
  const nameLabel = `${player.first_name} ${player.last_name}`;
  const initials = `${player.first_name[0]}${player.last_name[0]}`;
  const starIcons = (
    <span className={styles.starIcons}>
      {Array.from({ length: starCount }).map((_, i) => (
        <Icon
          key={i}
          name="stars"
        />
      ))}
    </span>
  );
  const statItems =
    player.position === 'G'
      ? [
          { label: 'SA', value: goalieStatRecord?.shots_against ?? '—' },
          { label: 'SV', value: goalieStatRecord?.saves ?? '—' },
          {
            label: 'SV%',
            value: formatSavePct(goalieStatRecord?.saves, goalieStatRecord?.shots_against),
          },
        ]
      : [
          { label: 'G', value: stats.goals },
          { label: 'A', value: stats.assists },
          { label: 'P', value: stats.goals + stats.assists },
        ];

  return (
    <div className={styles.starItem}>
      <PlayerCard
        compact
        className={styles.starPlayerCard}
        topContent={starIcons}
        name={nameLabel}
        nameSuffix={playerDataComplete(
          player.date_of_birth,
          player.start_date,
          player.acquisition_type,
          showPlayerDataStatus,
        )}
        photo={player.photo}
        initials={initials}
        href={playerHref}
        teamLogo={teamLogo}
        teamLogoDark={teamLogoDark}
        teamLogoLight={teamLogoLight}
        teamCode={teamCode}
        teamPrimaryColor={primaryColor}
        teamTextColor={textColor}
        jerseyNumber={player.jersey_number}
        position={player.position}
        imageSize={72}
        footer={<StarStats stats={statItems} />}
      />
    </div>
  );
};

export default StarCard;
