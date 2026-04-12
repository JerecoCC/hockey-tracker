import { useState } from 'react';
import Button from '../../../components/Button/Button';
import Card from '../../../components/Card/Card';
import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal';
import Icon from '../../../components/Icon/Icon';
import {
  type CreateGroupData,
  type GroupRecord,
  type GroupTeamRecord,
} from '../../../hooks/useLeagueGroups';
import { type TeamRecord } from '../../../hooks/useTeams';
import styles from './LeagueDetails.module.scss';

// ── Inline add / edit row ────────────────────────────────────────────────────

type InlineMode =
  | { type: 'add'; parentId: string | null }
  | { type: 'edit'; groupId: string }
  | null;

const InlineInput = ({
  initialValue = '',
  placeholder = 'Group name…',
  onConfirm,
  onCancel,
}: {
  initialValue?: string;
  placeholder?: string;
  onConfirm: (name: string) => Promise<void>;
  onCancel: () => void;
}) => {
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
  updateGroup: (id: string, payload: { name: string }) => Promise<boolean>;
  onAddTeam: (group: GroupRecord) => void;
  onCreateTeam: () => void;
  onEditTeam: (teamId: string) => void;
  onViewTeam: (teamId: string) => void;
  onDelete: (group: GroupRecord) => void;
  onDeleteTeam: (teamId: string) => Promise<void>;
  className?: string;
}

// ── GroupNode ────────────────────────────────────────────────────────────────

const GroupNode = ({
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
  depth = 0,
}: {
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
  depth?: number;
}) => {
  const [open, setOpen] = useState(true);
  const [confirmDeleteTeam, setConfirmDeleteTeam] = useState<GroupTeamRecord | null>(null);
  const [isDeletingTeam, setIsDeletingTeam] = useState(false);

  const children = allGroups
    .filter((g) => g.parent_id === group.id)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  const isEditing = inlineMode?.type === 'edit' && inlineMode.groupId === group.id;
  const isAddingChild = inlineMode?.type === 'add' && inlineMode.parentId === group.id;
  const isLeaf = children.length === 0;

  return (
    <li className={`${styles.groupItem} ${depth > 0 ? styles.groupItemChild : ''}`}>
      {isEditing ? (
        <InlineInput
          initialValue={group.name}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      ) : (
        <div className={`${styles.groupRow} ${!open ? styles.groupRowCollapsed : ''}`}>
          <button
            className={styles.groupToggle}
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Collapse' : 'Expand'}
            aria-expanded={open}
          >
            <Icon
              name="expand_more"
              size="0.8em"
              className={open ? styles.groupToggleIconOpen : styles.groupToggleIcon}
            />
          </button>
          <span className={styles.groupName}>{group.name}</span>
          <span className={styles.groupActions}>
            {!isAddingChild && group.teams.length === 0 && (
              <Button
                variant="outlined"
                intent="neutral"
                icon="folder_plus"
                size="sm"
                tooltip="Create Sub-group"
                onClick={() => onStartAdd(group.id)}
              />
            )}
            <Button
              variant="outlined"
              intent="accent"
              icon="edit"
              size="sm"
              disabled={busy === group.id}
              tooltip="Edit"
              onClick={() => onStartEdit(group.id)}
            />
            <Button
              variant="outlined"
              intent="danger"
              icon="delete"
              size="sm"
              disabled={busy === group.id}
              tooltip="Delete"
              onClick={() => onDelete(group)}
            />
          </span>
        </div>
      )}

      {open && !isEditing && isLeaf && !isAddingChild && (
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

      {open && group.teams.length > 0 && !isEditing && (
        <ul className={styles.teamList}>
          {group.teams.map((t) => (
            <li
              key={t.id}
              className={styles.teamListItem}
            >
              {t.logo ? (
                <img
                  src={t.logo}
                  alt=""
                  className={styles.teamLogoThumb}
                />
              ) : (
                <span className={styles.teamLogoPlaceholder}>{t.code.slice(0, 3)}</span>
              )}
              <span className={styles.teamListName}>{t.name}</span>
              <span className={styles.seasonListDates}>{t.code}</span>
              <span className={styles.teamActions}>
                <Button
                  variant="outlined"
                  intent="neutral"
                  icon="open_in_new"
                  size="sm"
                  tooltip="View team"
                  onClick={() => onViewTeam(t.id)}
                />
                <Button
                  variant="outlined"
                  intent="accent"
                  icon="edit"
                  size="sm"
                  tooltip="Edit team"
                  onClick={() => onEditTeam(t.id)}
                />
                <Button
                  variant="outlined"
                  intent="danger"
                  icon="delete"
                  size="sm"
                  tooltip="Delete team"
                  onClick={() => setConfirmDeleteTeam(t)}
                />
              </span>
            </li>
          ))}
        </ul>
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

      {open && (children.length > 0 || isAddingChild) && (
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
              depth={depth + 1}
            />
          ))}
          {isAddingChild && (
            <li className={styles.groupItem}>
              <InlineInput
                placeholder="Sub-group name…"
                onConfirm={onConfirm}
                onCancel={onCancel}
              />
            </li>
          )}
        </ul>
      )}
    </li>
  );
};

// ── Card ─────────────────────────────────────────────────────────────────────

const LeagueGroupsCard = ({
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
}: Props) => {
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
            />
          ))}
          {isRootAdding && (
            <li className={styles.groupItem}>
              <InlineInput
                placeholder="Group name…"
                onConfirm={handleConfirm}
                onCancel={handleCancel}
              />
            </li>
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
        </ul>
      )}

      {!loading && ungroupedTeams.length > 0 && (
        <>
          {roots.length > 0 && <p className={styles.ungroupedLabel}>Unassigned</p>}
          <ul className={styles.teamList}>
            {ungroupedTeams.map((t) => (
              <li
                key={t.id}
                className={styles.teamListItem}
              >
                {t.logo ? (
                  <img
                    src={t.logo}
                    alt=""
                    className={styles.teamLogoThumb}
                  />
                ) : (
                  <span className={styles.teamLogoPlaceholder}>{t.code.slice(0, 3)}</span>
                )}
                <span className={styles.teamListName}>{t.name}</span>
                <span className={styles.seasonListDates}>{t.code}</span>
                <span className={styles.teamActions}>
                  <Button
                    variant="outlined"
                    intent="neutral"
                    icon="open_in_new"
                    size="sm"
                    tooltip="View team"
                    onClick={() => onViewTeam(t.id)}
                  />
                  <Button
                    variant="outlined"
                    intent="accent"
                    icon="edit"
                    size="sm"
                    tooltip="Edit team"
                    onClick={() => onEditTeam(t.id)}
                  />
                  <Button
                    variant="outlined"
                    intent="danger"
                    icon="delete"
                    size="sm"
                    tooltip="Delete team"
                    onClick={() => setConfirmDeleteUngrouped(t)}
                  />
                </span>
              </li>
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
