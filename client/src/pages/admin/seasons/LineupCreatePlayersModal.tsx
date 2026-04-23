import { useState } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import Button from '../../../components/Button/Button';
import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal';
import Field from '../../../components/Field/Field';
import Icon from '../../../components/Icon/Icon';
import Modal from '../../../components/Modal/Modal';
import { type PlayerPosition, type PlayerShoots } from '../../../hooks/useLeaguePlayers';
import styles from './LineupCreatePlayersModal.module.scss';

const POSITION_OPTIONS = [
  { value: 'C', label: 'Center' },
  { value: 'LW', label: 'Left Wing' },
  { value: 'RW', label: 'Right Wing' },
  { value: 'D', label: 'Defenseman' },
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
  jersey_number: '',
};

interface RowValues {
  first_name: string;
  last_name: string;
  position: PlayerPosition | '';
  shoots: PlayerShoots | '';
  jersey_number: string;
}

interface FormValues {
  players: RowValues[];
}

type CreateAndRosterFn = (
  teamId: string,
  seasonId: string,
  players: Array<{
    first_name: string;
    last_name: string;
    position: PlayerPosition;
    shoots: PlayerShoots;
    jersey_number?: number | null;
  }>,
) => Promise<boolean>;

interface Props {
  open: boolean;
  onClose: () => void;
  teamId: string;
  seasonId: string;
  teamName: string;
  createAndRosterPlayers: CreateAndRosterFn;
}

const LineupCreatePlayersModal = ({
  open,
  onClose,
  teamId,
  seasonId,
  teamName,
  createAndRosterPlayers,
}: Props) => {
  const [confirmRemoveIndex, setConfirmRemoveIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { control, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { players: [{ ...EMPTY_ROW }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'players' });
  const watchedPlayers = useWatch({ control, name: 'players' });

  const isRowDirty = (index: number) => {
    const row = watchedPlayers?.[index];
    return !!(row?.first_name || row?.last_name || row?.position || row?.shoots);
  };

  const handleDeleteClick = (index: number) => {
    if (isRowDirty(index)) setConfirmRemoveIndex(index);
    else remove(index);
  };

  const handleClose = () => {
    reset({ players: [{ ...EMPTY_ROW }] });
    onClose();
  };

  const onSubmit = handleSubmit(async (data) => {
    setIsSubmitting(true);
    const payload = data.players.map((row) => ({
      first_name: row.first_name,
      last_name: row.last_name,
      position: row.position as PlayerPosition,
      shoots: row.shoots as PlayerShoots,
      jersey_number: row.jersey_number !== '' ? Number(row.jersey_number) : null,
    }));
    const ok = await createAndRosterPlayers(teamId, seasonId, payload);
    setIsSubmitting(false);
    if (ok) handleClose();
  });

  return (
    <>
      <Modal
        open={open}
        title={`Create Players for ${teamName}`}
        size="lg"
        onClose={handleClose}
      >
        <form onSubmit={onSubmit}>
          <div className={styles.headerRow}>
            <span className={styles.headerCell}>#</span>
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
                  name={`players.${index}.jersey_number`}
                  placeholder="—"
                  disabled={isSubmitting}
                />
                <Field
                  control={control}
                  name={`players.${index}.first_name`}
                  required
                  rules={{ required: true }}
                  placeholder="First name"
                  disabled={isSubmitting}
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
              Add Player
            </Button>
          </div>

          <div className={styles.formActions}>
            <Button
              type="button"
              variant="outlined"
              intent="neutral"
              disabled={isSubmitting}
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              Save {fields.length} Player{fields.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={confirmRemoveIndex !== null}
        title="Remove player?"
        message="This row has data. Are you sure you want to remove it?"
        confirmLabel="Remove"
        onConfirm={() => {
          if (confirmRemoveIndex !== null) {
            remove(confirmRemoveIndex);
            setConfirmRemoveIndex(null);
          }
        }}
        onCancel={() => setConfirmRemoveIndex(null)}
      />
    </>
  );
};

export default LineupCreatePlayersModal;
