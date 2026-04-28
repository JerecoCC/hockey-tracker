import styles from '@/pages/admin/seasons/StatsLeaderCard.module.scss';

export interface StatsLeaderItem {
  player_id: string;
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
  onAllLeaders,
}: Props<T>) {
  if (items.length === 0) return null;

  const featured = items[featuredIdx];

  return (
    <div className={styles.layout}>
      {/* ── Featured player ── */}
      <div className={styles.featured}>
        {featured.photo ? (
          <img src={featured.photo} alt="" className={styles.photo} />
        ) : (
          <span
            className={styles.photoPH}
            style={{
              background: featured.team_primary_color ?? undefined,
              color: featured.team_text_color ?? undefined,
            }}
          >
            {featured.first_name.charAt(0)}
            {featured.last_name.charAt(0)}
          </span>
        )}

        <span className={styles.name}>
          {featured.first_name}
          <br />
          {featured.last_name}
        </span>

        <div className={styles.meta}>
          {featured.team_logo && (
            <img src={featured.team_logo} alt="" className={styles.metaLogo} />
          )}
          {featured.team_code && <span>{featured.team_code}</span>}
          {featured.jersey_number != null && <span>• #{featured.jersey_number}</span>}
          {featured.position && <span>• {featured.position}</span>}
        </div>

        <span className={styles.statLabel}>{statLabel}</span>
        <span className={styles.statValue}>{getFeaturedStat(featured)}</span>
      </div>

      {/* ── Ranked list ── */}
      <div>
        {items.map((item, i) => (
          <div
            key={item.player_id}
            className={[styles.entry, i === featuredIdx ? styles.entryActive : '']
              .filter(Boolean)
              .join(' ')}
            onMouseEnter={() => onHover(i)}
          >
            <span className={styles.rank}>{tieRanks[i]}.</span>
            <span className={styles.entryName}>
              {item.first_name} {item.last_name}
            </span>
            <span className={styles.entryStat}>{getRowStat(item)}</span>
          </div>
        ))}

        {onAllLeaders && (
          <div className={styles.allLeadersRow}>
            <button className={styles.allLeadersLink} onClick={onAllLeaders}>
              All Leaders
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default StatsLeaderCard;
