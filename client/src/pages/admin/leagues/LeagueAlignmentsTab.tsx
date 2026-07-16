import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import Button from '@jerecocc/tracker-ui/components/Button/Button';
import Checklist from '@jerecocc/tracker-ui/components/Checklist/Checklist';
import ConfirmModal from '@jerecocc/tracker-ui/components/ConfirmModal/ConfirmModal';
import Divider from '@jerecocc/tracker-ui/components/Divider/Divider';
import Field from '@jerecocc/tracker-ui/components/Field/Field';
import GroupedFields from '@jerecocc/tracker-ui/components/GroupedFields/GroupedFields';
import InfoTooltip from '@jerecocc/tracker-ui/components/InfoTooltip/InfoTooltip';
import ListItem from '@jerecocc/tracker-ui/components/ListItem/ListItem';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import Section from '@jerecocc/tracker-ui/components/Section/Section';
import SegmentedControl from '@jerecocc/tracker-ui/components/SegmentedControl/SegmentedControl';
import Skeleton from '@jerecocc/tracker-ui/components/Skeleton/Skeleton';
import { type GroupTeamRecord } from '@/hooks/useLeagueGroups';
import useGroupAlignmentSets, {
  type AlignmentGroupRecord,
  type GroupAlignmentSet,
  type GroupAlignmentStructureType,
} from '@/hooks/useGroupAlignmentSets';
import { type SeasonGroupRecord } from '@/hooks/useSeasonDetails';
import { type TeamRecord } from '@/hooks/useTeams';
import { useLeagueDetailsContext } from './LeagueDetailsContext';
import {
  LeagueListRowSkeleton,
  TabActionSkeleton,
  type TabSkeletonProps,
} from './LeagueTabSkeletonHelpers';
import ResponsiveList from '@/shared/ResponsiveList/ResponsiveList';
import styles from './LeagueDetails.module.scss';

interface Props {
  className?: string;
}

interface AlignmentFormValues {
  name: string;
  structure_type: GroupAlignmentStructureType;
}

interface CreateAlignmentFormValues {
  name: string;
  structure_type: GroupAlignmentStructureType | null;
}

interface AlignmentGroupFormValues {
  name: string;
  role: 'conference' | 'division' | '__none__';
  parent_id: string;
}

interface AlignmentGroupNameFormValues {
  name: string;
}

interface AlignmentConfigPayload {
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
    <InfoTooltip text={ALIGNMENT_TITLE_TOOLTIP} />
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

const draftTeamCount = (
  structureType: GroupAlignmentStructureType | null,
  draft: DraftAlignmentDetails,
) =>
  structureType === 'league'
    ? draft.teams.length
    : new Set(draft.groups.flatMap((group) => group.teams.map((team) => team.id))).size;

const buildAlignmentConfigPayload = (
  name: string,
  structureType: GroupAlignmentStructureType,
  draft: DraftAlignmentDetails,
): AlignmentConfigPayload => ({
  name: name.trim(),
  structure_type: structureType,
  team_ids: structureType === 'league' ? draft.teams.map((team) => team.id) : [],
  groups:
    structureType === 'groups'
      ? draft.groups.map((group) => ({
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

const AlignmentStructureField = ({
  control,
  value,
  disabled,
  required = false,
  onChange,
}: {
  control: unknown;
  value: GroupAlignmentStructureType | null;
  disabled: boolean;
  required?: boolean;
  onChange: (value: GroupAlignmentStructureType) => void;
}) => {
  return (
    <Field
      type="custom"
      label="Uses groups?"
      control={control}
      name="structure_type"
      required={required}
      wrapperClassName={styles.alignmentStructureField}
      rules={required ? { required: 'Choose whether this alignment uses groups' } : undefined}
    >
      <SegmentedControl
        variant="field"
        value={value}
        options={[
          { value: 'groups', label: 'Yes', tooltip: 'Organize teams into groups' },
          { value: 'league', label: 'No', tooltip: 'Use one league-wide team list' },
        ]}
        disabled={disabled}
        onChange={(next) => onChange(next as GroupAlignmentStructureType)}
      />
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

  const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));

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
      <Checklist
        options={sortedTeams.map((team) => ({
          id: team.id,
          searchText: [team.name, team.team_name, team.place_name, team.code]
            .filter(Boolean)
            .join(' '),
          image: team.logo,
          imageDark: team.logo_dark,
          imageLight: team.logo_light,
          imageBackground: false,
          imagePlaceholder: team.code.slice(0, 3),
          imagePrimaryColor: team.primary_color,
          imageTextColor: team.text_color,
          name: team.team_name || team.name,
          eyebrow: team.place_name || undefined,
          rightContent: <span className={styles.alignmentTeamModalCode}>{team.code}</span>,
        }))}
        selectedIds={draftIds}
        onToggle={(option) => toggleTeam(option.id)}
        searchable
        query={query}
        onQueryChange={setQuery}
        placeholder="Search teams..."
        autoFocus
        searchDisabled={disabled}
        toolbarClassName={styles.alignmentTeamModalControls}
        searchClassName={styles.alignmentTeamModalSearch}
        listClassName={styles.alignmentTeamModalList}
        emptyClassName={styles.alignmentTeamModalEmpty}
        emptyMessage="No teams are available."
        noResultsMessage={(searchQuery) => `No teams match "${searchQuery}".`}
        disabled={disabled}
      />
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
  depth = 0,
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
  depth?: number;
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
  const teamCountLabel = `${teamCount} ${teamCount === 1 ? 'team' : 'teams'}`;
  const groupName = roleLabel ? `${group.name} ${roleLabel}` : group.name;
  const groupCountLabel = `(${teamCountLabel})`;
  const removeTeam = (teamId: string) => {
    void onSetGroupTeams(
      group.id,
      group.teams.filter((team) => team.id !== teamId).map((team) => team.id),
    );
  };

  const groupActions = editMode ? (
    <div className={styles.alignmentGroupActions}>
      <Button
        type="button"
        variant="outlined"
        intent="neutral"
        size="small"
        icon="edit"
        tooltip="Edit group"
        disabled={busy === group.id}
        onClick={() => setEditGroupModalOpen(true)}
      />
      {canHaveSubgroups && (
        <Button
          type="button"
          variant="outlined"
          intent="accent"
          size="small"
          icon="add"
          tooltip="Create subgroup"
          disabled={busy === group.id}
          onClick={() => setCreateSubgroupModalOpen(true)}
        />
      )}
      {isLeaf && (
        <Button
          type="button"
          variant="outlined"
          intent="accent"
          size="small"
          icon="group_add"
          tooltip="Edit teams"
          disabled={busy === group.id}
          onClick={() => setTeamModalOpen(true)}
        />
      )}
      <Button
        type="button"
        variant="outlined"
        intent="danger"
        size="small"
        icon="delete"
        tooltip="Delete group"
        disabled={busy === group.id}
        onClick={() => setConfirmDeleteOpen(true)}
      />
    </div>
  ) : null;

  const groupBody = (
    <div className={styles.alignmentGroupBody}>
      {isLeaf && group.teams.length > 0 && (
        <ResponsiveList className={`${styles.alignmentTeamList} ${styles.alignmentGroupTeamList}`}>
          {group.teams.map((team) => (
            <ListItem
              key={team.id}
              fullWidth
              image={team.logo}
              imageDark={team.logo_dark}
              imageLight={team.logo_light}
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
        </ResponsiveList>
      )}
      {isLeaf && group.teams.length === 0 && (
        <p className={`${styles.emptyMsg} ${styles.groupEmptyMsg}`}>
          No teams assigned to this group.
        </p>
      )}
      {children.length > 0 && (
        <div className={styles.alignmentGroupChildren}>
          {depth > 0 && <div className={styles.alignmentGroupChildrenLabel}>Subgroups</div>}
          <ResponsiveList className={`${styles.alignmentGroupList} ${styles.alignmentGroupListNested}`}>
            {children.map((child) => (
              <AlignmentGroupNode
                key={child.id}
                group={child}
                allGroups={allGroups}
                leagueTeams={leagueTeams}
                busy={busy}
                editMode={editMode}
                depth={depth + 1}
                onAddSubgroup={onAddSubgroup}
                onUpdateGroup={onUpdateGroup}
                onDeleteGroup={onDeleteGroup}
                onSetGroupTeams={onSetGroupTeams}
              />
            ))}
          </ResponsiveList>
        </div>
      )}
    </div>
  );

  return (
    <li className={styles.groupItem}>
      {depth === 0 ? (
        <div className={styles.alignmentParentGroup}>
          <div className={styles.alignmentParentGroupHeader}>
            <div className={styles.alignmentParentGroupTitle}>
              <span className={styles.alignmentParentGroupName}>
                {groupName}
                {' '}
                <span className={styles.alignmentGroupNameCount}>{groupCountLabel}</span>
              </span>
            </div>
            {groupActions}
            <Divider className={styles.alignmentParentGroupHeaderDivider} />
          </div>
          <div className={styles.alignmentParentGroupBody}>{groupBody}</div>
        </div>
      ) : (
        <GroupedFields
          className={[
            styles.alignmentGroupFieldset,
            depth > 0 ? styles.alignmentGroupFieldsetNested : '',
          ]
            .filter(Boolean)
            .join(' ')}
          legend={
            <>
              <span className={styles.alignmentGroupLegendTitle}>
                <span>{groupName}</span>
                {' '}
                <span className={styles.alignmentGroupNameCount}>{groupCountLabel}</span>
              </span>
              <Divider className={styles.alignmentGroupLegendRule} />
              {groupActions}
            </>
          }
          legendClassName={styles.alignmentGroupLegend}
        >
          {groupBody}
        </GroupedFields>
      )}
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
    payload: AlignmentConfigPayload,
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
  const assignedTeamCount = draftTeamCount(structureType, {
    groups,
    teams: flatTeams,
  });

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
    const saved = await onSave(
      alignmentSet.id,
      buildAlignmentConfigPayload(name, structure_type, draftDetails),
    );
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
        </div>
        <div className={styles.alignmentEditActionRow}>
          <Button
            type="button"
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
          size="small"
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
          <ResponsiveList className={styles.alignmentTeamList}>
            {flatTeams.map((team) => (
              <ListItem
                key={team.id}
                fullWidth
                image={team.logo}
                imageDark={team.logo_dark}
                imageLight={team.logo_light}
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
          </ResponsiveList>
        )
      ) : roots.length === 0 ? (
        <p className={styles.emptyMsg}>No groups are defined in this alignment.</p>
      ) : (
        <div className={styles.alignmentGroupSection}>
          <ResponsiveList className={styles.alignmentGroupList}>
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
          </ResponsiveList>
        </div>
      )}
    </div>
  );

  return (
    <>
      <ListItem
        fullWidth
        hideImage
        name={alignmentSet.name}
        subtitle={headerMeta}
        actions={[
          {
            icon: 'edit',
            tooltip: 'Edit alignment',
            disabled: busy === alignmentSet.id || editLocked,
            onClick: onStartEdit,
          },
          {
            icon: 'delete',
            tooltip: 'Delete alignment',
            intent: 'danger',
            disabled: busy === alignmentSet.id || editLocked,
            onClick: onDelete,
          },
        ]}
      />
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
        footerStart={
          <span>{detailsLoading ? 'Loading teams...' : countLabel(assignedTeamCount, 'team')}</span>
        }
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

const CreateAlignmentModal = ({
  open,
  leagueId,
  leagueTeams,
  busy,
  onClose,
  onCreate,
}: {
  open: boolean;
  leagueId: string;
  leagueTeams: TeamRecord[];
  busy: boolean;
  onClose: () => void;
  onCreate: (payload: AlignmentConfigPayload) => Promise<GroupAlignmentSet | null>;
}) => {
  const [confirmStructureChangeOpen, setConfirmStructureChangeOpen] = useState(false);
  const [pendingStructureType, setPendingStructureType] =
    useState<GroupAlignmentStructureType | null>(null);
  const [draftDetails, setDraftDetails] = useState<DraftAlignmentDetails>({
    groups: [],
    teams: [],
  });
  const [flatTeamModalOpen, setFlatTeamModalOpen] = useState(false);
  const [createGroupModalOpen, setCreateGroupModalOpen] = useState(false);
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isSubmitting, isValid },
  } = useForm<CreateAlignmentFormValues>({
    defaultValues: { name: '', structure_type: null },
    mode: 'onChange',
  });

  useEffect(() => {
    if (!open) return;
    reset({ name: '', structure_type: null });
    setDraftDetails({ groups: [], teams: [] });
    setFlatTeamModalOpen(false);
    setCreateGroupModalOpen(false);
    setPendingStructureType(null);
    setConfirmStructureChangeOpen(false);
  }, [open, reset]);

  const selectedStructure = watch('structure_type');
  const nameValue = watch('name');
  const alignmentName = nameValue.trim() || 'Alignment';
  const assignedTeamCount = draftTeamCount(selectedStructure, draftDetails);
  const alignmentActionIcon = selectedStructure === 'groups' ? 'add' : 'group_add';
  const alignmentActionLabel = selectedStructure === 'groups' ? 'Create group' : 'Update teams';

  const applyStructureTypeChange = (next: GroupAlignmentStructureType) => {
    setValue('structure_type', next, { shouldDirty: true, shouldValidate: true });
    setDraftDetails({ groups: [], teams: [] });
    setPendingStructureType(null);
    setConfirmStructureChangeOpen(false);
  };

  const handleStructureTypeChange = (next: GroupAlignmentStructureType) => {
    if (next === selectedStructure) return;
    if (draftHasContent(draftDetails)) {
      setPendingStructureType(next);
      setConfirmStructureChangeOpen(true);
      return;
    }
    applyStructureTypeChange(next);
  };

  const handleAlignmentAction = () => {
    if (selectedStructure === 'groups') {
      setCreateGroupModalOpen(true);
      return;
    }
    if (selectedStructure === 'league') {
      setFlatTeamModalOpen(true);
    }
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
            alignment_set_id: undefined,
            league_id: leagueId,
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
    return true;
  };

  const handleUpdateDraftGroup = async (groupId: string, payload: { name: string }) => {
    setDraftDetails((current) => ({
      ...current,
      groups: current.groups.map((group) =>
        group.id === groupId ? { ...group, name: payload.name } : group,
      ),
    }));
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
    return true;
  };

  const handleSetDraftAlignmentTeams = async (teamIds: string[]) => {
    setDraftDetails((current) => ({ ...current, teams: teamsFromIds(leagueTeams, teamIds) }));
    return true;
  };

  const handleRemoveDraftAlignmentTeam = (teamId: string) => {
    setDraftDetails((current) => ({
      ...current,
      teams: current.teams.filter((team) => team.id !== teamId),
    }));
  };

  const onSubmit = handleSubmit(async ({ name, structure_type }) => {
    if (!structure_type) return;
    const created = await onCreate(buildAlignmentConfigPayload(name, structure_type, draftDetails));
    if (created) onClose();
  });

  const roots = draftDetails.groups
    .filter((group) => group.parent_id === null)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  return (
    <>
      <Modal
        open={open}
        title="Create Alignment"
        onClose={onClose}
        onConfirm={onSubmit}
        confirmLabel={isSubmitting || busy ? 'Creating...' : 'Create Alignment'}
        confirmIcon="save"
        confirmDisabled={isSubmitting || busy || !isValid || !selectedStructure}
        busy={isSubmitting || busy}
        size="md"
        footerStart={<span>{countLabel(assignedTeamCount, 'team')}</span>}
      >
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
                placeholder="Alignment name"
                required
                rules={{
                  required: 'Name is required',
                  validate: (value) => value.trim().length > 0 || 'Name is required',
                }}
                disabled={isSubmitting || busy}
                autoFocus
              />
            </div>
            <div className={styles.alignmentEditControlsRow}>
              <AlignmentStructureField
                control={control}
                value={selectedStructure}
                disabled={isSubmitting || busy}
                required
                onChange={handleStructureTypeChange}
              />
            </div>
            {selectedStructure && (
              <div className={styles.alignmentEditActionRow}>
                <Button
                  type="button"
                  variant="outlined"
                  intent="accent"
                  icon={alignmentActionIcon}
                  disabled={isSubmitting || busy}
                  onClick={handleAlignmentAction}
                >
                  {alignmentActionLabel}
                </Button>
              </div>
            )}
            <Button
              type="submit"
              size="small"
              icon="save"
              className={styles.srOnly}
              disabled={isSubmitting || busy || !isValid || !selectedStructure}
            >
              Create
            </Button>
          </form>

          {selectedStructure === 'league' ? (
            draftDetails.teams.length === 0 ? (
              <p className={styles.emptyMsg}>No teams are defined in this alignment.</p>
            ) : (
              <ResponsiveList className={styles.alignmentTeamList}>
                {draftDetails.teams.map((team) => (
                  <ListItem
                    key={team.id}
                    fullWidth
                    image={team.logo}
                    imageDark={team.logo_dark}
                    imageLight={team.logo_light}
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
                        disabled: isSubmitting || busy,
                        onClick: () => handleRemoveDraftAlignmentTeam(team.id),
                      },
                    ]}
                  />
                ))}
              </ResponsiveList>
            )
          ) : selectedStructure === 'groups' ? (
            roots.length === 0 ? (
              <p className={styles.emptyMsg}>No groups are defined in this alignment.</p>
            ) : (
              <div className={styles.alignmentGroupSection}>
                <ResponsiveList className={styles.alignmentGroupList}>
                  {roots.map((group) => (
                    <AlignmentGroupNode
                      key={group.id}
                      group={group}
                      allGroups={draftDetails.groups}
                      leagueTeams={leagueTeams}
                      busy={busy ? 'create' : null}
                      editMode
                      onAddSubgroup={(parentGroup, payload) =>
                        handleAddDraftGroup(parentGroup, payload)
                      }
                      onUpdateGroup={handleUpdateDraftGroup}
                      onDeleteGroup={handleDeleteDraftGroup}
                      onSetGroupTeams={handleSetDraftGroupTeams}
                    />
                  ))}
                </ResponsiveList>
              </div>
            )
          ) : null}
        </div>
      </Modal>
      <TeamSelectionModal
        open={flatTeamModalOpen}
        title={`${alignmentName} Teams`}
        teams={leagueTeams}
        selectedIds={draftDetails.teams.map((team) => team.id)}
        disabled={isSubmitting || busy}
        onClose={() => setFlatTeamModalOpen(false)}
        onSave={handleSetDraftAlignmentTeams}
      />
      <CreateAlignmentGroupModal
        open={createGroupModalOpen}
        disabled={isSubmitting || busy}
        onClose={() => setCreateGroupModalOpen(false)}
        onCreate={(payload) => handleAddDraftGroup(null, { ...payload, parent_id: null })}
      />
      <ConfirmModal
        open={confirmStructureChangeOpen}
        title="Change Alignment Structure"
        body="Changing this setting will clear the draft groups and teams for this alignment."
        confirmLabel="Change"
        confirmIcon="save"
        variant="danger"
        busy={isSubmitting || busy}
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

  const handleCreateAlignment = async (payload: AlignmentConfigPayload) => {
    const { name, structure_type } = payload;
    const created = await createAlignmentSet({
      name,
      structure_type,
      team_ids: structure_type === 'league' ? payload.team_ids : undefined,
    });
    if (!created) return null;

    let nextAlignmentSet = created;
    if (structure_type === 'groups' && (payload.groups?.length ?? 0) > 0) {
      const saved = await saveAlignmentConfig(created.id, payload);
      if (saved) nextAlignmentSet = saved;
    }

    setAlignmentDetails((prev) => ({ ...prev, [nextAlignmentSet.id]: nextAlignmentSet }));
    return nextAlignmentSet;
  };

  const handleSaveAlignment = async (alignmentSetId: string, payload: AlignmentConfigPayload) => {
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
          <Section
            className={styles.alignmentHeaderCard}
            title={<AlignmentCardTitle />}
            action={
              <Button
                icon="add"
                size="medium"
                onClick={() => setCreateModalOpen(true)}
              >
                Create Alignment
              </Button>
            }
            noHeaderMargin
          >
            {alignmentSets.length === 0 ? (
              <div className={styles.alignmentEmptyState}>
                <p className={styles.emptyMsg}>No alignment sets yet.</p>
              </div>
            ) : (
              <ResponsiveList className={styles.alignmentSetStack}>
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
              </ResponsiveList>
            )}
          </Section>
        </div>
      </div>

      <CreateAlignmentModal
        open={createModalOpen}
        leagueId={league.id}
        leagueTeams={teams}
        busy={!!alignmentBusy}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreateAlignment}
      />

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
      <Section
        className={styles.alignmentHeaderCard}
        title={<AlignmentCardTitle />}
        action={<TabActionSkeleton width="122px" />}
        noHeaderMargin
        role="status"
        aria-busy="true"
        aria-label="Loading alignments"
      >
        <ResponsiveList className={styles.alignmentSetStack}>
          {Array.from({ length: 5 }, (_, index) => (
            <LeagueListRowSkeleton key={index} />
          ))}
        </ResponsiveList>
      </Section>
    </div>
  </div>
);

export default LeagueAlignmentsTab;
