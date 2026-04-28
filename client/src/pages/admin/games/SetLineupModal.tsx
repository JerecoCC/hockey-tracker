import { useEffect, useState } from 'react';
import Button from '@/components/Button/Button';
import Modal from '@/components/Modal/Modal';
import Select from '@/components/Select/Select';
import { type LineupEntry, type LineupPositionSlot } from '@/hooks/useGameLineup';
import { type TeamPlayerRecord } from '@/hooks/useTeamPlayers';
import styles from '@/pages/admin/games/SetLineupModal.module.scss';

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
  const [savedDraft, setSavedDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const allFilled = (Object.values(draft) as (string | null)[]).every(Boolean);
  const hasChanges = (Object.keys(draft) as LineupPositionSlot[]).some(
    (slot) => draft[slot] !== savedDraft[slot],
  );

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
    setSavedDraft(next);
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
    const ok = await saveTeamLineup(teamId, slots, teamName);
    setSaving(false);
    if (ok) onClose();
  };

  const handleClose = () => {
    if (!saving) onClose();
  };

  const isDraftEmpty = (Object.values(draft) as (string | null)[]).every((v) => v === null);
  const handleClear = () => setDraft(emptyDraft());

  const slotSelect = (slot: LineupPositionSlot, label: string) => (
    <div className={styles.slotField}>
      <span className={styles.slotLabel}>{label}</span>
      <Select
        value={draft[slot] ?? ''}
        options={buildOptions(slot, players)}
        placeholder="— Required —"
        onChange={(val) => set(slot, val)}
        searchable
      />
    </div>
  );

  return (
    <Modal
      open={open}
      title={`Set Starting Lineup — ${teamName}`}
      onClose={handleClose}
      size="md"
      onConfirm={handleSave}
      confirmLabel={saving ? 'Saving…' : 'Save Lineup'}
      confirmIcon="set_lineup"
      confirmDisabled={saving || !allFilled || !hasChanges}
      busy={saving}
      footerStart={
        <Button
          variant="outlined"
          intent="neutral"
          icon="clear_all"
          onClick={handleClear}
          disabled={saving || isDraftEmpty}
        >
          Clear
        </Button>
      }
    >
      <div className={styles.grid}>
        {/* Center — spans both columns */}
        <div className={styles.spanFull}>{slotSelect('C', SLOT_LABEL.C)}</div>

        {/* Left Wing + Right Wing — one column each */}
        {slotSelect('LW', SLOT_LABEL.LW)}
        {slotSelect('RW', SLOT_LABEL.RW)}

        {/* Defence 1 + Defence 2 — one column each */}
        {slotSelect('D1', `${SLOT_LABEL.D1} 1`)}
        {slotSelect('D2', `${SLOT_LABEL.D2} 2`)}

        {/* Goalie — spans both columns */}
        <div className={styles.spanFull}>{slotSelect('G', SLOT_LABEL.G)}</div>
      </div>
    </Modal>
  );
};

export default SetLineupModal;
