import { useState } from 'react';
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
import styles from './TeamDetails.module.scss';

const TeamDetailsPage = () => {
  const navigate = useNavigate();
  const { id, leagueId } = useParams<{ id: string; leagueId?: string }>();
  const { team, loading, uploadLogo, updateTeam } = useTeamDetails(id);
  const { groups } = useLeagueGroups(team?.league_id ?? undefined);
  const [isEditing, setIsEditing] = useState(false);

  const fromLeague = Boolean(leagueId);

  const breadcrumbItems = fromLeague
    ? [
        { label: 'Leagues', path: '/admin/leagues' },
        { label: team?.league_name ?? '…', path: `/admin/leagues/${leagueId}` },
        { label: team?.name ?? '…' },
      ]
    : [{ label: 'Teams', path: '/admin/teams' }, { label: team?.name ?? '…' }];

  const backPath = fromLeague ? `/admin/leagues/${leagueId}` : '/admin/teams';
  const backTooltip = fromLeague ? 'Back to League Details' : 'Back to Teams';

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
            onClick={() => navigate(backPath, fromLeague ? { state: { activeTab: 1 } } : undefined)}
          />
        }
        right={<Breadcrumbs items={breadcrumbItems} />}
      />

      <Tabs
        disabled={isEditing}
        tabs={[
          {
            label: 'Info',
            content: (
              <TeamInfoTab
                team={team}
                groups={groups}
                uploadLogo={uploadLogo}
                updateTeam={updateTeam}
                onEditingChange={setIsEditing}
              />
            ),
          },
          { label: 'Games', content: <TeamGamesTab /> },
          { label: 'Roster', content: <TeamRosterTab /> },
          { label: 'Prospects', content: <TeamProspectsTab /> },
        ]}
      />
    </>
  );
};

export default TeamDetailsPage;
