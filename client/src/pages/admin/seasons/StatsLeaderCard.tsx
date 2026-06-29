import PlayerCard from '@/components/PlayerCard/PlayerCard';
import styles from './StatsLeaderCard.module.scss';

export interface StatsLeaderItem {
  player_id: string;
  team_id?: string | null;
  first_name: string;
  last_name: string;
  photo: string | null;
  team_primary_color: string | null;
  team_text_color: string | null;
  team_logo: string | null;
  team_code: string | null;
  jersey_number: number | null;
  position?: string | null;
}

interface Props<T extends StatsLeaderItem> {
  items: T[];
  featuredIdx: number;
  onHover: (idx: number) => void;
  tieRanks: string[];
  statLabel: string;
  getFeaturedStat: (item: T) => React.ReactNode;
  getRowStat: (item: T) => React.ReactNode;
  onSelectItem?: (item: T) => void;
  onAllLeaders?: () => void;
}

function StatsLeaderCard<T extends StatsLeaderItem>({
  items,
  featuredIdx,
  onHover,
  tieRanks,
  statLabel,
  getFeaturedStat,
  getRowStat,
  onSelectItem,
  onAllLeaders,
}: Props<T>) {
  if (items.length === 0) return null;

  const featured = items[featuredIdx];
  const featuredName = `${featured.first_name} ${featured.last_name}`;
  const featuredInitials = `${featured.first_name.charAt(0)}${featured.last_name.charAt(0)}`;

  return (
    <div className={styles.layout}>
      <PlayerCard
        name={featuredName}
        photo={featured.photo}
        initials={featuredInitials}
        teamLogo={featured.team_logo}
        teamCode={featured.team_code}
        teamPrimaryColor={featured.team_primary_color}
        teamTextColor={featured.team_text_color}
        jerseyNumber={featured.jersey_number}
        position={featured.position}
        onClick={onSelectItem ? () => onSelectItem(featured) : undefined}
        className={styles.featuredCard}
        footer={
          <div className={styles.statBlock}>
            <span className={styles.statLabel}>{statLabel}</span>
            <span className={styles.statValue}>{getFeaturedStat(featured)}</span>
          </div>
        }
      />

      <div>
        {items.map((item, i) => {
          const className = [
            styles.entry,
            i === featuredIdx ? styles.entryActive : '',
            onSelectItem ? styles.entryButton : '',
          ]
            .filter(Boolean)
            .join(' ');

          return onSelectItem ? (
            <button
              key={item.player_id}
              type="button"
              className={className}
              onMouseEnter={() => onHover(i)}
              onFocus={() => onHover(i)}
              onClick={() => onSelectItem(item)}
            >
              <span className={styles.rank}>{tieRanks[i]}.</span>
              <span className={styles.entryName}>
                {item.first_name} {item.last_name}
              </span>
              <span className={styles.entryStat}>{getRowStat(item)}</span>
            </button>
          ) : (
            <div
              key={item.player_id}
              className={className}
              onMouseEnter={() => onHover(i)}
            >
              <span className={styles.rank}>{tieRanks[i]}.</span>
              <span className={styles.entryName}>
                {item.first_name} {item.last_name}
              </span>
              <span className={styles.entryStat}>{getRowStat(item)}</span>
            </div>
          );
        })}

        {onAllLeaders && (
          <div className={styles.allLeadersRow}>
            <button
              className={styles.allLeadersLink}
              onClick={onAllLeaders}
            >
              All Leaders
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default StatsLeaderCard;
