import { useEffect, useState } from 'react';
import Button from '@/components/Button/Button';
import Modal from '@/components/Modal/Modal';
import SelectableListItem from '@/components/SelectableListItem/SelectableListItem';
import { type GroupRecord } from '@/hooks/useLeagueGroups';
import { type TeamRecord } from '@/hooks/useTeams';
import styles from '@/pages/admin/leagues/LeagueDetails.module.scss';

interface Props {
  open: boolean;
  /** The group to add teams to. */
  group: GroupRecord | null;
  /** Teams in this league that are not yet assigned to any group. */
  unassignedTeams: TeamRecord[];
  onClose: () => void;
  setGroupTeams: (groupId: string, teamIds: string[]) => Promise<boolean>;
}

const GroupAddTeamModal = (props: Props) => {
  const { open, group, unassignedTeams, onClose, setGroupTeams } = props;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Reset selection each time the modal opens
  useEffect(() => {
    if (open) setSelectedIds(new Set());
  }, [open]);

  const toggle = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleAdd = async () => {
    if (!group || selectedIds.size === 0 || saving) return;
    setSaving(true);
    // Merge new selections with the group's existing teams
    const currentIds = group.teams.map((t) => t.id);
    const merged = [...new Set([...currentIds, ...selectedIds])];
    const ok = await setGroupTeams(group.id, merged);
    setSaving(false);
    if (ok) onClose();
  };

  const count = selectedIds.size;
  const title = group ? `Add Teams to "${group.name}"` : 'Add Teams';

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
    >
      {unassignedTeams.length === 0 ? (
        <p className={styles.teamsEmpty}>
          All teams in this league are already assigned to a group.
        </p>
      ) : (
        <ul className={styles.teamSelectList}>
          {unassignedTeams.map((t) => (
            <SelectableListItem
              key={t.id}
              checked={selectedIds.has(t.id)}
              onToggle={() => toggle(t.id)}
              image={t.logo}
              imagePlaceholder={t.code.slice(0, 3)}
              name={t.name}
              rightContent={<span className={styles.seasonListDates}>{t.code}</span>}
            />
          ))}
        </ul>
      )}

      <div className={styles.formActions}>
        <Button
          variant="outlined"
          intent="neutral"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          disabled={count === 0 || saving}
          onClick={handleAdd}
        >
          {saving
            ? 'Adding…'
            : count === 0
              ? 'Add Teams'
              : `Add ${count} Team${count === 1 ? '' : 's'}`}
        </Button>
      </div>
    </Modal>
  );
};

export default GroupAddTeamModal;
