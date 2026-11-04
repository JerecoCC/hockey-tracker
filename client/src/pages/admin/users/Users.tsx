import { useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import Table from '@jerecocc/tracker-ui/components/Table/Table';
import useBackgroundModalAction from '@/hooks/useBackgroundModalAction';
import useUsers from '@/hooks/useUsers';
import { getUserColumns, UserRecord } from './columns';
import UserRoleModal, { RoleConfirm } from './UserRoleModal';
import UserDeleteModal from './UserDeleteModal';
import Card from '@jerecocc/tracker-ui/components/Card/Card';

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

  const closeRoleConfirm = () => {
    setRoleConfirmOpen(false);
    setRoleConfirm(null);
  };
  const closeDeleteConfirm = () => {
    setDeleteConfirmOpen(false);
    setDeleteConfirm(null);
  };
  // Role changes and deletions run behind a progress toast with their confirm dialog hidden;
  // the dialog reappears if the request fails.
  const { hidden: roleHidden, runSettled: runRoleChange } = useBackgroundModalAction({
    target: roleConfirmOpen ? (roleConfirm?.user.id ?? null) : null,
    onDone: closeRoleConfirm,
  });
  const { hidden: deleteHidden, runSettled: runDelete } = useBackgroundModalAction({
    target: deleteConfirmOpen ? (deleteConfirm?.id ?? null) : null,
    onDone: closeDeleteConfirm,
  });

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
    <>
      <Card>
        <Table
          columns={columns}
          rows={sortedUsers}
          getRowKey={(u) => u.id}
          loading={loading}
          emptyMessage="No users found."
          activeSortKey={sortKey}
          sortDirection={sortDir}
          onSort={handleSort}
        />
      </Card>

      <UserRoleModal
        open={roleConfirmOpen && !roleHidden}
        busy={busy}
        roleConfirm={roleConfirm}
        onCancel={closeRoleConfirm}
        onConfirm={() => {
          if (!roleConfirm) return;
          const { user: target, role } = roleConfirm;
          void runRoleChange(
            () => changeRole(target.id, role),
            {
              pending:
                role === 'admin'
                  ? `Making ${target.display_name} an admin…`
                  : `Removing admin access from ${target.display_name}…`,
            },
          );
        }}
      />

      <UserDeleteModal
        open={deleteConfirmOpen && !deleteHidden}
        busy={busy}
        target={deleteConfirm}
        onCancel={closeDeleteConfirm}
        onConfirm={() => {
          if (!deleteConfirm) return;
          const target = deleteConfirm;
          void runDelete(
            () => deleteUser(target.id),
            { pending: `Deleting ${target.display_name}…` },
          );
        }}
      />
    </>
  );
};

export default UsersPage;
