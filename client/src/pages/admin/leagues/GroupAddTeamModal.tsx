import { useEffect, useState } from 'react';
import Button from '@jerecocc/tracker-ui/components/Button/Button';
import Checklist from '@jerecocc/tracker-ui/components/Checklist/Checklist';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import useBackgroundModalAction from '@/hooks/useBackgroundModalAction';
import { type GroupRecord } from '@/hooks/useLeagueGroups';
import { type TeamRecord } from '@/hooks/useTeams';
import styles from './LeagueDetails.module.scss';

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
  // The modal hides while the teams are added behind a progress toast, and reappears with the
  // same teams ticked if that fails.
  const { hidden, runSettled } = useBackgroundModalAction({
    target: open ? (group?.id ?? 'group') : null,
    onDone: onClose,
  });

  // Reset selection each time the modal opens
  useEffect(() => {
    if (open) setSelectedIds(new Set());
  }, [open]);

  const toggle = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleAdd = () => {
    if (!group || selectedIds.size === 0 || hidden) return;
    // Merge new selections with the group's existing teams
    const currentIds = group.teams.map((t) => t.id);
    const merged = [...new Set([...currentIds, ...selectedIds])];
    const added = selectedIds.size;
    void runSettled(() => setGroupTeams(group.id, merged), {
      pending: `Adding ${added} team${added === 1 ? '' : 's'}…`,
    });
  };

  const count = selectedIds.size;
  const title = group ? `Add Teams to "${group.name}"` : 'Add Teams';

  return (
    <Modal
      open={open && !hidden}
      title={title}
      onClose={onClose}
    >
      <Checklist
        options={unassignedTeams.map((team) => ({
          id: team.id,
          image: team.logo,
          imageDark: team.logo_dark,
          imageLight: team.logo_light,
          imagePlaceholder: team.code.slice(0, 3),
          name: team.name,
          rightContent: <span className={styles.seasonListDates}>{team.code}</span>,
        }))}
        selectedIds={selectedIds}
        onToggle={(option) => toggle(option.id)}
        listClassName={styles.teamSelectList}
        emptyClassName={styles.teamsEmpty}
        emptyMessage="All teams in this league are already assigned to a group."
      />

      <div className={styles.formActions}>
        <Button
          variant="outlined"
          intent="neutral"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          disabled={count === 0}
          onClick={handleAdd}
        >
          {count === 0 ? 'Add Teams' : `Add ${count} Team${count === 1 ? '' : 's'}`}
        </Button>
      </div>
    </Modal>
  );
};

export default GroupAddTeamModal;
