import { useState } from 'react';
import ActionOverlay from '../../../components/ActionOverlay/ActionOverlay';
import Button from '../../../components/Button/Button';
import Card from '../../../components/Card/Card';
import Icon from '../../../components/Icon/Icon';
import { type SeasonGroupRecord } from '../../../hooks/useSeasonDetails';
import styles from './SeasonDetails.module.scss';

// ── GroupNode ─────────────────────────────────────────────────────────────────

interface GroupNodeProps {
  group: SeasonGroupRecord;
  allGroups: SeasonGroupRecord[];
  busy: string | null;
  onOverride: (group: SeasonGroupRecord) => void;
  onReset: (groupId: string) => void;
  depth?: number;
}

const GroupNode = (props: GroupNodeProps) => {
  const { group, allGroups, busy, onOverride, onReset, depth = 0 } = props;
  const [open, setOpen] = useState(true);

  const children = allGroups
    .filter((g) => g.parent_id === group.id)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  const isLeaf = children.length === 0;
  const isBusy = busy === group.id;

  return (
    <li className={[styles.groupItem, depth > 0 ? styles.groupItemChild : ''].filter(Boolean).join(' ')}>
      {/* Group header row */}
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

        {/* Override / Default badge */}
        <span className={group.has_season_override ? styles.badgeOverride : styles.badgeDefault}>
          {group.has_season_override ? 'Season' : 'Default'}
        </span>

        <ActionOverlay className={styles.groupActions}>
          <Button
            variant="outlined"
            intent="accent"
            icon="edit"
            size="sm"
            disabled={isBusy}
            tooltip="Override season teams"
            onClick={() => onOverride(group)}
          />
          {group.has_season_override && (
            <Button
              variant="outlined"
              intent="neutral"
              icon="restart_alt"
              size="sm"
              disabled={isBusy}
              tooltip="Reset to default teams"
              onClick={() => onReset(group.id)}
            />
          )}
        </ActionOverlay>
      </div>

      {/* Team list (shown when expanded and leaf group) */}
      {open && isLeaf && group.teams.length > 0 && (
        <ul className={styles.teamList}>
          {group.teams.map((t) => (
            <li key={t.id} className={styles.teamListItem}>
              {t.logo ? (
                <img src={t.logo} alt="" className={styles.teamLogoThumb} />
              ) : (
                <span className={styles.teamLogoPlaceholder}>{t.code.slice(0, 3)}</span>
              )}
              <span className={styles.teamListName}>{t.name}</span>
              <span className={styles.teamCode}>{t.code}</span>
            </li>
          ))}
        </ul>
      )}

      {open && isLeaf && group.teams.length === 0 && (
        <p className={styles.emptyMsg}>No teams assigned.</p>
      )}

      {/* Child groups */}
      {open && children.length > 0 && (
        <ul className={styles.groupList}>
          {children.map((child) => (
            <GroupNode
              key={child.id}
              group={child}
              allGroups={allGroups}
              busy={busy}
              onOverride={onOverride}
              onReset={onReset}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

// ── Card ──────────────────────────────────────────────────────────────────────

interface Props {
  groups: SeasonGroupRecord[];
  loading: boolean;
  busy: string | null;
  onOverride: (group: SeasonGroupRecord) => void;
  onReset: (groupId: string) => void;
  className?: string;
}

const SeasonGroupsCard = (props: Props) => {
  const { groups, loading, busy, onOverride, onReset, className } = props;

  const roots = groups
    .filter((g) => g.parent_id === null)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  return (
    <Card className={className} title="Groups">
      {loading ? (
        <p className={styles.emptyMsg}>Loading…</p>
      ) : roots.length === 0 ? (
        <p className={styles.emptyMsg}>
          No groups set up for this league yet. Create groups from the league's Teams tab.
        </p>
      ) : (
        <ul className={styles.groupList}>
          {roots.map((g) => (
            <GroupNode
              key={g.id}
              group={g}
              allGroups={groups}
              busy={busy}
              onOverride={onOverride}
              onReset={onReset}
            />
          ))}
        </ul>
      )}
    </Card>
  );
};

export default SeasonGroupsCard;
