import ListItem, { type ListItemAction } from '@jerecocc/tracker-ui/components/ListItem/ListItem';
import Section from '@jerecocc/tracker-ui/components/Section/Section';
import { useLeagueDetailsContext } from './leagueDetailsState';
import useScreenSize from '@/hooks/useScreenSize';
import EmptyMessage from '@/shared/EmptyMessage/EmptyMessage';
import ResponsiveList from '@/shared/ResponsiveList/ResponsiveList';
import SectionActionButton from '@/shared/SectionActionButton/SectionActionButton';
import { getSeasonTagPhase, seasonPhasePresentation } from '@/lib/seasonPhase';
import styles from './LeagueDetails.module.scss';

interface Props {
  className?: string;
}

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});
// MM/DD/YY, for phones.
const NUMERIC_DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: '2-digit',
  day: '2-digit',
  year: '2-digit',
});
const parseLocal = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

const formatSeasonSubtitle = (
  start: string | null,
  end: string | null,
  isCurrent: boolean,
  numeric: boolean,
) => {
  if (!start && !end) return 'No dates';
  const fmt = numeric ? NUMERIC_DATE_FMT : DATE_FMT;
  const startLabel = start ? fmt.format(parseLocal(start)) : 'Unknown';
  const endLabel = end ? fmt.format(parseLocal(end)) : isCurrent ? 'Present' : 'Unknown';
  return `${startLabel} - ${endLabel}`;
};

const LeagueSeasonsCard = (props: Props) => {
  const { className } = props;
  const { seasons, busy, onAddSeason, onEditSeason, onDeleteSeason, getSeasonHref } =
    useLeagueDetailsContext();
  const isMobileView = useScreenSize() === 'mobile';
  return (
    <Section
      className={className}
      title="Seasons"
      action={
        <SectionActionButton
          icon="add"
          label="Create Season"
          onClick={onAddSeason}
        />
      }
    >
      {seasons.length === 0 ? (
        <EmptyMessage>No seasons for this league yet.</EmptyMessage>
      ) : (
        <ResponsiveList
          className={`${styles.seasonList} ${seasons.length > 5 ? styles.seasonListLimited : ''}`}
        >
          {seasons.map((s) => {
            const phase = getSeasonTagPhase(s);
            const phasePresentation = seasonPhasePresentation(phase);
            return (
              <ListItem
                key={s.id}
                fullWidth
                hideImage
                name={s.name}
                href={getSeasonHref(s)}
                subtitle={formatSeasonSubtitle(
                  s.start_date,
                  s.end_date,
                  phase === 'in_progress' || phase === 'playoffs',
                  isMobileView,
                )}
                rightContent={{ type: 'tag', ...phasePresentation }}
                actions={
                  [
                    {
                      icon: 'edit',
                      intent: 'neutral',
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
            );
          })}
        </ResponsiveList>
      )}
    </Section>
  );
};

export default LeagueSeasonsCard;
