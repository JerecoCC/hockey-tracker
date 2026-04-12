import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal';
import { UserRecord } from './columns';

interface Props {
  open: boolean;
  busy: string | null;
  target: UserRecord | null;
  onCancel: () => void;
  onConfirm: () => void;
}

const UserDeleteModal = (props: Props) => {
  const { open, busy, target, onCancel, onConfirm } = props;
  return (
    <ConfirmModal
      open={open}
      title="Delete User"
      body={
        <>
          Are you sure you want to delete <strong>{target?.display_name}</strong>? This cannot be
          undone.
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

export default UserDeleteModal;
