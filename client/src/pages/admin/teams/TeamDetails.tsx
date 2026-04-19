import { useNavigate, useParams } from 'react-router-dom';
import Breadcrumbs from '../../../components/Breadcrumbs/Breadcrumbs';
import Button from '../../../components/Button/Button';
import Tabs from '../../../components/Tabs/Tabs';
import TitleRow from '../../../components/TitleRow/TitleRow';
import useTeamDetails from '../../../hooks/useTeamDetails';
import useLeagueGroups from '../../../hooks/useLeagueGroups';
import TeamInfoTab from './TeamInfoTab';
import TeamGamesTab from './TeamGamesTab';
import TeamRosterTab from './TeamRosterTab';
import TeamProspectsTab from './TeamProspectsTab';
import TeamHistoryTab from './TeamHistoryTab';
import styles from './TeamDetails.module.scss';

const TeamDetailsPage = () => {
  const navigate = useNavigate();
  const { id, leagueId } = useParams<{ id: string; leagueId: string }>();
  const { team, loading, uploadLogo, updateTeam } = useTeamDetails(id);
  const { groups } = useLeagueGroups(team?.league_id ?? undefined);
  const breadcrumbItems = [
    { label: 'Leagues', path: '/admin/leagues' },
    { label: team?.league_name ?? '…', path: `/admin/leagues/${leagueId}` },
    { label: team?.name ?? '…' },
  ];

  const backPath = `/admin/leagues/${leagueId}`;
  const backTooltip = 'Back to League Details';

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
      <TitleRow
        left={
          <Button
            variant="outlined"
            intent="neutral"
            icon="arrow_back"
            tooltip={backTooltip}
            onClick={() => navigate(backPath, { state: { activeTab: 1 } })}
          />
        }
        right={<Breadcrumbs items={breadcrumbItems} />}
      />

      <Tabs
        tabs={[
          {
            label: 'Info',
            content: (
              <TeamInfoTab
                team={team}
                groups={groups}
                uploadLogo={uploadLogo}
                updateTeam={updateTeam}
              />
            ),
          },
          { label: 'Games', content: <TeamGamesTab /> },
          {
            label: 'Roster',
            content: (
              <TeamRosterTab
                teamId={team.id}
                leagueId={team.league_id ?? ''}
                latestSeasonId={team.latest_season_id ?? null}
              />
            ),
          },
          { label: 'Prospects', content: <TeamProspectsTab /> },
          {
            label: 'History',
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
