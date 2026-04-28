import { useState } from 'react';
import Card from '@/components/Card/Card';
import EntityHeader from '@/components/EntityHeader/EntityHeader';
import { type GroupRecord } from '@/hooks/useLeagueGroups';
import { type TeamDetailRecord } from '@/hooks/useTeamDetails';
import { type CreateTeamData } from '@/hooks/useTeams';
import TeamEditModal from '@/pages/admin/teams/TeamEditModal';
import TeamInfoGrid from '@/pages/admin/teams/TeamInfoGrid';

interface Props {
  team: TeamDetailRecord;
  groups: GroupRecord[];
  uploadLogo: (file: File) => Promise<string | null>;
  updateTeam: (id: string, payload: Partial<CreateTeamData>) => Promise<boolean>;
}

const TeamInfoTab = ({ team, groups, uploadLogo, updateTeam }: Props) => {
  const [editModalOpen, setEditModalOpen] = useState(false);

  const userGroups = groups.filter((g) => !g.is_auto && g.teams.some((t) => t.id === team.id));
  const allGroupLabels = userGroups.map((g) => {
    if (g.parent_id) {
      const parent = groups.find((p) => p.id === g.parent_id);
      return parent ? `${parent.name} – ${g.name}` : g.name;
    }
    return g.name;
  });
  // Only show the latest (last in sort order) group
  const groupLabel = allGroupLabels.length > 0 ? allGroupLabels[allGroupLabels.length - 1] : null;

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
          groupLabel={groupLabel}
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
