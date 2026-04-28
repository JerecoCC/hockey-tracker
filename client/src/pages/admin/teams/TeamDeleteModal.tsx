import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import { TeamRecord } from '@/hooks/useTeams';

interface Props {
  open: boolean;
  busy: string | null;
  target: TeamRecord | null;
  onCancel: () => void;
  onConfirm: () => void;
}

const TeamDeleteModal = (props: Props) => {
  const { open, busy, target, onCancel, onConfirm } = props;
  return (
    <ConfirmModal
      open={open}
      title="Delete Team"
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
};

export default TeamDeleteModal;
