import { useState, useEffect } from 'react';
import Modal from '../../../../components/Modal/Modal';
import Select from '../../../../components/Select/Select';
import { type GameRosterEntry } from '../../../../hooks/useGameRoster';
import styles from '../GameDetailsPage.module.scss';

interface StarPayload {
  star1: string;
  star2: string;
  star3: string;
}

interface Props {
  open: boolean;
  /** true = editing stars on a finished game; false = end-game award flow */
  editMode: boolean;
  roster: GameRosterEntry[];
  busy: boolean;
  /** Pre-fill values used when editMode is true */
  initialStars?: { star1: string; star2: string; star3: string };
  onClose: () => void;
  /** Called in edit mode — save updated stars */
  onSave: (payload: StarPayload) => Promise<boolean>;
  /** Called in end-game mode — finalise the game with 3 stars */
  onEndGame: (payload: StarPayload) => Promise<boolean>;
}

const ThreeStarsModal = ({
  open,
  editMode,
  roster,
  busy,
  initialStars,
  onClose,
  onSave,
  onEndGame,
}: Props) => {
  const [star1Id, setStar1Id] = useState('');
  const [star2Id, setStar2Id] = useState('');
  const [star3Id, setStar3Id] = useState('');

  // Populate selections whenever the modal opens
  useEffect(() => {
    if (open) {
      setStar1Id(editMode && initialStars ? initialStars.star1 : '');
      setStar2Id(editMode && initialStars ? initialStars.star2 : '');
      setStar3Id(editMode && initialStars ? initialStars.star3 : '');
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const allPlayerOptions = roster.map((e) => ({
    value: e.player_id,
    label:
      e.jersey_number != null
        ? `#${e.jersey_number} ${e.first_name} ${e.last_name}`
        : `${e.first_name} ${e.last_name}`,
  }));

  const canConfirm = !!star1Id && !!star2Id && !!star3Id;

  const handleConfirm = async () => {
    const payload: StarPayload = { star1: star1Id, star2: star2Id, star3: star3Id };
    if (editMode) {
      const ok = await onSave(payload);
      if (ok) onClose();
    } else {
      const ok = await onEndGame(payload);
      if (ok) onClose();
    }
  };

  return (
    <Modal
      open={open}
      title={editMode ? 'Edit Three Stars' : 'End Game — 3 Stars'}
      onClose={onClose}
      confirmLabel={editMode ? (busy ? 'Saving…' : 'Save') : 'End Game'}
      confirmIcon={editMode ? 'save' : undefined}
      confirmDisabled={!canConfirm || busy}
      onConfirm={handleConfirm}
    >
      <div className={styles.goalForm}>
        <div className={styles.goalFormField}>
          <label className={styles.goalFormLabel}>1st Star</label>
          <Select
            value={star1Id || null}
            options={allPlayerOptions}
            placeholder="— Select player —"
            onChange={setStar1Id}
            searchable
            disabled={busy}
          />
        </div>
        <div className={styles.goalFormField}>
          <label className={styles.goalFormLabel}>2nd Star</label>
          <Select
            value={star2Id || null}
            options={allPlayerOptions}
            placeholder="— Select player —"
            onChange={setStar2Id}
            searchable
            disabled={busy}
          />
        </div>
        <div className={styles.goalFormField}>
          <label className={styles.goalFormLabel}>3rd Star</label>
          <Select
            value={star3Id || null}
            options={allPlayerOptions}
            placeholder="— Select player —"
            onChange={setStar3Id}
            searchable
            disabled={busy}
          />
        </div>
      </div>
    </Modal>
  );
};

export default ThreeStarsModal;
