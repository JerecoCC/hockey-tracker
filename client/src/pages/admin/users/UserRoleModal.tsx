import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import { UserRecord } from './columns';

export interface RoleConfirm {
  user: UserRecord;
  role: 'admin' | 'user';
}

interface Props {
  open: boolean;
  busy: string | null;
  roleConfirm: RoleConfirm | null;
  onCancel: () => void;
  onConfirm: () => void;
}

const UserRoleModal = (props: Props) => {
  const { open, busy, roleConfirm, onCancel, onConfirm } = props;
  const isPromote = roleConfirm?.role === 'admin';
  const actionLabel = isPromote ? 'Make Admin' : 'Remove Admin';

  return (
    <ConfirmModal
      open={open}
      title={actionLabel}
      body={
        isPromote ? (
          <>
            Grant admin access to <strong>{roleConfirm?.user.display_name}</strong>?
          </>
        ) : (
          <>
            Remove admin access from <strong>{roleConfirm?.user.display_name}</strong>?
          </>
        )
      }
      confirmLabel={busy === roleConfirm?.user.id ? 'Saving…' : actionLabel}
      confirmIcon={isPromote ? 'manage_accounts' : 'person_remove'}
      variant={isPromote ? 'accent' : 'info'}
      busy={busy === roleConfirm?.user.id}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
};

export default UserRoleModal;
