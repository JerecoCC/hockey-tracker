import { useEffect, useState, useCallback } from 'react';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../../../context/AuthContext';
import Icon from '../../../components/Icon/Icon';
import Table, { Column } from '../../../components/Table/Table';
import styles from './Users.module.scss';

const API = import.meta.env.VITE_API_URL || '/api';

interface UserRecord {
  id: string;
  display_name: string;
  email: string;
  role: 'admin' | 'user';
  is_google: boolean;
  created_at: string;
}

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

const apiError = (err: unknown, fallback: string): string =>
  (err as AxiosError<{ error: string }>).response?.data?.error ?? fallback;

const UsersPage = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const fetchUsers = useCallback(async (signal?: AbortSignal) => {
    try {
      const { data } = await axios.get<UserRecord[]>(`${API}/admin/users`, { headers: authHeaders(), signal });
      setUsers(data);
    } catch (err) {
      if (axios.isCancel(err)) return;
      toast.error(apiError(err, 'Failed to load users'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchUsers(controller.signal);
    return () => controller.abort();
  }, [fetchUsers]);

  const changeRole = async (id: string, role: 'admin' | 'user') => {
    setBusy(id);
    try {
      await axios.patch(`${API}/admin/users/${id}/role`, { role }, { headers: authHeaders() });
      await fetchUsers();
    } catch (err) {
      toast.error(apiError(err, 'Failed to update role'));
    } finally {
      setBusy(null);
    }
  };

  const deleteUser = async (id: string, name: string) => {
    if (!window.confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    setBusy(id);
    try {
      await axios.delete(`${API}/admin/users/${id}`, { headers: authHeaders() });
      await fetchUsers();
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete user'));
    } finally {
      setBusy(null);
    }
  };

  const columns: Column<UserRecord>[] = [
    { header: 'Name',  key: 'display_name' },
    { header: 'Email', key: 'email' },
    {
      type: 'custom',
      header: 'Role',
      render: (u) => (
        <span className={`${styles.badge} ${u.role === 'admin' ? styles.badgeAdmin : styles.badgeUser}`}>
          {u.role}
        </span>
      ),
    },
    {
      type: 'custom',
      header: 'Auth',
      render: (u) =>
        u.is_google
          ? <><Icon name="account_circle" size="1rem" style={{ color: '#4285F4', verticalAlign: '-0.2em' }} /> Google</>
          : <><Icon name="mail" size="1rem" style={{ color: '#64748b', verticalAlign: '-0.2em' }} /> Email</>,
    },
    { type: 'date', header: 'Joined', key: 'created_at' },
    {
      type: 'custom',
      header: 'Actions',
      render: (u) => {
        const isMe = u.id === user?.id;
        const isBusy = busy === u.id;
        return (
          <div className={styles.actions}>
            {u.role !== 'admin' && (
              <button className={styles.promoteBtn} disabled={isBusy} onClick={() => changeRole(u.id, 'admin')}>
                Make Admin
              </button>
            )}
            {u.role === 'admin' && !isMe && (
              <button className={styles.demoteBtn} disabled={isBusy} onClick={() => changeRole(u.id, 'user')}>
                Remove Admin
              </button>
            )}
            {!isMe && (
              <button className={styles.deleteBtn} disabled={isBusy} onClick={() => deleteUser(u.id, u.display_name)}>
                Delete
              </button>
            )}
            {isMe && <span style={{ color: '#64748b', fontSize: '0.8rem' }}>You</span>}
          </div>
        );
      },
    },
  ];

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

