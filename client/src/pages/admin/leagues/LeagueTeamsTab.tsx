import { useNavigate } from 'react-router-dom';
import Button from '../../../components/Button/Button';
import Card from '../../../components/Card/Card';
import ListItem, { type ListItemAction } from '../../../components/ListItem/ListItem';
import SearchableList from '../../../components/SearchableList/SearchableList';
import { type TeamRecord } from '../../../hooks/useTeams';
import styles from './LeagueDetails.module.scss';

interface Props {
  leagueId: string;
  teams: TeamRecord[];
  loading: boolean;
  busy: string | null;
  onAdd: () => void;
  onEdit: (team: TeamRecord) => void;
  onDelete: (team: TeamRecord) => void;
  className?: string;
}

const LeagueTeamsTab = (props: Props) => {
  const { leagueId, teams, loading, busy, onAdd, onEdit, onDelete, className } = props;
  const navigate = useNavigate();

  return (
    <Card
      className={className}
      title="Teams"
      action={
        <Button
          icon="add"
          size="sm"
          onClick={onAdd}
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
            {filtered.map((t) => (
              <ListItem
                key={t.id}
                image={t.logo}
                name={t.name}
                rightContent={{ type: 'code', value: t.code }}
                primaryColor={t.primary_color}
                textColor={t.text_color}
                actions={
                  [
                    {
                      icon: 'open_in_new',
                      intent: 'accent',
                      tooltip: 'View team',
                      onClick: () => navigate(`/admin/leagues/${leagueId}/teams/${t.id}`),
                    },
                    {
                      icon: 'edit',
                      intent: 'neutral',
                      tooltip: 'Edit',
                      disabled: busy === t.id,
                      onClick: () => onEdit(t),
                    },
                    {
                      icon: 'delete',
                      intent: 'danger',
                      tooltip: 'Delete',
                      disabled: busy === t.id,
                      onClick: () => onDelete(t),
                    },
                  ] satisfies ListItemAction[]
                }
              />
            ))}
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
