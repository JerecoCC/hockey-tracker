import Button from '@/components/Button/Button';
import ListItem, { type ListItemAction } from '@/components/ListItem/ListItem';
import SearchableList from '@/components/SearchableList/SearchableList';
import Section from '@/components/Section/Section';
import Skeleton from '@/components/Skeleton/Skeleton';
import { buildTeamDetailsPath } from '@/lib/routeSlugs';
import { useLeagueDetailsContext } from './LeagueDetailsContext';
import {
  LeagueListRowSkeleton,
  TabActionSkeleton,
  type TabSkeletonProps,
} from './LeagueTabSkeletonHelpers';
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
            size="sm"
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
            <ul className={styles.teamList}>
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
            </ul>
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
      <ul className={styles.tabSkeletonGrid}>
        {Array.from({ length: 5 }, (_, index) => (
          <LeagueListRowSkeleton
            key={index}
            image
            code
            bordered
          />
        ))}
      </ul>
    </Section>
  </div>
);

export default LeagueTeamsTab;
