import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import Table from '../../../components/Table/Table';
import useUsers from '../../../hooks/useUsers';
import { getUserColumns, UserRecord } from './columns';
import UserRoleModal, { RoleConfirm } from './UserRoleModal';
import UserDeleteModal from './UserDeleteModal';
import styles from './Users.module.scss';

const UsersPage = () => {
  const { user } = useAuth();
  const { users, loading, busy, changeRole, deleteUser } = useUsers();
  const [roleConfirm, setRoleConfirm] = useState<RoleConfirm | null>(null);
  const [roleConfirmOpen, setRoleConfirmOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<UserRecord | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const confirmRole = (u: UserRecord, role: 'admin' | 'user') => { setRoleConfirm({ user: u, role }); setRoleConfirmOpen(true); };
  const confirmDelete = (u: UserRecord) => { setDeleteConfirm(u); setDeleteConfirmOpen(true); };

  const columns = getUserColumns({ currentUserId: user?.id, busy, confirmRole, confirmDelete });

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

      <UserRoleModal
        open={roleConfirmOpen}
        busy={busy}
        roleConfirm={roleConfirm}
        onCancel={() => { setRoleConfirmOpen(false); setRoleConfirm(null); }}
        onConfirm={async () => { await changeRole(roleConfirm!.user.id, roleConfirm!.role); setRoleConfirmOpen(false); setRoleConfirm(null); }}
      />

      <UserDeleteModal
        open={deleteConfirmOpen}
        busy={busy}
        target={deleteConfirm}
        onCancel={() => { setDeleteConfirmOpen(false); setDeleteConfirm(null); }}
        onConfirm={async () => { await deleteUser(deleteConfirm!.id); setDeleteConfirmOpen(false); setDeleteConfirm(null); }}
      />
    </main>
  );
};

export default UsersPage;

