import Button from '../../../components/Button/Button';
import Card from '../../../components/Card/Card';
import ListItem, { type ListItemAction } from '../../../components/ListItem/ListItem';
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

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});
const parseLocal = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};
const formatDate = (d: string | null) => (d ? DATE_FMT.format(parseLocal(d)) : '—');
const formatEndDate = (d: string | null, isCurrent: boolean) =>
  d ? DATE_FMT.format(parseLocal(d)) : isCurrent ? 'Present' : '?';

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
            <ListItem
              key={s.id}
              hideImage
              name={s.name}
              subtitle={
                s.start_date || s.end_date
                  ? `${formatDate(s.start_date)} – ${formatEndDate(s.end_date, s.is_current)}`
                  : 'No dates'
              }
              rightContent={
                s.is_current ? { type: 'tag', label: 'Current', intent: 'success' } : undefined
              }
              actions={
                [
                  {
                    icon: 'open_in_new',
                    intent: 'neutral',
                    tooltip: 'View season',
                    onClick: () => onView(s),
                  },
                  {
                    icon: 'edit',
                    intent: 'accent',
                    tooltip: 'Edit',
                    disabled: busy === s.id,
                    onClick: () => onEdit(s),
                  },
                  {
                    icon: 'delete',
                    intent: 'danger',
                    tooltip: 'Delete',
                    disabled: busy === s.id,
                    onClick: () => onDelete(s),
                  },
                ] satisfies ListItemAction[]
              }
            />
          ))}
        </ul>
      )}
    </Card>
  );
};

export default LeagueSeasonsCard;
