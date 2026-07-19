import Card from '@jerecocc/tracker-ui/components/Card/Card';
import Divider from '@jerecocc/tracker-ui/components/Divider/Divider';
import EntityHeader from '@jerecocc/tracker-ui/components/EntityHeader/EntityHeader';
import InfoItem from '@jerecocc/tracker-ui/components/InfoItem/InfoItem';
import Skeleton from '@jerecocc/tracker-ui/components/Skeleton/Skeleton';
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

const cx = (...classes: Array<string | undefined>) => classes.filter(Boolean).join(' ');

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
          variant="text"
          className={styles.infoSkeletonTitle}
        />
        <Skeleton
          variant="text"
          className={styles.infoSkeletonCode}
        />
      </div>
      <div className={styles.infoSkeletonRightCol}>
        <Skeleton className={styles.infoSkeletonButton} />
        <div className={styles.infoSkeletonSwatches}>
          {['primary', 'text'].map((item) => (
            <span
              key={item}
              className={styles.infoSkeletonSwatch}
            >
              <Skeleton
                variant="text"
                className={styles.infoSkeletonSwatchLabel}
              />
              <Skeleton className={styles.infoSkeletonSwatchDot} />
            </span>
          ))}
        </div>
      </div>
    </div>

    <Divider />

    <div className={cx(styles.infoGrid, styles.infoCardGrid)}>
      {['playoff-format', 'shootout-rounds', 'goalie-minimum', 'scoring-system'].map((item) => (
        <div
          key={item}
          className={styles.infoSkeletonItem}
        >
          <Skeleton
            variant="text"
            className={styles.infoSkeletonLabel}
          />
          <Skeleton
            variant="text"
            className={styles.infoSkeletonValue}
          />
        </div>
      ))}
      <div className={[styles.infoSkeletonItem, styles.infoSkeletonItemFull].join(' ')}>
        <Skeleton
          variant="text"
          className={styles.infoSkeletonLabelLong}
        />
        <div className={styles.infoSkeletonDescription}>
          <Skeleton
            variant="text"
            className={styles.infoSkeletonDescriptionLine}
          />
          <Skeleton
            variant="text"
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
      editIconOnly
      showDivider={false}
    />

    <Divider />

    <div className={cx(styles.infoGrid, styles.infoCardGrid)}>
      <InfoItem
        label="Playoff Series Format"
        value={`Best of ${league.best_of_playoff}`}
      />
      <InfoItem
        label="Shootout Rounds"
        value={`${league.best_of_shootout} rounds`}
      />
      <InfoItem
        label="Goalie Min TOI"
        value={`${league.goalie_min_regular_minutes} min`}
      />
      <InfoItem
        label="Scoring System"
        value={league.scoring_system}
      />
      <InfoItem
        type="html"
        label="Description"
        value={league.description}
        muted="No description"
        fullWidth
      />
    </div>
  </Card>
);

export default LeagueInfoCard;
