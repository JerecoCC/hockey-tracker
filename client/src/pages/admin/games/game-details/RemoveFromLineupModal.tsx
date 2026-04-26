import ConfirmModal from '../../../../components/ConfirmModal/ConfirmModal';
import { type GameRosterEntry } from '../../../../hooks/useGameRoster';

interface Props {
  entry: GameRosterEntry | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const RemoveFromLineupModal = ({ entry, busy, onConfirm, onCancel }: Props) => (
  <ConfirmModal
    open={!!entry}
    title="Remove from Lineup"
    body={
      entry ? (
        <>
          Remove{' '}
          <strong>
            {entry.first_name} {entry.last_name}
          </strong>{' '}
          from this game&apos;s lineup?
        </>
      ) : (
        ''
      )
    }
    confirmLabel="Remove"
    confirmIcon="person_remove"
    variant="danger"
    busy={busy}
    onConfirm={onConfirm}
    onCancel={onCancel}
  />
);

export default RemoveFromLineupModal;
