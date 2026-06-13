import { useNavigate } from 'react-router-dom';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import ListItem, { type ListItemAction } from '@/components/ListItem/ListItem';
import SearchableList from '@/components/SearchableList/SearchableList';
import { buildTeamDetailsPath } from '@/lib/routeSlugs';
import { useLeagueDetailsContext } from './LeagueDetailsContext';
import styles from './LeagueDetails.module.scss';

interface Props {
  className?: string;
}

const LeagueTeamsTab = (props: Props) => {
  const { className } = props;
  const { league, teams, loading, busy, onAddTeam, onEditTeam, onDeleteTeam } =
    useLeagueDetailsContext();
  const navigate = useNavigate();

  return (
    <Card
      className={className}
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
                  variant="plain"
                  rightContent={{ type: 'code', value: t.code }}
                  primaryColor={t.primary_color}
                  textColor={t.text_color}
                  href={teamHref}
                  actions={
                    [
                      {
                        icon: 'open_in_new',
                        intent: 'accent',
                        tooltip: 'View team',
                        onClick: () => navigate(teamHref),
                      },
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
        placeholder="Search teams…"
        loading={loading}
        emptyMessage="No teams assigned to this league yet."
        noResultsMessage={(q) => `No teams match "${q}".`}
      />
    </Card>
  );
};

export default LeagueTeamsTab;
