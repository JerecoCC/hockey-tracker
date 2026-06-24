import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import ActionOverlay from '@/components/ActionOverlay/ActionOverlay';
import Accordion from '@/components/Accordion/Accordion';
import Tag from '@/components/Tag/Tag';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import Field from '@/components/Field/Field';
import Icon from '@/components/Icon/Icon';
import ListItem from '@/components/ListItem/ListItem';
import Modal from '@/components/Modal/Modal';
import SearchField from '@/components/SearchField/SearchField';
import SegmentedControl from '@/components/SegmentedControl/SegmentedControl';
import SelectableListItem from '@/components/SelectableListItem/SelectableListItem';
import Skeleton from '@/components/Skeleton/Skeleton';
import Tooltip from '@/components/Tooltip/Tooltip';
import { type GroupTeamRecord } from '@/hooks/useLeagueGroups';
import useGroupAlignmentSets, {
  type AlignmentGroupRecord,
  type GroupAlignmentSet,
  type GroupAlignmentStructureType,
} from '@/hooks/useGroupAlignmentSets';
import { type SeasonGroupRecord } from '@/hooks/useSeasonDetails';
import { type TeamRecord } from '@/hooks/useTeams';
import { useLeagueDetailsContext } from './LeagueDetailsContext';
import { TabActionSkeleton, type TabSkeletonProps } from './LeagueTabSkeletonHelpers';
import styles from './LeagueDetails.module.scss';

interface Props {
  className?: string;
}

interface AlignmentFormValues {
  name: string;
  structure_type: GroupAlignmentStructureType;
}

interface AlignmentGroupFormValues {
  name: string;
  role: 'conference' | 'division' | '__none__';
  parent_id: string;
}

interface AlignmentGroupNameFormValues {
  name: string;
}

type DraftAlignmentGroup = AlignmentGroupRecord & {
  client_id: string;
  parent_client_id: string | null;
};

interface DraftAlignmentDetails {
  groups: DraftAlignmentGroup[];
  teams: GroupTeamRecord[];
}

const ROLE_LABELS: Record<string, string> = { conference: 'Conference', division: 'Division' };
const ALIGNMENT_TITLE_TOOLTIP = 'Define reusable team lists and group structures for seasons.';

const AlignmentCardTitle = () => (
  <>
    Team Alignments
    <Tooltip text={ALIGNMENT_TITLE_TOOLTIP}>
      <span
        className={styles.alignmentTitleInfo}
        aria-label={ALIGNMENT_TITLE_TOOLTIP}
        tabIndex={0}
      >
        <Icon
          name="info"
          size="0.95rem"
        />
      </span>
    </Tooltip>
  </>
);

const countGroupTeams = (group: DraftAlignmentGroup, allGroups: DraftAlignmentGroup[]) => {
  const teamIds = new Set<string>();
  const collect = (current: DraftAlignmentGroup) => {
    current.teams.forEach((team) => teamIds.add(team.id));
    allGroups
      .filter((candidate) => candidate.parent_id === current.id)
      .forEach((child) => collect(child));
  };

  collect(group);
  return teamIds.size;
};

const defaultName = (structureType: GroupAlignmentStructureType) =>
  structureType === 'league' ? 'Team List' : 'Current Groups';

const newDraftId = () => `draft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const isDraftId = (id: string) => id.startsWith('draft-');

const teamRecordToGroupTeam = (team: TeamRecord): GroupTeamRecord => ({
  id: team.id,
  name: team.name,
  place_name: team.place_name,
  team_name: team.team_name,
  code: team.code,
  logo: team.logo,
  logo_dark: team.logo_dark,
  logo_light: team.logo_light,
  primary_color: team.primary_color,
  text_color: team.text_color,
  home_arena: team.home_arena,
});

const teamsFromIds = (leagueTeams: TeamRecord[], teamIds: string[]): GroupTeamRecord[] =>
  teamIds
    .map((teamId) => leagueTeams.find((team) => team.id === teamId))
    .filter((team): team is TeamRecord => Boolean(team))
    .map(teamRecordToGroupTeam);

const draftFromDetails = (details: GroupAlignmentSet | null): DraftAlignmentDetails => ({
  groups: (details?.groups ?? []).map((group) => ({
    ...group,
    client_id: group.id,
    parent_client_id: group.parent_id,
  })),
  teams: details?.teams ?? [],
});

const draftHasContent = (draft: DraftAlignmentDetails) =>
  draft.teams.length > 0 ||
  draft.groups.length > 0 ||
  draft.groups.some((group) => group.teams.length > 0);

const AlignmentStructureField = ({
  control,
  value,
  disabled,
  onChange,
}: {
  control: unknown;
  value: GroupAlignmentStructureType;
  disabled: boolean;
  onChange: (value: GroupAlignmentStructureType) => void;
}) => {
  return (
    <Field
      type="custom"
      label="Uses groups?"
      control={control}
      name="structure_type"
    >
      <div className={styles.alignmentBooleanField}>
        <SegmentedControl
          className={styles.alignmentStructureSegmented}
          variant="field"
          value={value}
          options={[
            { value: 'groups', label: 'Yes', tooltip: 'Organize teams into groups' },
            { value: 'league', label: 'No', tooltip: 'Use one league-wide team list' },
          ]}
          disabled={disabled}
          onChange={(next) => onChange(next as GroupAlignmentStructureType)}
        />
      </div>
    </Field>
  );
};

const countLabel = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

const alignmentCountLabel = (alignmentSet: GroupAlignmentSet) => {
  const teams = alignmentSet.team_count ?? 0;
  if (alignmentSet.structure_type === 'league') {
    return `${countLabel(teams, 'team')}, no groups`;
  }
  const conferences = alignmentSet.conference_count ?? 0;
  const divisions = alignmentSet.division_count ?? 0;
  return `${countLabel(conferences, 'conference')}, ${countLabel(divisions, 'division')}, ${countLabel(teams, 'team')}`;
};

const TeamSelectionModal = ({
  open,
  title,
  teams,
  selectedIds,
  disabled,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  teams: TeamRecord[];
  selectedIds: string[];
  disabled: boolean;
  onClose: () => void;
  onSave: (teamIds: string[]) => Promise<boolean>;
}) => {
  const [draftIds, setDraftIds] = useState<string[]>(selectedIds);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    setDraftIds(selectedIds);
    setQuery('');
  }, [open, selectedIds]);

  const selectedSet = new Set(draftIds);
  const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));
  const filteredTeams = query.trim()
    ? sortedTeams.filter((team) => {
        const q = query.trim().toLowerCase();
        return (
          team.name.toLowerCase().includes(q) ||
          (team.team_name ?? '').toLowerCase().includes(q) ||
          (team.place_name ?? '').toLowerCase().includes(q) ||
          team.code.toLowerCase().includes(q)
        );
      })
    : sortedTeams;

  const toggleTeam = (teamId: string) => {
    setDraftIds((current) =>
      current.includes(teamId) ? current.filter((id) => id !== teamId) : [...current, teamId],
    );
  };

  const handleSave = async () => {
    const ok = await onSave(draftIds);
    if (ok) onClose();
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      onConfirm={handleSave}
      confirmLabel="Save Teams"
      confirmIcon="save"
      confirmDisabled={disabled}
      busy={disabled}
      size="md"
      footerStart={
        <span>
          {draftIds.length > 0
            ? `${draftIds.length} team${draftIds.length !== 1 ? 's' : ''} selected`
            : 'No teams selected'}
        </span>
      }
    >
      <div className={styles.alignmentTeamModalControls}>
        <SearchField
          className={styles.alignmentTeamModalSearch}
          placeholder="Search teams..."
          value={query}
          onChange={setQuery}
          autoFocus
        />
      </div>
      {filteredTeams.length === 0 ? (
        <p className={styles.alignmentTeamModalEmpty}>
          {teams.length === 0 ? 'No teams are available.' : `No teams match "${query}".`}
        </p>
      ) : (
        <ul className={styles.alignmentTeamModalList}>
          {filteredTeams.map((team) => (
            <SelectableListItem
              key={team.id}
              checked={selectedSet.has(team.id)}
              disabled={disabled}
              onToggle={() => toggleTeam(team.id)}
              image={team.logo}
              imageBackground={false}
              imagePlaceholder={team.code.slice(0, 3)}
              imagePrimaryColor={team.primary_color}
              imageTextColor={team.text_color}
              name={team.team_name || team.name}
              eyebrow={team.place_name || undefined}
              rightContent={<span className={styles.alignmentTeamModalCode}>{team.code}</span>}
            />
          ))}
        </ul>
      )}
    </Modal>
  );
};

const CreateAlignmentGroupModal = ({
  open,
  parentGroup,
  disabled,
  onClose,
  onCreate,
}: {
  open: boolean;
  parentGroup?: SeasonGroupRecord | null;
  disabled: boolean;
  onClose: () => void;
  onCreate: (payload: {
    name: string;
    parent_id?: string | null;
    role?: 'conference' | 'division' | null;
  }) => Promise<boolean>;
}) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, isValid },
  } = useForm<AlignmentGroupFormValues>({
    defaultValues: { name: '', role: 'conference', parent_id: '__none__' },
    mode: 'onChange',
  });
  const isSubgroup = !!parentGroup;

  useEffect(() => {
    if (!open) return;
    reset({
      name: '',
      role: isSubgroup ? 'division' : 'conference',
      parent_id: parentGroup?.id ?? '__none__',
    });
  }, [isSubgroup, open, parentGroup?.id, reset]);

  const onSubmit = handleSubmit(async ({ name, role, parent_id }) => {
    const ok = await onCreate({
      name: name.trim(),
      role: isSubgroup ? 'division' : role === '__none__' ? null : role,
      parent_id: isSubgroup ? parentGroup?.id : parent_id === '__none__' ? null : parent_id,
    });
    if (ok) onClose();
  });

  return (
    <Modal
      open={open}
      title={isSubgroup ? `Create Subgroup - ${parentGroup?.name}` : 'Create Group'}
      onClose={onClose}
      onConfirm={onSubmit}
      confirmLabel={
        isSubmitting || disabled ? 'Creating...' : isSubgroup ? 'Create Subgroup' : 'Create Group'
      }
      confirmIcon="add"
      confirmDisabled={isSubmitting || disabled || !isValid}
      busy={isSubmitting || disabled}
    >
      <div className={styles.alignmentSetForm}>
        <Field
          label="Name"
          control={control}
          name="name"
          disabled={isSubmitting || disabled}
          rules={{ required: 'Name is required' }}
          autoFocus
        />
        {!isSubgroup && (
          <Field
            type="select"
            label="Role"
            control={control}
            name="role"
            disabled={isSubmitting || disabled}
            options={[
              { value: 'conference', label: 'Conference' },
              { value: '__none__', label: 'None' },
            ]}
          />
        )}
      </div>
    </Modal>
  );
};

const EditAlignmentGroupModal = ({
  open,
  group,
  disabled,
  onClose,
  onUpdate,
}: {
  open: boolean;
  group: SeasonGroupRecord;
  disabled: boolean;
  onClose: () => void;
  onUpdate: (payload: { name: string }) => Promise<boolean>;
}) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, isValid },
  } = useForm<AlignmentGroupNameFormValues>({
    defaultValues: { name: group.name },
    mode: 'onChange',
  });

  useEffect(() => {
    if (!open) return;
    reset({ name: group.name });
  }, [group.name, open, reset]);

  const onSubmit = handleSubmit(async ({ name }) => {
    const ok = await onUpdate({ name: name.trim() });
    if (ok) onClose();
  });

  return (
    <Modal
      open={open}
      title="Edit Group"
      onClose={onClose}
      onConfirm={onSubmit}
      confirmLabel={isSubmitting || disabled ? 'Saving...' : 'Save Group'}
      confirmIcon="save"
      confirmDisabled={isSubmitting || disabled || !isValid}
      busy={isSubmitting || disabled}
    >
      <div className={styles.alignmentSetForm}>
        <Field
          label="Name"
          control={control}
          name="name"
          disabled={isSubmitting || disabled}
          rules={{ required: 'Name is required' }}
          autoFocus
        />
      </div>
    </Modal>
  );
};

const AlignmentGroupNode = ({
  group,
  allGroups,
  leagueTeams,
  busy,
  editMode,
  onAddSubgroup,
  onUpdateGroup,
  onDeleteGroup,
  onSetGroupTeams,
}: {
  group: DraftAlignmentGroup;
  allGroups: DraftAlignmentGroup[];
  leagueTeams: TeamRecord[];
  busy: string | null;
  editMode: boolean;
  onAddSubgroup: (
    parentGroup: DraftAlignmentGroup,
    payload: {
      name: string;
      parent_id?: string | null;
      role?: 'conference' | 'division' | null;
    },
  ) => Promise<boolean>;
  onUpdateGroup: (groupId: string, payload: { name: string }) => Promise<boolean>;
  onDeleteGroup: (groupId: string) => Promise<boolean>;
  onSetGroupTeams: (groupId: string, teamIds: string[]) => Promise<boolean>;
}) => {
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [editGroupModalOpen, setEditGroupModalOpen] = useState(false);
  const [createSubgroupModalOpen, setCreateSubgroupModalOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const children = allGroups
    .filter((g) => g.parent_id === group.id)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const isLeaf = children.length === 0;
  const canHaveSubgroups = group.parent_id === null && group.role !== 'division';
  const roleLabel = group.role ? ROLE_LABELS[group.role] : null;
  const teamCount = countGroupTeams(group, allGroups);
  const removeTeam = (teamId: string) => {
    void onSetGroupTeams(
      group.id,
      group.teams.filter((team) => team.id !== teamId).map((team) => team.id),
    );
  };

  return (
    <li className={styles.groupItem}>
      <Accordion
        label={<span className={styles.groupLabel}>{group.name}</span>}
        labelMeta={
          <span
            className={styles.groupTeamCount}
            title={`${teamCount} ${teamCount === 1 ? 'team' : 'teams'}`}
          >
            ({teamCount} {teamCount === 1 ? 'team' : 'teams'})
          </span>
        }
        headerRight={
          roleLabel ? (
            <Tag
              label={roleLabel}
              intent={group.role === 'division' ? 'success' : 'info'}
            />
          ) : null
        }
        hoverActions={
          editMode
            ? [
                {
                  icon: 'edit',
                  tooltip: 'Edit group',
                  disabled: busy === group.id,
                  onClick: () => setEditGroupModalOpen(true),
                },
                ...(canHaveSubgroups
                  ? [
                      {
                        icon: 'add',
                        tooltip: 'Create subgroup',
                        intent: 'accent',
                        disabled: busy === group.id,
                        onClick: () => setCreateSubgroupModalOpen(true),
                      },
                    ]
                  : []),
                ...(isLeaf
                  ? [
                      {
                        icon: 'group_add',
                        tooltip: 'Edit teams',
                        intent: 'accent',
                        disabled: busy === group.id,
                        onClick: () => setTeamModalOpen(true),
                      },
                    ]
                  : []),
                {
                  icon: 'delete',
                  tooltip: 'Delete group',
                  intent: 'danger',
                  disabled: busy === group.id,
                  onClick: () => setConfirmDeleteOpen(true),
                },
              ]
            : undefined
        }
      >
        {isLeaf && group.teams.length > 0 && (
          <ul className={styles.alignmentTeamList}>
            {group.teams.map((team) => (
              <ListItem
                key={team.id}
                image={team.logo}
                eyebrow={team.place_name || ''}
                name={team.team_name || team.name}
                variant="plain"
                rightContent={{ type: 'code', value: team.code }}
                primaryColor={team.primary_color}
                textColor={team.text_color}
                actions={[
                  {
                    icon: 'close',
                    tooltip: 'Remove team',
                    intent: 'danger',
                    disabled: busy === group.id,
                    onClick: () => removeTeam(team.id),
                  },
                ]}
              />
            ))}
          </ul>
        )}
        {isLeaf && group.teams.length === 0 && (
          <p className={`${styles.emptyMsg} ${styles.groupEmptyMsg}`}>
            No teams assigned to this group.
          </p>
        )}
        {children.length > 0 && (
          <div className={styles.groupNestedList}>
            <ul className={styles.alignmentGroupList}>
              {children.map((child) => (
                <AlignmentGroupNode
                  key={child.id}
                  group={child}
                  allGroups={allGroups}
                  leagueTeams={leagueTeams}
                  busy={busy}
                  editMode={editMode}
                  onAddSubgroup={onAddSubgroup}
                  onUpdateGroup={onUpdateGroup}
                  onDeleteGroup={onDeleteGroup}
                  onSetGroupTeams={onSetGroupTeams}
                />
              ))}
            </ul>
          </div>
        )}
      </Accordion>
      {isLeaf && (
        <TeamSelectionModal
          open={teamModalOpen}
          title={`${group.name} Teams`}
          teams={leagueTeams}
          selectedIds={group.teams.map((team) => team.id)}
          disabled={busy === group.id}
          onClose={() => setTeamModalOpen(false)}
          onSave={(teamIds) => onSetGroupTeams(group.id, teamIds)}
        />
      )}
      <EditAlignmentGroupModal
        open={editGroupModalOpen}
        group={group}
        disabled={busy === group.id}
        onClose={() => setEditGroupModalOpen(false)}
        onUpdate={(payload) => onUpdateGroup(group.id, payload)}
      />
      {canHaveSubgroups && (
        <CreateAlignmentGroupModal
          open={createSubgroupModalOpen}
          parentGroup={group}
          disabled={busy === group.id}
          onClose={() => setCreateSubgroupModalOpen(false)}
          onCreate={(payload) => onAddSubgroup(group, payload)}
        />
      )}
      <ConfirmModal
        open={confirmDeleteOpen}
        title="Delete Group"
        body={
          <>
            Delete <strong>{group.name}</strong>?
            {children.length > 0
              ? ' This will also delete its subgroups and their team assignments.'
              : ' Team assignments for this group will be removed.'}
          </>
        }
        confirmLabel="Delete"
        confirmIcon="delete"
        variant="danger"
        busy={busy === group.id}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={async () => {
          const ok = await onDeleteGroup(group.id);
          if (ok) setConfirmDeleteOpen(false);
        }}
      />
    </li>
  );
};

const AlignmentPanel = ({
  alignmentSet,
  busy,
  details,
  leagueTeams,
  editMode,
  editLocked,
  onLoadDetails,
  onDelete,
  onStartEdit,
  onStopEdit,
  onSave,
}: {
  alignmentSet: GroupAlignmentSet;
  busy: string | null;
  details: GroupAlignmentSet | null;
  leagueTeams: TeamRecord[];
  editMode: boolean;
  editLocked: boolean;
  onLoadDetails: (alignmentSetId: string) => void;
  onDelete: () => void;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onSave: (
    alignmentSetId: string,
    payload: {
      name: string;
      structure_type: GroupAlignmentStructureType;
      team_ids?: string[];
      groups?: {
        id?: string;
        client_id: string;
        parent_client_id?: string | null;
        name: string;
        role?: 'conference' | 'division' | null;
        sort_order?: number;
        team_ids?: string[];
      }[];
    },
  ) => Promise<GroupAlignmentSet | null>;
}) => {
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [confirmStructureChangeOpen, setConfirmStructureChangeOpen] = useState(false);
  const [pendingStructureType, setPendingStructureType] =
    useState<GroupAlignmentStructureType | null>(null);
  const [draftDetails, setDraftDetails] = useState<DraftAlignmentDetails>(() =>
    draftFromDetails(details),
  );
  const [draftDirty, setDraftDirty] = useState(false);
  const [flatTeamModalOpen, setFlatTeamModalOpen] = useState(false);
  const [createGroupModalOpen, setCreateGroupModalOpen] = useState(false);
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isDirty, isValid },
  } = useForm<AlignmentFormValues>({
    defaultValues: {
      name: alignmentSet.name,
      structure_type: alignmentSet.structure_type,
    },
    mode: 'onChange',
  });

  useEffect(() => {
    if (!editMode) return;
    onLoadDetails(alignmentSet.id);
  }, [alignmentSet.id, editMode, onLoadDetails]);

  useEffect(() => {
    reset({
      name: alignmentSet.name,
      structure_type: alignmentSet.structure_type,
    });
  }, [alignmentSet.name, alignmentSet.structure_type, reset]);

  useEffect(() => {
    if (!editMode || !details) return;
    setDraftDetails(draftFromDetails(details));
    setDraftDirty(false);
    setPendingStructureType(null);
    setConfirmStructureChangeOpen(false);
  }, [details, editMode]);

  const structureType = watch('structure_type');
  const detailsLoading = details === null;
  const hasChanges = isDirty || draftDirty;
  const groups = editMode ? draftDetails.groups : draftFromDetails(details).groups;
  const roots = groups
    .filter((group) => group.parent_id === null)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const flatTeams = editMode ? draftDetails.teams : (details?.teams ?? []);

  const discardEdits = () => {
    reset({
      name: alignmentSet.name,
      structure_type: alignmentSet.structure_type,
    });
    setDraftDetails(draftFromDetails(details));
    setDraftDirty(false);
    setPendingStructureType(null);
    setConfirmCancelOpen(false);
    setConfirmStructureChangeOpen(false);
    onStopEdit();
  };

  const handleCancelEdit = () => {
    if (isDirty || draftDirty) {
      setConfirmCancelOpen(true);
      return;
    }
    discardEdits();
  };

  const onSubmit = handleSubmit(async ({ name, structure_type }) => {
    const saved = await onSave(alignmentSet.id, {
      name: name.trim(),
      structure_type,
      team_ids: structure_type === 'league' ? draftDetails.teams.map((team) => team.id) : [],
      groups:
        structure_type === 'groups'
          ? draftDetails.groups.map((group) => ({
              id: isDraftId(group.id) ? undefined : group.id,
              client_id: group.client_id,
              parent_client_id: group.parent_id,
              name: group.name,
              role: group.role,
              sort_order: group.sort_order,
              team_ids: group.teams.map((team) => team.id),
            }))
          : [],
    });
    if (saved) {
      setDraftDetails(draftFromDetails(saved));
      setDraftDirty(false);
      onStopEdit();
    }
  });

  const headerMeta = alignmentCountLabel(alignmentSet);
  const alignmentActionIcon = structureType === 'groups' ? 'add' : 'group_add';
  const alignmentActionTooltip = structureType === 'groups' ? 'Create group' : 'Update teams';
  const handleAlignmentAction = () => {
    if (structureType === 'groups') {
      setCreateGroupModalOpen(true);
      return;
    }
    setFlatTeamModalOpen(true);
  };

  const applyStructureTypeChange = (next: GroupAlignmentStructureType) => {
    setValue('structure_type', next, { shouldDirty: true, shouldValidate: true });
    setDraftDetails({ groups: [], teams: [] });
    setDraftDirty(true);
    setPendingStructureType(null);
    setConfirmStructureChangeOpen(false);
  };

  const handleStructureTypeChange = (next: GroupAlignmentStructureType) => {
    if (next === structureType) return;
    if (draftHasContent(draftDetails)) {
      setPendingStructureType(next);
      setConfirmStructureChangeOpen(true);
      return;
    }
    applyStructureTypeChange(next);
  };

  const handleAddDraftGroup = async (
    parentGroup: DraftAlignmentGroup | null,
    payload: {
      name: string;
      parent_id?: string | null;
      role?: 'conference' | 'division' | null;
    },
  ) => {
    const id = newDraftId();
    setDraftDetails((current) => {
      const siblings = current.groups.filter(
        (group) => group.parent_id === (parentGroup?.id ?? null),
      );
      return {
        ...current,
        groups: [
          ...current.groups,
          {
            id,
            client_id: id,
            parent_client_id: parentGroup?.id ?? null,
            alignment_set_id: alignmentSet.id,
            league_id: alignmentSet.league_id,
            parent_id: parentGroup?.id ?? null,
            stable_key: null,
            name: payload.name,
            role: parentGroup ? 'division' : (payload.role ?? null),
            sort_order: siblings.length,
            created_at: new Date().toISOString(),
            is_auto: false,
            teams: [],
          },
        ],
      };
    });
    setDraftDirty(true);
    return true;
  };

  const handleUpdateDraftGroup = async (groupId: string, payload: { name: string }) => {
    setDraftDetails((current) => ({
      ...current,
      groups: current.groups.map((group) =>
        group.id === groupId ? { ...group, name: payload.name } : group,
      ),
    }));
    setDraftDirty(true);
    return true;
  };

  const handleDeleteDraftGroup = async (groupId: string) => {
    setDraftDetails((current) => {
      const removedIds = new Set([groupId]);
      current.groups.forEach((group) => {
        if (removedIds.has(group.parent_id ?? '')) removedIds.add(group.id);
      });
      return {
        ...current,
        groups: current.groups.filter((group) => !removedIds.has(group.id)),
      };
    });
    setDraftDirty(true);
    return true;
  };

  const handleSetDraftGroupTeams = async (groupId: string, teamIds: string[]) => {
    const nextTeams = teamsFromIds(leagueTeams, teamIds);
    setDraftDetails((current) => ({
      ...current,
      groups: current.groups.map((group) =>
        group.id === groupId ? { ...group, teams: nextTeams } : group,
      ),
    }));
    setDraftDirty(true);
    return true;
  };

  const handleSetDraftAlignmentTeams = async (teamIds: string[]) => {
    setDraftDetails((current) => ({ ...current, teams: teamsFromIds(leagueTeams, teamIds) }));
    setDraftDirty(true);
    return true;
  };
  const handleRemoveDraftAlignmentTeam = (teamId: string) => {
    setDraftDetails((current) => ({
      ...current,
      teams: current.teams.filter((team) => team.id !== teamId),
    }));
    setDraftDirty(true);
  };

  const editorBody = (
    <div className={styles.alignmentPanelBody}>
      <form
        className={styles.alignmentEditRow}
        onSubmit={onSubmit}
      >
        <div className={styles.alignmentEditNameRow}>
          <Field
            label="Name"
            control={control}
            name="name"
            disabled={busy === alignmentSet.id || detailsLoading}
            rules={{ required: 'Name is required' }}
          />
        </div>
        <div className={styles.alignmentEditControlsRow}>
          <AlignmentStructureField
            control={control}
            value={structureType}
            disabled={busy === alignmentSet.id || detailsLoading}
            onChange={handleStructureTypeChange}
          />
          <Button
            type="button"
            size="sm"
            variant="outlined"
            intent="accent"
            icon={alignmentActionIcon}
            disabled={busy === alignmentSet.id || detailsLoading}
            onClick={handleAlignmentAction}
          >
            {alignmentActionTooltip}
          </Button>
        </div>
        <Button
          type="submit"
          size="sm"
          icon="save"
          className={styles.srOnly}
          disabled={busy === alignmentSet.id || !isValid || detailsLoading || !hasChanges}
        >
          Save
        </Button>
      </form>

      {details === null ? (
        <div
          className={styles.tabSkeletonStack}
          role="status"
          aria-busy="true"
          aria-label="Loading alignment details"
        >
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton
              key={index}
              type="text"
              className={
                index === 2
                  ? styles.infoSkeletonDescriptionLineShort
                  : styles.infoSkeletonDescriptionLine
              }
            />
          ))}
        </div>
      ) : structureType === 'league' ? (
        flatTeams.length === 0 ? (
          <p className={styles.emptyMsg}>No teams are defined in this alignment.</p>
        ) : (
          <ul className={styles.alignmentTeamList}>
            {flatTeams.map((team) => (
              <ListItem
                key={team.id}
                image={team.logo}
                eyebrow={team.place_name || ''}
                name={team.team_name || team.name}
                rightContent={{ type: 'code', value: team.code }}
                primaryColor={team.primary_color}
                textColor={team.text_color}
                actions={[
                  {
                    icon: 'close',
                    tooltip: 'Remove team',
                    intent: 'danger',
                    disabled: busy === alignmentSet.id,
                    onClick: () => handleRemoveDraftAlignmentTeam(team.id),
                  },
                ]}
              />
            ))}
          </ul>
        )
      ) : roots.length === 0 ? (
        <p className={styles.emptyMsg}>No groups are defined in this alignment.</p>
      ) : (
        <ul className={styles.alignmentGroupList}>
          {roots.map((group) => (
            <AlignmentGroupNode
              key={group.id}
              group={group}
              allGroups={groups}
              leagueTeams={leagueTeams}
              busy={busy}
              editMode={editMode}
              onAddSubgroup={(parentGroup, payload) => handleAddDraftGroup(parentGroup, payload)}
              onUpdateGroup={handleUpdateDraftGroup}
              onDeleteGroup={handleDeleteDraftGroup}
              onSetGroupTeams={handleSetDraftGroupTeams}
            />
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <>
      <li className={styles.alignmentCard}>
        <div className={styles.alignmentCardHeader}>
          <div className={styles.ruleSetName}>
            <span>{alignmentSet.name}</span>
            <span className={styles.alignmentSetMeta}>{headerMeta}</span>
          </div>
          <ActionOverlay className={styles.alignmentCardHoverActions}>
            <Button
              type="button"
              size="sm"
              variant="outlined"
              intent="neutral"
              icon="edit"
              tooltip="Edit alignment"
              disabled={busy === alignmentSet.id || editLocked}
              onClick={onStartEdit}
            />
            <Button
              type="button"
              size="sm"
              variant="outlined"
              intent="danger"
              icon="delete"
              tooltip="Delete alignment"
              disabled={busy === alignmentSet.id || editLocked}
              onClick={onDelete}
            />
          </ActionOverlay>
        </div>
      </li>
      <Modal
        open={editMode}
        title={`Edit Alignment - ${alignmentSet.name}`}
        onClose={handleCancelEdit}
        onConfirm={onSubmit}
        confirmLabel={busy === alignmentSet.id ? 'Saving...' : 'Save Alignment'}
        confirmIcon="save"
        confirmDisabled={busy === alignmentSet.id || !isValid || detailsLoading || !hasChanges}
        busy={busy === alignmentSet.id}
        size="md"
      >
        {editorBody}
      </Modal>
      <ConfirmModal
        open={confirmCancelOpen}
        title="Discard Alignment Edits"
        body="Discard your unsaved alignment changes?"
        confirmLabel="Discard"
        confirmIcon="close"
        variant="danger"
        busy={busy === alignmentSet.id}
        onCancel={() => setConfirmCancelOpen(false)}
        onConfirm={discardEdits}
      />
      <TeamSelectionModal
        open={flatTeamModalOpen}
        title={`${alignmentSet.name} Teams`}
        teams={leagueTeams}
        selectedIds={flatTeams.map((team) => team.id)}
        disabled={busy === alignmentSet.id}
        onClose={() => setFlatTeamModalOpen(false)}
        onSave={handleSetDraftAlignmentTeams}
      />
      <CreateAlignmentGroupModal
        open={createGroupModalOpen}
        disabled={busy === alignmentSet.id}
        onClose={() => setCreateGroupModalOpen(false)}
        onCreate={(payload) => handleAddDraftGroup(null, { ...payload, parent_id: null })}
      />
      <ConfirmModal
        open={confirmStructureChangeOpen}
        title="Change Alignment Structure"
        body="Changing this setting will clear the draft groups and teams for this alignment. The change is not saved until you save the alignment."
        confirmLabel="Change"
        confirmIcon="save"
        variant="danger"
        busy={busy === alignmentSet.id}
        onCancel={() => {
          setPendingStructureType(null);
          setConfirmStructureChangeOpen(false);
        }}
        onConfirm={() => {
          if (!pendingStructureType) return;
          applyStructureTypeChange(pendingStructureType);
        }}
      />
    </>
  );
};

const LeagueAlignmentsTab = (props: Props) => {
  const { className } = props;
  const { league, teams } = useLeagueDetailsContext();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<GroupAlignmentSet | null>(null);
  const [editingAlignmentId, setEditingAlignmentId] = useState<string | null>(null);
  const [alignmentDetails, setAlignmentDetails] = useState<
    Record<string, GroupAlignmentSet | null>
  >({});
  const {
    alignmentSets,
    loading: alignmentsLoading,
    busy: alignmentBusy,
    fetchAlignmentSet,
    createAlignmentSet,
    saveAlignmentConfig,
    deleteAlignmentSet,
  } = useGroupAlignmentSets(league.id);
  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isSubmitting, isValid },
  } = useForm<AlignmentFormValues>({
    defaultValues: { name: '', structure_type: 'groups' },
    mode: 'onChange',
  });
  const selectedStructure = watch('structure_type');
  const createAlignmentFormId = 'new-alignment-form';

  useEffect(() => {
    if (!createModalOpen) return;
    reset({ name: defaultName('groups'), structure_type: 'groups' });
  }, [createModalOpen, reset]);

  const loadAlignmentDetails = useCallback(
    async (alignmentSetId: string) => {
      if (alignmentSetId in alignmentDetails) return;
      const details = await fetchAlignmentSet(alignmentSetId);
      setAlignmentDetails((prev) =>
        alignmentSetId in prev ? prev : { ...prev, [alignmentSetId]: details },
      );
    },
    [alignmentDetails, fetchAlignmentSet],
  );

  const onCreateAlignment = handleSubmit(async ({ name, structure_type }) => {
    const created = await createAlignmentSet({
      name: name.trim() || defaultName(structure_type),
      structure_type,
    });
    if (created) {
      setCreateModalOpen(false);
      setAlignmentDetails((prev) => ({ ...prev, [created.id]: created }));
    }
  });

  const handleSaveAlignment = async (
    alignmentSetId: string,
    payload: {
      name: string;
      structure_type: GroupAlignmentStructureType;
      team_ids?: string[];
      groups?: {
        id?: string;
        client_id: string;
        parent_client_id?: string | null;
        name: string;
        role?: 'conference' | 'division' | null;
        sort_order?: number;
        team_ids?: string[];
      }[];
    },
  ) => {
    const saved = await saveAlignmentConfig(alignmentSetId, payload);
    if (saved) {
      setAlignmentDetails((prev) => ({ ...prev, [alignmentSetId]: saved }));
    }
    return saved;
  };

  if (alignmentsLoading) return <LeagueAlignmentsTabSkeleton className={className} />;

  return (
    <>
      <div className={styles.grid}>
        <div className={[styles.alignmentCards, styles.col12, className].filter(Boolean).join(' ')}>
          <Card
            className={styles.alignmentHeaderCard}
            title={<AlignmentCardTitle />}
            action={
              <Button
                icon="add"
                size="sm"
                onClick={() => setCreateModalOpen(true)}
              >
                New Alignment
              </Button>
            }
            noHeaderMargin
          >
            {alignmentSets.length === 0 ? (
              <div className={styles.alignmentEmptyState}>
                <p className={styles.emptyMsg}>No alignment sets yet.</p>
              </div>
            ) : (
              <ul className={styles.alignmentSetStack}>
                {alignmentSets.map((alignmentSet) => {
                  const editMode = editingAlignmentId === alignmentSet.id;
                  const editLocked =
                    editingAlignmentId !== null && editingAlignmentId !== alignmentSet.id;

                  return (
                    <AlignmentPanel
                      key={alignmentSet.id}
                      alignmentSet={alignmentSet}
                      busy={alignmentBusy}
                      details={alignmentDetails[alignmentSet.id] ?? null}
                      leagueTeams={teams}
                      editMode={editMode}
                      editLocked={editLocked}
                      onLoadDetails={loadAlignmentDetails}
                      onDelete={() => setConfirmDelete(alignmentSet)}
                      onStartEdit={() => setEditingAlignmentId(alignmentSet.id)}
                      onStopEdit={() =>
                        setEditingAlignmentId((current) =>
                          current === alignmentSet.id ? null : current,
                        )
                      }
                      onSave={handleSaveAlignment}
                    />
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Modal
        open={createModalOpen}
        title="New Alignment"
        onClose={() => setCreateModalOpen(false)}
        confirmForm={createAlignmentFormId}
        confirmLabel={isSubmitting || !!alignmentBusy ? 'Creating...' : 'Create Alignment'}
        confirmIcon="save"
        confirmDisabled={isSubmitting || !!alignmentBusy || !isValid}
        busy={isSubmitting || !!alignmentBusy}
        size="md"
      >
        <form
          id={createAlignmentFormId}
          className={styles.alignmentEditRow}
          onSubmit={onCreateAlignment}
        >
          <div className={styles.alignmentEditNameRow}>
            <Field
              label="Name"
              control={control}
              name="name"
              placeholder={defaultName(selectedStructure)}
              disabled={isSubmitting || !!alignmentBusy}
              autoFocus
            />
          </div>
          <div className={styles.alignmentEditControlsRow}>
            <AlignmentStructureField
              control={control}
              value={selectedStructure}
              disabled={isSubmitting || !!alignmentBusy}
              onChange={(value) => {
                const next = value as GroupAlignmentStructureType;
                setValue('structure_type', next, { shouldDirty: true, shouldValidate: true });
                if (!watch('name').trim()) setValue('name', defaultName(next));
              }}
            />
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={confirmDelete !== null}
        title="Delete Alignment"
        body={
          <>
            Delete <strong>{confirmDelete?.name}</strong>? Seasons using this alignment will return
            to their legacy group setup.
          </>
        }
        confirmLabel="Delete"
        confirmIcon="delete"
        variant="danger"
        busy={alignmentBusy === confirmDelete?.id}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return;
          const ok = await deleteAlignmentSet(confirmDelete.id);
          if (ok) {
            setConfirmDelete(null);
            setEditingAlignmentId((current) => (current === confirmDelete.id ? null : current));
          }
        }}
      />
    </>
  );
};

export const LeagueAlignmentsTabSkeleton = ({ className }: TabSkeletonProps) => (
  <div className={styles.grid}>
    <div className={[styles.alignmentCards, styles.col12, className].filter(Boolean).join(' ')}>
      <Card
        className={styles.alignmentHeaderCard}
        title={<AlignmentCardTitle />}
        action={<TabActionSkeleton width="122px" />}
        noHeaderMargin
        role="status"
        aria-busy="true"
        aria-label="Loading alignments"
      >
        <ul className={styles.alignmentSetStack}>
          {Array.from({ length: 5 }, (_, index) => (
            <li
              key={index}
              className={styles.alignmentCard}
            >
              <div className={styles.alignmentCardHeader}>
                <span className={styles.ruleSetName}>
                  <Skeleton
                    type="text"
                    className={styles.tabSkeletonName}
                  />
                  <Skeleton
                    type="text"
                    className={styles.tabSkeletonMetaLine}
                  />
                </span>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  </div>
);

export default LeagueAlignmentsTab;
