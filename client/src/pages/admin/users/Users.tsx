import { useAuth } from '../../../context/AuthContext';
import Table from '../../../components/Table/Table';
import useUsers from '../../../hooks/useUsers';
import { getUserColumns } from './columns';
import styles from './Users.module.scss';

const UsersPage = () => {
  const { user } = useAuth();
  const { users, loading, busy, changeRole, deleteUser } = useUsers();
  const columns = getUserColumns({ currentUserId: user?.id, busy, changeRole, deleteUser });

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
    </main>
  );
};

export default UsersPage;

