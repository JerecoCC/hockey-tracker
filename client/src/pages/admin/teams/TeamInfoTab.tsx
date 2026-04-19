import { useState } from 'react';
import Card from '../../../components/Card/Card';
import EntityHeader from '../../../components/EntityHeader/EntityHeader';
import { type GroupRecord } from '../../../hooks/useLeagueGroups';
import { type TeamDetailRecord } from '../../../hooks/useTeamDetails';
import { type CreateTeamData } from '../../../hooks/useTeams';
import TeamEditModal from './TeamEditModal';
import TeamInfoGrid from './TeamInfoGrid';

interface Props {
  team: TeamDetailRecord;
  groups: GroupRecord[];
  uploadLogo: (file: File) => Promise<string | null>;
  updateTeam: (id: string, payload: Partial<CreateTeamData>) => Promise<boolean>;
}

const TeamInfoTab = ({ team, groups, uploadLogo, updateTeam }: Props) => {
  const [editModalOpen, setEditModalOpen] = useState(false);

  const teamGroupLabels = groups
    .filter((g) => g.teams.some((t) => t.id === team.id))
    .map((g) => {
      if (g.parent_id) {
        const parent = groups.find((p) => p.id === g.parent_id);
        return parent ? `${parent.name} – ${g.name}` : g.name;
      }
      return g.name;
    });

  return (
    <>
      <Card>
        <EntityHeader
          logo={team.logo}
          name={team.name}
          code={team.code}
          primaryColor={team.primary_color}
          textColor={team.text_color}
          onEdit={() => setEditModalOpen(true)}
          swatches={[
            { label: 'Primary', color: team.primary_color },
            { label: 'Secondary', color: team.secondary_color },
            { label: 'Text', color: team.text_color },
          ]}
        />
        <TeamInfoGrid
          team={team}
          teamGroupLabels={teamGroupLabels}
        />
      </Card>

      <TeamEditModal
        open={editModalOpen}
        team={team}
        uploadLogo={uploadLogo}
        updateTeam={updateTeam}
        onClose={() => setEditModalOpen(false)}
      />
    </>
  );
};

export default TeamInfoTab;
