import { useState, useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import Card from '../../../components/Card/Card';
import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal';
import { type GroupRecord } from '../../../hooks/useLeagueGroups';
import { type TeamDetailRecord } from '../../../hooks/useTeamDetails';
import { type CreateTeamData } from '../../../hooks/useTeams';
import useSeasons from '../../../hooks/useSeasons';
import TeamInfoGrid, { type FormValues, seasonLabel, type SeasonOption } from './TeamInfoGrid';
import EntityHeader from '../../../components/EntityHeader/EntityHeader';

const normalizeDescription = (html: string | null | undefined): string | null => {
  if (!html || html === '<p></p>') return null;
  return html;
};

interface Props {
  team: TeamDetailRecord;
  groups: GroupRecord[];
  uploadLogo: (file: File) => Promise<string | null>;
  updateTeam: (id: string, payload: Partial<CreateTeamData>) => Promise<boolean>;
  onEditingChange: (isEditing: boolean) => void;
}

const TeamInfoTab = (props: Props) => {
  const { team, groups, uploadLogo, updateTeam, onEditingChange } = props;
  const [isEditing, setIsEditing] = useState(false);
  const { seasons } = useSeasons();

  // League seasons sorted newest-first, used for the two season selects
  const seasonOptions: SeasonOption[] = seasons
    .filter((s) => team.league_id && s.league_id === team.league_id)
    .sort((a, b) => {
      if (!a.start_date && !b.start_date) return 0;
      if (!a.start_date) return 1;
      if (!b.start_date) return -1;
      return b.start_date.localeCompare(a.start_date);
    })
    .map((s) => ({ value: s.id, label: seasonLabel(s.start_date, s.end_date, s.name) }));

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      logo: null,
      name: '',
      code: '',
      city: '',
      home_arena: '',
      primary_color: '#334155',
      secondary_color: '#1e293b',
      text_color: '#ffffff',
      description: null,
      start_season_id: '',
      latest_season_id: '',
    },
  });

  useEffect(() => {
    if (isEditing && team) {
      reset({
        logo: team.logo ?? null,
        name: team.name,
        code: team.code,
        city: team.city ?? '',
        home_arena: team.home_arena ?? '',
        primary_color: team.primary_color,
        secondary_color: team.secondary_color,
        text_color: team.text_color,
        description: team.description ?? null,
        start_season_id: team.start_season_id ?? '',
        latest_season_id: team.latest_season_id ?? '',
      });
    }
  }, [isEditing, team, reset]);

  const blocker = useBlocker(isEditing);

  const setEditing = (value: boolean) => {
    setIsEditing(value);
    onEditingChange(value);
  };

  const handleCancel = () => {
    setEditing(false);
    reset();
  };

  const onSubmit = handleSubmit(async (data) => {
    let logoUrl: string | null = typeof data.logo === 'string' ? data.logo : null;
    if (data.logo instanceof File) {
      const url = await uploadLogo(data.logo);
      if (!url) return;
      logoUrl = url;
    }
    const payload: Partial<CreateTeamData> = {
      logo: logoUrl,
      name: data.name,
      code: data.code,
      city: data.city || undefined,
      home_arena: data.home_arena || undefined,
      primary_color: data.primary_color,
      secondary_color: data.secondary_color,
      text_color: data.text_color,
      description: normalizeDescription(data.description) ?? undefined,
      start_season_id: data.start_season_id || null,
      latest_season_id: data.latest_season_id || null,
    };
    const ok = await updateTeam(team.id, payload);
    if (ok) setEditing(false);
  });

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
          isEditing={isEditing}
          onEdit={() => setEditing(true)}
          swatches={[
            { label: 'Primary', color: team.primary_color },
            { label: 'Secondary', color: team.secondary_color },
            { label: 'Text', color: team.text_color },
          ]}
          control={control}
          formId="team-edit-form"
          onCancel={handleCancel}
          isSubmitting={isSubmitting}
        />
        <TeamInfoGrid
          isEditing={isEditing}
          team={team}
          teamGroupLabels={teamGroupLabels}
          control={control}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          seasonOptions={seasonOptions}
        />
      </Card>

      <ConfirmModal
        open={blocker.state === 'blocked'}
        title="Unsaved Changes"
        body="You have unsaved changes. Are you sure you want to leave?"
        confirmLabel="Leave without saving"
        variant="danger"
        onCancel={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      />
    </>
  );
};

export default TeamInfoTab;
