import Button from '@/components/Button/Button';
import ListItem, { type ListItemAction } from '@/components/ListItem/ListItem';
import Section from '@/components/Section/Section';
import { useLeagueDetailsContext } from './LeagueDetailsContext';
import styles from './LeagueDetails.module.scss';

interface Props {
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
const formatDate = (d: string | null) => (d ? DATE_FMT.format(parseLocal(d)) : 'Unknown');
const formatEndDate = (d: string | null, isCurrent: boolean) =>
  d ? DATE_FMT.format(parseLocal(d)) : isCurrent ? 'Present' : 'Unknown';

const formatSeasonSubtitle = (start: string | null, end: string | null, isCurrent: boolean) =>
  start || end ? `${formatDate(start)} - ${formatEndDate(end, isCurrent)}` : 'No dates';

const LeagueSeasonsCard = (props: Props) => {
  const { className } = props;
  const { seasons, busy, onAddSeason, onEditSeason, onDeleteSeason, getSeasonHref } =
    useLeagueDetailsContext();
  return (
    <Section
      className={className}
      title="Seasons"
      action={
        <Button
          icon="add"
          size="sm"
          onClick={onAddSeason}
        >
          Create Season
        </Button>
      }
    >
      {seasons.length === 0 ? (
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
              href={getSeasonHref(s)}
              subtitle={formatSeasonSubtitle(s.start_date, s.end_date, s.is_current)}
              rightContent={
                s.is_current ? { type: 'tag', label: 'Current', intent: 'success' } : undefined
              }
              actions={
                [
                  {
                    icon: 'edit',
                    intent: 'accent',
                    tooltip: 'Edit',
                    disabled: busy === s.id,
                    onClick: () => onEditSeason(s),
                  },
                  {
                    icon: 'delete',
                    intent: 'danger',
                    tooltip: 'Delete',
                    disabled: busy === s.id,
                    onClick: () => onDeleteSeason(s),
                  },
                ] satisfies ListItemAction[]
              }
            />
          ))}
        </ul>
      )}
    </Section>
  );
};

export default LeagueSeasonsCard;
