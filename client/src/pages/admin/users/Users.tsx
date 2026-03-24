import { useEffect, useState, useCallback } from 'react';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../../../context/AuthContext';
import AdminNav from '../../../components/AdminNav/AdminNav';
import Icon from '../../../components/Icon/Icon';
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

const Users = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await axios.get<UserRecord[]>(`${API}/admin/users`, { headers: authHeaders() });
      setUsers(data);
    } catch (err) {
      toast.error(apiError(err, 'Failed to load users'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

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

  return (
    <div className={styles.page}>
      <AdminNav />
      <main className={styles.main}>
        <h2 className={styles.sectionTitle}>Users</h2>

        <div className={styles.card}>
          <div className={styles.tableWrapper}>
            {loading ? (
              <div className={styles.loaderWrapper}>
                <span className={styles.spinner} />
                <p className={styles.loaderText}>Loading users…</p>
              </div>
            ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Auth</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className={styles.emptyMsg}>No users found.</td>
                  </tr>
                )}
                {users.map((u) => {
                  const isMe = u.id === user?.id;
                  const isBusy = busy === u.id;
                  return (
                    <tr key={u.id}>
                      <td>{u.display_name}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`${styles.badge} ${u.role === 'admin' ? styles.badgeAdmin : styles.badgeUser}`}>
                          {u.role}
                        </span>
                      </td>
                      <td>
                        {u.is_google
                          ? <><Icon name="account_circle" size="1rem" style={{ color: '#4285F4', verticalAlign: '-0.2em' }} /> Google</>
                          : <><Icon name="mail" size="1rem" style={{ color: '#64748b', verticalAlign: '-0.2em' }} /> Email</>
                        }
                      </td>
                      <td>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td>
                        <div className={styles.actions}>
                          {u.role !== 'admin' && (
                            <button
                              className={styles.promoteBtn}
                              disabled={isBusy}
                              onClick={() => changeRole(u.id, 'admin')}
                            >
                              Make Admin
                            </button>
                          )}
                          {u.role === 'admin' && !isMe && (
                            <button
                              className={styles.demoteBtn}
                              disabled={isBusy}
                              onClick={() => changeRole(u.id, 'user')}
                            >
                              Remove Admin
                            </button>
                          )}
                          {!isMe && (
                            <button
                              className={styles.deleteBtn}
                              disabled={isBusy}
                              onClick={() => deleteUser(u.id, u.display_name)}
                            >
                              Delete
                            </button>
                          )}
                          {isMe && <span style={{ color: '#64748b', fontSize: '0.8rem' }}>You</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Users;

