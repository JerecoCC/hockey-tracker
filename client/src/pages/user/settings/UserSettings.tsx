import { useMemo, useState } from 'react';
import Accordion from '@/components/Accordion/Accordion';
import Card from '@/components/Card/Card';
import InfoItem from '@/components/InfoItem/InfoItem';
import ListItem, { type ListItemAction } from '@/components/ListItem/ListItem';
import PlayerAvatar from '@/components/PlayerAvatar/PlayerAvatar';
import SearchField from '@/components/SearchField/SearchField';
import Section from '@/components/Section/Section';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
import { useAuth } from '@/context/AuthContext';
import useFavoriteTeams from '@/hooks/useFavoriteTeams';
import useLeagues from '@/hooks/useLeagues';
import useTeams, { type TeamRecord } from '@/hooks/useTeams';
import styles from './UserSettings.module.scss';

interface TeamCardProps {
  team: TeamRecord;
  favorited: boolean;
  showFavoriteIndicator?: boolean;
  onToggle: () => void;
}

const getUserInitials = (name: string, email?: string) => {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (parts.length === 1 && parts[0] !== 'Player') return parts[0].slice(0, 2).toUpperCase();
  return (email?.slice(0, 2) || 'P').toUpperCase();
};

const TeamCard = ({ team, favorited, showFavoriteIndicator = false, onToggle }: TeamCardProps) => (
  <ListItem
    className={favorited && showFavoriteIndicator ? styles.teamItemFavorited : undefined}
    image={team.logo}
    eyebrow={team.place_name || undefined}
    name={team.team_name || team.name}
    rightContent={{ type: 'code', value: team.code }}
    primaryColor={team.primary_color}
    textColor={team.text_color}
    actions={
      [
        {
          icon: favorited ? 'remove_circle_outline' : 'favorite',
          intent: favorited ? 'danger' : 'warning',
          tooltip: favorited ? 'Remove from favorites' : 'Add to favorites',
          onClick: onToggle,
        },
      ] satisfies ListItemAction[]
    }
  />
);

const UserSettings = () => {
  const { user } = useAuth();
  const { leagues, loading: leaguesLoading } = useLeagues();
  const { teams, loading: teamsLoading } = useTeams();
  const { isFavorite, toggle } = useFavoriteTeams();
  const [leagueSearch, setLeagueSearch] = useState('');
  const displayName = user?.display_name ?? user?.displayName ?? 'Player';
  const authProvider = user?.is_google ? 'Google' : 'Email';
  const accountCode = user?.role === 'admin' ? 'Admin' : 'User';
  const userInitials = getUserInitials(displayName, user?.email);

  const teamsByLeague = useMemo(() => {
    const map: Record<string, TeamRecord[]> = {};
    for (const team of teams) {
      if (!team.league_id) continue;
      if (!map[team.league_id]) map[team.league_id] = [];
      map[team.league_id].push(team);
    }
    return map;
  }, [teams]);

  const favoriteTeams = useMemo(
    () => teams.filter((team) => isFavorite(team.id)),
    [teams, isFavorite],
  );
  const filteredLeagues = useMemo(() => {
    const query = leagueSearch.trim().toLowerCase();
    return leagues
      .map((league) => {
        const leagueTeams = teamsByLeague[league.id] ?? [];
        const leagueMatches =
          query.length === 0 ||
          league.name.toLowerCase().includes(query) ||
          league.code.toLowerCase().includes(query);
        const visibleTeams = leagueMatches
          ? leagueTeams
          : leagueTeams.filter(
              (team) =>
                team.name.toLowerCase().includes(query) || team.code.toLowerCase().includes(query),
            );
        return { league, teams: visibleTeams };
      })
      .filter(({ teams }) => teams.length > 0);
  }, [leagueSearch, leagues, teamsByLeague]);
  const loading = leaguesLoading || teamsLoading;

  return (
    <div className={styles.page}>
      <Card className={styles.accountCard}>
        <div className={styles.accountHero}>
          <PlayerAvatar
            photo={user?.photo ?? null}
            initials={userInitials}
            primaryColor="#2563eb"
            textColor="#ffffff"
            size={88}
            className={styles.accountAvatar}
          />
          <div className={styles.accountTitle}>
            <h2 className={styles.accountName}>{displayName}</h2>
            <span className={styles.accountBadge}>{accountCode}</span>
          </div>
        </div>
        <div className={styles.infoGrid}>
          <InfoItem
            label="Email"
            data={user?.email}
          />
          <InfoItem
            label="Sign-in"
            data={authProvider}
          />
        </div>
      </Card>

      <div className={styles.contentGrid}>
        <div className={styles.mainColumn}>
          <Section title="Leagues">
            <SearchField
              value={leagueSearch}
              onChange={setLeagueSearch}
              placeholder="Search leagues or teams"
              aria-label="Search leagues or teams"
              className={styles.searchField}
            />
            {loading ? (
              <p className={styles.empty}>Loading...</p>
            ) : leagues.length === 0 ? (
              <p className={styles.empty}>No leagues available.</p>
            ) : filteredLeagues.length === 0 ? (
              <p className={styles.empty}>No leagues or teams match your search.</p>
            ) : (
              <div className={styles.leaguesList}>
                {filteredLeagues.map(({ league, teams: leagueTeams }) => {
                  return (
                    <Accordion
                      key={league.id}
                      bodyClassName={styles.leagueBody}
                      variant="static"
                      label={
                        <div className={styles.leagueHeader}>
                          <TeamLogo
                            logo={league.logo}
                            code={league.code}
                            primaryColor={league.primary_color}
                            textColor={league.text_color}
                            size={32}
                            shape="square"
                          />
                          <div className={styles.leagueText}>
                            <span className={styles.leagueName}>{league.name}</span>
                            <span className={styles.leagueCode}>{league.code}</span>
                          </div>
                        </div>
                      }
                      headerRight={
                        <span className={styles.leagueCount}>
                          {leagueTeams.length} {leagueTeams.length === 1 ? 'team' : 'teams'}
                        </span>
                      }
                    >
                      <ul className={styles.teamList}>
                        {leagueTeams.map((team) => (
                          <TeamCard
                            key={team.id}
                            team={team}
                            favorited={isFavorite(team.id)}
                            showFavoriteIndicator
                            onToggle={() => toggle(team.id)}
                          />
                        ))}
                      </ul>
                    </Accordion>
                  );
                })}
              </div>
            )}
          </Section>
        </div>

        <aside className={styles.sideColumn}>
          <Section title="My Teams">
            {favoriteTeams.length === 0 ? (
              <p className={styles.empty}>No favorite teams yet.</p>
            ) : (
              <ul className={styles.favoriteList}>
                {favoriteTeams.map((team) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    favorited
                    onToggle={() => toggle(team.id)}
                  />
                ))}
              </ul>
            )}
          </Section>
        </aside>
      </div>
    </div>
  );
};

export default UserSettings;
