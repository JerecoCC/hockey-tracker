import { useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Tabs from '@/components/Tabs/Tabs';
import { usePageBreadcrumbs } from '@/context/BreadcrumbContext';
import useLeagueDetails from '@/hooks/useLeagueDetails';
import useTeamDetails from '@/hooks/useTeamDetails';
import useLeagueGroups from '@/hooks/useLeagueGroups';
import useLeagues from '@/hooks/useLeagues';
import useTabState from '@/hooks/useTabState';
import {
  UUID_PATTERN,
  buildLeagueDetailsPath,
  buildTeamDetailsPath,
  toRouteSlug,
} from '@/lib/routeSlugs';
import TeamInfoTab from './TeamInfoTab';
import TeamGamesTab from './TeamGamesTab';
import TeamPlayersTab from './TeamPlayersTab';
import TeamHistoryTab from './TeamHistoryTab';
import styles from './TeamDetails.module.scss';

const TeamDetailsPage = () => {
  const navigate = useNavigate();
  const {
    teamSlug: routeTeamSlug,
    id: legacyTeamId,
    leagueSlug: routeLeagueSlug,
    leagueId: legacyLeagueId,
  } = useParams<{
    teamSlug?: string;
    id?: string;
    leagueSlug?: string;
    leagueId?: string;
  }>();
  const [searchParams] = useSearchParams();
  const routeSeasonId = searchParams.get('season');
  const teamSlug = routeTeamSlug ?? legacyTeamId;
  const leagueSlug = routeLeagueSlug ?? legacyLeagueId;
  const isLegacyTeamRoute = !!teamSlug && UUID_PATTERN.test(teamSlug);
  const isLegacyLeagueRoute = !!leagueSlug && UUID_PATTERN.test(leagueSlug);
  const { leagues: allLeagues, loading: leaguesLoading } = useLeagues();
  const routeLeague = isLegacyLeagueRoute
    ? null
    : allLeagues.find(
        (item) =>
          toRouteSlug(item.code) === leagueSlug ||
          toRouteSlug(item.name) === leagueSlug,
      );
  const leagueId = isLegacyLeagueRoute ? leagueSlug : routeLeague?.id;
  const { teams: leagueTeams, loading: leagueDetailsLoading } = useLeagueDetails(leagueId);
  const routeTeam = isLegacyTeamRoute
    ? null
    : leagueTeams.find(
        (item) =>
          toRouteSlug(item.code) === teamSlug ||
          toRouteSlug(item.name) === teamSlug,
      );
  const id = isLegacyTeamRoute ? teamSlug : routeTeam?.id;
  const { team, loading: teamLoading, uploadLogo, updateTeam } = useTeamDetails(id);
  const loading = teamLoading || (!isLegacyLeagueRoute && leaguesLoading) || (!isLegacyTeamRoute && leagueDetailsLoading);
  const { groups } = useLeagueGroups(team?.league_id ?? undefined);
  const [activeTab, handleTabChange] = useTabState('tab:team-details');
  const breadcrumbItems = [
    {
      label: team?.league_code ?? '...',
      path: buildLeagueDetailsPath({
        leagueCode: team?.league_code,
        leagueId: team?.league_id ?? leagueId,
      }),
    },
    { label: team?.name ?? '...' },
  ];

  const backPath = buildLeagueDetailsPath({
    leagueCode: team?.league_code,
    leagueId: team?.league_id ?? leagueId,
  });
  const backTooltip = 'Back to League Details';

  usePageBreadcrumbs(
    loading
      ? null
      : {
          backPath,
          backLabel: backTooltip,
          items: breadcrumbItems,
        },
    [
      loading,
      backPath,
      team?.league_name,
      team?.league_code,
      team?.name,
      leagueId,
    ],
  );

  useEffect(() => {
    if (!team || isLegacyLeagueRoute || isLegacyTeamRoute) return;
    const canonicalPath = buildTeamDetailsPath({
      leagueCode: team.league_code,
      leagueId: team.league_id,
      teamCode: team.code,
      teamId: team.id,
      seasonId: routeSeasonId,
    });
    if (
      leagueSlug !== toRouteSlug(team.league_code) ||
      teamSlug !== toRouteSlug(team.code)
    ) {
      navigate(canonicalPath, { replace: true });
    }
  }, [isLegacyLeagueRoute, isLegacyTeamRoute, leagueSlug, navigate, routeSeasonId, team, teamSlug]);

  useEffect(() => {
    if (loading || team) return;
    navigate(backPath, { replace: true });
  }, [backPath, loading, navigate, team]);

  if (loading) {
    return (
      <div className={styles.loaderWrapper}>
        <span className={styles.spinner} />
        <p className={styles.loaderText}>Loading team…</p>
      </div>
    );
  }

  if (!team) {
    return <p className={styles.loaderText}>Team not found.</p>;
  }

  return (
    <>
      <Tabs
        activeIndex={activeTab}
        onTabChange={handleTabChange}
        tabs={[
          {
            label: 'Info',
            icon: 'info',
            content: (
              <TeamInfoTab
                team={team}
                groups={groups}
                uploadLogo={uploadLogo}
                updateTeam={updateTeam}
              />
            ),
          },
          {
            label: 'Games',
            icon: 'sports_hockey',
            content: (
              <TeamGamesTab
                teamId={team.id}
                leagueId={team.league_id ?? leagueId ?? ''}
                leagueCode={team.league_code}
                defaultSeasonId={routeSeasonId}
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
                defaultSeasonId={routeSeasonId}
              />
            ),
          },
          {
            label: 'History',
            icon: 'history',
            content: (
              <TeamHistoryTab
                teamId={team.id}
                leagueId={team.league_id}
                teamName={team.name}
                teamCode={team.code}
                teamLogo={team.logo}
                primaryColor={team.primary_color}
                textColor={team.text_color}
                uploadLogo={uploadLogo}
              />
            ),
          },
        ]}
      />
    </>
  );
};

export default TeamDetailsPage;

