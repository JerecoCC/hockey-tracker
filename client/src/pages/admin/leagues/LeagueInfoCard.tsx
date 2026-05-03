import Card from '@/components/Card/Card';
import EntityHeader from '@/components/EntityHeader/EntityHeader';
import { type LeagueFullRecord } from '@/hooks/useLeagueDetails';
import { type PlayoffFormatRule } from '@/hooks/useLeagues';
import styles from './LeagueDetails.module.scss';

const normalizeDescription = (html: string | null | undefined): string | null => {
  if (!html || html === '<p></p>') return null;
  return html;
};

const SCOPE_LABEL: Record<PlayoffFormatRule['scope'], string> = {
  league: 'league-wide',
  conference: 'per conference',
  division: 'per division',
};

const METHOD_LABEL: Record<PlayoffFormatRule['method'], string> = {
  top: 'top',
  wildcard: 'wildcard',
};

const formatRuleText = (r: PlayoffFormatRule): string =>
  `${METHOD_LABEL[r.method] === 'top' ? `Top ${r.count}` : `${r.count} wildcard`} ${SCOPE_LABEL[r.scope]}`;

interface Props {
  league: LeagueFullRecord;
  onEdit: () => void;
  className?: string;
}

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
      <div className={styles.infoItem}>
        <span className={styles.infoLabel}>Playoff Series Format</span>
        <span className={styles.infoValue}>Best of {league.best_of_playoff}</span>
      </div>
      <div className={styles.infoItem}>
        <span className={styles.infoLabel}>Shootout Rounds</span>
        <span className={styles.infoValue}>{league.best_of_shootout} rounds</span>
      </div>
      <div className={styles.infoItem}>
        <span className={styles.infoLabel}>Scoring System</span>
        <span className={styles.infoValue}>{league.scoring_system}</span>
      </div>
      <div className={`${styles.infoItem} ${styles.infoItemFull}`}>
        <span className={styles.infoLabel}>Playoff Qualification</span>
        {league.playoff_format && league.playoff_format.length > 0 ? (
          <ol className={styles.playoffFormatList}>
            {league.playoff_format.map((r, i) => (
              <li
                key={i}
                className={styles.infoValue}
              >
                {formatRuleText(r)}
              </li>
            ))}
          </ol>
        ) : (
          <span className={styles.infoValueMuted}>Not configured — managed manually</span>
        )}
      </div>
      <div className={`${styles.infoItem} ${styles.infoItemFull}`}>
        <span className={styles.infoLabel}>Description</span>
        {normalizeDescription(league.description) ? (
          <div
            className={styles.infoValue}
            dangerouslySetInnerHTML={{ __html: league.description! }}
          />
        ) : (
          <span className={styles.infoValueMuted}>No description</span>
        )}
      </div>
    </div>
  </Card>
);

export default LeagueInfoCard;
