import { useEffect, useState } from 'react';
import Button from '../../../components/Button/Button';
import Icon from '../../../components/Icon/Icon';
import Modal from '../../../components/Modal/Modal';
import { type SeasonGroupRecord, type LeagueTeam } from '../../../hooks/useSeasonDetails';
import styles from './SeasonDetails.module.scss';

interface Props {
  open: boolean;
  /** The group whose season-specific teams are being set. */
  group: SeasonGroupRecord | null;
  /** All teams in the league. */
  leagueTeams: LeagueTeam[];
  onClose: () => void;
  onSave: (groupId: string, teamIds: string[]) => Promise<boolean>;
}

const SeasonTeamOverrideModal = (props: Props) => {
  const { open, group, leagueTeams, onClose, onSave } = props;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Pre-select the group's current season teams each time the modal opens
  useEffect(() => {
    if (open && group) {
      setSelectedIds(new Set(group.teams.map((t) => t.id)));
    }
  }, [open, group]);

  const toggle = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleSave = async () => {
    if (!group || saving) return;
    setSaving(true);
    const ok = await onSave(group.id, [...selectedIds]);
    setSaving(false);
    if (ok) onClose();
  };

  const title = group ? `Override Teams for "${group.name}"` : 'Override Teams';

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
    >
      {leagueTeams.length === 0 ? (
        <p className={styles.emptyMsg}>No teams in this league yet.</p>
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
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          disabled={saving || leagueTeams.length === 0}
          onClick={handleSave}
        >
          {saving ? 'Saving…' : `Save Override (${selectedIds.size} team${selectedIds.size === 1 ? '' : 's'})`}
        </Button>
      </div>
    </Modal>
  );
};

export default SeasonTeamOverrideModal;
