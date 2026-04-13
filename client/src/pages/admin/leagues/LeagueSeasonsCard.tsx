import ActionOverlay from '../../../components/ActionOverlay/ActionOverlay';
import Button from '../../../components/Button/Button';
import Card from '../../../components/Card/Card';
import { type LeagueSeasonRecord } from '../../../hooks/useLeagueDetails';
import styles from './LeagueDetails.module.scss';

interface Props {
  seasons: LeagueSeasonRecord[];
  loading: boolean;
  busy: string | null;
  onAdd: () => void;
  onEdit: (season: LeagueSeasonRecord) => void;
  onDelete: (season: LeagueSeasonRecord) => void;
  onView: (season: LeagueSeasonRecord) => void;
  className?: string;
}

const formatDate = (d: string | null) =>
  d
    ? new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(new Date(d))
    : '?';

const LeagueSeasonsCard = (props: Props) => {
  const { seasons, loading, busy, onAdd, onEdit, onDelete, onView, className } = props;
  return (
    <Card
      className={className}
      title="Seasons"
      action={
        <Button
          icon="add"
          size="sm"
          onClick={onAdd}
        >
          Create Season
        </Button>
      }
    >
      {loading ? (
        <p className={styles.teamsEmpty}>Loading…</p>
      ) : seasons.length === 0 ? (
        <p className={styles.teamsEmpty}>No seasons for this league yet.</p>
      ) : (
        <ul
          className={`${styles.seasonList} ${seasons.length > 5 ? styles.seasonListLimited : ''}`}
        >
          {seasons.map((s) => (
            <li
              key={s.id}
              className={styles.seasonListItem}
            >
              <span className={styles.seasonListName}>{s.name}</span>
              <span className={styles.seasonListDates}>
                {s.start_date || s.end_date
                  ? [s.start_date, s.end_date].map(formatDate).join(' – ')
                  : 'No dates'}
              </span>
              <ActionOverlay className={styles.seasonActions}>
                <Button
                  variant="outlined"
                  intent="neutral"
                  icon="open_in_new"
                  size="sm"
                  tooltip="View season"
                  onClick={() => onView(s)}
                />
                <Button
                  variant="outlined"
                  intent="accent"
                  icon="edit"
                  size="sm"
                  disabled={busy === s.id}
                  tooltip="Edit"
                  onClick={() => onEdit(s)}
                />
                <Button
                  variant="outlined"
                  intent="danger"
                  icon="delete"
                  size="sm"
                  disabled={busy === s.id}
                  tooltip="Delete"
                  onClick={() => onDelete(s)}
                />
              </ActionOverlay>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

export default LeagueSeasonsCard;
