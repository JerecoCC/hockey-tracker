import { useState } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import Button from '@/components/Button/Button';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import Field from '@/components/Field/Field';
import Icon from '@/components/Icon/Icon';
import Modal from '@/components/Modal/Modal';
import {
  type BulkPlayerInput,
  type PlayerPosition,
  type PlayerShoots,
} from '@/hooks/useLeaguePlayers';
import styles from './BulkAddPlayersModal.module.scss';

const POSITION_OPTIONS = [
  { value: 'C', label: 'Center' },
  { value: 'LW', label: 'Left Wing' },
  { value: 'RW', label: 'Right Wing' },
  { value: 'D', label: 'Defense' },
  { value: 'G', label: 'Goalie' },
];

const SHOOTS_OPTIONS = [
  { value: 'L', label: 'Left' },
  { value: 'R', label: 'Right' },
];

const EMPTY_ROW = {
  first_name: '',
  last_name: '',
  position: '' as PlayerPosition | '',
  shoots: '' as PlayerShoots | '',
};

interface RowValues {
  first_name: string;
  last_name: string;
  position: PlayerPosition | '';
  shoots: PlayerShoots | '';
}

interface FormValues {
  players: RowValues[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  bulkAddPlayers: (players: BulkPlayerInput[]) => Promise<boolean>;
}

const BulkAddPlayersModal = ({ open, onClose, bulkAddPlayers }: Props) => {
  const [confirmRemoveIndex, setConfirmRemoveIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { control, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { players: [{ ...EMPTY_ROW }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'players' });

  // Live values — used to decide whether a row is "dirty" before confirming removal
  const watchedPlayers = useWatch({ control, name: 'players' });
  const isRowDirty = (index: number): boolean => {
    const row = watchedPlayers?.[index];
    return !!(row?.first_name || row?.last_name || row?.position || row?.shoots);
  };

  const handleDeleteClick = (index: number) => {
    if (isRowDirty(index)) {
      setConfirmRemoveIndex(index);
    } else {
      remove(index);
    }
  };

  const handleClose = () => {
    reset({ players: [{ ...EMPTY_ROW }] });
    onClose();
  };

  const onSubmit = handleSubmit(async (data) => {
    setIsSubmitting(true);
    const payload: BulkPlayerInput[] = data.players.map((row) => ({
      first_name: row.first_name,
      last_name: row.last_name,
      position: row.position as PlayerPosition,
      shoots: row.shoots as PlayerShoots,
    }));
    const ok = await bulkAddPlayers(payload);
    setIsSubmitting(false);
    if (ok) handleClose();
  });

  const handleConfirmRemove = () => {
    if (confirmRemoveIndex !== null) {
      remove(confirmRemoveIndex);
      setConfirmRemoveIndex(null);
    }
  };

  return (
    <>
      <Modal
        open={open}
        title="Bulk Create Players"
        size="lg"
        onClose={handleClose}
        confirmLabel={
          isSubmitting ? 'Saving…' : `Save ${fields.length} Player${fields.length !== 1 ? 's' : ''}`
        }
        confirmForm="bulk-add-players-form"
        confirmDisabled={isSubmitting}
        busy={isSubmitting}
      >
        <form
          id="bulk-add-players-form"
          onSubmit={onSubmit}
        >
          {/* Column headers */}
          <div className={styles.headerRow}>
            <span className={styles.headerCell}>First Name</span>
            <span className={styles.headerCell}>Last Name</span>
            <span className={styles.headerCell}>Position</span>
            <span className={styles.headerCell}>Shoots</span>
            <span />
          </div>

          <div className={styles.playerList}>
            {fields.map((field, index) => (
              <div
                key={field.id}
                className={styles.playerRow}
              >
                <Field
                  control={control}
                  name={`players.${index}.first_name`}
                  required
                  rules={{ required: true }}
                  placeholder="First name"
                  disabled={isSubmitting}
                  autoFocus={index === 0}
                />
                <Field
                  control={control}
                  name={`players.${index}.last_name`}
                  required
                  rules={{ required: true }}
                  placeholder="Last name"
                  disabled={isSubmitting}
                />
                <Field
                  type="select"
                  control={control}
                  name={`players.${index}.position`}
                  options={POSITION_OPTIONS}
                  required
                  rules={{ required: true }}
                  placeholder="Position"
                  disabled={isSubmitting}
                />
                <Field
                  type="select"
                  control={control}
                  name={`players.${index}.shoots`}
                  options={SHOOTS_OPTIONS}
                  required
                  rules={{ required: true }}
                  placeholder="Shoots"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => handleDeleteClick(index)}
                  disabled={isSubmitting}
                  aria-label="Remove player"
                >
                  <Icon
                    name="delete"
                    size="1em"
                  />
                </button>
              </div>
            ))}
          </div>

          <div className={styles.addRow}>
            <Button
              type="button"
              variant="ghost"
              intent="neutral"
              icon="add"
              size="sm"
              disabled={isSubmitting}
              onClick={() => append({ ...EMPTY_ROW })}
            >
              Create Player
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={confirmRemoveIndex !== null}
        title="Remove Player"
        body="Are you sure you want to remove this player from the list?"
        confirmLabel="Remove"
        confirmIcon="delete"
        variant="danger"
        onCancel={() => setConfirmRemoveIndex(null)}
        onConfirm={handleConfirmRemove}
      />
    </>
  );
};

export default BulkAddPlayersModal;
