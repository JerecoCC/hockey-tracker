import { useNavigate, useParams, useLocation } from 'react-router-dom';
import Breadcrumbs from '../../../components/Breadcrumbs/Breadcrumbs';
import Button from '../../../components/Button/Button';
import Icon from '../../../components/Icon/Icon';
import useTeamDetails from '../../../hooks/useTeamDetails';
import styles from './TeamDetails.module.scss';

interface LocationState {
  from?: 'teams' | 'league';
  leagueId?: string;
  leagueName?: string;
}

const TeamDetailsPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { state } = useLocation() as { state: LocationState | null };
  const { team, loading } = useTeamDetails(id);

  const fromLeague = state?.from === 'league';

  const breadcrumbItems = fromLeague
    ? [
        { label: 'Leagues', path: '/admin/leagues' },
        { label: state!.leagueName!, path: `/admin/leagues/${state!.leagueId}` },
        { label: team?.name ?? '…' },
      ]
    : [
        { label: 'Teams', path: '/admin/teams' },
        { label: team?.name ?? '…' },
      ];

  const backPath = fromLeague ? `/admin/leagues/${state!.leagueId}` : '/admin/teams';
  const backTooltip = fromLeague ? `Back to ${state!.leagueName}` : 'Back to Teams';

  if (loading) {
    return (
      <main className={styles.main}>
        <div className={styles.loaderWrapper}>
          <span className={styles.spinner} />
          <p className={styles.loaderText}>Loading team…</p>
        </div>
      </main>
    );
  }

  if (!team) {
    return (
      <main className={styles.main}>
        <p className={styles.loaderText}>Team not found.</p>
      </main>
    );
  }

  const createdDate = new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  }).format(new Date(team.created_at));

  return (
    <main className={styles.main}>
      <Breadcrumbs items={breadcrumbItems} />

      <div className={styles.titleRow}>
        <Button
          variant="outlined"
          intent="neutral"
          icon="arrow_back"
          tooltip={backTooltip}
          onClick={() => navigate(backPath)}
        />
        <h2 className={styles.sectionTitle}>
          <Icon name="groups" size="1em" />
          Team Details
        </h2>
      </div>

      <div className={styles.grid}>
        {/* ── Header card ─────────────────────────────────── */}
        <div className={`${styles.card} ${styles.col12}`}>
          <div className={styles.teamHeader}>
            <div className={styles.logoArea}>
              {team.logo ? (
                <img src={team.logo} alt={team.name} className={styles.logo} />
              ) : (
                <span className={styles.logoPlaceholder}>{team.code.slice(0, 3)}</span>
              )}
            </div>
            <div className={styles.teamInfo}>
              <h3 className={styles.teamName}>{team.name}</h3>
              <span className={styles.teamCode}>{team.code}</span>
              {team.location && (
                <span className={styles.teamLocation}>
                  <Icon name="location_on" size="0.95em" />
                  {team.location}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Description card ────────────────────────────── */}
        <div className={`${styles.card} ${styles.col8}`}>
          <div className={styles.cardHeader}>
            <h4 className={styles.cardTitle}>Description</h4>
          </div>
          {team.description ? (
            <p className={styles.descriptionText}>{team.description}</p>
          ) : (
            <p className={styles.descriptionEmpty}>No description provided.</p>
          )}
        </div>

        {/* ── Info card ───────────────────────────────────── */}
        <div className={`${styles.card} ${styles.col4}`}>
          <div className={styles.cardHeader}>
            <h4 className={styles.cardTitle}>Details</h4>
          </div>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>League</span>
              {team.league_id ? (
                <div className={styles.leagueBadge}>
                  {team.league_logo ? (
                    <img src={team.league_logo} alt={team.league_name ?? ''} className={styles.leagueLogo} />
                  ) : (
                    <span className={styles.leagueLogoPlaceholder}>{team.league_code?.slice(0, 3)}</span>
                  )}
                  <span className={styles.infoValue}>{team.league_name}</span>
                </div>
              ) : (
                <span className={styles.infoValueMuted}>Unassigned</span>
              )}
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Created</span>
              <span className={styles.infoValue}>{createdDate}</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default TeamDetailsPage;
