import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import Card from '@/components/Card/Card';
import Icon from '@/components/Icon/Icon';
import useLeagues from '@/hooks/useLeagues';
import useTeams, { TeamRecord } from '@/hooks/useTeams';
import useFavoriteTeams from '@/hooks/useFavoriteTeams';
import styles from './UserDashboard.module.scss';

// ── Team card ────────────────────────────────────────────────────────────────

interface TeamCardProps {
  team: TeamRecord;
  favorited: boolean;
  onToggle: () => void;
}

const TeamCard = ({ team, favorited, onToggle }: TeamCardProps) => (
  <div className={`${styles.teamCard} ${favorited ? styles.teamCardFavorited : ''}`}>
    <div className={styles.teamCardLeft}>
      {team.logo ? (
        <img
          src={team.logo}
          alt=""
          className={styles.teamLogo}
        />
      ) : (
        <span
          className={styles.teamLogoPlaceholder}
          style={{ background: team.primary_color, color: team.text_color }}
        >
          {team.code.slice(0, 3)}
        </span>
      )}
      <div>
        <p className={styles.teamName}>{team.name}</p>
        <p className={styles.teamCode}>{team.code}</p>
      </div>
    </div>
    <button
      className={`${styles.starBtn} ${favorited ? styles.starActive : ''}`}
      onClick={onToggle}
      aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Icon
        name="stars"
        size="1.1rem"
      />
    </button>
  </div>
);

// ── Page ─────────────────────────────────────────────────────────────────────

const UserDashboard = () => {
  const { user } = useAuth();
  const { leagues, loading: leaguesLoading } = useLeagues();
  const { teams, loading: teamsLoading } = useTeams();
  const { isFavorite, toggle } = useFavoriteTeams();

  const teamsByLeague = useMemo(() => {
    const map: Record<string, TeamRecord[]> = {};
    for (const team of teams) {
      if (!team.league_id) continue;
      if (!map[team.league_id]) map[team.league_id] = [];
      map[team.league_id].push(team);
    }
    return map;
  }, [teams]);

  const favoriteTeams = useMemo(() => teams.filter((t) => isFavorite(t.id)), [teams, isFavorite]);

  const loading = leaguesLoading || teamsLoading;

  return (
    <div className={styles.page}>
      {/* Welcome */}
      <div className={styles.welcome}>
        {user?.photo && (
          <img
            src={user.photo}
            alt=""
            className={styles.avatar}
            referrerPolicy="no-referrer"
          />
        )}
        <div>
          <h2 className={styles.welcomeName}>
            Welcome, {user?.display_name ?? user?.displayName ?? 'Player'}!
          </h2>
          <p className={styles.welcomeEmail}>{user?.email}</p>
        </div>
      </div>

      {/* My Teams */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>My Teams</h3>
        {favoriteTeams.length === 0 ? (
          <p className={styles.empty}>
            No favorite teams yet — browse leagues below to add some.
          </p>
        ) : (
          <div className={styles.teamsGrid}>
            {favoriteTeams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                favorited
                onToggle={() => toggle(team.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Browse Leagues */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Browse Leagues</h3>
        {loading ? (
          <p className={styles.empty}>Loading...</p>
        ) : leagues.length === 0 ? (
          <p className={styles.empty}>No leagues available.</p>
        ) : (
          <div className={styles.leaguesList}>
            {leagues.map((league) => {
              const leagueTeams = teamsByLeague[league.id] ?? [];
              if (leagueTeams.length === 0) return null;
              return (
                <Card
                  key={league.id}
                  className={styles.leagueCard}
                >
                  <div className={styles.leagueHeader}>
                    {league.logo ? (
                      <img
                        src={league.logo}
                        alt=""
                        className={styles.leagueLogo}
                      />
                    ) : (
                      <span
                        className={styles.leagueLogoPlaceholder}
                        style={{ background: league.primary_color, color: league.text_color }}
                      >
                        {league.code.slice(0, 3)}
                      </span>
                    )}
                    <span className={styles.leagueName}>{league.name}</span>
                  </div>
                  <div className={styles.teamsGrid}>
                    {leagueTeams.map((team) => (
                      <TeamCard
                        key={team.id}
                        team={team}
                        favorited={isFavorite(team.id)}
                        onToggle={() => toggle(team.id)}
                      />
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default UserDashboard;
