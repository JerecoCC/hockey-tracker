import { useParams } from 'react-router-dom';
import Tabs from '@/components/Tabs/Tabs';
import { usePageBreadcrumbs } from '@/context/BreadcrumbContext';
import useTeamDetails from '@/hooks/useTeamDetails';
import useLeagueGroups from '@/hooks/useLeagueGroups';
import useTabState from '@/hooks/useTabState';
import TeamInfoTab from './TeamInfoTab';
import TeamGamesTab from './TeamGamesTab';
import TeamRosterTab from './TeamRosterTab';
import TeamProspectsTab from './TeamProspectsTab';
import TeamHistoryTab from './TeamHistoryTab';
import styles from './TeamDetails.module.scss';

const TeamDetailsPage = () => {
  const { id, leagueId } = useParams<{ id: string; leagueId: string }>();
  const { team, loading, uploadLogo, updateTeam } = useTeamDetails(id);
  const { groups } = useLeagueGroups(team?.league_id ?? undefined);
  const [activeTab, handleTabChange] = useTabState('tab:team-details');
  const breadcrumbItems = [
    { label: 'Leagues', path: '/admin/leagues' },
    {
      label: team?.league_name ?? '…',
      shortLabel: team?.league_code ?? undefined,
      path: `/admin/leagues/${leagueId}`,
    },
    { label: team?.name ?? '…' },
  ];

  const backPath = `/admin/leagues/${leagueId}`;
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
                leagueId={leagueId ?? ''}
              />
            ),
          },
          {
            label: 'Roster',
            icon: 'set_lineup',
            content: (
              <TeamRosterTab
                teamId={team.id}
                leagueId={team.league_id ?? ''}
                latestSeasonId={team.latest_season_id ?? null}
              />
            ),
          },
          {
            label: 'Prospects',
            icon: 'search',
            content: (
              <TeamProspectsTab
                teamId={team.id}
                leagueId={team.league_id ?? ''}
                latestSeasonId={team.latest_season_id ?? null}
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
