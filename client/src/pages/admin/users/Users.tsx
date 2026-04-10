import { useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import Table from '../../../components/Table/Table';
import useUsers from '../../../hooks/useUsers';
import { getUserColumns, UserRecord } from './columns';
import UserRoleModal, { RoleConfirm } from './UserRoleModal';
import UserDeleteModal from './UserDeleteModal';
import Card from '../../../components/Card/Card';
import styles from './Users.module.scss';

const sortRows = <T,>(data: T[], key: string, dir: 'asc' | 'desc'): T[] =>
  [...data].sort((a, b) => {
    const av = String((a as Record<string, unknown>)[key] ?? '');
    const bv = String((b as Record<string, unknown>)[key] ?? '');
    const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
    return dir === 'asc' ? cmp : -cmp;
  });

const UsersPage = () => {
  const { user } = useAuth();
  const { users, loading, busy, changeRole, deleteUser } = useUsers();
  const [roleConfirm, setRoleConfirm] = useState<RoleConfirm | null>(null);
  const [roleConfirmOpen, setRoleConfirmOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<UserRecord | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [sortKey, setSortKey] = useState('display_name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string, dir: 'asc' | 'desc') => {
    setSortKey(key);
    setSortDir(dir);
  };

  const confirmRole = (u: UserRecord, role: 'admin' | 'user') => {
    setRoleConfirm({ user: u, role });
    setRoleConfirmOpen(true);
  };
  const confirmDelete = (u: UserRecord) => {
    setDeleteConfirm(u);
    setDeleteConfirmOpen(true);
  };

  const columns = getUserColumns({ currentUserId: user?.id, busy, confirmRole, confirmDelete });
  const sortedUsers = useMemo(() => sortRows(users, sortKey, sortDir), [users, sortKey, sortDir]);

  return (
    <main className={styles.main}>
      <Card>
        <Table
          columns={columns}
          data={sortedUsers}
          rowKey={(u) => u.id}
          loading={loading}
          emptyMessage="No users found."
          activeSortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
        />
      </Card>

      <UserRoleModal
        open={roleConfirmOpen}
        busy={busy}
        roleConfirm={roleConfirm}
        onCancel={() => {
          setRoleConfirmOpen(false);
          setRoleConfirm(null);
        }}
        onConfirm={async () => {
          await changeRole(roleConfirm!.user.id, roleConfirm!.role);
          setRoleConfirmOpen(false);
          setRoleConfirm(null);
        }}
      />

      <UserDeleteModal
        open={deleteConfirmOpen}
        busy={busy}
        target={deleteConfirm}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setDeleteConfirm(null);
        }}
        onConfirm={async () => {
          await deleteUser(deleteConfirm!.id);
          setDeleteConfirmOpen(false);
          setDeleteConfirm(null);
        }}
      />
    </main>
  );
};

export default UsersPage;
