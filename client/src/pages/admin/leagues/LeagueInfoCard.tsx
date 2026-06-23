import Card from '@/components/Card/Card';
import EntityHeader from '@/components/EntityHeader/EntityHeader';
import InfoItem from '@/components/InfoItem/InfoItem';
import Skeleton from '@/components/Skeleton/Skeleton';
import { type LeagueFullRecord } from '@/hooks/useLeagueDetails';
import styles from './LeagueDetails.module.scss';

interface Props {
  league: LeagueFullRecord;
  onEdit: () => void;
  className?: string;
}

interface SkeletonProps {
  className?: string;
}

export const LeagueInfoCardSkeleton = ({ className }: SkeletonProps) => (
  <Card
    className={className}
    role="status"
    aria-busy="true"
    aria-label="Loading league information"
  >
    <span className={styles.srOnly}>Loading league…</span>
    <div className={styles.infoSkeletonHeader}>
      <Skeleton className={styles.infoSkeletonLogo} />
      <div className={styles.infoSkeletonNameBlock}>
        <Skeleton
          type="text"
          className={styles.infoSkeletonTitle}
        />
        <Skeleton
          type="text"
          className={styles.infoSkeletonCode}
        />
      </div>
      <div className={styles.infoSkeletonRightCol}>
        <div className={styles.infoSkeletonSwatches}>
          {['primary', 'text'].map((item) => (
            <span
              key={item}
              className={styles.infoSkeletonSwatch}
            >
              <Skeleton className={styles.infoSkeletonSwatchDot} />
              <Skeleton
                type="text"
                className={styles.infoSkeletonSwatchLabel}
              />
            </span>
          ))}
        </div>
      </div>
    </div>

    <div className={styles.infoGrid}>
      {['playoff-format', 'shootout-rounds', 'scoring-system'].map((item) => (
        <div
          key={item}
          className={styles.infoSkeletonItem}
        >
          <Skeleton
            type="text"
            className={styles.infoSkeletonLabel}
          />
          <Skeleton
            type="text"
            className={styles.infoSkeletonValue}
          />
        </div>
      ))}
      <div className={[styles.infoSkeletonItem, styles.infoSkeletonItemFull].join(' ')}>
        <Skeleton
          type="text"
          className={styles.infoSkeletonLabelLong}
        />
        <div className={styles.infoSkeletonDescription}>
          <Skeleton
            type="text"
            className={styles.infoSkeletonDescriptionLine}
          />
          <Skeleton
            type="text"
            className={styles.infoSkeletonDescriptionLineShort}
          />
        </div>
      </div>
    </div>
  </Card>
);

const LeagueInfoCard = ({ league, onEdit, className }: Props) => (
  <Card className={className}>
    <EntityHeader
      logo={league.logo}
      name={league.name}
      code={league.code}
      primaryColor={league.primary_color}
      textColor={league.text_color}
      onEdit={onEdit}
      swatches={[
        { label: 'Primary', color: league.primary_color },
        { label: 'Text', color: league.text_color },
      ]}
    />

    <div className={styles.infoGrid}>
      <InfoItem
        label="Playoff Series Format"
        data={`Best of ${league.best_of_playoff}`}
      />
      <InfoItem
        label="Shootout Rounds"
        data={`${league.best_of_shootout} rounds`}
      />
      <InfoItem
        label="Scoring System"
        data={league.scoring_system}
      />
      <InfoItem
        type="html"
        label="Description"
        data={league.description}
        muted="No description"
        full
      />
    </div>
  </Card>
);

export default LeagueInfoCard;
