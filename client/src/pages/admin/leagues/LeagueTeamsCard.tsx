import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../components/Button/Button';
import Card from '../../../components/Card/Card';
import Icon from '../../../components/Icon/Icon';
import ListItem, { type ListItemAction } from '../../../components/ListItem/ListItem';
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

const LeagueTeamsCard = (props: Props) => {
  const { leagueId, teams, loading, busy, onAdd, onEdit, onDelete, className } = props;
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? teams.filter((t) => {
        const q = query.trim().toLowerCase();
        return t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q);
      })
    : teams;

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
      {loading ? (
        <p className={styles.teamsEmpty}>Loading…</p>
      ) : teams.length === 0 ? (
        <p className={styles.teamsEmpty}>No teams assigned to this league yet.</p>
      ) : (
        <>
          <div className={styles.teamSearch}>
            <Icon
              name="search"
              size="1em"
              className={styles.teamSearchIcon}
            />
            <input
              className={styles.teamSearchInput}
              type="text"
              placeholder="Search teams…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                className={styles.teamSearchClear}
                onClick={() => setQuery('')}
                aria-label="Clear search"
              >
                <Icon
                  name="close"
                  size="0.8em"
                />
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <p className={styles.teamsEmpty}>No teams match "{query}".</p>
          ) : (
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
        </>
      )}
    </Card>
  );
};

export default LeagueTeamsCard;
