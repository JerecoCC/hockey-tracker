import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ActionOverlay from '../../../components/ActionOverlay/ActionOverlay';
import Button from '../../../components/Button/Button';
import Card from '../../../components/Card/Card';
import Icon from '../../../components/Icon/Icon';
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
                <li
                  key={t.id}
                  className={`${styles.teamListItem} ${styles.teamListItemClickable}`}
                  onClick={() => navigate(`/admin/leagues/${leagueId}/teams/${t.id}`)}
                >
                  {t.logo ? (
                    <img
                      src={t.logo}
                      alt=""
                      className={styles.teamLogoThumb}
                    />
                  ) : (
                    <span className={styles.teamLogoPlaceholder}>{t.code.slice(0, 3)}</span>
                  )}
                  <span className={styles.teamListName}>{t.name}</span>
                  <span className={styles.seasonListDates}>{t.code}</span>
                  <ActionOverlay className={styles.teamActions}>
                    <Button
                      variant="outlined"
                      intent="accent"
                      icon="edit"
                      size="sm"
                      disabled={busy === t.id}
                      tooltip="Edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(t);
                      }}
                    />
                    <Button
                      variant="outlined"
                      intent="danger"
                      icon="delete"
                      size="sm"
                      disabled={busy === t.id}
                      tooltip="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(t);
                      }}
                    />
                  </ActionOverlay>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
};

export default LeagueTeamsCard;
