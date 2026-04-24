import { useEffect, useState } from 'react';
import Button from '../../../components/Button/Button';
import Modal from '../../../components/Modal/Modal';
import Select from '../../../components/Select/Select';
import { type LineupEntry, type LineupPositionSlot } from '../../../hooks/useGameLineup';
import { type TeamPlayerRecord } from '../../../hooks/useTeamPlayers';
import styles from './SetLineupModal.module.scss';

// Positions that count as "forwards" and are interchangeable for C/LW/RW slots
const FORWARD_POSITIONS = new Set(['C', 'LW', 'RW']);

interface Props {
  open: boolean;
  onClose: () => void;
  teamId: string;
  teamName: string;
  players: TeamPlayerRecord[];
  /** All lineup entries for the game — will be filtered to this team's entries. */
  lineup: LineupEntry[];
  saveTeamLineup: (
    teamId: string,
    slots: Array<{ position_slot: LineupPositionSlot; player_id: string | null }>,
  ) => Promise<boolean>;
}

type Draft = Record<LineupPositionSlot, string | null>;

const emptyDraft = (): Draft => ({ C: null, LW: null, RW: null, D1: null, D2: null, G: null });

/** Returns option list for a given slot based on position eligibility. */
const buildOptions = (
  slot: LineupPositionSlot,
  players: TeamPlayerRecord[],
): { value: string; label: string }[] => {
  const eligible = players.filter((p) => {
    const pos = p.position ?? '';
    if (slot === 'C' || slot === 'LW' || slot === 'RW') return FORWARD_POSITIONS.has(pos);
    if (slot === 'D1' || slot === 'D2') return pos === 'D';
    if (slot === 'G') return pos === 'G';
    return false;
  });
  return eligible.map((p) => ({
    value: p.id,
    label:
      p.jersey_number != null
        ? `#${p.jersey_number} ${p.first_name} ${p.last_name}`
        : `${p.first_name} ${p.last_name}`,
  }));
};

const SLOT_LABEL: Record<LineupPositionSlot, string> = {
  C: 'Center',
  LW: 'Left Wing',
  RW: 'Right Wing',
  D1: 'Defence',
  D2: 'Defence',
  G: 'Goalie',
};

const SetLineupModal = ({
  open,
  onClose,
  teamId,
  teamName,
  players,
  lineup,
  saveTeamLineup,
}: Props) => {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const allFilled = (Object.values(draft) as (string | null)[]).every(Boolean);

  // Sync draft from existing lineup when modal opens or lineup data changes
  useEffect(() => {
    if (!open) return;
    const next = emptyDraft();
    lineup
      .filter((e) => e.team_id === teamId)
      .forEach((e) => {
        next[e.position_slot] = e.player_id;
      });
    setDraft(next);
  }, [open, lineup, teamId]);

  const set = (slot: LineupPositionSlot, val: string) =>
    setDraft((prev) => ({ ...prev, [slot]: val || null }));

  const handleSave = async () => {
    if (!allFilled) return;
    setSaving(true);
    const slots = (Object.keys(draft) as LineupPositionSlot[]).map((slot) => ({
      position_slot: slot,
      player_id: draft[slot] ?? null,
    }));
    const ok = await saveTeamLineup(teamId, slots);
    setSaving(false);
    if (ok) onClose();
  };

  const handleClose = () => {
    if (!saving) onClose();
  };

  const slotSelect = (slot: LineupPositionSlot, label: string) => (
    <div className={styles.slotField}>
      <span className={styles.slotLabel}>{label}</span>
      <Select
        value={draft[slot] ?? ''}
        options={buildOptions(slot, players)}
        placeholder="— Required —"
        onChange={(val) => set(slot, val)}
      />
    </div>
  );

  return (
    <Modal
      open={open}
      title={`Set Starting Lineup — ${teamName}`}
      onClose={handleClose}
      size="md"
    >
      <div className={styles.grid}>
        {/* Row 1: Center */}
        <div className={styles.row}>{slotSelect('C', SLOT_LABEL.C)}</div>

        {/* Row 2: Left Wing + Right Wing */}
        <div className={styles.row}>
          {slotSelect('LW', SLOT_LABEL.LW)}
          {slotSelect('RW', SLOT_LABEL.RW)}
        </div>

        {/* Row 3: Defence 1 + Defence 2 */}
        <div className={styles.row}>
          {slotSelect('D1', `${SLOT_LABEL.D1} 1`)}
          {slotSelect('D2', `${SLOT_LABEL.D2} 2`)}
        </div>

        {/* Row 4: Goalie */}
        <div className={styles.row}>{slotSelect('G', SLOT_LABEL.G)}</div>
      </div>

      <div className={styles.footer}>
        <Button
          variant="outlined"
          intent="neutral"
          onClick={handleClose}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          intent="accent"
          icon="set_lineup"
          onClick={handleSave}
          disabled={saving || !allFilled}
        >
          {saving ? 'Saving…' : 'Save Lineup'}
        </Button>
      </div>
    </Modal>
  );
};

export default SetLineupModal;
