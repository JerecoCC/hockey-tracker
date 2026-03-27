import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal';
import { LeagueRecord } from '../../../hooks/useLeagues';

interface Props {
  open: boolean;
  busy: string | null;
  target: LeagueRecord | null;
  onCancel: () => void;
  onConfirm: () => void;
}

const LeagueDeleteModal = ({ open, busy, target, onCancel, onConfirm }: Props) => (
  <ConfirmModal
    open={open}
    title="Delete League"
    body={
      <>
        Are you sure you want to delete <strong>{target?.name}</strong>? This cannot be undone.
      </>
    }
    confirmLabel={busy === target?.id ? 'Deleting…' : 'Delete'}
    confirmIcon="delete"
    variant="danger"
    busy={busy === target?.id}
    onCancel={onCancel}
    onConfirm={onConfirm}
  />
);

export default LeagueDeleteModal;
