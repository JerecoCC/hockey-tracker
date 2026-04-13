import { useEffect, useState } from 'react';
import ActionOverlay from '../../../components/ActionOverlay/ActionOverlay';
import Button from '../../../components/Button/Button';
import Card from '../../../components/Card/Card';
import Icon from '../../../components/Icon/Icon';
import Modal from '../../../components/Modal/Modal';
import {
  type LeagueTeam,
  type SeasonGroupRecord,
  type SeasonTeam,
} from '../../../hooks/useSeasonDetails';
import SeasonTeamOverrideModal from './SeasonTeamOverrideModal';
import styles from './SeasonDetails.module.scss';

// ── Types ──────────────────────────────────────────────────────────────────────

type InlineMode =
  | { type: 'add'; parentId: string | null }
  | { type: 'edit'; groupId: string }
  | null;

// ── Manage Season Teams modal (flat roster picker) ─────────────────────────────

interface PickerProps {
  open: boolean;
  seasonTeams: SeasonTeam[];
  leagueTeams: LeagueTeam[];
  busy: boolean;
  onClose: () => void;
  onSave: (teamIds: string[]) => Promise<boolean>;
}

const ManageTeamsModal = ({
  open,
  seasonTeams,
  leagueTeams,
  busy,
  onClose,
  onSave,
}: PickerProps) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) setSelectedIds(new Set(seasonTeams.map((t) => t.id)));
  }, [open, seasonTeams]);

  const toggle = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleSave = async () => {
    const ok = await onSave([...selectedIds]);
    if (ok) onClose();
  };

  return (
    <Modal
      open={open}
      title="Manage Season Teams"
      onClose={onClose}
    >
      {leagueTeams.length === 0 ? (
        <p className={styles.emptyMsg}>
          No teams in this league yet. Add teams from the league page.
        </p>
      ) : (
        <ul className={styles.teamSelectList}>
          {leagueTeams.map((t) => {
            const checked = selectedIds.has(t.id);
            return (
              <li
                key={t.id}
                className={styles.teamSelectItem}
                data-selected={checked}
                onClick={() => toggle(t.id)}
              >
                <span
                  className={styles.teamCheckbox}
                  data-checked={checked}
                >
                  {checked && (
                    <Icon
                      name="check"
                      size="0.7em"
                    />
                  )}
                </span>
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
                <span className={styles.teamCode}>{t.code}</span>
              </li>
            );
          })}
        </ul>
      )}
      <div className={styles.modalActions}>
        <Button
          variant="outlined"
          intent="neutral"
          onClick={onClose}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button
          disabled={busy || leagueTeams.length === 0}
          onClick={handleSave}
        >
          {busy ? 'Saving…' : `Save (${selectedIds.size} team${selectedIds.size === 1 ? '' : 's'})`}
        </Button>
      </div>
    </Modal>
  );
};

// ── Inline group name input ────────────────────────────────────────────────────

interface InlineInputProps {
  initialValue?: string;
  placeholder?: string;
  onConfirm: (name: string) => Promise<void>;
  onCancel: () => void;
}

const InlineInput = ({
  initialValue = '',
  placeholder = 'Group name…',
  onConfirm,
  onCancel,
}: InlineInputProps) => {
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

// ── GroupNode ──────────────────────────────────────────────────────────────────

interface GroupNodeProps {
  group: SeasonGroupRecord;
  allGroups: SeasonGroupRecord[];
  seasonBusy: string | null;
  groupBusy: string | null;
  inlineMode: InlineMode;
  onStartEdit: (groupId: string) => void;
  onStartAdd: (parentId: string) => void;
  onConfirm: (name: string) => Promise<void>;
  onCancel: () => void;
  onSetTeams: (group: SeasonGroupRecord) => void;
  onResetTeams: (groupId: string) => void;
  onDeleteGroup: (group: SeasonGroupRecord) => void;
  depth?: number;
}

const GroupNode = (props: GroupNodeProps) => {
  const {
    group,
    allGroups,
    seasonBusy,
    groupBusy,
    inlineMode,
    onStartEdit,
    onStartAdd,
    onConfirm,
    onCancel,
    onSetTeams,
    onResetTeams,
    onDeleteGroup,
    depth = 0,
  } = props;
  const [open, setOpen] = useState(true);

  const children = allGroups
    .filter((g) => g.parent_id === group.id)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const isEditing = inlineMode?.type === 'edit' && inlineMode.groupId === group.id;
  const isAddingChild = inlineMode?.type === 'add' && inlineMode.parentId === group.id;
  const isLeaf = children.length === 0;

  return (
    <li
      className={[styles.groupItem, depth > 0 ? styles.groupItemChild : '']
        .filter(Boolean)
        .join(' ')}
    >
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
          <span className={group.has_season_override ? styles.badgeOverride : styles.badgeDefault}>
            {group.has_season_override ? 'Season' : 'Default'}
          </span>
          <ActionOverlay className={styles.groupActions}>
            {depth === 0 && !isAddingChild && group.teams.length === 0 && (
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
              disabled={groupBusy === group.id}
              tooltip="Rename group"
              onClick={() => onStartEdit(group.id)}
            />
            <Button
              variant="outlined"
              intent="danger"
              icon="delete"
              size="sm"
              disabled={groupBusy === group.id}
              tooltip="Delete group"
              onClick={() => onDeleteGroup(group)}
            />
          </ActionOverlay>
        </div>
      )}

      {open && isLeaf && !isEditing && (
        <div className={styles.groupFooter}>
          <Button
            icon="groups"
            size="sm"
            variant="outlined"
            intent={group.has_season_override ? 'accent' : 'neutral'}
            disabled={seasonBusy === group.id}
            onClick={() => onSetTeams(group)}
          >
            Set Season Teams
          </Button>
          {group.has_season_override && (
            <Button
              icon="restart_alt"
              size="sm"
              variant="outlined"
              intent="neutral"
              disabled={seasonBusy === group.id}
              tooltip="Revert to default team list"
              onClick={() => onResetTeams(group.id)}
            />
          )}
        </div>
      )}

      {open && isLeaf && !isEditing && group.teams.length > 0 && (
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
              <span className={styles.teamCode}>{t.code}</span>
            </li>
          ))}
        </ul>
      )}
      {open && isLeaf && !isEditing && group.teams.length === 0 && (
        <p className={styles.emptyMsg}>No teams assigned to this group.</p>
      )}

      {open && (children.length > 0 || isAddingChild) && (
        <ul className={styles.groupList}>
          {children.map((child) => (
            <GroupNode
              key={child.id}
              group={child}
              allGroups={allGroups}
              seasonBusy={seasonBusy}
              groupBusy={groupBusy}
              inlineMode={inlineMode}
              onStartEdit={onStartEdit}
              onStartAdd={onStartAdd}
              onConfirm={onConfirm}
              onCancel={onCancel}
              onSetTeams={onSetTeams}
              onResetTeams={onResetTeams}
              onDeleteGroup={onDeleteGroup}
              depth={depth + 1}
            />
          ))}
          {isAddingChild && (
            <li className={`${styles.groupItem} ${styles.groupItemSpanFull}`}>
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

// ── Card ──────────────────────────────────────────────────────────────────────

interface Props {
  seasonTeams: SeasonTeam[];
  groups: SeasonGroupRecord[];
  leagueTeams: LeagueTeam[];
  loading: boolean;
  busy: string | null;
  groupBusy: string | null;
  setSeasonTeams: (teamIds: string[]) => Promise<boolean>;
  setSeasonGroupTeams: (groupId: string, teamIds: string[]) => Promise<boolean>;
  resetSeasonGroupTeams: (groupId: string) => Promise<boolean>;
  addGroup: (data: { name: string; parent_id?: string | null }) => Promise<boolean>;
  updateGroup: (groupId: string, payload: { name: string }) => Promise<boolean>;
  onDeleteGroup: (group: SeasonGroupRecord) => void;
  className?: string;
}

const SeasonTeamsCard = (props: Props) => {
  const {
    seasonTeams,
    groups,
    leagueTeams,
    loading,
    busy,
    groupBusy,
    setSeasonTeams,
    setSeasonGroupTeams,
    resetSeasonGroupTeams,
    addGroup,
    updateGroup,
    onDeleteGroup,
    className,
  } = props;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [inlineMode, setInlineMode] = useState<InlineMode>(null);
  const [teamTarget, setTeamTarget] = useState<SeasonGroupRecord | null>(null);

  const roots = groups
    .filter((g) => g.parent_id === null)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const isRootAdding = inlineMode?.type === 'add' && inlineMode.parentId === null;

  const handleRemove = async (teamId: string) => {
    const next = seasonTeams.filter((t) => t.id !== teamId).map((t) => t.id);
    await setSeasonTeams(next);
  };

  const handleGroupConfirm = async (name: string) => {
    if (!inlineMode) return;
    const ok =
      inlineMode.type === 'add'
        ? await addGroup({ name, parent_id: inlineMode.parentId })
        : await updateGroup(inlineMode.groupId, { name });
    if (ok) setInlineMode(null);
  };

  return (
    <>
      <Card
        className={className}
        title="Teams"
        action={
          <div className={styles.cardActions}>
            {groups.length === 0 && (
              <Button
                icon="group_add"
                size="sm"
                onClick={() => setPickerOpen(true)}
              >
                Manage Teams
              </Button>
            )}
            {seasonTeams.length === 0 && (
              <Button
                icon="folder_plus"
                size="sm"
                variant="outlined"
                intent="neutral"
                onClick={() => setInlineMode({ type: 'add', parentId: null })}
              >
                Create Group
              </Button>
            )}
          </div>
        }
      >
        {loading ? (
          <p className={styles.emptyMsg}>Loading…</p>
        ) : (
          <>
            {/* ── Season roster ── */}
            {seasonTeams.length === 0 ? (
              <p className={styles.emptyMsg}>
                No teams added to this season yet. Use &ldquo;Manage Teams&rdquo; to select teams
                from the league.
              </p>
            ) : (
              <ul className={styles.teamList}>
                {seasonTeams.map((t) => (
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
                    <span className={styles.teamCode}>{t.code}</span>
                    <ActionOverlay className={styles.teamActions}>
                      <Button
                        variant="outlined"
                        intent="danger"
                        icon="remove_circle_outline"
                        size="sm"
                        disabled={busy === 'season-teams'}
                        tooltip="Remove from season"
                        onClick={() => handleRemove(t.id)}
                      />
                    </ActionOverlay>
                  </li>
                ))}
              </ul>
            )}

            {/* ── Groups section ── */}
            {(roots.length > 0 || isRootAdding) && (
              <div className={styles.groupsSection}>
                <p className={styles.sectionLabel}>Groups</p>
                <ul className={styles.groupList}>
                  {roots.map((g) => (
                    <GroupNode
                      key={g.id}
                      group={g}
                      allGroups={groups}
                      seasonBusy={busy}
                      groupBusy={groupBusy}
                      inlineMode={inlineMode}
                      onStartEdit={(id) => setInlineMode({ type: 'edit', groupId: id })}
                      onStartAdd={(pid) => setInlineMode({ type: 'add', parentId: pid })}
                      onConfirm={handleGroupConfirm}
                      onCancel={() => setInlineMode(null)}
                      onSetTeams={setTeamTarget}
                      onResetTeams={resetSeasonGroupTeams}
                      onDeleteGroup={onDeleteGroup}
                    />
                  ))}
                  {isRootAdding && (
                    <li className={`${styles.groupItem} ${styles.groupItemSpanFull}`}>
                      <InlineInput
                        placeholder="Group name…"
                        onConfirm={handleGroupConfirm}
                        onCancel={() => setInlineMode(null)}
                      />
                    </li>
                  )}
                </ul>
              </div>
            )}
          </>
        )}
      </Card>

      <ManageTeamsModal
        open={pickerOpen}
        seasonTeams={seasonTeams}
        leagueTeams={leagueTeams}
        busy={busy === 'season-teams'}
        onClose={() => setPickerOpen(false)}
        onSave={setSeasonTeams}
      />

      <SeasonTeamOverrideModal
        open={teamTarget !== null}
        group={teamTarget}
        leagueTeams={leagueTeams}
        onClose={() => setTeamTarget(null)}
        onSave={async (groupId, teamIds) => {
          const ok = await setSeasonGroupTeams(groupId, teamIds);
          if (ok) setTeamTarget(null);
          return ok;
        }}
      />
    </>
  );
};

export default SeasonTeamsCard;
