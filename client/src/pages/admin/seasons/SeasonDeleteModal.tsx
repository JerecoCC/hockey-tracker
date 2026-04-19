import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal';
import { SeasonRecord } from '../../../hooks/useSeasons';

interface Props {
  open: boolean;
  busy: string | null;
  target: SeasonRecord | null;
  onCancel: () => void;
  onConfirm: () => void;
}

const SeasonDeleteModal = (props: Props) => {
  const { open, busy, target, onCancel, onConfirm } = props;
  return (
    <ConfirmModal
      open={open}
      title="Delete Season"
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

export default SeasonDeleteModal;
