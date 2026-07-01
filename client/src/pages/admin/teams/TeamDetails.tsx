import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Tabs from '@/components/Tabs/Tabs';
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
import TeamGamesTab from './TeamGamesTab';
import TeamPlayersTab from './TeamPlayersTab';
import TeamHistoryTab from './TeamHistoryTab';
import styles from './TeamDetails.module.scss';

const getCurrentMonthStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

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
  const [searchParams] = useSearchParams();
  const routeSeasonParam = searchParams.get('season');
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
    seasons: leagueSeasons,
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
  const [teamGamesCalendarMonth, setTeamGamesCalendarMonth] = useState<Date>(getCurrentMonthStart);
  const routeSeason = routeSeasonParam
    ? leagueSeasons.find(
        (season) =>
          season.id === routeSeasonParam ||
          toRouteSlug(season.name) === toRouteSlug(routeSeasonParam),
      )
    : null;
  const routeSeasonId =
    routeSeason?.id ??
    (routeSeasonParam && UUID_PATTERN.test(routeSeasonParam) ? routeSeasonParam : null);
  const canonicalSeasonParam = routeSeason ? toRouteSlug(routeSeason.name) : routeSeasonId;
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
    : [];

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
          seasonName: routeSeason?.name,
          seasonId: routeSeasonId,
        })
      : buildUserTeamDetailsPath({
          leagueCode: team.league_code,
          leagueId: team.league_id,
          teamCode: team.code,
          teamId: team.id,
          seasonName: routeSeason?.name,
          seasonId: routeSeasonId,
        });
    if (
      leagueSlug !== toRouteSlug(team.league_code) ||
      teamSlug !== toRouteSlug(team.code) ||
      (routeSeasonParam ?? null) !== (canonicalSeasonParam ?? null)
    ) {
      navigate(canonicalPath, { replace: true });
    }
  }, [
    canonicalSeasonParam,
    isAdminView,
    isLegacyLeagueRoute,
    isLegacyTeamRoute,
    leagueSlug,
    navigate,
    routeSeason?.name,
    routeSeasonId,
    routeSeasonParam,
    team,
    teamSlug,
  ]);

  useEffect(() => {
    if (loading || team) return;
    navigate(backPath, { replace: true });
  }, [backPath, loading, navigate, team]);

  useEffect(() => {
    setTeamGamesCalendarMonth(getCurrentMonthStart());
  }, [team?.id]);

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
      label: 'Games',
      icon: 'sports_hockey',
      content: (
        <TeamGamesTab
          teamId={team.id}
          teamName={team.name}
          leagueId={team.league_id ?? leagueId ?? ''}
          leagueCode={team.league_code}
          calendarMonth={teamGamesCalendarMonth}
          onCalendarMonthChange={setTeamGamesCalendarMonth}
          mode={mode}
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
          readOnly={!isAdminView}
          mode={mode}
        />
      ),
    },
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
        activeIndex={activeTab}
        onTabChange={handleTabChange}
        tabs={tabs}
      />
    </>
  );
};

export default TeamDetailsPage;
