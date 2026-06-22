import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import Accordion from '@/components/Accordion/Accordion';
import Badge from '@/components/Badge/Badge';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import Field from '@/components/Field/Field';
import Icon from '@/components/Icon/Icon';
import ListItem, { type ListItemAction } from '@/components/ListItem/ListItem';
import Modal from '@/components/Modal/Modal';
import SearchableList from '@/components/SearchableList/SearchableList';
import SegmentedControl from '@/components/SegmentedControl/SegmentedControl';
import useGroupAlignmentSets, {
  type GroupAlignmentSet,
  type GroupAlignmentStructureType,
} from '@/hooks/useGroupAlignmentSets';
import { type SeasonGroupRecord } from '@/hooks/useSeasonDetails';
import { type TeamRecord } from '@/hooks/useTeams';
import { buildTeamDetailsPath } from '@/lib/routeSlugs';
import { useLeagueDetailsContext } from './LeagueDetailsContext';
import styles from './LeagueDetails.module.scss';

interface Props {
  className?: string;
}

type TeamsView = 'list' | 'alignments';

interface AlignmentFormValues {
  name: string;
  structure_type: GroupAlignmentStructureType;
}

const STRUCTURE_OPTIONS = [
  { value: 'groups', label: 'Grouped from current groups' },
  { value: 'league', label: 'No groups, explicit teams' },
];

const ROLE_LABELS: Record<string, string> = { conference: 'Conference', division: 'Division' };

const defaultName = (structureType: GroupAlignmentStructureType) =>
  structureType === 'league' ? 'Team List' : 'Current Groups';

const AlignmentTeamPicker = ({
  teams,
  selectedIds,
  disabled,
  onSave,
}: {
  teams: TeamRecord[];
  selectedIds: string[];
  disabled: boolean;
  onSave: (teamIds: string[]) => Promise<boolean>;
}) => {
  const [draftIds, setDraftIds] = useState<string[]>(selectedIds);

  useEffect(() => {
    setDraftIds(selectedIds);
  }, [selectedIds]);

  const draftSet = new Set(draftIds);
  const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className={styles.alignmentTeamPicker}>
      <div className={styles.alignmentTeamPickerHeader}>
        <span>{draftIds.length} selected</span>
        <Button
          size="sm"
          icon="save"
          disabled={disabled}
          onClick={() => onSave(draftIds)}
        >
          Save Teams
        </Button>
      </div>
      <ul className={styles.alignmentTeamPickerList}>
        {sortedTeams.map((team) => {
          const checked = draftSet.has(team.id);
          return (
            <li key={team.id}>
              <label className={styles.alignmentTeamPickerItem}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={(event) => {
                    setDraftIds((current) =>
                      event.target.checked
                        ? [...current, team.id]
                        : current.filter((id) => id !== team.id),
                    );
                  }}
                />
                {team.logo && (
                  <img
                    src={team.logo}
                    alt=""
                    className={styles.groupTeamThumb}
                  />
                )}
                {!team.logo && <span className={styles.groupTeamDot}>{team.code.slice(0, 2)}</span>}
                <span>{team.team_name || team.name}</span>
                <code>{team.code}</code>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const AlignmentGroupNode = ({
  group,
  allGroups,
  leagueTeams,
  busy,
  onSetGroupTeams,
}: {
  group: SeasonGroupRecord;
  allGroups: SeasonGroupRecord[];
  leagueTeams: TeamRecord[];
  busy: string | null;
  onSetGroupTeams: (groupId: string, teamIds: string[]) => Promise<boolean>;
}) => {
  const [editingTeams, setEditingTeams] = useState(false);
  const children = allGroups
    .filter((g) => g.parent_id === group.id)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const isLeaf = children.length === 0;
  const roleLabel = group.role ? ROLE_LABELS[group.role] : null;

  return (
    <li className={styles.groupItem}>
      <Accordion
        label={
          <span className={styles.groupLabel}>
            {group.name}
            {roleLabel && (
              <span className={`${styles.groupRoleBadge} ${styles[`groupRoleBadge_${group.role}`]}`}>
                {roleLabel}
              </span>
            )}
          </span>
        }
        headerRight={
          <Badge
            label={`${group.teams.length} team${group.teams.length === 1 ? '' : 's'}`}
            intent="neutral"
          />
        }
      >
        {isLeaf && (
          <div className={styles.alignmentGroupTools}>
            <Button
              size="sm"
              variant="outlined"
              intent="neutral"
              icon={editingTeams ? 'expand_less' : 'edit'}
              disabled={busy === group.id}
              onClick={() => setEditingTeams((current) => !current)}
            >
              Teams
            </Button>
          </div>
        )}
        {isLeaf && editingTeams && (
          <AlignmentTeamPicker
            teams={leagueTeams}
            selectedIds={group.teams.map((team) => team.id)}
            disabled={busy === group.id}
            onSave={(teamIds) => onSetGroupTeams(group.id, teamIds)}
          />
        )}
        {isLeaf && group.teams.length > 0 && (
          <ul className={styles.teamList}>
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
              />
            ))}
          </ul>
        )}
        {isLeaf && group.teams.length === 0 && (
          <p className={styles.emptyMsg}>No teams assigned to this group.</p>
        )}
        {children.length > 0 && (
          <div className={styles.groupNestedList}>
            <ul className={styles.groupList}>
              {children.map((child) => (
                <AlignmentGroupNode
                  key={child.id}
                  group={child}
                  allGroups={allGroups}
                  leagueTeams={leagueTeams}
                  busy={busy}
                  onSetGroupTeams={onSetGroupTeams}
                />
              ))}
            </ul>
          </div>
        )}
      </Accordion>
    </li>
  );
};

const AlignmentPanel = ({
  alignmentSet,
  expanded,
  busy,
  details,
  leagueTeams,
  onEdit,
  onDelete,
  onSave,
  onSetAlignmentTeams,
  onSetGroupTeams,
}: {
  alignmentSet: GroupAlignmentSet;
  expanded: boolean;
  busy: string | null;
  details: GroupAlignmentSet | null;
  leagueTeams: TeamRecord[];
  onEdit: () => void;
  onDelete: () => void;
  onSave: (
    alignmentSetId: string,
    payload: { name: string; structure_type: GroupAlignmentStructureType },
  ) => Promise<boolean>;
  onSetAlignmentTeams: (alignmentSetId: string, teamIds: string[]) => Promise<boolean>;
  onSetGroupTeams: (groupId: string, teamIds: string[]) => Promise<boolean>;
}) => {
  const [name, setName] = useState(alignmentSet.name);
  const [structureType, setStructureType] = useState<GroupAlignmentStructureType>(
    alignmentSet.structure_type,
  );

  useEffect(() => {
    setName(alignmentSet.name);
    setStructureType(alignmentSet.structure_type);
  }, [alignmentSet.name, alignmentSet.structure_type]);

  const groups = details?.groups ?? [];
  const roots = groups
    .filter((group) => group.parent_id === null)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  return (
    <section className={styles.alignmentPanel}>
      <div className={styles.alignmentPanelHeader}>
        <div className={styles.ruleSetName}>
          <span>{alignmentSet.name}</span>
          <span className={styles.alignmentSetMeta}>
            {alignmentSet.structure_type === 'league'
              ? `${alignmentSet.team_count ?? 0} teams, no groups`
              : `${alignmentSet.group_count ?? 0} groups, ${alignmentSet.team_count ?? 0} teams`}
          </span>
        </div>
        <div className={styles.ruleSetActions}>
          <Button
            variant="outlined"
            intent="neutral"
            icon={expanded ? 'expand_less' : 'edit'}
            size="sm"
            tooltip={expanded ? 'Collapse alignment' : 'Edit alignment'}
            disabled={busy === alignmentSet.id}
            onClick={onEdit}
          />
          <Button
            variant="outlined"
            intent="danger"
            icon="delete"
            size="sm"
            tooltip="Delete alignment"
            disabled={busy === alignmentSet.id}
            onClick={onDelete}
          />
        </div>
      </div>

      {expanded && (
        <div className={styles.alignmentPanelBody}>
          <div className={styles.alignmentEditRow}>
            <label className={styles.alignmentEditLabel}>
              <span>Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={busy === alignmentSet.id}
              />
            </label>
            <label className={styles.alignmentEditLabel}>
              <span>Structure</span>
              <select
                value={structureType}
                onChange={(event) =>
                  setStructureType(event.target.value as GroupAlignmentStructureType)
                }
                disabled={busy === alignmentSet.id}
              >
                <option value="groups">Grouped</option>
                <option value="league">League-wide</option>
              </select>
            </label>
            <Button
              size="sm"
              icon="save"
              disabled={busy === alignmentSet.id || !name.trim()}
              onClick={async () => {
                await onSave(alignmentSet.id, {
                  name: name.trim(),
                  structure_type: structureType,
                });
              }}
            >
              Save
            </Button>
          </div>

          {structureType === 'league' || details?.structure_type === 'league' ? (
            details === null ? (
              <p className={styles.emptyMsg}>Loading alignment...</p>
            ) : (
              <AlignmentTeamPicker
                teams={leagueTeams}
                selectedIds={(details.teams ?? []).map((team) => team.id)}
                disabled={busy === alignmentSet.id}
                onSave={(teamIds) => onSetAlignmentTeams(alignmentSet.id, teamIds)}
              />
            )
          ) : details === null ? (
            <p className={styles.emptyMsg}>Loading alignment...</p>
          ) : roots.length === 0 ? (
            <p className={styles.emptyMsg}>No groups are defined in this alignment.</p>
          ) : (
            <ul className={styles.groupList}>
              {roots.map((group) => (
                <AlignmentGroupNode
                  key={group.id}
                  group={group}
                  allGroups={groups}
                  leagueTeams={leagueTeams}
                  busy={busy}
                  onSetGroupTeams={onSetGroupTeams}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};

const LeagueTeamsTab = (props: Props) => {
  const { className } = props;
  const { league, teams, loading, busy, onAddTeam, onEditTeam, onDeleteTeam } =
    useLeagueDetailsContext();
  const navigate = useNavigate();
  const [view, setView] = useState<TeamsView>('list');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [expandedAlignmentId, setExpandedAlignmentId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<GroupAlignmentSet | null>(null);
  const [alignmentDetails, setAlignmentDetails] = useState<Record<string, GroupAlignmentSet | null>>(
    {},
  );
  const {
    alignmentSets,
    loading: alignmentsLoading,
    busy: alignmentBusy,
    fetchAlignmentSet,
    createAlignmentSet,
    updateAlignmentSet,
    deleteAlignmentSet,
    setGroupTeams,
    setAlignmentTeams,
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

  useEffect(() => {
    if (!createModalOpen) return;
    reset({ name: defaultName('groups'), structure_type: 'groups' });
  }, [createModalOpen, reset]);

  useEffect(() => {
    if (!expandedAlignmentId || expandedAlignmentId in alignmentDetails) return;
    let cancelled = false;
    fetchAlignmentSet(expandedAlignmentId).then((details) => {
      if (cancelled) return;
      setAlignmentDetails((prev) => ({ ...prev, [expandedAlignmentId]: details }));
    });
    return () => {
      cancelled = true;
    };
  }, [alignmentDetails, expandedAlignmentId, fetchAlignmentSet]);

  const onCreateAlignment = handleSubmit(async ({ name, structure_type }) => {
    const created = await createAlignmentSet({
      name: name.trim() || defaultName(structure_type),
      structure_type,
      source: structure_type === 'league' ? 'league' : 'legacy',
    });
    if (created) {
      setCreateModalOpen(false);
      setExpandedAlignmentId(created.id);
      setAlignmentDetails((prev) => ({ ...prev, [created.id]: created }));
    }
  });

  const handleSaveAlignment = async (
    alignmentSetId: string,
    payload: { name: string; structure_type: GroupAlignmentStructureType },
  ) => {
    const ok = await updateAlignmentSet(alignmentSetId, payload);
    if (ok) {
      setAlignmentDetails((prev) => {
        const next = { ...prev };
        delete next[alignmentSetId];
        return next;
      });
    }
    return ok;
  };

  const refreshAlignmentDetails = async (alignmentSetId: string) => {
    const details = await fetchAlignmentSet(alignmentSetId);
    setAlignmentDetails((prev) => ({ ...prev, [alignmentSetId]: details }));
  };

  const handleSetAlignmentTeams = async (alignmentSetId: string, teamIds: string[]) => {
    const ok = await setAlignmentTeams(alignmentSetId, teamIds);
    if (ok) await refreshAlignmentDetails(alignmentSetId);
    return ok;
  };

  const handleSetGroupTeams = async (groupId: string, teamIds: string[]) => {
    const ok = await setGroupTeams(groupId, teamIds);
    if (ok && expandedAlignmentId) await refreshAlignmentDetails(expandedAlignmentId);
    return ok;
  };

  return (
    <>
      <Card
        className={className}
        title="Teams"
        action={
          <div className={styles.leagueTeamsActions}>
            <Button
              icon="add"
              size="sm"
              onClick={onAddTeam}
            >
              Create Team
            </Button>
            <SegmentedControl
              className={styles.teamsViewSwitch}
              value={view}
              onChange={(value) => setView(value as TeamsView)}
              options={[
                {
                  value: 'list',
                  label: <Icon name="view_list" />,
                  ariaLabel: 'Team list view',
                  tooltip: 'Team list',
                },
                {
                  value: 'alignments',
                  label: <Icon name="account_tree" />,
                  ariaLabel: 'Team alignments view',
                  tooltip: 'Team alignments',
                },
              ]}
            />
          </div>
        }
      >
        {view === 'list' ? (
          <SearchableList
            items={teams}
            filterFn={(t, q) =>
              t.name.toLowerCase().includes(q.toLowerCase()) ||
              t.code.toLowerCase().includes(q.toLowerCase())
            }
            renderItems={(filtered) => (
              <ul className={styles.teamList}>
                {filtered.map((t) => {
                  const teamHref = buildTeamDetailsPath({
                    leagueCode: league.code,
                    leagueId: league.id,
                    teamCode: t.code,
                    teamId: t.id,
                  });
                  return (
                    <ListItem
                      key={t.id}
                      image={t.logo}
                      eyebrow={t.place_name || ''}
                      name={t.team_name || ''}
                      variant="plain"
                      rightContent={{ type: 'code', value: t.code }}
                      primaryColor={t.primary_color}
                      textColor={t.text_color}
                      href={teamHref}
                      actions={
                        [
                          {
                            icon: 'open_in_new',
                            intent: 'accent',
                            tooltip: 'View team',
                            onClick: () => navigate(teamHref),
                          },
                          {
                            icon: 'edit',
                            intent: 'neutral',
                            tooltip: 'Edit',
                            disabled: busy === t.id,
                            onClick: () => onEditTeam(t),
                          },
                          {
                            icon: 'delete',
                            intent: 'danger',
                            tooltip: 'Delete',
                            disabled: busy === t.id,
                            onClick: () => onDeleteTeam(t),
                          },
                        ] satisfies ListItemAction[]
                      }
                    />
                  );
                })}
              </ul>
            )}
            placeholder="Search teams..."
            loading={loading}
            emptyMessage="No teams assigned to this league yet."
            noResultsMessage={(q) => `No teams match "${q}".`}
          />
        ) : (
          <div className={styles.alignmentSetStack}>
            <div className={styles.alignmentViewHeader}>
              <div>
                <h3>Team Alignments</h3>
                <p>Reusable team structures that seasons can select.</p>
              </div>
              <Button
                icon="add"
                size="sm"
                variant="outlined"
                intent="neutral"
                onClick={() => setCreateModalOpen(true)}
              >
                New Alignment
              </Button>
            </div>
            {alignmentsLoading ? (
              <p className={styles.emptyMsg}>Loading...</p>
            ) : alignmentSets.length === 0 ? (
              <div className={styles.alignmentEmptyState}>
                <p className={styles.emptyMsg}>No alignment sets yet.</p>
                <Button
                  icon="add"
                  size="sm"
                  onClick={() => setCreateModalOpen(true)}
                >
                  New Alignment
                </Button>
              </div>
            ) : (
              alignmentSets.map((alignmentSet) => (
                <AlignmentPanel
                  key={alignmentSet.id}
                  alignmentSet={alignmentSet}
                  expanded={expandedAlignmentId === alignmentSet.id}
                  busy={alignmentBusy}
                  details={alignmentDetails[alignmentSet.id] ?? null}
                  leagueTeams={teams}
                  onEdit={() =>
                    setExpandedAlignmentId((current) =>
                      current === alignmentSet.id ? null : alignmentSet.id,
                    )
                  }
                  onDelete={() => setConfirmDelete(alignmentSet)}
                  onSave={handleSaveAlignment}
                  onSetAlignmentTeams={handleSetAlignmentTeams}
                  onSetGroupTeams={handleSetGroupTeams}
                />
              ))
            )}
          </div>
        )}
      </Card>

      <Modal
        open={createModalOpen}
        title="New Alignment"
        onClose={() => setCreateModalOpen(false)}
        confirmLabel={isSubmitting || !!alignmentBusy ? 'Creating...' : 'Create'}
        confirmDisabled={isSubmitting || !!alignmentBusy || !isValid}
        busy={isSubmitting || !!alignmentBusy}
        onConfirm={onCreateAlignment}
      >
        <div className={styles.alignmentSetForm}>
          <Field
            label="Name"
            control={control}
            name="name"
            placeholder={defaultName(selectedStructure)}
            disabled={isSubmitting || !!alignmentBusy}
            autoFocus
          />
          <Field
            type="select"
            label="Structure"
            control={control}
            name="structure_type"
            options={STRUCTURE_OPTIONS}
            disabled={isSubmitting || !!alignmentBusy}
            onChange={(value) => {
              const next = value as GroupAlignmentStructureType;
              if (!watch('name').trim()) setValue('name', defaultName(next));
            }}
          />
        </div>
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
          if (ok) setConfirmDelete(null);
        }}
      />
    </>
  );
};

export default LeagueTeamsTab;
