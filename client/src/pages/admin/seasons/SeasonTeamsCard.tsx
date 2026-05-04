import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import Field from '@/components/Field/Field';
import Accordion, { type AccordionAction } from '@/components/Accordion/Accordion';
import ListItem, { type ListItemAction } from '@/components/ListItem/ListItem';
import Badge from '@/components/Badge/Badge';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import Icon from '@/components/Icon/Icon';
import Modal from '@/components/Modal/Modal';
import { type LeagueTeam, type SeasonGroupRecord, type SeasonTeam } from '@/hooks/useSeasonDetails';
import SeasonTeamOverrideModal from './SeasonTeamOverrideModal';
import styles from './SeasonDetails.module.scss';

// ── Types ──────────────────────────────────────────────────────────────────────

type GroupRole = 'conference' | 'division' | null;

type GroupModalState =
  | { mode: 'add'; parentId: string | null }
  | { mode: 'edit'; group: SeasonGroupRecord }
  | null;

// ── Manage Season Teams modal (flat roster picker) ─────────────────────────────

interface PickerProps {
  open: boolean;
  /** IDs to pre-select when the modal opens. */
  preSelectedIds: string[];
  leagueTeams: LeagueTeam[];
  busy: boolean;
  onClose: () => void;
  onSave: (teamIds: string[]) => Promise<boolean>;
}

const ManageTeamsModal = ({
  open,
  preSelectedIds,
  leagueTeams,
  busy,
  onClose,
  onSave,
}: PickerProps) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) {
      setSelectedIds(new Set(preSelectedIds));
      setQuery('');
    }
  }, [open, preSelectedIds]);

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
        <>
          <div className={styles.teamSearch}>
            <Icon
              name="search"
              size="1em"
              className={styles.teamSearchIcon}
            />
            <input
              className={styles.teamSearchInput}
              type="text"
              placeholder="Search teams…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                className={styles.teamSearchClear}
                onClick={() => setQuery('')}
                aria-label="Clear search"
              >
                <Icon
                  name="close"
                  size="0.8em"
                />
              </button>
            )}
          </div>
          <ul className={styles.teamSelectList}>
            {leagueTeams
              .filter((t) => {
                const q = query.trim().toLowerCase();
                return !q || t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q);
              })
              .map((t) => {
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
                      <span
                        className={styles.teamLogoPlaceholder}
                        style={{ background: t.primary_color, color: t.text_color }}
                      >
                        {t.code.slice(0, 3)}
                      </span>
                    )}
                    <span className={styles.teamListName}>{t.name}</span>
                    <span className={styles.teamCode}>{t.code}</span>
                  </li>
                );
              })}
          </ul>
        </>
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

// ── Group form modal ───────────────────────────────────────────────────────────

interface GroupFormValues {
  name: string;
  role: 'conference' | 'division' | 'none';
}

const ROLE_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'conference', label: 'Conference' },
  { value: 'division', label: 'Division' },
];

const ROLE_LABELS: Record<string, string> = { conference: 'Conference', division: 'Division' };

interface GroupFormModalProps {
  open: boolean;
  /** The group being edited, or null when creating a new one. */
  editTarget: SeasonGroupRecord | null;
  /** Pre-set parent when adding a sub-group; null for top-level. */
  parentId: string | null;
  busy: boolean;
  onClose: () => void;
  onSave: (data: { name: string; role: GroupRole; parent_id: string | null }) => Promise<void>;
}

const GroupFormModal = ({
  open,
  editTarget,
  parentId,
  busy,
  onClose,
  onSave,
}: GroupFormModalProps) => {
  const isEdit = editTarget !== null;
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<GroupFormValues>({ defaultValues: { name: '', role: 'none' } });

  useEffect(() => {
    if (open) {
      reset({
        name: editTarget?.name ?? '',
        role: (editTarget?.role ?? 'none') as GroupFormValues['role'],
      });
    }
  }, [open, editTarget, reset]);

  const onSubmit = handleSubmit(async ({ name, role }) => {
    await onSave({
      name,
      role: role === 'none' ? null : role,
      parent_id: editTarget?.parent_id ?? parentId,
    });
  });

  return (
    <Modal
      open={open}
      title={isEdit ? 'Edit Group' : 'Create Group'}
      onClose={onClose}
      confirmLabel={isSubmitting || busy ? 'Saving…' : isEdit ? 'Save Changes' : 'Create'}
      confirmDisabled={isSubmitting || busy}
      busy={isSubmitting || busy}
      onConfirm={onSubmit}
    >
      <div className={styles.form}>
        <Field
          label="Name"
          required
          control={control}
          name="name"
          placeholder="e.g. Eastern Conference"
          rules={{ required: true }}
          disabled={isSubmitting || busy}
          autoFocus
        />
        <Field
          type="select"
          label="Playoff Role"
          control={control}
          name="role"
          options={ROLE_OPTIONS}
          disabled={isSubmitting || busy}
        />
      </div>
    </Modal>
  );
};

// ── GroupNode ──────────────────────────────────────────────────────────────────

interface GroupNodeProps {
  group: SeasonGroupRecord;
  allGroups: SeasonGroupRecord[];
  seasonBusy: string | null;
  groupBusy: string | null;
  isEnded: boolean;
  onEdit: (group: SeasonGroupRecord) => void;
  onAddChild: (parentId: string) => void;
  onSetTeams: (group: SeasonGroupRecord) => void;
  onResetTeams: (groupId: string) => void;
  onDeleteGroup: (group: SeasonGroupRecord) => void;
  depth?: number;
}

const GroupNode = ({
  group,
  allGroups,
  seasonBusy,
  groupBusy,
  isEnded,
  onEdit,
  onAddChild,
  onSetTeams,
  onResetTeams,
  onDeleteGroup,
  depth = 0,
}: GroupNodeProps) => {
  const children = allGroups
    .filter((g) => g.parent_id === group.id)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const isLeaf = children.length === 0;
  const roleLabel = group.role ? ROLE_LABELS[group.role] : null;

  return (
    <li className={styles.groupItem}>
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
        headerRight={
          <Badge
            label={
              group.has_season_override ? 'Season' : group.is_inherited ? 'Inherited' : 'Default'
            }
            intent={
              group.has_season_override ? 'accent' : group.is_inherited ? 'warning' : 'neutral'
            }
          />
        }
        hoverActions={
          [
            !isEnded && depth === 0 && children.length === 0
              ? {
                  icon: 'folder_plus',
                  intent: 'neutral' as const,
                  tooltip: 'Add sub-group',
                  onClick: () => onAddChild(group.id),
                }
              : null,
            !isEnded && isLeaf
              ? {
                  icon: 'groups',
                  intent: (group.has_season_override
                    ? 'accent'
                    : 'neutral') as AccordionAction['intent'],
                  disabled: !!seasonBusy,
                  tooltip: 'Assign teams',
                  onClick: () => onSetTeams(group),
                }
              : null,
            !isEnded && isLeaf && group.has_season_override
              ? {
                  icon: 'restart_alt',
                  intent: 'neutral' as const,
                  disabled: !!seasonBusy,
                  tooltip: 'Revert to default team list',
                  onClick: () => onResetTeams(group.id),
                }
              : null,
            {
              icon: 'edit',
              intent: 'accent' as const,
              disabled: groupBusy === group.id,
              tooltip: 'Edit group',
              onClick: () => onEdit(group),
            },
            {
              icon: 'delete',
              intent: 'danger' as const,
              disabled: groupBusy === group.id,
              tooltip: 'Delete group',
              onClick: () => onDeleteGroup(group),
            },
          ].filter(Boolean) as AccordionAction[]
        }
      >
        {isLeaf && group.teams.length > 0 && (
          <ul className={styles.teamList}>
            {group.teams.map((t) => (
              <ListItem
                key={t.id}
                image={t.logo}
                name={t.name}
                rightContent={{ type: 'code', value: t.code }}
                primaryColor={t.primary_color}
                textColor={t.text_color}
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
                <GroupNode
                  key={child.id}
                  group={child}
                  allGroups={allGroups}
                  seasonBusy={seasonBusy}
                  groupBusy={groupBusy}
                  isEnded={isEnded}
                  onEdit={onEdit}
                  onAddChild={onAddChild}
                  onSetTeams={onSetTeams}
                  onResetTeams={onResetTeams}
                  onDeleteGroup={onDeleteGroup}
                  depth={depth + 1}
                />
              ))}
            </ul>
          </div>
        )}
      </Accordion>
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
  /** When true the season is ended — all roster-editing actions are hidden. */
  isEnded: boolean;
  setSeasonTeams: (teamIds: string[]) => Promise<boolean>;
  setSeasonGroupTeams: (groupId: string, teamIds: string[]) => Promise<boolean>;
  resetSeasonGroupTeams: (groupId: string) => Promise<boolean>;
  addGroup: (data: {
    name: string;
    parent_id?: string | null;
    role?: GroupRole;
  }) => Promise<boolean>;
  updateGroup: (groupId: string, payload: { name?: string; role?: GroupRole }) => Promise<boolean>;
  onDeleteGroup: (group: SeasonGroupRecord) => void;
  className?: string;
}

const SeasonTeamsCard = ({
  seasonTeams,
  groups,
  leagueTeams,
  loading,
  busy,
  groupBusy,
  isEnded,
  setSeasonTeams,
  setSeasonGroupTeams,
  resetSeasonGroupTeams,
  addGroup,
  updateGroup,
  onDeleteGroup,
  className,
}: Props) => {
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [groupModal, setGroupModal] = useState<GroupModalState>(null);
  const [teamTarget, setTeamTarget] = useState<SeasonGroupRecord | null>(null);

  // ── Split auto group from user groups ────────────────────────────────────────
  const autoGroup = groups.find((g) => g.is_auto);
  const userGroups = groups.filter((g) => !g.is_auto);
  const userRoots = userGroups
    .filter((g) => g.parent_id === null)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  // Teams shown in the auto-group flat list
  const autoTeams = autoGroup?.teams ?? [];
  const isInherited = autoGroup?.is_inherited ?? false;

  // Pre-selection for the picker: auto group teams (if any), else inherited season teams
  const pickerPreSelectedIds = autoGroup
    ? autoGroup.teams.map((t) => t.id)
    : seasonTeams.map((t) => t.id);

  const handleRemoveAutoTeam = async (teamId: string) => {
    const next = autoTeams.filter((t) => t.id !== teamId).map((t) => t.id);
    await setSeasonTeams(next);
  };

  return (
    <>
      <Card
        className={className}
        title="Teams"
        action={
          <div className={styles.cardActions}>
            {/* "Manage Teams" — hidden once user groups exist or season is ended */}
            {!loading && !isEnded && userGroups.length === 0 && (
              <Button
                icon="group_add"
                size="sm"
                onClick={() => setPickerOpen(true)}
              >
                Manage Teams
              </Button>
            )}
            {/* "Create Group" — hidden once an auto group exists or season is ended */}
            {!loading && !isEnded && autoGroup === undefined && (
              <Button
                icon="folder_plus"
                size="sm"
                variant="outlined"
                intent="neutral"
                onClick={() => setGroupModal({ mode: 'add', parentId: null })}
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
            {/* ── Empty state ── */}
            {autoTeams.length === 0 && userGroups.length === 0 && (
              <p className={styles.emptyMsg}>
                No teams added to this season yet. Use &ldquo;Manage Teams&rdquo; to select teams
                from the league.
              </p>
            )}

            {/* ── Auto group: flat team list ── */}
            {autoTeams.length > 0 && (
              <>
                {isInherited && (
                  <p className={styles.inheritedBanner}>
                    <Icon
                      name="history"
                      size="1em"
                    />
                    Inherited from the previous season &mdash; use &ldquo;Manage Teams&rdquo; to set
                    this season&apos;s roster explicitly.
                  </p>
                )}
                <ul className={styles.teamList}>
                  {autoTeams.map((t) => (
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
                            onClick: () =>
                              navigate(`/admin/leagues/${autoGroup!.league_id}/teams/${t.id}`),
                          },
                          !isEnded && {
                            icon: 'remove_circle_outline',
                            intent: 'danger',
                            tooltip: 'Remove from season',
                            disabled: busy === 'season-teams',
                            onClick: () => handleRemoveAutoTeam(t.id),
                          },
                        ] satisfies (ListItemAction | false)[]
                      }
                    />
                  ))}
                </ul>
              </>
            )}

            {/* ── User groups section ── */}
            {userRoots.length > 0 && (
              <div className={styles.groupsSection}>
                <ul className={styles.groupList}>
                  {userRoots.map((g) => (
                    <GroupNode
                      key={g.id}
                      group={g}
                      allGroups={userGroups}
                      seasonBusy={busy}
                      groupBusy={groupBusy}
                      isEnded={isEnded}
                      onEdit={(group) => setGroupModal({ mode: 'edit', group })}
                      onAddChild={(parentId) => setGroupModal({ mode: 'add', parentId })}
                      onSetTeams={setTeamTarget}
                      onResetTeams={resetSeasonGroupTeams}
                      onDeleteGroup={onDeleteGroup}
                    />
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </Card>

      <GroupFormModal
        open={groupModal !== null}
        editTarget={groupModal?.mode === 'edit' ? groupModal.group : null}
        parentId={groupModal?.mode === 'add' ? groupModal.parentId : null}
        busy={!!groupBusy}
        onClose={() => setGroupModal(null)}
        onSave={async ({ name, role, parent_id }) => {
          const ok =
            groupModal?.mode === 'edit'
              ? await updateGroup(groupModal.group.id, { name, role })
              : await addGroup({ name, parent_id, role });
          if (ok) setGroupModal(null);
        }}
      />

      <ManageTeamsModal
        open={pickerOpen}
        preSelectedIds={pickerPreSelectedIds}
        leagueTeams={leagueTeams}
        busy={busy === 'season-teams'}
        onClose={() => setPickerOpen(false)}
        onSave={setSeasonTeams}
      />

      <SeasonTeamOverrideModal
        open={teamTarget !== null}
        group={teamTarget}
        groups={userGroups}
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
