import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Tabs from '@jerecocc/tracker-ui/components/Tabs/Tabs';
import { usePageBreadcrumbs } from '@/context/BreadcrumbContext';
import useDocumentIcon from '@/hooks/useDocumentIcon';
import useLeagueDetails from '@/hooks/useLeagueDetails';
import useLeagues from '@/hooks/useLeagues';
import useTabState from '@/hooks/useTabState';
import useTeamDetails, { useTeamSeasons } from '@/hooks/useTeamDetails';
import {
  UUID_PATTERN,
  buildSeasonDetailsPath,
  buildSeasonTeamDetailsPath,
  buildTeamDetailsPath,
  buildTeamSeasonDetailsPath,
  toRouteSlug,
} from '@/lib/routeSlugs';
import TeamAwardsTab from './TeamAwardsTab';
import styles from './TeamDetails.module.scss';
import TeamGamesTab from './TeamGamesTab';
import TeamPlayersTab from './TeamPlayersTab';

interface Props {
  entry: 'team' | 'season';
}

const monthForSeason = (startDate?: string | null) => {
  if (!startDate) return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const date = new Date(`${startDate}T00:00:00`);
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

const TeamSeasonDetailsPage = ({ entry }: Props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { leagueSlug, teamSlug, seasonSlug } = useParams<{
    leagueSlug: string;
    teamSlug: string;
    seasonSlug: string;
  }>();
  const legacyLeague = !!leagueSlug && UUID_PATTERN.test(leagueSlug);
  const legacyTeam = !!teamSlug && UUID_PATTERN.test(teamSlug);
  const legacySeason = !!seasonSlug && UUID_PATTERN.test(seasonSlug);
  const { leagues, loading: leaguesLoading } = useLeagues();
  const routeLeague = legacyLeague
    ? null
    : leagues.find(
        (league) =>
          toRouteSlug(league.code) === leagueSlug || toRouteSlug(league.name) === leagueSlug,
      );
  const leagueId = legacyLeague ? leagueSlug : routeLeague?.id;
  const {
    teams,
    seasons,
    loading: leagueLoading,
  } = useLeagueDetails(leagueId);
  const routeTeam = legacyTeam
    ? null
    : teams.find(
        (team) => toRouteSlug(team.code) === teamSlug || toRouteSlug(team.name) === teamSlug,
      );
  const teamId = legacyTeam ? teamSlug : routeTeam?.id;
  const routeSeason = legacySeason
    ? null
    : seasons.find((season) => toRouteSlug(season.name) === seasonSlug);
  const seasonId = legacySeason ? seasonSlug : routeSeason?.id;
  const { team, loading: teamLoading } = useTeamDetails(teamId);
  const { seasons: teamSeasons, loading: teamSeasonsLoading } = useTeamSeasons(teamId);
  const season = seasons.find((item) => item.id === seasonId) ?? null;
  const teamParticipates = teamSeasons.some((item) => item.id === seasonId);
  const loading =
    leaguesLoading || leagueLoading || teamLoading || teamSeasonsLoading;
  const [activeTab, handleTabChange] = useTabState('tab:team-season-details');
  const [calendarMonth, setCalendarMonth] = useState(() => monthForSeason(season?.start_date));

  useDocumentIcon(team?.icon);

  useEffect(() => {
    setCalendarMonth(monthForSeason(season?.start_date));
  }, [season?.id, season?.start_date]);

  useEffect(() => {
    if (!team?.name || !season?.name) return;
    document.title = `${team.name} · ${season.name}`;
    return () => {
      document.title = 'Hockey Tracker';
    };
  }, [season?.name, team?.name]);

  const teamPath = buildTeamDetailsPath({
    leagueCode: team?.league_code,
    leagueId,
    teamCode: team?.code,
    teamId,
  });
  const seasonPath = buildSeasonDetailsPath({
    leagueCode: team?.league_code,
    leagueId,
    seasonName: season?.name,
    seasonId,
  });

  usePageBreadcrumbs(
    loading || !team || !season
      ? null
      : entry === 'team'
        ? {
            backPath: teamPath,
            backLabel: `Back to ${team.name}`,
            items: [
              { label: team.league_code ?? 'League' },
              { label: team.name, path: teamPath },
              { label: season.name },
            ],
          }
        : {
            backPath: seasonPath,
            backLabel: `Back to ${season.name}`,
            items: [
              { label: team.league_code ?? 'League' },
              { label: season.name, path: seasonPath },
              { label: team.name },
            ],
          },
    [
      entry,
      loading,
      season?.name,
      seasonPath,
      team?.league_code,
      team?.name,
      teamPath,
    ],
  );

  useEffect(() => {
    if (loading || !team || !season || !teamParticipates) return;
    const canonicalPath =
      entry === 'team'
        ? buildTeamSeasonDetailsPath({
            leagueCode: team.league_code,
            leagueId,
            teamCode: team.code,
            teamId: team.id,
            seasonName: season.name,
            seasonId: season.id,
          })
        : buildSeasonTeamDetailsPath({
            leagueCode: team.league_code,
            leagueId,
            seasonName: season.name,
            seasonId: season.id,
            teamCode: team.code,
            teamId: team.id,
          });
    if (location.pathname !== canonicalPath) navigate(canonicalPath, { replace: true });
  }, [entry, leagueId, loading, location.pathname, navigate, season, team, teamParticipates]);

  if (loading) {
    return (
      <div className={styles.loaderWrapper}>
        <span className={styles.spinner} />
        <p className={styles.loaderText}>Loading team season…</p>
      </div>
    );
  }

  if (!team || !season || !teamParticipates) {
    return <p className={styles.loaderText}>Team season not found.</p>;
  }

  return (
    <Tabs
      selectedIndex={activeTab}
      onSelectedIndexChange={handleTabChange}
      tabs={[
        {
          label: 'Games',
          icon: 'sports_hockey',
          content: (
            <TeamGamesTab
              teamId={team.id}
              teamName={team.name}
              leagueId={team.league_id ?? leagueId ?? ''}
              leagueCode={team.league_code}
              seasonId={season.id}
              calendarMonth={calendarMonth}
              onCalendarMonthChange={setCalendarMonth}
            />
          ),
        },
        {
          label: 'Players',
          icon: 'set_lineup',
          content: (
            <TeamPlayersTab
              teamId={team.id}
              teamName={team.name}
              leagueId={team.league_id ?? ''}
              leagueCode={team.league_code}
              teamCode={team.code}
              seasonId={season.id}
              scope="season"
            />
          ),
        },
        {
          label: 'Awards',
          icon: 'emoji_events',
          content: (
            <TeamAwardsTab
              teamId={team.id}
              seasonId={season.id}
            />
          ),
        },
      ]}
    />
  );
};

export default TeamSeasonDetailsPage;
