import { useState } from 'react';
import Accordion, { type AccordionAction } from '@/components/Accordion/Accordion';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import Icon from '@/components/Icon/Icon';
import ListItem, { type ListItemAction } from '@/components/ListItem/ListItem';
import {
  type CreateGroupData,
  type GroupRecord,
  type GroupTeamRecord,
} from '@/hooks/useLeagueGroups';
import { type TeamRecord } from '@/hooks/useTeams';
import styles from './LeagueDetails.module.scss';

// ── Inline add / edit row ────────────────────────────────────────────────────

type InlineMode =
  | { type: 'add'; parentId: string | null }
  | { type: 'edit'; groupId: string }
  | null;

interface InlineInputProps {
  initialValue?: string;
  placeholder?: string;
  onConfirm: (name: string) => Promise<void>;
  onCancel: () => void;
}

const InlineInput = (props: InlineInputProps) => {
  const { initialValue = '', placeholder = 'Group name…', onConfirm, onCancel } = props;
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    const trimmed = value.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    await onConfirm(trimmed);
    setSaving(false);
  };

  return (
    <div className={styles.groupInlineRow}>
      <input
        className={styles.groupInlineInput}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        autoFocus
        disabled={saving}
        onKeyDown={(e) => {
          if (e.key === 'Enter') confirm();
          if (e.key === 'Escape') onCancel();
        }}
      />
      <button
        className={styles.groupInlineBtn}
        onClick={confirm}
        disabled={saving || !value.trim()}
        aria-label="Confirm"
      >
        <Icon
          name="check"
          size="0.85em"
        />
      </button>
      <button
        className={`${styles.groupInlineBtn} ${styles.groupInlineBtnCancel}`}
        onClick={onCancel}
        disabled={saving}
        aria-label="Cancel"
      >
        <Icon
          name="close"
          size="0.85em"
        />
      </button>
    </div>
  );
};

interface Props {
  leagueId: string;
  teams: TeamRecord[];
  groups: GroupRecord[];
  loading: boolean;
  busy: string | null;
  addGroup: (data: CreateGroupData) => Promise<boolean>;
  updateGroup: (
    id: string,
    payload: Partial<Omit<CreateGroupData, 'league_id'>>,
  ) => Promise<boolean>;
  onAddTeam: (group: GroupRecord) => void;
  onCreateTeam: () => void;
  onEditTeam: (teamId: string) => void;
  onViewTeam: (teamId: string) => void;
  onDelete: (group: GroupRecord) => void;
  onDeleteTeam: (teamId: string) => Promise<void>;
  className?: string;
}

// ── GroupNode ────────────────────────────────────────────────────────────────

type GroupRole = 'conference' | 'division' | null;

const ROLE_CYCLE: GroupRole[] = [null, 'conference', 'division'];
const ROLE_LABELS: Record<string, string> = { conference: 'Conference', division: 'Division' };

interface GroupNodeProps {
  group: GroupRecord;
  allGroups: GroupRecord[];
  busy: string | null;
  inlineMode: InlineMode;
  onStartEdit: (groupId: string) => void;
  onStartAdd: (parentId: string) => void;
  onConfirm: (name: string) => Promise<void>;
  onCancel: () => void;
  onAddTeam: (g: GroupRecord) => void;
  onDelete: (g: GroupRecord) => void;
  onDeleteTeam: (teamId: string) => Promise<void>;
  onEditTeam: (teamId: string) => void;
  onViewTeam: (teamId: string) => void;
  onSetRole: (groupId: string, role: GroupRole) => Promise<void>;
  depth?: number;
}

const GroupNode = (props: GroupNodeProps) => {
  const {
    group,
    allGroups,
    busy,
    inlineMode,
    onStartEdit,
    onStartAdd,
    onConfirm,
    onCancel,
    onAddTeam,
    onDelete,
    onDeleteTeam,
    onEditTeam,
    onViewTeam,
    onSetRole,
    depth = 0,
  } = props;
  const [confirmDeleteTeam, setConfirmDeleteTeam] = useState<GroupTeamRecord | null>(null);
  const [isDeletingTeam, setIsDeletingTeam] = useState(false);

  const children = allGroups
    .filter((g) => g.parent_id === group.id)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  const isEditing = inlineMode?.type === 'edit' && inlineMode.groupId === group.id;
  const isAddingChild = inlineMode?.type === 'add' && inlineMode.parentId === group.id;
  const isLeaf = children.length === 0;

  const handleCycleRole = () => {
    const idx = ROLE_CYCLE.indexOf(group.role as GroupRole);
    const next = ROLE_CYCLE[(idx + 1) % ROLE_CYCLE.length];
    onSetRole(group.id, next);
  };

  const roleLabel = group.role ? ROLE_LABELS[group.role] : null;

  return (
    <li className={styles.groupItem}>
      {isEditing ? (
        <InlineInput
          initialValue={group.name}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      ) : (
        <Accordion
          className={depth > 0 ? styles.groupItemChild : undefined}
          label={
            <span className={styles.groupLabel}>
              {group.name}
              {roleLabel && (
                <span
                  className={`${styles.groupRoleBadge} ${styles[`groupRoleBadge_${group.role}`]}`}
                >
                  {roleLabel}
                </span>
              )}
            </span>
          }
          hoverActions={
            [
              depth === 0 && !isAddingChild && group.teams.length === 0
                ? {
                    icon: 'folder_plus',
                    intent: 'neutral' as const,
                    tooltip: 'Create Sub-group',
                    onClick: () => onStartAdd(group.id),
                  }
                : null,
              {
                icon: 'label',
                intent: 'neutral' as const,
                disabled: busy === group.id,
                tooltip: group.role
                  ? `Role: ${ROLE_LABELS[group.role]} (click to change)`
                  : 'Set playoff role',
                onClick: handleCycleRole,
              },
              {
                icon: 'edit',
                intent: 'accent' as const,
                disabled: busy === group.id,
                tooltip: 'Edit',
                onClick: () => onStartEdit(group.id),
              },
              {
                icon: 'delete',
                intent: 'danger' as const,
                disabled: busy === group.id,
                tooltip: 'Delete',
                onClick: () => onDelete(group),
              },
            ].filter(Boolean) as AccordionAction[]
          }
        >
          {group.teams.length > 0 && (
            <ul className={styles.teamList}>
              {group.teams.map((t) => (
                <ListItem
                  key={t.id}
                  image={t.logo}
                  name={t.name}
                  rightContent={{ type: 'code', value: t.code }}
                  primaryColor={t.primary_color}
                  textColor={t.text_color}
                  actions={
                    [
                      {
                        icon: 'open_in_new',
                        intent: 'neutral',
                        tooltip: 'View team',
                        onClick: () => onViewTeam(t.id),
                      },
                      {
                        icon: 'edit',
                        intent: 'accent',
                        tooltip: 'Edit team',
                        onClick: () => onEditTeam(t.id),
                      },
                      {
                        icon: 'delete',
                        intent: 'danger',
                        tooltip: 'Delete team',
                        onClick: () => setConfirmDeleteTeam(t),
                      },
                    ] satisfies ListItemAction[]
                  }
                />
              ))}
            </ul>
          )}

          {isLeaf && !isAddingChild && (
            <div className={styles.groupFooter}>
              <Button
                icon="add"
                size="sm"
                variant="outlined"
                intent="neutral"
                onClick={() => onAddTeam(group)}
              >
                Create Team
              </Button>
            </div>
          )}

          {isAddingChild && (
            <div className={styles.groupItemNew}>
              <InlineInput
                placeholder="Sub-group name…"
                onConfirm={onConfirm}
                onCancel={onCancel}
              />
            </div>
          )}

          {children.length > 0 && (
            <div className={styles.groupNestedList}>
              <ul className={styles.groupList}>
                {children.map((child) => (
                  <GroupNode
                    key={child.id}
                    group={child}
                    allGroups={allGroups}
                    busy={busy}
                    inlineMode={inlineMode}
                    onStartEdit={onStartEdit}
                    onStartAdd={onStartAdd}
                    onConfirm={onConfirm}
                    onCancel={onCancel}
                    onAddTeam={onAddTeam}
                    onDelete={onDelete}
                    onDeleteTeam={onDeleteTeam}
                    onEditTeam={onEditTeam}
                    onViewTeam={onViewTeam}
                    onSetRole={onSetRole}
                    depth={depth + 1}
                  />
                ))}
              </ul>
            </div>
          )}
        </Accordion>
      )}

      <ConfirmModal
        open={confirmDeleteTeam !== null}
        title="Delete Team"
        body={
          <>
            Are you sure you want to delete <strong>{confirmDeleteTeam?.name}</strong>? This cannot
            be undone.
          </>
        }
        confirmLabel={isDeletingTeam ? 'Deleting…' : 'Delete'}
        confirmIcon="delete"
        variant="danger"
        busy={isDeletingTeam}
        onCancel={() => setConfirmDeleteTeam(null)}
        onConfirm={async () => {
          if (!confirmDeleteTeam) return;
          setIsDeletingTeam(true);
          await onDeleteTeam(confirmDeleteTeam.id);
          setIsDeletingTeam(false);
          setConfirmDeleteTeam(null);
        }}
      />
    </li>
  );
};

// ── Card ─────────────────────────────────────────────────────────────────────

const LeagueGroupsCard = (props: Props) => {
  const {
    leagueId,
    teams,
    groups,
    loading,
    busy,
    addGroup,
    updateGroup,
    onAddTeam,
    onCreateTeam,
    onEditTeam,
    onViewTeam,
    onDelete,
    onDeleteTeam,
    className,
  } = props;
  const [inlineMode, setInlineMode] = useState<InlineMode>(null);
  const [confirmDeleteUngrouped, setConfirmDeleteUngrouped] = useState<TeamRecord | null>(null);
  const [isDeletingUngrouped, setIsDeletingUngrouped] = useState(false);

  const roots = groups
    .filter((g) => g.parent_id === null)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  const groupedTeamIds = new Set(groups.flatMap((g) => g.teams.map((t) => t.id)));
  const ungroupedTeams = teams.filter((t) => !groupedTeamIds.has(t.id));

  const handleConfirm = async (name: string) => {
    if (!inlineMode) return;
    const ok =
      inlineMode.type === 'add'
        ? await addGroup({ league_id: leagueId, name, parent_id: inlineMode.parentId })
        : await updateGroup(inlineMode.groupId, { name });
    if (ok) setInlineMode(null);
  };
  const handleCancel = () => setInlineMode(null);

  const handleSetRole = async (groupId: string, role: GroupRole) => {
    await updateGroup(groupId, { role });
  };

  const isRootAdding = inlineMode?.type === 'add' && inlineMode.parentId === null;

  return (
    <Card
      className={className}
      title="Teams"
      action={
        <Button
          icon="folder_plus"
          size="sm"
          onClick={() => setInlineMode({ type: 'add', parentId: null })}
        >
          Create Group
        </Button>
      }
    >
      {loading ? (
        <p className={styles.teamsEmpty}>Loading…</p>
      ) : (
        <>
          {isRootAdding && (
            <div
              className={`${styles.groupItem} ${styles.groupItemNew} ${styles.groupItemNewRoot}`}
            >
              <InlineInput
                placeholder="Group name…"
                onConfirm={handleConfirm}
                onCancel={handleCancel}
              />
            </div>
          )}
          {roots.length > 0 && (
            <ul className={styles.groupList}>
              {roots.map((g) => (
                <GroupNode
                  key={g.id}
                  group={g}
                  allGroups={groups}
                  busy={busy}
                  inlineMode={inlineMode}
                  onStartEdit={(id) => setInlineMode({ type: 'edit', groupId: id })}
                  onStartAdd={(pid) => setInlineMode({ type: 'add', parentId: pid })}
                  onConfirm={handleConfirm}
                  onCancel={handleCancel}
                  onAddTeam={onAddTeam}
                  onDelete={onDelete}
                  onDeleteTeam={onDeleteTeam}
                  onEditTeam={onEditTeam}
                  onViewTeam={onViewTeam}
                  onSetRole={handleSetRole}
                />
              ))}
            </ul>
          )}
          {!isRootAdding && roots.length === 0 && ungroupedTeams.length === 0 && (
            <div className={styles.emptyState}>
              <Button
                icon="add"
                size="sm"
                variant="outlined"
                intent="neutral"
                onClick={onCreateTeam}
              >
                Create Team
              </Button>
              <p className={styles.teamsEmpty}>
                No teams yet. Create a group to organise teams, or add a team directly.
              </p>
            </div>
          )}
        </>
      )}

      {!loading && ungroupedTeams.length > 0 && (
        <>
          {roots.length > 0 && <p className={styles.ungroupedLabel}>Unassigned</p>}
          <ul className={styles.teamList}>
            {ungroupedTeams.map((t) => (
              <ListItem
                key={t.id}
                image={t.logo}
                name={t.name}
                rightContent={{ type: 'code', value: t.code }}
                primaryColor={t.primary_color}
                textColor={t.text_color}
                actions={
                  [
                    {
                      icon: 'open_in_new',
                      intent: 'neutral',
                      tooltip: 'View team',
                      onClick: () => onViewTeam(t.id),
                    },
                    {
                      icon: 'edit',
                      intent: 'accent',
                      tooltip: 'Edit team',
                      onClick: () => onEditTeam(t.id),
                    },
                    {
                      icon: 'delete',
                      intent: 'danger',
                      tooltip: 'Delete team',
                      onClick: () => setConfirmDeleteUngrouped(t),
                    },
                  ] satisfies ListItemAction[]
                }
              />
            ))}
          </ul>
        </>
      )}

      <ConfirmModal
        open={confirmDeleteUngrouped !== null}
        title="Delete Team"
        body={
          <>
            Are you sure you want to delete <strong>{confirmDeleteUngrouped?.name}</strong>? This
            cannot be undone.
          </>
        }
        confirmLabel={isDeletingUngrouped ? 'Deleting…' : 'Delete'}
        confirmIcon="delete"
        variant="danger"
        busy={isDeletingUngrouped}
        onCancel={() => setConfirmDeleteUngrouped(null)}
        onConfirm={async () => {
          if (!confirmDeleteUngrouped) return;
          setIsDeletingUngrouped(true);
          await onDeleteTeam(confirmDeleteUngrouped.id);
          setIsDeletingUngrouped(false);
          setConfirmDeleteUngrouped(null);
        }}
      />
    </Card>
  );
};

export default LeagueGroupsCard;
