import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import Icon from '../../../components/Icon/Icon';
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

  const confirmRole = (u: UserRecord, role: 'admin' | 'user') => setRoleConfirm({ user: u, role });

  const columns = getUserColumns({ currentUserId: user?.id, busy, confirmRole, deleteUser });

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
        <div className={styles.overlay} onClick={() => setRoleConfirm(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{actionLabel}</h3>
              <button className={styles.closeBtn} onClick={() => setRoleConfirm(null)} type="button">
                <Icon name="close" size="1.2em" />
              </button>
            </div>
            <p className={styles.confirmBody}>
              {isPromote
                ? <>Grant admin access to <strong>{roleConfirm.user.display_name}</strong>?</>
                : <>Remove admin access from <strong>{roleConfirm.user.display_name}</strong>?</>}
            </p>
            <div className={styles.formActions}>
              <button className={styles.cancelBtn} onClick={() => setRoleConfirm(null)} type="button">
                Cancel
              </button>
              <button
                className={isPromote ? styles.confirmPromoteBtn : styles.confirmDemoteBtn}
                disabled={busy === roleConfirm.user.id}
                onClick={async () => {
                  await changeRole(roleConfirm.user.id, roleConfirm.role);
                  setRoleConfirm(null);
                }}
                type="button"
              >
                <Icon name={isPromote ? 'manage_accounts' : 'person_remove'} size="1em" />
                {busy === roleConfirm.user.id ? 'Saving…' : actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default UsersPage;

