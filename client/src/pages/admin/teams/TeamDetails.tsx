import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Tabs from '@jerecocc/tracker-ui/components/Tabs/Tabs';
import { usePageBreadcrumbs } from '@/context/BreadcrumbContext';
import useLeagueDetails from '@/hooks/useLeagueDetails';
import useDocumentIcon from '@/hooks/useDocumentIcon';
import useTeamDetails from '@/hooks/useTeamDetails';
import useLeagueGroups from '@/hooks/useLeagueGroups';
import useLeagues from '@/hooks/useLeagues';
import useTabState from '@/hooks/useTabState';
import {
  UUID_PATTERN,
  buildLeagueDetailsPath,
  buildTeamDetailsPath,
  buildUserTeamDetailsPath,
  toRouteSlug,
} from '@/lib/routeSlugs';
import TeamInfoTab from './TeamInfoTab';
import TeamPlayersTab from './TeamPlayersTab';
import TeamSeasonsTab from './TeamSeasonsTab';
import TeamHistoryTab from './TeamHistoryTab';
import styles from './TeamDetails.module.scss';

interface Props {
  mode?: 'admin' | 'user';
}

const TeamDetailsPage = ({ mode = 'admin' }: Props) => {
  const navigate = useNavigate();
  const isAdminView = mode === 'admin';
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
  const teamSlug = routeTeamSlug ?? legacyTeamId;
  const leagueSlug = routeLeagueSlug ?? legacyLeagueId;
  const isLegacyTeamRoute = !!teamSlug && UUID_PATTERN.test(teamSlug);
  const isLegacyLeagueRoute = !!leagueSlug && UUID_PATTERN.test(leagueSlug);
  const { leagues: allLeagues, loading: leaguesLoading } = useLeagues({ mode });
  const routeLeague = isLegacyLeagueRoute
    ? null
    : allLeagues.find(
        (item) => toRouteSlug(item.code) === leagueSlug || toRouteSlug(item.name) === leagueSlug,
      );
  const leagueId = isLegacyLeagueRoute ? leagueSlug : routeLeague?.id;
  const {
    teams: leagueTeams,
    loading: leagueDetailsLoading,
  } = useLeagueDetails(leagueId, { mode });
  const routeTeam = isLegacyTeamRoute
    ? null
    : leagueTeams.find(
        (item) => toRouteSlug(item.code) === teamSlug || toRouteSlug(item.name) === teamSlug,
      );
  const id = isLegacyTeamRoute ? teamSlug : routeTeam?.id;
  const { team, loading: teamLoading, uploadLogo, updateTeam } = useTeamDetails(id, { mode });
  useDocumentIcon(team?.icon);
  useEffect(() => {
    if (!team?.name) return;
    document.title = team.name;
    return () => {
      document.title = 'Hockey Tracker';
    };
  }, [team?.name]);
  const loading =
    teamLoading ||
    (!isLegacyLeagueRoute && leaguesLoading) ||
    (!isLegacyTeamRoute && leagueDetailsLoading);
  const { groups } = useLeagueGroups(isAdminView ? (team?.league_id ?? undefined) : undefined);
  const [activeTab, handleTabChange] = useTabState(
    isAdminView ? 'tab:team-details' : 'tab:user-team-details',
  );
  const leagueDetailsPath = buildLeagueDetailsPath({
    leagueCode: team?.league_code,
    leagueId: team?.league_id ?? leagueId,
  });
  const breadcrumbItems = isAdminView
    ? [
        {
          label: team?.league_code ?? '...',
          path: leagueDetailsPath,
        },
        { label: team?.name ?? '...' },
      ]
    : [
        { label: 'Games', path: '/games' },
        { label: team?.league_code ?? '...' },
        { label: team?.name ?? '...' },
      ];

  const backPath = isAdminView ? leagueDetailsPath : '/games';
  const backTooltip = isAdminView ? 'Back to League Details' : 'Back to Games';

  usePageBreadcrumbs(
    loading
      ? null
      : {
          backPath,
          backLabel: backTooltip,
          items: breadcrumbItems,
        },
    [loading, backPath, isAdminView, team?.league_name, team?.league_code, team?.name, leagueId],
  );

  useEffect(() => {
    if (!team || isLegacyLeagueRoute || isLegacyTeamRoute) return;
    const canonicalPath = isAdminView
      ? buildTeamDetailsPath({
          leagueCode: team.league_code,
          leagueId: team.league_id,
          teamCode: team.code,
          teamId: team.id,
        })
      : buildUserTeamDetailsPath({
          leagueCode: team.league_code,
          leagueId: team.league_id,
          teamCode: team.code,
          teamId: team.id,
        });
    if (
      leagueSlug !== toRouteSlug(team.league_code) ||
      teamSlug !== toRouteSlug(team.code)
    ) {
      navigate(canonicalPath, { replace: true });
    }
  }, [
    isAdminView,
    isLegacyLeagueRoute,
    isLegacyTeamRoute,
    leagueSlug,
    navigate,
    team,
    teamSlug,
  ]);

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

  const tabs = [
    {
      label: 'Info',
      icon: 'info',
      content: (
        <TeamInfoTab
          team={team}
          groups={groups}
          uploadLogo={uploadLogo}
          updateTeam={updateTeam}
          readOnly={!isAdminView}
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
          scope="team"
          readOnly
          mode={mode}
        />
      ),
    },
    isAdminView
      ? {
          label: 'Seasons',
          icon: 'calendar_month',
          content: (
            <TeamSeasonsTab
              teamId={team.id}
              teamCode={team.code}
              leagueId={team.league_id}
              leagueCode={team.league_code}
            />
          ),
        }
      : null,
    isAdminView
      ? {
          label: 'History',
          icon: 'history',
          content: (
            <TeamHistoryTab
              teamId={team.id}
              leagueId={team.league_id}
              teamName={team.name}
              teamPlaceName={team.place_name}
              teamNickname={team.team_name}
              teamCode={team.code}
              teamLogoDark={team.logo_dark}
              teamLogoLight={team.logo_light}
              teamIcon={team.icon}
              primaryColor={team.primary_color}
              textColor={team.text_color}
              uploadLogo={uploadLogo}
            />
          ),
        }
      : null,
  ].filter((tab): tab is NonNullable<typeof tab> => tab !== null);

  return (
    <>
      <Tabs
        selectedIndex={activeTab}
        onSelectedIndexChange={handleTabChange}
        tabs={tabs}
      />
    </>
  );
};

export default TeamDetailsPage;
