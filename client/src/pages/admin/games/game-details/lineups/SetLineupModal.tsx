import { useEffect, useState } from 'react';
import Button from '@/components/Button/Button';
import Modal from '@/components/Modal/Modal';
import Select from '@/components/Select/Select';
import { type SelectOption } from '@/components/Select/Select';
import { type LineupEntry, type LineupPositionSlot } from '@/hooks/useGameLineup';
import { type TeamPlayerRecord } from '@/hooks/useTeamPlayers';
import styles from './SetLineupModal.module.scss';

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
    teamName?: string,
  ) => Promise<boolean>;
}

type Draft = Record<LineupPositionSlot, string | null>;

const emptyDraft = (): Draft => ({ F1: null, F2: null, F3: null, D1: null, D2: null, G: null });

const toOption = (p: TeamPlayerRecord): SelectOption => ({
  value: p.id,
  label:
    p.jersey_number != null
      ? `#${p.jersey_number} ${p.first_name} ${p.last_name}`
      : `${p.first_name} ${p.last_name}`,
});

/**
 * Builds the option list for a position slot.
 *
 * For G: only goalies.
 * For F1/F2/F3: forwards come first, then a divider, then all remaining non-goalies.
 * For D1/D2: defense players come first, then a divider, then the rest.
 */
const buildOptions = (slot: LineupPositionSlot, players: TeamPlayerRecord[]): SelectOption[] => {
  if (slot === 'G') return players.filter((p) => (p.position ?? '') === 'G').map(toOption);

  const isForwardSlot = slot === 'F1' || slot === 'F2' || slot === 'F3';
  const nonGoalies = players.filter((p) => (p.position ?? '') !== 'G');

  const primary = nonGoalies.filter((p) => {
    const pos = p.position ?? '';
    if (isForwardSlot) return pos === 'F' || pos === 'C' || pos === 'LW' || pos === 'RW';
    // D1 → LD + D, D2 → RD + D; either specific side also fits the other D slot
    if (slot === 'D1' || slot === 'D2') return pos === 'D' || pos === 'LD' || pos === 'RD';
    return false;
  });
  const rest = nonGoalies.filter((p) => !primary.includes(p));

  const result: SelectOption[] = primary.map(toOption);
  if (primary.length > 0 && rest.length > 0) result.push({ divider: true });
  result.push(...rest.map(toOption));
  return result;
};

const SLOT_LABEL: Record<LineupPositionSlot, string> = {
  F1: 'Forward 1',
  F2: 'Forward 2',
  F3: 'Forward 3',
  D1: 'Defense 1',
  D2: 'Defense 2',
  G: 'Goalie',
};

const duplicateLineupPlayerError = (draft: Draft) => {
  const playerSlots = new Map<string, LineupPositionSlot[]>();
  (Object.keys(draft) as LineupPositionSlot[]).forEach((slot) => {
    const playerId = draft[slot];
    if (!playerId) return;
    const slots = playerSlots.get(playerId) ?? [];
    slots.push(slot);
    playerSlots.set(playerId, slots);
  });

  for (const slots of playerSlots.values()) {
    if (slots.length > 1) {
      return `A player cannot be used in multiple starting lineup slots (${slots
        .map((slot) => SLOT_LABEL[slot])
        .join(', ')})`;
    }
  }

  return null;
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
  const duplicateError = duplicateLineupPlayerError(draft);

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

  const set = (slot: LineupPositionSlot, val: string) => {
    if (saving) return;
    setDraft((prev) => ({ ...prev, [slot]: val || null }));
  };

  const handleSave = async () => {
    if (!allFilled) return;
    if (duplicateError) return;
    setSaving(true);
    const slots = (Object.keys(draft) as LineupPositionSlot[]).map((slot) => ({
      position_slot: slot,
      player_id: draft[slot] ?? null,
    }));
    let ok = false;
    try {
      ok = await saveTeamLineup(teamId, slots, teamName);
    } finally {
      setSaving(false);
    }
    if (ok) onClose();
  };

  const handleClose = () => {
    if (!saving) onClose();
  };

  const isDraftEmpty = (Object.values(draft) as (string | null)[]).every((v) => v === null);
  const handleClear = () => {
    if (saving) return;
    setDraft(emptyDraft());
  };

  const slotSelect = (slot: LineupPositionSlot, label: string) => (
    <div className={styles.slotField}>
      <Select
        value={draft[slot] ?? ''}
        options={buildOptions(slot, players)}
        placeholder={label}
        onChange={(val) => set(slot, val)}
        searchable
        disabled={saving}
      />
    </div>
  );

  return (
    <Modal
      open={open}
      title={`Set Starting Lineup — ${teamName}`}
      onClose={handleClose}
      size="md"
      busy={saving}
      footer={
        <div className={styles.footerActions}>
          <Button
            variant="outlined"
            intent="danger"
            icon="clear_all"
            onClick={handleClear}
            disabled={saving || isDraftEmpty}
            className={styles.footerClear}
          >
            Clear
          </Button>
          <Button
            variant="outlined"
            intent="neutral"
            onClick={handleClose}
            type="button"
            disabled={saving}
            className={styles.footerCancel}
          >
            Cancel
          </Button>
          <Button
            intent="accent"
            icon="set_lineup"
            onClick={handleSave}
            type="button"
            disabled={saving || !allFilled || !hasChanges || !!duplicateError}
            className={styles.footerSave}
          >
            {saving ? 'Saving…' : 'Save Lineup'}
          </Button>
        </div>
      }
    >
      <div className={styles.lineupSlotList}>
        <div className={styles.lineupSlotGroup}>
          <span className={styles.slotGroupLabel}>
            Forwards <span className={styles.required}>*</span>
          </span>
          {slotSelect('F1', SLOT_LABEL.F1)}
          {slotSelect('F2', SLOT_LABEL.F2)}
          {slotSelect('F3', SLOT_LABEL.F3)}
        </div>

        <div className={styles.lineupSlotGroup}>
          <span className={styles.slotGroupLabel}>
            Defense <span className={styles.required}>*</span>
          </span>
          {slotSelect('D1', SLOT_LABEL.D1)}
          {slotSelect('D2', SLOT_LABEL.D2)}
        </div>

        <div className={styles.lineupSlotGroup}>
          <span className={styles.slotGroupLabel}>
            Goalie <span className={styles.required}>*</span>
          </span>
          {slotSelect('G', SLOT_LABEL.G)}
        </div>
      </div>
      {duplicateError && <p className={styles.error}>{duplicateError}</p>}
    </Modal>
  );
};

export default SetLineupModal;

