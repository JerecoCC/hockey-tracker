import { useNavigate } from 'react-router-dom';
import Button from '../../../components/Button/Button';
import Card from '../../../components/Card/Card';
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

const LeagueTeamsCard = ({ leagueId, teams, loading, busy, onAdd, onEdit, onDelete, className }: Props) => {
  const navigate = useNavigate();

  return (
    <Card
      className={className}
      title="Teams"
      action={
        <Button icon="add" size="sm" onClick={onAdd}>
          Add Team
        </Button>
      }
    >
      {loading ? (
        <p className={styles.teamsEmpty}>Loading…</p>
      ) : teams.length === 0 ? (
        <p className={styles.teamsEmpty}>No teams assigned to this league yet.</p>
      ) : (
        <ul className={`${styles.teamList} ${teams.length > 5 ? styles.teamListLimited : ''}`}>
          {teams.map((t) => (
            <li
              key={t.id}
              className={`${styles.teamListItem} ${styles.teamListItemClickable}`}
              onClick={() => navigate(`/admin/leagues/${leagueId}/teams/${t.id}`)}
            >
              {t.logo ? (
                <img src={t.logo} alt="" className={styles.teamLogoThumb} />
              ) : (
                <span className={styles.teamLogoPlaceholder}>{t.code.slice(0, 3)}</span>
              )}
              <span className={styles.teamListName}>{t.name}</span>
              <span className={styles.seasonListDates}>{t.code}</span>
              <span className={styles.teamActions}>
                <Button
                  variant="outlined"
                  intent="accent"
                  icon="edit"
                  size="sm"
                  disabled={busy === t.id}
                  tooltip="Edit"
                  onClick={(e) => { e.stopPropagation(); onEdit(t); }}
                />
                <Button
                  variant="outlined"
                  intent="danger"
                  icon="delete"
                  size="sm"
                  disabled={busy === t.id}
                  tooltip="Delete"
                  onClick={(e) => { e.stopPropagation(); onDelete(t); }}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

export default LeagueTeamsCard;
