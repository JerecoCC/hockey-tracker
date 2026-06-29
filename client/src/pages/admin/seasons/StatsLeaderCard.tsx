import Card from '@/components/Card/Card';
import Divider from '@/components/Divider/Divider';
import ListItem from '@/components/ListItem/ListItem';
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
}

const getPlayerName = (item: StatsLeaderItem) => `${item.first_name} ${item.last_name}`;

const getPlayerInitials = (item: StatsLeaderItem) =>
  `${item.first_name.charAt(0)}${item.last_name.charAt(0)}`;

function StatsLeaderCard<T extends StatsLeaderItem>({
  items,
  featuredIdx,
  onHover,
  tieRanks,
  statLabel,
  getFeaturedStat,
  getRowStat,
  onSelectItem,
}: Props<T>) {
  if (items.length === 0) return null;

  const featured = items[featuredIdx];
  const featuredName = getPlayerName(featured);
  const featuredInitials = getPlayerInitials(featured);

  return (
    <div className={styles.layout}>
      <div className={styles.previewColumn}>
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
        />

        <Divider />

        <Card
          variant="border"
          className={styles.statCard}
        >
          <div className={styles.statBlock}>
            <span className={styles.statLabel}>{statLabel}</span>
            <span className={styles.statValue}>{getFeaturedStat(featured)}</span>
          </div>
        </Card>
      </div>

      <ul className={styles.leaderList}>
        {items.map((item, i) => {
          const playerName = getPlayerName(item);
          const className = [styles.leaderItem, i === featuredIdx ? styles.leaderItemActive : '']
            .filter(Boolean)
            .join(' ');

          return (
            <ListItem
              key={item.player_id}
              className={className}
              size="compact"
              preTextContent={
                <span className={styles.rankSlot}>
                  <span className={styles.rankText}>{tieRanks[i]}</span>
                  <Divider
                    variant="vertical"
                    className={styles.rankDivider}
                  />
                </span>
              }
              name={playerName}
              rightContent={<span className={styles.entryStat}>{getRowStat(item)}</span>}
              onMouseEnter={() => onHover(i)}
              onFocus={() => onHover(i)}
              onClick={onSelectItem ? () => onSelectItem(item) : undefined}
              ariaLabel={onSelectItem ? `View ${playerName}` : undefined}
            />
          );
        })}
      </ul>
    </div>
  );
}

export default StatsLeaderCard;
