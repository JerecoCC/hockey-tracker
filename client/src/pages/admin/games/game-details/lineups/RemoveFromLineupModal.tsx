import ConfirmModal from '@jerecocc/tracker-ui/components/ConfirmModal/ConfirmModal';
import { type GameRosterEntry } from '@/hooks/useGameRoster';

interface Props {
  entry: GameRosterEntry | null;
  /** Hides the confirm while the removal runs in the background. */
  hidden?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const RemoveFromLineupModal = ({ entry, hidden = false, onConfirm, onCancel }: Props) => (
  <ConfirmModal
    open={!!entry && !hidden}
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
    intent="danger"
    onConfirm={onConfirm}
    onCancel={onCancel}
  />
);

export default RemoveFromLineupModal;
