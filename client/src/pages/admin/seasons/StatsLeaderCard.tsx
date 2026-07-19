import Card from '@jerecocc/tracker-ui/components/Card/Card';
import Divider from '@jerecocc/tracker-ui/components/Divider/Divider';
import ListItem from '@jerecocc/tracker-ui/components/ListItem/ListItem';
import PlayerCard from '@/shared/PlayerCard/PlayerCard';
import Skeleton from '@jerecocc/tracker-ui/components/Skeleton/Skeleton';
import type { ReactNode } from 'react';
import ResponsiveList from '@/shared/ResponsiveList/ResponsiveList';
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
  team_logo_dark?: string | null;
  team_logo_light?: string | null;
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
  getFeaturedStat: (item: T) => ReactNode;
  getRowStat: (item: T) => ReactNode;
  onSelectItem?: (item: T) => void;
}

const getPlayerName = (item: StatsLeaderItem) => `${item.first_name} ${item.last_name}`;

const getPlayerInitials = (item: StatsLeaderItem) =>
  `${item.first_name.charAt(0)}${item.last_name.charAt(0)}`;

const TOP_LEADER_SKELETON_COUNT = 10;

export const StatsLeaderCardSkeleton = () => (
  <div className={styles.layout}>
    <div className={styles.previewColumn}>
      <Skeleton
        variant="card"
        className={[styles.featuredCard, styles.featuredCardSkeleton].join(' ')}
      />

      <Divider />

      <Skeleton
        variant="card"
        className={styles.statCardSkeleton}
      />
    </div>

    <ResponsiveList className={styles.leaderList}>
      {Array.from({ length: TOP_LEADER_SKELETON_COUNT }, (_, index) => (
        <li
          key={index}
          className={styles.leaderItemSkeleton}
        >
          <Skeleton
            variant="card"
            className={styles.leaderItemSkeletonSurface}
          />
        </li>
      ))}
    </ResponsiveList>
  </div>
);

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
          teamLogoDark={featured.team_logo_dark}
          teamLogoLight={featured.team_logo_light}
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

      <ResponsiveList className={styles.leaderList}>
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
                    orientation="vertical"
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
      </ResponsiveList>
    </div>
  );
}

export default StatsLeaderCard;
