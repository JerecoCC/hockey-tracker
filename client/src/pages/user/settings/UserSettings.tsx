import { useMemo, useState } from 'react';
import Accordion from '@jerecocc/tracker-ui/components/Accordion/Accordion';
import Card from '@jerecocc/tracker-ui/components/Card/Card';
import Divider from '@jerecocc/tracker-ui/components/Divider/Divider';
import InfoItem from '@jerecocc/tracker-ui/components/InfoItem/InfoItem';
import ListItem, { type ListItemAction } from '@jerecocc/tracker-ui/components/ListItem/ListItem';
import PlayerAvatar from '@jerecocc/tracker-ui/components/PlayerAvatar/PlayerAvatar';
import SearchField from '@jerecocc/tracker-ui/components/SearchField/SearchField';
import Section from '@jerecocc/tracker-ui/components/Section/Section';
import TeamLogo from '@jerecocc/tracker-ui/components/TeamLogo/TeamLogo';
import Toggle from '@jerecocc/tracker-ui/components/Toggle/Toggle';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import useFavoriteTeams from '@/hooks/useFavoriteTeams';
import useLeagues from '@/hooks/useLeagues';
import useTeams, { type TeamRecord } from '@/hooks/useTeams';
import EmptyMessage from '@/shared/EmptyMessage/EmptyMessage';
import StatusTag from '@/shared/StatusTag/StatusTag';
import ResponsiveList from '@/shared/ResponsiveList/ResponsiveList';
import styles from './UserSettings.module.scss';

interface TeamCardProps {
  team: TeamRecord;
  favorited: boolean;
  fullWidth?: boolean;
  showFavoriteIndicator?: boolean;
  onToggle: () => void;
}

const getUserInitials = (name: string, email?: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (parts.length === 1 && parts[0] !== 'Player') return parts[0].slice(0, 2).toUpperCase();
  return (email?.slice(0, 2) || 'P').toUpperCase();
};

const getUserNameParts = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { firstName: '', lastName: parts[0] || 'Player' };
  }
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
};

const TeamCard = ({
  team,
  favorited,
  fullWidth,
  showFavoriteIndicator = false,
  onToggle,
}: TeamCardProps) => (
  <ListItem
    fullWidth={fullWidth}
    className={favorited && showFavoriteIndicator ? styles.teamItemFavorited : undefined}
    image={team.logo}
    imageDark={team.logo_dark}
    imageLight={team.logo_light}
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
  const { isDarkMode, toggleTheme } = useTheme();
  const { leagues, loading: leaguesLoading } = useLeagues();
  const { teams, loading: teamsLoading } = useTeams();
  const { isFavorite, toggle } = useFavoriteTeams();
  const [leagueSearch, setLeagueSearch] = useState('');
  const displayName = user?.display_name ?? user?.displayName ?? 'Player';
  const { firstName, lastName } = getUserNameParts(displayName);
  const authProvider = user?.is_google ? 'Google' : 'Email';
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
            <h2
              className={styles.accountName}
              aria-label={displayName}
            >
              {firstName && <span className={styles.accountFirstName}>{firstName}</span>}
              <span className={styles.accountLastName}>{lastName}</span>
            </h2>
          </div>
          <div className={styles.accountRight}>
            <div className={styles.themeControl}>
              <span className={styles.themeLabel}>Dark mode</span>
              <Toggle
                variant="toggle"
                active={isDarkMode}
                onActiveChange={toggleTheme}
                activeIcon="dark_mode"
                inactiveIcon="light_mode"
                activeTooltip="Switch to light mode"
                inactiveTooltip="Switch to dark mode"
              />
            </div>
            <StatusTag
              className={styles.accountRole}
              status={user?.role ?? 'user'}
            />
          </div>
        </div>
        <Divider className={styles.accountDivider} />
        <div className={styles.infoGrid}>
          <InfoItem
            label="Email"
            value={user?.email}
          />
          <InfoItem
            label="Sign-in"
            value={authProvider}
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
              <EmptyMessage>Loading...</EmptyMessage>
            ) : leagues.length === 0 ? (
              <EmptyMessage>No leagues available.</EmptyMessage>
            ) : filteredLeagues.length === 0 ? (
              <EmptyMessage>No leagues or teams match your search.</EmptyMessage>
            ) : (
              <div className={styles.leaguesList}>
                {filteredLeagues.map(({ league, teams: leagueTeams }) => {
                  return (
                    <Accordion
                      key={league.id}
                      bodyClassName={styles.leagueBody}
                      mode="static"
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
                      <ResponsiveList className={styles.teamList}>
                        {leagueTeams.map((team) => (
                          <TeamCard
                            key={team.id}
                            team={team}
                            favorited={isFavorite(team.id)}
                            showFavoriteIndicator
                            onToggle={() => toggle(team.id)}
                          />
                        ))}
                      </ResponsiveList>
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
              <EmptyMessage>No favorite teams yet.</EmptyMessage>
            ) : (
              <ResponsiveList className={styles.favoriteList}>
                {favoriteTeams.map((team) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    favorited
                    fullWidth
                    onToggle={() => toggle(team.id)}
                  />
                ))}
              </ResponsiveList>
            )}
          </Section>
        </aside>
      </div>
    </div>
  );
};

export default UserSettings;
