import Button from '@jerecocc/tracker-ui/components/Button/Button';
import ListItem, { type ListItemAction } from '@jerecocc/tracker-ui/components/ListItem/ListItem';
import SearchableList from '@jerecocc/tracker-ui/components/SearchableList/SearchableList';
import Section from '@jerecocc/tracker-ui/components/Section/Section';
import Skeleton from '@jerecocc/tracker-ui/components/Skeleton/Skeleton';
import { buildTeamDetailsPath } from '@/lib/routeSlugs';
import { useLeagueDetailsContext } from './leagueDetailsState';
import {
  LeagueListRowSkeleton,
  TabActionSkeleton,
  type TabSkeletonProps,
} from './LeagueTabSkeletonHelpers';
import ResponsiveList from '@/shared/ResponsiveList/ResponsiveList';
import styles from './LeagueDetails.module.scss';

interface Props {
  className?: string;
}

const LeagueTeamsTab = (props: Props) => {
  const { className } = props;
  const { league, teams, loading, busy, onAddTeam, onEditTeam, onDeleteTeam } =
    useLeagueDetailsContext();

  if (loading) return <LeagueTeamsTabSkeleton className={className} />;

  return (
    <div className={styles.grid}>
      <Section
        className={[styles.col12, className].filter(Boolean).join(' ')}
        title="Teams"
        action={
          <Button
            icon="add"
            size="medium"
            onClick={onAddTeam}
          >
            Create Team
          </Button>
        }
      >
        <SearchableList
          items={teams}
          filterFn={(t, q) =>
            t.name.toLowerCase().includes(q.toLowerCase()) ||
            t.code.toLowerCase().includes(q.toLowerCase())
          }
          renderItems={(filtered) => (
    <ResponsiveList className={styles.teamList}>
              {filtered.map((t) => {
                const teamHref = buildTeamDetailsPath({
                  leagueCode: league.code,
                  leagueId: league.id,
                  teamCode: t.code,
                  teamId: t.id,
                });
                return (
                  <ListItem
                    key={t.id}
                    image={t.logo}
                    imageDark={t.logo_dark}
                    imageLight={t.logo_light}
                    eyebrow={t.place_name || ''}
                    name={t.team_name || ''}
                    rightContent={{ type: 'code', value: t.code }}
                    primaryColor={t.primary_color}
                    textColor={t.text_color}
                    href={teamHref}
                    actions={
                      [
                        {
                          icon: 'edit',
                          intent: 'neutral',
                          tooltip: 'Edit',
                          disabled: busy === t.id,
                          onClick: () => onEditTeam(t),
                        },
                        {
                          icon: 'delete',
                          intent: 'danger',
                          tooltip: 'Delete',
                          disabled: busy === t.id,
                          onClick: () => onDeleteTeam(t),
                        },
                      ] satisfies ListItemAction[]
                    }
                  />
                );
              })}
    </ResponsiveList>
          )}
          placeholder="Search teams..."
          emptyMessage="No teams assigned to this league yet."
          noResultsMessage={(q) => `No teams match "${q}".`}
        />
      </Section>
    </div>
  );
};

export const LeagueTeamsTabSkeleton = ({ className }: TabSkeletonProps) => (
  <div className={styles.grid}>
    <Section
      className={[styles.col12, className].filter(Boolean).join(' ')}
      title="Teams"
      action={<TabActionSkeleton width="112px" />}
      role="status"
      aria-busy="true"
      aria-label="Loading teams"
    >
      <div className={styles.tabSkeletonControls}>
        <Skeleton
          type="text"
          className={[styles.tabSkeletonSearch, styles.tabSkeletonSearchFull].join(' ')}
        />
      </div>
      <ResponsiveList className={styles.tabSkeletonGrid}>
        {Array.from({ length: 5 }, (_, index) => (
          <LeagueListRowSkeleton key={index} />
        ))}
      </ResponsiveList>
    </Section>
  </div>
);

export default LeagueTeamsTab;
