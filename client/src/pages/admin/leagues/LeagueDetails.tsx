import { useParams } from 'react-router-dom';
import Breadcrumbs from '../../../components/Breadcrumbs/Breadcrumbs';
import Icon from '../../../components/Icon/Icon';
import useLeagues from '../../../hooks/useLeagues';
import styles from './LeagueDetails.module.scss';

const LeagueDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const { leagues, loading } = useLeagues();

  const league = leagues.find((l) => l.id === id);

  if (loading) {
    return (
      <main className={styles.main}>
        <p style={{ color: 'var(--text-dim)' }}>Loading…</p>
      </main>
    );
  }

  if (!league) {
    return (
      <main className={styles.main}>
        <Breadcrumbs
          items={[{ label: 'Leagues', path: '/admin/leagues' }, { label: 'Not Found' }]}
        />
        <p style={{ color: 'var(--text-dim)' }}>League not found.</p>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <Breadcrumbs items={[{ label: 'Leagues', path: '/admin/leagues' }, { label: league.name }]} />

      <h2 className={styles.sectionTitle}>
        <Icon
          name="emoji_events"
          size="1em"
        />
        League Details
      </h2>

      <div className={styles.card}>
        <div className={styles.leagueHeader}>
          {league.logo ? (
            <img
              src={league.logo}
              alt={league.name}
              className={styles.logo}
            />
          ) : (
            <span className={styles.logoPlaceholder}>{league.code.slice(0, 3)}</span>
          )}
          <div>
            <h3 className={styles.leagueName}>{league.name}</h3>
            <span className={styles.leagueCode}>{league.code}</span>
          </div>
        </div>

        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Description</span>
            {league.description ? (
              <span className={styles.infoValue}>{league.description}</span>
            ) : (
              <span className={styles.infoValueMuted}>No description provided.</span>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

export default LeagueDetailsPage;
