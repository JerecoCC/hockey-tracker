import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal';
import Table from '../../../components/Table/Table';
import useUsers from '../../../hooks/useUsers';
import { getUserColumns, UserRecord } from './columns';
import styles from './Users.module.scss';

interface RoleConfirm {
  user: UserRecord;
  role: 'admin' | 'user';
}

const UsersPage = () => {
  const { user } = useAuth();
  const { users, loading, busy, changeRole, deleteUser } = useUsers();
  const [roleConfirm, setRoleConfirm] = useState<RoleConfirm | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<UserRecord | null>(null);

  const confirmRole = (u: UserRecord, role: 'admin' | 'user') => setRoleConfirm({ user: u, role });
  const confirmDelete = (u: UserRecord) => setDeleteConfirm(u);

  const columns = getUserColumns({ currentUserId: user?.id, busy, confirmRole, confirmDelete });

  const isPromote = roleConfirm?.role === 'admin';
  const actionLabel = isPromote ? 'Make Admin' : 'Remove Admin';

  return (
    <main className={styles.main}>
      <h2 className={styles.sectionTitle}>Users</h2>
      <div className={styles.card}>
        <Table
          columns={columns}
          data={users}
          rowKey={(u) => u.id}
          loading={loading}
          emptyMessage="No users found."
        />
      </div>

      {roleConfirm && (
        <ConfirmModal
          title={actionLabel}
          body={isPromote
            ? <>Grant admin access to <strong>{roleConfirm.user.display_name}</strong>?</>
            : <>Remove admin access from <strong>{roleConfirm.user.display_name}</strong>?</>}
          confirmLabel={busy === roleConfirm.user.id ? 'Saving…' : actionLabel}
          confirmIcon={isPromote ? 'manage_accounts' : 'person_remove'}
          variant={isPromote ? 'accent' : 'info'}
          busy={busy === roleConfirm.user.id}
          onCancel={() => setRoleConfirm(null)}
          onConfirm={async () => { await changeRole(roleConfirm.user.id, roleConfirm.role); setRoleConfirm(null); }}
        />
      )}

      {deleteConfirm && (
        <ConfirmModal
          title="Delete User"
          body={<>Are you sure you want to delete <strong>{deleteConfirm.display_name}</strong>? This cannot be undone.</>}
          confirmLabel={busy === deleteConfirm.id ? 'Deleting…' : 'Delete'}
          confirmIcon="delete"
          variant="danger"
          busy={busy === deleteConfirm.id}
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={async () => { await deleteUser(deleteConfirm.id); setDeleteConfirm(null); }}
        />
      )}
    </main>
  );
};

export default UsersPage;

